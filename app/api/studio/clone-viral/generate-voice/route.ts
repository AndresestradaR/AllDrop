import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

// Voces de ElevenLabs disponibles en KIE
// Lista completa en: https://elevenlabs.io/voice-library
const VOICES = {
  // Voces femeninas
  female: {
    default: 'Rachel',      // Americana, calmada
    alternative: 'Bella',    // Americana, suave
    latin: 'Charlotte',      // Versatil, expresiva
  },
  // Voces masculinas
  male: {
    default: 'Adam',         // Americana, profunda
    alternative: 'Antoni',   // Americana, bien modulada
    latin: 'Arnold',         // Profunda, clara
  },
}

/**
 * Generate voice audio using ElevenLabs TTS via KIE.ai.
 *
 * Docs: https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2
 *
 * Model: elevenlabs/text-to-speech-multilingual-v2
 * - Soporta 29 idiomas incluyendo español
 * - Usa "voice" (nombre) en vez de "voice_id"
 * - Params: stability, similarity_boost, style, speed, language_code
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      text,
      voice,           // nombre de voz (ej: "Rachel", "Adam")
      gender = 'female', // fallback para elegir voz por defecto
      speed = 1,
      language_code = 'es',  // español por defecto
    } = body as {
      text: string
      voice?: string
      gender?: 'male' | 'female'
      speed?: number
      language_code?: string
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

    // Seleccionar voz: usar la proporcionada o elegir por género
    const selectedVoice = voice || (gender === 'male' ? VOICES.male.default : VOICES.female.default)

    console.log(`[CloneViral/Voice] Voice: ${selectedVoice}, Language: ${language_code}, Speed: ${speed}`)
    console.log(`[CloneViral/Voice] Text preview: ${text.substring(0, 100)}...`)

    const taskResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        model: 'elevenlabs/text-to-speech-multilingual-v2',
        input: {
          text,
          voice: selectedVoice,
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          speed: speed,
          language_code: language_code,
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

    // Verificar error de KIE
    if (taskData.code && taskData.code !== 200) {
      console.error('[CloneViral/Voice] KIE error:', taskData.msg || taskData.message)
      return NextResponse.json({
        error: taskData.msg || taskData.message || 'Error en KIE al generar voz'
      }, { status: 500 })
    }

    const taskId = taskData.data?.taskId || taskData.taskId
    if (!taskId) {
      console.error('[CloneViral/Voice] No taskId in response:', JSON.stringify(taskData))
      return NextResponse.json({
        error: 'No se recibió taskId de KIE'
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
