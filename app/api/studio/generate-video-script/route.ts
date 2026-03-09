import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON } from '@/lib/services/ai-text'

export const maxDuration = 60

const STANDALONE_SCRIPT_SYSTEM = `You are an expert UGC video director for Latin American e-commerce. You create scene-by-scene scripts optimized for AI video generation.

Each scene lasts EXACTLY 8 seconds (Veo 3.1 fixed duration). The total video is built by generating each scene independently and concatenating them.

OUTPUT FORMAT — You MUST respond with valid JSON only, no markdown, no backticks, no explanation:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "action": "What the content creator physically does in this scene",
      "dialogue": "Exact Spanish dialogue (informal Latin American Spanish)",
      "camera": "Camera angle and movement description",
      "sound": "Sound design notes (ambient, music mood, sound effects)",
      "veoPrompt": "English prompt for AI video generation, max 400 chars"
    }
  ]
}

NARRATIVE ARC — Adapt based on number of scenes requested:
- 3 scenes: Hook → Demo → CTA
- 4 scenes: Hook → Problema → Demo → CTA
- 5 scenes: Hook → Problema → Descubrimiento → Demo → CTA
- 6 scenes: Hook → Problema → Descubrimiento → Demo → Resultado → CTA

RULES:
1. "dialogue" MUST be in informal Latin American Spanish. Natural, conversational, like talking to a friend. Use "tu" not "usted". Include filler words like "mira", "literal", "te juro", "o sea".
2. "veoPrompt" MUST be in English (AI video models render better in English). Max 400 characters.
3. Every veoPrompt MUST describe the content creator generically (e.g. "a young content creator", "a person filming themselves"). Do NOT reference a specific person or influencer.
4. Every veoPrompt MUST include voice/speech instruction matching the voice gender. Format: "[Gender] voice speaking in Spanish: [key phrase from dialogue]"
5. Style: UGC aesthetic — handheld iPhone footage, natural lighting, casual real-life settings. NOT studio quality.
6. Camera directions: Use "handheld", "close-up", "medium shot", "POV", "slight pan", "tracking shot". Avoid complex movements.
7. First scene MUST grab attention in the first 2 seconds (pattern interrupt, surprising action, direct address to camera).
8. Last scene MUST have clear CTA with product visible and purchase motivation.
9. Each veoPrompt is SELF-CONTAINED — it must fully describe the scene without referencing other scenes.
10. Include the sales angle naturally woven into the dialogue, never forced or scripted-sounding.
11. Sound notes should enhance the mood: "upbeat background music", "satisfying product sound", "ambient cafe noise", etc.`

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { userId, supabase } = auth

    const body = await request.json()
    const {
      angle,
      productDescription,
      numberOfScenes = 4,
      voiceGender = 'femenina',
    } = body as {
      angle: { name: string; hook: string; salesAngle: string; tone: string }
      productDescription: string
      numberOfScenes: number
      voiceGender: string
    }

    if (!productDescription || !angle) {
      return NextResponse.json({ error: 'productDescription y angle son requeridos' }, { status: 400 })
    }

    const sceneCount = Math.max(3, Math.min(6, numberOfScenes))

    const keys = await getAIKeys(supabase, userId)
    requireAIKeys(keys)

    const voiceInstruction = voiceGender === 'masculina'
      ? 'Male voice speaking in Spanish with Latin American accent'
      : 'Female voice speaking in Spanish with Latin American accent'

    const userMessage = `VOICE GENDER: ${voiceGender} (use "${voiceInstruction}" in every veoPrompt)

PRODUCT DESCRIPTION:
${productDescription}

SALES ANGLE:
- Name: ${angle.name}
- Hook: ${angle.hook}
- Tone: ${angle.tone}
- Sales Message: ${angle.salesAngle}

NUMBER OF SCENES: ${sceneCount}

Generate exactly ${sceneCount} scenes following the narrative arc for ${sceneCount} scenes. Each scene is 8 seconds. Make the dialogue feel natural and the veoPrompts visually compelling. Use a generic content creator description (not a specific influencer).`

    const responseText = await generateAIText(keys, {
      systemPrompt: STANDALONE_SCRIPT_SYSTEM,
      userMessage,
      temperature: 0.8,
      jsonMode: true,
      skipKIE: true,
      googleModel: 'gemini-2.5-pro',
    })

    let result: any
    try {
      const cleaned = extractJSON(responseText)
      result = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[GenerateVideoScript] JSON parse error:', parseErr, 'Raw:', responseText.substring(0, 200))
      return NextResponse.json({ error: 'Error al generar guion: JSON invalido' }, { status: 500 })
    }

    if (!result.scenes || !Array.isArray(result.scenes) || result.scenes.length < 2) {
      return NextResponse.json({ error: 'Error al generar guion: estructura invalida' }, { status: 500 })
    }

    // Enforce constraints
    result.scenes = result.scenes.slice(0, 6).map((s: any, i: number) => ({
      sceneNumber: i + 1,
      action: String(s.action || '').substring(0, 300),
      dialogue: String(s.dialogue || '').substring(0, 500),
      camera: String(s.camera || '').substring(0, 200),
      sound: String(s.sound || '').substring(0, 200),
      veoPrompt: String(s.veoPrompt || '').substring(0, 400),
    }))

    console.log(`[GenerateVideoScript] Success, ${result.scenes.length} scenes`)

    return NextResponse.json({ success: true, scenes: result.scenes })

  } catch (error: any) {
    console.error('[GenerateVideoScript] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar guion' }, { status: 500 })
  }
}
