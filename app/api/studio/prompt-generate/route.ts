import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

const VIDEO_PROMPT_SYSTEM = `Eres un experto en generación de prompts para modelos de video IA (Kling, Veo, Sora, Wan, Luma, MiniMax, Hunyuan).

Tu trabajo es tomar una descripción en español y convertirla en un prompt cinematográfico optimizado EN INGLÉS para el modelo seleccionado.

## REGLAS:
1. El prompt final SIEMPRE va en inglés (los modelos funcionan mejor en inglés)
2. Incluir detalles de: movimiento de cámara, iluminación, composición, estilo visual
3. Adaptar el estilo al formato solicitado (UGC, profesional, producto, testimonial, ASMR, cinemático)
4. Considerar la duración del video para la complejidad del prompt
5. Si el modelo soporta audio, incluir indicaciones de sonido ambiente
6. Ser específico con movimientos: "slow dolly in", "tracking shot", "static close-up"
7. Para productos: enfatizar texturas, reflejos, detalles macro

## NOTAS POR MODELO:
- Kling 2.6/3.0: Excelente con personas, movimiento realista. Usar "cinematic, 4K, natural lighting"
- Veo 3.1: Cinematografía de alta calidad. Usar directivas de dirección de cine
- Sora 2: Creativo, buen con escenas complejas. Puede manejar narrativa
- Wan 2.6: Bueno para estilos artísticos. Soporta "fast" y "slow" motion
- Luma Dream Machine: Bueno con transiciones suaves
- MiniMax: Versátil, bueno con texto en video
- Hunyuan: Bueno con escenas de acción

Responde SOLO en JSON válido:
{
  "prompt": "string (el prompt optimizado en inglés, 1-3 párrafos)",
  "tips": ["string (3-5 tips específicos para este tipo de video)"],
  "model_specific_notes": "string (notas específicas para el modelo seleccionado)",
  "negative_prompt": "string (opcional, qué evitar)"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      description,
      model = 'kling',
      style = 'cinematic',
      duration = 5,
      with_audio = false,
    } = body as {
      description: string
      model?: string
      style?: string
      duration?: number
      with_audio?: boolean
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: 'La descripción es requerida' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de Google en Settings',
      }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)
    const genAI = new GoogleGenerativeAI(apiKey)
    const aiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: VIDEO_PROMPT_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    })

    const userPrompt = [
      `Descripción (español): ${description}`,
      `Modelo de video: ${model}`,
      `Estilo: ${style}`,
      `Duración: ${duration} segundos`,
      `Con audio: ${with_audio ? 'sí' : 'no'}`,
    ].join('\n')

    console.log(`[PromptGen] User: ${user.id.substring(0, 8)}..., Model: ${model}, Style: ${style}`)

    const result = await aiModel.generateContent(userPrompt)
    const responseText = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      console.error('[PromptGen] Failed to parse JSON:', responseText.substring(0, 500))
      return NextResponse.json({
        error: 'Error al procesar la respuesta. Intenta de nuevo.',
      }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[PromptGen] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al generar prompt',
    }, { status: 500 })
  }
}
