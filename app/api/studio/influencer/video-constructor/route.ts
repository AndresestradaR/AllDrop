import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON } from '@/lib/services/ai-text'

export const maxDuration = 60

const CONSTRUCTOR_SYSTEM = `You are an expert UGC (User-Generated Content) video director specialized in creating multi-shot video narratives for dropshipping and e-commerce products targeting Latin American markets.

Your job: Given a product description, sales angles, a scenario, and an influencer's visual descriptor, generate a structured multi-shot video script optimized for Kling 3.0 AI video generation.

OUTPUT FORMAT — You MUST respond with valid JSON only, no markdown, no backticks, no explanation:
{
  "startFramePrompt": "Hyperrealistic photo prompt for the opening frame...",
  "endFramePrompt": "Hyperrealistic photo prompt for the closing frame...",
  "scenes": [
    { "prompt": "Scene description for video generation...", "duration": 4 },
    { "prompt": "Scene description...", "duration": 4 },
    { "prompt": "Scene description...", "duration": 3 }
  ]
}

RULES:
1. startFramePrompt: A detailed image generation prompt describing the influencer in the scenario BEFORE discovering the product. Include "Hyperrealistic photo of" + the visual descriptor. 200-400 chars.
2. endFramePrompt: A detailed image generation prompt describing the influencer at the END, happy, holding/showing the product to camera. Include "Hyperrealistic photo of" + the visual descriptor. 200-400 chars.
3. scenes: Array of 3-4 scene objects. Each scene has:
   - prompt: Video scene description. Include camera movements, emotions, actions. Max 500 chars. Write in English but include "speaks in Spanish with Latin American accent" when dialogue is involved.
   - duration: Integer seconds (1-12). Total of all durations MUST be between 3 and 15 seconds.
4. Narrative arc:
   - Scene 1: HOOK — The influencer shows a relatable problem or pain point. Grabs attention.
   - Scene 2: DISCOVERY — The influencer discovers/picks up the product. Shows interest.
   - Scene 3: TRANSFORMATION — The influencer uses/shows the product, demonstrates benefit.
   - Scene 4 (optional): CTA — Close-up of product, influencer invites viewer to buy.
5. Style: UGC aesthetic — natural, candid, iPhone-quality feel. Not overly polished.
6. Camera: Include camera directions like "medium shot", "close-up", "handheld feel", "slight zoom in".
7. The character ALWAYS speaks in Spanish. Include this in scene prompts where dialogue occurs.
8. Keep total duration realistic: 3-4 scenes, 3-15 seconds total.`

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { userId, supabase } = auth

    const body = await request.json()
    const {
      influencerId,
      productDescription,
      salesAngles,
      scenario,
      promptDescriptor,
      influencerName,
    } = body as {
      influencerId: string
      productDescription: string
      salesAngles: string
      scenario: string
      promptDescriptor: string
      influencerName: string
    }

    if (!influencerId || !productDescription) {
      return NextResponse.json({ error: 'influencerId y productDescription son requeridos' }, { status: 400 })
    }

    // Get AI keys
    const keys = await getAIKeys(supabase, userId)
    requireAIKeys(keys)

    const userMessage = `INFLUENCER VISUAL DESCRIPTOR:
${promptDescriptor || `A person called ${influencerName}`}

INFLUENCER NAME: ${influencerName || 'the influencer'}

PRODUCT:
${productDescription}

SALES ANGLES / PAIN POINTS:
${salesAngles || 'General product benefits'}

SCENARIO:
${scenario || 'at home, casual setting'}

Generate the structured multi-shot video script as JSON.`

    const responseText = await generateAIText(keys, {
      systemPrompt: CONSTRUCTOR_SYSTEM,
      userMessage,
      temperature: 0.7,
      jsonMode: true,
      kieModel: 'gemini-2.5-pro',
      googleModel: 'gemini-2.5-pro',
    })

    // Parse JSON response
    let result: any
    try {
      const cleaned = extractJSON(responseText)
      result = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error(`[VideoConstructor] JSON parse error:`, parseErr, 'Raw:', responseText.substring(0, 200))
      return NextResponse.json({ error: 'Error al generar: invalid JSON' }, { status: 500 })
    }

    // Validate structure
    if (!result.scenes || !Array.isArray(result.scenes) || result.scenes.length < 2) {
      return NextResponse.json({ error: 'Error al generar: invalid structure (no scenes)' }, { status: 500 })
    }

    // Enforce constraints
    result.scenes = result.scenes.slice(0, 5).map((s: any) => ({
      prompt: String(s.prompt || '').substring(0, 500),
      duration: Math.max(1, Math.min(12, Math.round(Number(s.duration) || 4))),
    }))

    const totalDuration = result.scenes.reduce((sum: number, s: any) => sum + s.duration, 0)
    if (totalDuration > 15) {
      // Scale down durations proportionally
      const scale = 15 / totalDuration
      result.scenes = result.scenes.map((s: any) => ({
        ...s,
        duration: Math.max(1, Math.round(s.duration * scale)),
      }))
    }
    if (totalDuration < 3 && result.scenes.length > 0) {
      result.scenes[0].duration = Math.max(result.scenes[0].duration, 3)
    }

    result.startFramePrompt = String(result.startFramePrompt || '').substring(0, 500)
    result.endFramePrompt = String(result.endFramePrompt || '').substring(0, 500)

    console.log(`[VideoConstructor] Success, ${result.scenes.length} scenes, total ${totalDuration}s`)

    return NextResponse.json({ success: true, result })

  } catch (error: any) {
    console.error('[VideoConstructor] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar' }, { status: 500 })
  }
}
