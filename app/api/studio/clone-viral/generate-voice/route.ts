import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

/**
 * Generate voice audio using ElevenLabs TTS via KIE.ai.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { text, voice_id = 'pNInz6obpgDQGcFmaJgB' } = body as {
      text: string
      voice_id?: string
    }

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Se requiere el texto' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.kie_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de KIE.ai en Settings' }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)

    const taskResponse = await fetch('https://api.kie.ai/api/v1/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': kieApiKey,
      },
      body: JSON.stringify({
        model: 'elevenlabs/text-to-speech',
        input: {
          text,
          voice_id,
          model_id: 'eleven_multilingual_v2',
        },
      }),
    })

    const taskData = await taskResponse.json()

    if (!taskData.data?.taskId) {
      console.error('[CloneViral/Voice] Task creation failed:', taskData)
      return NextResponse.json({ error: 'Error al crear tarea de voz' }, { status: 500 })
    }

    console.log(`[CloneViral/Voice] User: ${user.id.substring(0, 8)}..., TaskId: ${taskData.data.taskId}`)

    return NextResponse.json({
      success: true,
      taskId: taskData.data.taskId,
      status: 'processing',
    })

  } catch (error: any) {
    console.error('[CloneViral/Voice] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar voz' }, { status: 500 })
  }
}
