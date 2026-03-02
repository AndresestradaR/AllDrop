import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { decrypt } from '@/lib/services/encryption'
import { extendVeoVideo, VIDEO_MODELS } from '@/lib/video-providers'

export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { userId, supabase } = auth

    const body = await request.json()
    const { taskId, prompt, model } = body as {
      taskId: string
      prompt: string
      model?: 'veo3' | 'veo3_fast'
    }

    if (!taskId || !prompt) {
      return NextResponse.json(
        { error: 'taskId y prompt son requeridos' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', userId)
      .single()

    if (!profile?.kie_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de KIE.ai en Settings para extender videos',
      }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)

    console.log(`[Video/Extend] User: ${userId.substring(0, 8)}, TaskId: ${taskId}, Model: ${model || 'veo3_fast'}`)

    const result = await extendVeoVideo(taskId, prompt, kieApiKey, {
      model: model || 'veo3_fast',
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'No se pudo extender el video',
      }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      status: 'processing',
      message: 'Extension de video en proceso. Usa /api/studio/video-status para verificar.',
    })
  } catch (error: any) {
    console.error('[Video/Extend] Error:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al extender video',
    }, { status: 500 })
  }
}
