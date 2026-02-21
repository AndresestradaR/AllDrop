import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON } from '@/lib/services/ai-text'

export const maxDuration = 60

const TRANSCRIBE_SYSTEM = `Eres un experto en transcripción de audio/video. Transcribe el contenido hablado del video de forma precisa.

Responde SOLO en JSON válido:
{
  "transcript": "string (transcripción completa del audio)",
  "language": "string (idioma detectado, ej: es, en, pt)",
  "duration_estimate": "string (duración estimada del contenido hablado)"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { video_url } = body as { video_url: string }

    if (!video_url) {
      return NextResponse.json({ error: 'Se requiere URL del video' }, { status: 400 })
    }

    const keys = await getAIKeys(supabase, user.id)
    requireAIKeys(keys)

    // Download video and send as file
    const videoResponse = await fetch(video_url)
    const videoBuffer = await videoResponse.arrayBuffer()
    const base64Video = Buffer.from(videoBuffer).toString('base64')
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4'

    console.log(`[CloneViral/Transcribe] User: ${user.id.substring(0, 8)}..., Video size: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`)

    const responseText = await generateAIText(keys, {
      systemPrompt: TRANSCRIBE_SYSTEM,
      userMessage: 'Transcribe all spoken audio from this video accurately.',
      images: [{ mimeType: contentType, base64: base64Video }],
      temperature: 0.1,
      jsonMode: true,
    })

    let parsed: any
    try {
      parsed = JSON.parse(extractJSON(responseText))
    } catch {
      return NextResponse.json({ error: 'Error al transcribir' }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[CloneViral/Transcribe] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al transcribir' }, { status: 500 })
  }
}
