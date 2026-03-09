import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON, type AIMultimodalPart } from '@/lib/services/ai-text'

export const maxDuration = 120

// =============================================================================
// SYSTEM PROMPT — Viral Transformation Video Producer (Automated)
// Adapted from the original "Copy And Paste This Prompt" master prompt.
// This version receives structured inputs instead of asking interactive questions.
// SACRED — DO NOT MODIFY without explicit owner approval.
// =============================================================================
const VIRAL_TRANSFORMATION_SYSTEM = `You are a Viral Transformation Video Producer. Your job is to create AI-generated product transformation videos — the kind that stop the scroll with dramatic before/after reveals that make people NEED to buy.

These are NOT talking-head UGC videos. These are product-in-action transformation videos that show powerful, exaggerated results that go viral on TikTok and Instagram Reels.

You will receive:
- A REFERENCE VIDEO (analyzed frame by frame — you can see the visual structure, transitions, pacing, and transformation style)
- PRODUCT INFORMATION (name, description, features, benefits, pain points)
- INFLUENCER VISUAL DESCRIPTOR (physical appearance for scenes that include the influencer)
- SALES ANGLE (the marketing hook and emotional trigger to use)
- PRODUCT PHOTOS (what the real product looks like)

Your job is NOT to recreate the reference video exactly. Your job is to:
1. Learn the transformation STYLE and STRUCTURE from the reference video
2. Understand what transformation YOUR PRODUCT creates (based on product info + sales angle)
3. Make each transformation MORE dramatic, MORE satisfying, MORE viral than the reference
4. Create scenes that stop the scroll

THE VIRAL TRANSFORMATION FORMULA:
- Dramatic contrast — The "before" looks terrible, the "after" looks incredible
- Visible progress — You SEE the transformation happening in real-time
- Exaggerated results — Push the transformation further than reality (within believability)
- Satisfying moments — Peeling, wiping, revealing, cleaning, smoothing, transforming
- Clear product credit — The product is obviously causing the transformation

PRODUCTION-TESTED RULES (apply ALL without exception):

RULE 1 — Start with the transformation, not the problem.
Never open with a static "before" shot. Jump straight into the product actively working. Open Scene 1 with the product already in action.

RULE 2 — Make contrast unmissable.
Push every before/after to maximum contrast. Would someone watching at 50% attention still notice this change? If not, push it further.

RULE 3 — Never animate static scenes.
If nothing is physically moving in a scene (no product, no application, no transformation), mark it as "static": true. Only animate scenes where something is genuinely moving.

RULE 4 — Never use negative prompts.
Write only what you WANT to happen. "No warping" causes warping. Describe the desired outcome only.

RULE 5 — Animation prompts must be 4-6 sentences.
Too many instructions cause the model to fail at all of them. Too few leave the model guessing.

RULE 6 — One transformation per clip, always.
Never stack two visual changes into a single animation. If your product cleans AND polishes, those are two separate clips.

RULE 7 — No left/right directions on curved surfaces.
For curved surfaces use "across the surface." Only use directional language on flat surfaces.

RULE 8 — Product beauty shots use real product photos.
For the final beauty shot scene, generate the environment and lighting AROUND the product — not the product itself. The real product image will be used as reference.

RULE 9 — Test complex scenes first.
Mark your most complex transformation scene with "complexity": "high" so the user can test it first.

RULE 10 — Constrain the action, not the direction.
Focus on what changes and what is revealed. Do not over-engineer spatial direction.

THE WINNING ANIMATION PROMPT FORMULA (use for EVERY animationPrompt):
1. Subject — What surface, body part, or object we are looking at
2. Product action — What the product does and how it acts on the subject
3. What disappears or changes — What the problem looks like as it is being removed
4. What is revealed — The clean, smooth, bright, or improved result
5. "The transformation spreads steadily as the product works"
6. "One motion only. Camera static. 5 seconds."

LANGUAGE RULES:
- influencerDialogue: ALWAYS in Latin American Spanish (casual, natural, conversational)
- imagePrompt: ALWAYS in English (for AI image generators)
- animationPrompt: ALWAYS in English (for AI video generators like Veo, Kling, Sora)
- sceneDescription: in Spanish (for the user to understand)

OUTPUT FORMAT — Respond with valid JSON only. No markdown, no backticks, no explanation:
{
  "videoTitle": "Short viral title for this video concept (Spanish)",
  "videoConcept": "1-2 sentence summary of the video concept (Spanish)",
  "referenceAnalysis": "Brief analysis of the reference video structure and what you learned from it (Spanish)",
  "totalDuration": 25,
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneType": "transformation",
      "sceneDescription": "Description of what happens (Spanish)",
      "imagePrompt": "Detailed image generation prompt for the static frame (English, 200-400 chars)",
      "animationPrompt": "Animation prompt following the 6-part formula (English, max 400 chars)",
      "influencerDialogue": "What the influencer says, if applicable (Spanish Latino) or null",
      "duration": 5,
      "static": false,
      "complexity": "low",
      "usesInfluencer": false,
      "usesProductPhoto": false
    }
  ],
  "productionNotes": "Tips and warnings for generating these scenes (Spanish)"
}

SCENE TYPES:
- "transformation": Product actively transforming something (70%+ of scenes MUST be this type)
- "influencer": Influencer interacting with the product (hook, reaction, CTA)
- "beauty-shot": Final product showcase (ALWAYS uses real product photo as reference)

SCENE MIX RULES:
- 70%+ of scenes MUST show active transformation (sceneType: "transformation")
- The influencer should appear in 1-2 scenes maximum (hook and/or CTA)
- Final scene should ALWAYS be a beauty-shot with usesProductPhoto: true
- Total video: 15-30 seconds (4-6 scenes of 5 seconds each)
- Same camera angle for before/after in each scene — critical for comparison
- Lighting consistency — before and after share the same lighting setup

IMPORTANT:
- The reference video might be of a COMPLETELY DIFFERENT product. Extract the STYLE and STRUCTURE, not the specific product content.
- If the reference video is in English, that's fine — all output dialogue must be in Latin American Spanish.
- If no reference video is provided, create the production guide based on the product info and sales angle alone.
- Every animation prompt must follow the 6-part formula. No exceptions.
- Push transformations to be more dramatic than reality while staying believable.`

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
      influencerName,
      promptDescriptor,
      productDescription,
      salesAngle,
      referenceVideoUrl,
      productImageUrls,
      extraContext,
      sceneCount,
    } = body as {
      influencerId?: string
      influencerName?: string
      promptDescriptor?: string
      productDescription: string
      salesAngle?: string
      referenceVideoUrl?: string
      productImageUrls?: string[]
      extraContext?: string
      sceneCount?: number
    }

    if (!productDescription) {
      return NextResponse.json(
        { error: 'La descripción del producto es requerida' },
        { status: 400 }
      )
    }

    const keys = await getAIKeys(supabase, userId)
    requireAIKeys(keys)

    // Build multimodal content parts
    const parts: AIMultimodalPart[] = []

    // 1. Reference video (if provided) — Gemini analyzes directly via URL
    if (referenceVideoUrl) {
      parts.push({
        fileData: {
          fileUri: referenceVideoUrl,
          mimeType: 'video/mp4',
        },
      })
    }

    // 2. Product images (if provided)
    if (productImageUrls && productImageUrls.length > 0) {
      for (const imgUrl of productImageUrls.slice(0, 3)) {
        parts.push({
          fileData: {
            fileUri: imgUrl,
            mimeType: 'image/jpeg',
          },
        })
      }
    }

    // 3. Text prompt with all context
    const targetScenes = Math.max(3, Math.min(6, sceneCount || 5))

    const userMessage = `REFERENCE VIDEO: ${referenceVideoUrl ? 'Attached above. Analyze its structure, transitions, pacing, and transformation style. Learn HOW it creates viral impact — then apply that style to the NEW product below.' : 'No reference video provided. Create the production guide based on product info and sales angle.'}

PRODUCT INFORMATION:
${productDescription}

${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}SALES ANGLE:
${salesAngle || 'General product transformation — focus on the most dramatic before/after the product can create.'}

INFLUENCER:
${promptDescriptor ? `Visual descriptor: ${promptDescriptor}` : 'No influencer specified — focus on product-only transformation scenes.'}
${influencerName ? `Name: ${influencerName}` : ''}

PRODUCT PHOTOS: ${productImageUrls && productImageUrls.length > 0 ? `${productImageUrls.length} product photos attached above. Use the LAST scene as a beauty-shot referencing these real product photos.` : 'No product photos provided.'}

INSTRUCTIONS:
- Generate exactly ${targetScenes} scenes
- Total video duration: ${targetScenes * 5} seconds (${targetScenes} scenes × 5 seconds each)
- Follow ALL 10 production rules
- Use the 6-part animation prompt formula for EVERY animationPrompt
- 70%+ scenes must be active transformation
- Final scene: beauty-shot with the real product
- All dialogue in Latin American Spanish
- All image/animation prompts in English
- Push transformations to maximum dramatic impact

Generate the complete viral production guide as JSON.`

    parts.push({ text: userMessage })

    // Call Gemini 3 Pro with multimodal content (video + images + text)
    const hasMultimodal = parts.length > 1 // More than just the text part
    const responseText = await generateAIText(keys, {
      systemPrompt: VIRAL_TRANSFORMATION_SYSTEM,
      userMessage, // Always pass text (used by fallback if Google fails)
      multimodalParts: hasMultimodal ? parts : undefined, // Video + images + text for Google
      temperature: 0.8,
      jsonMode: true,
      skipKIE: true, // Skip KIE — doesn't support video input
      googleModel: 'gemini-3-pro',
    })

    // Parse JSON response
    let result: any
    try {
      const cleaned = extractJSON(responseText)
      result = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[ViralScript] JSON parse error:', parseErr, 'Raw:', responseText.substring(0, 300))
      return NextResponse.json({ error: 'Error al generar el guión: JSON inválido' }, { status: 500 })
    }

    // Validate structure
    if (!result.scenes || !Array.isArray(result.scenes) || result.scenes.length < 2) {
      return NextResponse.json(
        { error: 'Error al generar: estructura inválida (sin escenas)' },
        { status: 500 }
      )
    }

    // Enforce constraints on each scene
    result.scenes = result.scenes.slice(0, 7).map((s: any, i: number) => ({
      sceneNumber: i + 1,
      sceneType: String(s.sceneType || 'transformation'),
      sceneDescription: String(s.sceneDescription || ''),
      imagePrompt: String(s.imagePrompt || '').substring(0, 500),
      animationPrompt: String(s.animationPrompt || '').substring(0, 400),
      influencerDialogue: s.influencerDialogue ? String(s.influencerDialogue) : null,
      duration: Math.max(3, Math.min(8, Math.round(Number(s.duration) || 5))),
      static: Boolean(s.static),
      complexity: String(s.complexity || 'low'),
      usesInfluencer: Boolean(s.usesInfluencer),
      usesProductPhoto: Boolean(s.usesProductPhoto),
    }))

    // Ensure total duration is within bounds (15-40s)
    const totalDuration = result.scenes.reduce((sum: number, s: any) => sum + s.duration, 0)
    if (totalDuration > 40) {
      const scale = 40 / totalDuration
      result.scenes = result.scenes.map((s: any) => ({
        ...s,
        duration: Math.max(3, Math.round(s.duration * scale)),
      }))
    }

    result.totalDuration = result.scenes.reduce((sum: number, s: any) => sum + s.duration, 0)
    result.videoTitle = String(result.videoTitle || 'Video Viral de Transformación')
    result.videoConcept = String(result.videoConcept || '')
    result.referenceAnalysis = String(result.referenceAnalysis || '')
    result.productionNotes = String(result.productionNotes || '')

    console.log(`[ViralScript] Success: "${result.videoTitle}", ${result.scenes.length} scenes, ${result.totalDuration}s total`)

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    console.error('[ViralScript] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Error al generar el guión viral' },
      { status: 500 }
    )
  }
}
