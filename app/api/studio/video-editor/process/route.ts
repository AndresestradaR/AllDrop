import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'

export const maxDuration = 30

const VIDEO_EDITOR_SERVICE_URL = process.env.VIDEO_EDITOR_SERVICE_URL || ''
const VIDEO_EDITOR_SECRET = process.env.VIDEO_EDITOR_SECRET || ''

interface ClipInput {
  url: string
  startTime: number
  endTime: number
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!VIDEO_EDITOR_SERVICE_URL || !VIDEO_EDITOR_SECRET) {
      return NextResponse.json(
        { error: 'Servicio de edicion no configurado' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { clips, musicUrl, voiceVolume = 1.0, musicVolume = 0.5 } = body as {
      clips: ClipInput[]
      musicUrl?: string
      voiceVolume?: number
      musicVolume?: number
    }

    if (!clips || clips.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un clip' }, { status: 400 })
    }

    if (clips.length > 10) {
      return NextResponse.json({ error: 'Maximo 10 clips' }, { status: 400 })
    }

    // Forward to Railway service
    const resp = await fetch(`${VIDEO_EDITOR_SERVICE_URL}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Editor-Secret': VIDEO_EDITOR_SECRET,
      },
      body: JSON.stringify({
        clips,
        musicUrl: musicUrl || null,
        voiceVolume,
        musicVolume,
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      return NextResponse.json(
        { error: data.detail || 'Error al procesar video' },
        { status: resp.status }
      )
    }

    return NextResponse.json({
      jobId: data.jobId,
      status: 'processing',
    })
  } catch (error: any) {
    console.error('[VideoEditor/process] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
