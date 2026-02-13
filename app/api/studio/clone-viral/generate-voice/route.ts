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
    const { text, voice_id = 'EXAVITQu4vr4xnSDxMaL' } = body as {
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

    // CORREGIDO: endpoint /jobs/createTask y header Authorization Bearer
    // (antes usaba /createTask con header api-key que ya no funciona)
    const taskResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
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

    const responseText = await taskResponse.text()
    console.log('[CloneViral/Voice] KIE Response:', taskResponse.status, responseText.substring(0, 500))

    let taskData: any
    try {
      taskData = JSON.parse(responseText)
    } catch (e) {
      console.error('[CloneViral/Voice] Invalid JSON response:', responseText.substring(0, 200))
      return NextResponse.json({ error: 'Respuesta inválida de KIE' }, { status: 500 })
    }

    // KIE puede devolver taskId en data.taskId o directamente en taskId
    const taskId = taskData.data?.taskId || taskData.taskId
    if (!taskId) {
      console.error('[CloneViral/Voice] No taskId in response:', JSON.stringify(taskData))
      return NextResponse.json({
        error: taskData.msg || taskData.message || 'Error al crear tarea de voz'
      }, { status: 500 })
    }

    console.log(`[CloneViral/Voice] User: ${user.id.substring(0, 8)}..., TaskId: ${taskId}`)

    return NextResponse.json({
      success: true,
      taskId,
      status: 'processing',
    })

  } catch (error: any) {
    console.error('[CloneViral/Voice] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar voz' }, { status: 500 })
  }
}
