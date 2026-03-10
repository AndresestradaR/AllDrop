import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON, type AIMultimodalPart } from '@/lib/services/ai-text'

export const maxDuration = 120

// =============================================================================
// SYSTEM PROMPT — Viral Video Producer (Adaptive to ANY video style)
// Analyzes reference video style first, then generates matching scenes.
// Supports: UGC/talking-head, transformation, product demo, lifestyle, etc.
// =============================================================================
const VIRAL_VIDEO_SYSTEM = `You are a Viral Video Producer specializing in AI-generated product videos for TikTok and Instagram Reels.

Your method: REPLICATE the reference video's EXACT structure and style, but with the client's product and influencer.

STEP 1 — ANALYZE THE REFERENCE VIDEO (CRITICAL):
Before generating ANY scenes, you MUST analyze the reference video SECOND BY SECOND:
- What happens at each second? Who appears? What are they doing?
- What is the VIDEO STYLE? (UGC talking-head, transformation, product demo, lifestyle, testimonial, etc.)
- What camera angles are used? (close-up, medium shot, full body, product macro, etc.)
- When does the influencer appear vs. just the product?
- What is the dialogue/voiceover structure? (hook, explanation, benefits, CTA, etc.)
- What is the EMOTIONAL ARC? (curiosity, problem, discovery, trust, urgency)
- What is the setting/environment? (studio, home, outdoors, medical office, etc.)

STEP 2 — MAP THE TIMELINE:
The output will be ONE CONTINUOUS VIDEO split into clips (due to AI video generation limits).
Map each clip to the EXACT corresponding section of the reference video:
- If the reference shows the influencer talking to camera for the first 15 seconds → your first 2 clips should be influencer talking to camera
- If the reference shows a product close-up at second 20 → your corresponding clip should be a product close-up
- MATCH the reference video's pacing, not some generic template

STEP 3 — ADAPT CONTENT (NOT STYLE):
- KEEP the reference video's visual structure, camera work, pacing, and style
- REPLACE the product with the client's product
- REPLACE the person with the client's influencer (using their visual descriptor)
- ADAPT the dialogue to match the client's product benefits and sales angle
- KEEP the same setting/environment style as the reference

PRODUCTION RULES:

RULE 1 — MATCH THE REFERENCE VIDEO'S OPENING.
If the reference opens with someone talking to camera, YOUR video opens with someone talking to camera. If it opens with a product in action, yours does too. NEVER impose a different style.

RULE 2 — Never use negative prompts.
Write only what you WANT to see. "No warping" causes warping. Describe the desired outcome only.

RULE 3 — Animation prompts must be 4-6 sentences, focused on ONE action.
Too many instructions cause the AI video model to fail. Keep it simple and clear.

RULE 4 — One action per clip.
Each clip should have ONE clear thing happening: person talking, product close-up, person holding product, etc. Never stack multiple actions.

RULE 5 — Product shots use real product photos.
When showing the product, the real product image will be composited — generate the environment and context AROUND the product.

RULE 6 — CONTINUITY between clips is CRITICAL.
This is ONE video split into pieces. The end of clip N must flow into the start of clip N+1:
- Same clothing, same setting, same lighting across all clips
- If scene 1 ends with the influencer mid-sentence, scene 2 starts with them continuing
- Describe transitions explicitly in the animationPrompt

RULE 7 — imagePrompt describes the FIRST FRAME of each clip.
Think of it as a photograph of what the viewer sees at the exact second this clip starts. It must be:
- Consistent with the previous clip's ending
- Matching the reference video's visual at this timestamp
- Including the influencer (if usesInfluencer: true) with their EXACT appearance descriptor
- Including the product (if usesProductPhoto: true) matching the real product photos

CRITICAL FOR TRANSFORMATION SCENES — The imagePrompt must show the transformation ALREADY IN PROGRESS:
- NEVER generate a 100% "before" state (all dirty, all stained, all broken)
- Instead, show the surface ALREADY PARTIALLY TRANSFORMED: one half dirty, one half clean, with a visible boundary where the product has already worked
- Example: "Dirty oven grill with heavy grease buildup on the right side. The left side is already gleaming clean stainless steel where the steam cleaner has passed. A white handheld steam cleaner points at the boundary between dirty and clean areas, steam visible."
- This gives the AI video model a DIRECTION — it will expand the clean area across the surface
- Without this, the video model sees "dirty surface" and keeps it dirty or makes it worse

RULE 8 — animationPrompt describes the MOTION for the clip.
Use this formula:
1. Subject and setting — Who/what is in frame and where
2. Action — What movement happens (person speaks, gestures, holds up product, product rotates, etc.)
3. Camera — Camera movement or stability (static, slow zoom, etc.)
4. Duration — "Smooth continuous motion. 8 seconds."

For TALKING-HEAD / UGC scenes (person speaking to camera):
"[Person description] speaks directly to camera with natural gestures and expressions. [Specific gesture: holds up product / points to camera / smiles warmly]. Subtle natural movements, slight head tilts, blinking. Camera static, medium shot. 8 seconds."

For PRODUCT CLOSE-UP scenes:
"Close-up of [product description] on [surface/setting]. [Specific action: product slowly rotates / hand picks up product / lid opens]. Soft lighting highlights the product label. Camera static with slight focus pull. 8 seconds."

For TRANSFORMATION scenes (cleaning, before/after, etc.):
- imagePrompt: MUST show the surface ALREADY MID-TRANSFORMATION (half dirty, half clean — see Rule 7)
- animationPrompt: Describe the CLEAN AREA EXPANDING, not "dirt being removed". The AI video model is good at expanding what exists, bad at removing things.
- Example: "The gleaming clean area on the oven grill steadily expands from left to right as the steam cleaner moves across the surface. Grease and grime give way to shining metal. Steam billows where the nozzle meets the surface. The clean section grows to cover the entire grill. Camera static. 8 seconds."
- NEVER say "dirt disappears" or "stains are removed" — instead say "the clean surface expands" or "the shining area spreads"
- Focus on what APPEARS (clean, bright, shining) not what DISAPPEARS (dirt, grime, stains)

LANGUAGE RULES:
- influencerDialogue: ALWAYS in Latin American Spanish (casual, natural, like the reference video's tone)
- imagePrompt: ALWAYS in English (for AI image generators)
- animationPrompt: ALWAYS in English (for AI video generators like Veo, Kling, Sora)
- sceneDescription: in Spanish (for the user to understand)

DIALOGUE RULES — CRITICAL:
- If the reference video has dialogue/voiceover, EVERY scene where the influencer appears MUST have influencerDialogue
- Adapt the reference video's script to the client's product — same structure, same tone, same rhythm
- If the reference says "¿Quieres que tu piel luzca radiante?" → your script should have a similar opening hook adapted to the sales angle
- The dialogue should feel like ONE continuous speech split across scenes, not isolated phrases
- Keep it natural, conversational Latin American Spanish — not formal or robotic

OUTPUT FORMAT — Respond with valid JSON only. No markdown, no backticks, no explanation:
{
  "videoTitle": "Short viral title (Spanish)",
  "videoConcept": "1-2 sentence summary (Spanish)",
  "detectedStyle": "The style detected from the reference video (e.g., 'UGC talking-head con producto', 'transformación física', 'demo de producto', 'testimonial')",
  "referenceAnalysis": "Detailed second-by-second analysis of the reference video: what happens at each moment, camera angles, who appears, dialogue, transitions (Spanish, be thorough)",
  "totalDuration": 40,
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneType": "influencer | transformation | beauty-shot | product-demo",
      "sceneDescription": "What happens in this clip and how it connects to the previous/next (Spanish)",
      "imagePrompt": "First frame of this clip — must match what would be at this exact second in the reference video, adapted to our product and influencer (English, 200-400 chars)",
      "animationPrompt": "Motion description following the formula above, matching the reference video's action at this timestamp (English, max 400 chars)",
      "influencerDialogue": "What the influencer says during this clip (Spanish Latino) — part of ONE continuous speech. null only if no one speaks in this section of the reference.",
      "duration": 8,
      "static": false,
      "complexity": "low",
      "usesInfluencer": true,
      "usesProductPhoto": false,
      "referenceTimestamp": "0s-8s — what this clip corresponds to in the reference video"
    }
  ],
  "fullScript": "The COMPLETE dialogue as one continuous text, marking where each scene's dialogue starts (Spanish)",
  "productionNotes": "Tips for generating these scenes, potential issues, and how to maintain continuity (Spanish)"
}

SCENE TYPES:
- "influencer": Person speaking to camera, gesturing, explaining — the MOST COMMON type for UGC-style videos
- "product-demo": Product close-up, product being held/shown, product details
- "transformation": Product actively changing something visible (ONLY if the reference video actually shows this)
- "beauty-shot": Final product showcase with branding

FLAGS — CRITICAL for image generation:
- usesInfluencer: true → The influencer's reference photo will be used to generate this scene's image. The imagePrompt MUST describe the influencer's pose, expression, and what they're doing.
- usesProductPhoto: true → The product's reference photos will be used. The imagePrompt MUST describe the product's placement and context.
- BOTH can be true (influencer holding the product) — this is common in UGC videos
- Set these flags to EXACTLY match what appears at that moment in the reference video

CRITICAL REMINDERS:
- You are REPLICATING the reference video's structure with new content, NOT creating something from scratch
- If the reference is a person talking about gummies → your output is a person talking about gummies (with adapted dialogue)
- If the reference is a steam cleaner showing before/after → your output is a transformation video
- The reference video IS the blueprint — follow it faithfully
- WITHOUT a reference video, create a UGC-style talking-head video by default (most versatile format)
- EVERY scene with an influencer speaking MUST have dialogue — no silent influencer scenes
- The dialogue across all scenes should read as ONE continuous, natural speech`

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

    const sceneDuration = 8 // Veo 3.1 generates ~8s clips
    const userMessage = `REFERENCE VIDEO: ${referenceVideoUrl ? `Attached above.

CRITICAL — SECOND-BY-SECOND ANALYSIS REQUIRED:
Analyze the reference video frame by frame. For EACH second, note:
- Who is on screen (person, just product, both, neither)
- Camera angle (close-up face, medium shot, full body, product macro, wide shot)
- What the person is doing (talking, holding product, gesturing, applying product)
- What the product is doing (being shown, being used, close-up detail)
- Dialogue/voiceover at that moment
- Setting and lighting

Then split this timeline into ${targetScenes} clips of ${sceneDuration} seconds each.
Each clip MUST correspond to the matching section of the reference video.
This is ONE CONTINUOUS VIDEO — the clips will be joined together.` : 'No reference video provided. Create a UGC talking-head style video by default (influencer presenting the product to camera).'}

PRODUCT INFORMATION:
${productDescription}

${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}SALES ANGLE:
${salesAngle || 'General product presentation — focus on the key benefits and why someone should buy this product.'}

INFLUENCER (the person who will appear in the video):
${promptDescriptor ? `Visual appearance: ${promptDescriptor}
IMPORTANT: Every scene with usesInfluencer:true, the imagePrompt MUST describe this person with these exact physical characteristics. The AI image generator will use a reference photo of this person, but the prompt must describe them accurately for best results.` : 'No influencer specified — focus on product-only scenes.'}
${influencerName ? `Name: ${influencerName}` : ''}

PRODUCT PHOTOS: ${productImageUrls && productImageUrls.length > 0 ? `${productImageUrls.length} product photos attached above. These show the REAL product — every scene with usesProductPhoto:true must show this exact product.` : 'No product photos provided.'}

INSTRUCTIONS:
- Total video: ${targetScenes * sceneDuration} seconds, split into exactly ${targetScenes} clips of ${sceneDuration}s each
- Scene 1 = seconds 0-${sceneDuration}, Scene 2 = seconds ${sceneDuration}-${sceneDuration * 2}, Scene 3 = seconds ${sceneDuration * 2}-${sceneDuration * 3}, etc.
- Each scene's imagePrompt → generates the FIRST FRAME (a static image) of that clip
- Each scene's animationPrompt → animates that first frame for ${sceneDuration} seconds
- CONTINUITY: the end of clip N must flow naturally into the start of clip N+1 (same clothes, same setting, same lighting, continuous dialogue)
- usesInfluencer/usesProductPhoto flags MUST match exactly what appears at that moment in the reference video
- If the influencer is speaking in a scene, influencerDialogue MUST NOT be null
- All dialogue in natural Latin American Spanish
- All imagePrompt and animationPrompt in English
- Generate exactly ${targetScenes} scenes

Generate the complete production guide as JSON.`

    parts.push({ text: userMessage })

    // Call with multimodal content (video + images + text) when available
    // Only skip KIE when we have actual video/image multimodal parts (KIE can't handle those)
    // When it's text-only, let the full cascade work: KIE → OpenAI → Google
    const hasMultimodal = parts.length > 1 // More than just the text part
    const responseText = await generateAIText(keys, {
      systemPrompt: VIRAL_VIDEO_SYSTEM,
      userMessage, // Always pass text (used by fallback if Google fails)
      multimodalParts: hasMultimodal ? parts : undefined,
      temperature: 0.8,
      jsonMode: true,
      skipKIE: hasMultimodal, // Only skip KIE when multimodal (video/images) — text-only uses full cascade
      googleModel: 'gemini-3.1-pro-preview',
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

    // Enforce constraints on each scene — force 8s per scene (Veo 3.1 clip length)
    const SCENE_DURATION = 8
    result.scenes = result.scenes.slice(0, 7).map((s: any, i: number) => ({
      sceneNumber: i + 1,
      sceneType: String(s.sceneType || 'influencer'),
      sceneDescription: String(s.sceneDescription || ''),
      imagePrompt: String(s.imagePrompt || '').substring(0, 500),
      animationPrompt: String(s.animationPrompt || '').substring(0, 400),
      influencerDialogue: s.influencerDialogue ? String(s.influencerDialogue) : null,
      duration: SCENE_DURATION, // Fixed: every scene is exactly 8s (Veo limit)
      static: false, // Never static — all scenes generate video
      complexity: String(s.complexity || 'low'),
      usesInfluencer: Boolean(s.usesInfluencer),
      usesProductPhoto: Boolean(s.usesProductPhoto),
      startsAtSecond: i * SCENE_DURATION, // Timeline position
    }))

    result.totalDuration = result.scenes.reduce((sum: number, s: any) => sum + s.duration, 0)
    result.videoTitle = String(result.videoTitle || 'Video Viral')
    result.videoConcept = String(result.videoConcept || '')
    result.detectedStyle = String(result.detectedStyle || '')
    result.referenceAnalysis = String(result.referenceAnalysis || '')
    result.fullScript = String(result.fullScript || '')
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
