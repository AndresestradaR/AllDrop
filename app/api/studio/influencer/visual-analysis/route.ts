import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

const ANALYSIS_SYSTEM = `Act as a professional visual analyst specialized in hyperrealistic human description, with expertise in breaking down human appearance into precise, observable parameters for artistic, generative AI, or technical reproduction purposes.

You will be provided with reference images of a person. Your task is to analyze the images strictly from a visual standpoint, without making assumptions about the person's identity, background, or personal information.

Extract and describe, with EXTREME level of detail, ALL visible parameters that define the person in the images. The description should be exhaustive and precise, as if it were intended for a 3D artist, character designer, or AI image generation system to recreate the person with perfect accuracy.

Mandatory Analysis Areas (do not omit any):

1. FACE
- Overall face shape
- Facial proportions
- Visible bone structure
- Skin (tone, undertone, texture, imperfections, lighting interaction)
- Eyes (shape, size, color as perceived, spacing, gaze direction, expression)
- Eyebrows (density, shape, thickness, color, angle)
- Nose (bridge, width, length, tip shape)
- Mouth and lips (shape, volume, symmetry, expression)
- Jawline and chin
- Distinctive visible features (moles, freckles, wrinkles, scars)

2. HAIR
- Color
- Length
- Texture (straight, wavy, curly, coiled)
- Volume and density
- Hairstyle
- Hairline shape
- Grooming and overall condition

3. EXPRESSION AND BODY LANGUAGE
- Dominant facial expression
- Head position and tilt
- Shoulder and torso posture
- Body orientation
- Emotion or attitude conveyed (based only on visible cues)

4. CLOTHING
- Upper garments (type, cut, fit, color, fabric)
- Lower garments
- Outer layers
- How the clothing fits the body
- Overall style classification

5. ACCESSORIES
- Jewelry
- Glasses or sunglasses
- Watches
- Any small but relevant visual details

6. IMMEDIATE VISUAL CONTEXT
- Background description
- Lighting type and direction
- Camera angle and framing
- Image quality

Level of Detail: MAXIMUM. Describe every observable detail with clarity and technical precision. Avoid vague language.

Constraints:
- Do NOT identify the person
- Do NOT speculate about personal details
- Base all descriptions strictly on what is visible

Output Format:
- Clearly structured text with section headings
- Professional, descriptive, and precise language
- No emojis
- No unnecessary conclusions or summaries

ADDITIONALLY, at the end, provide a "PROMPT DESCRIPTOR" section: a single, dense paragraph (200-300 words) that describes the person in a way optimized for AI image generation prompts. This paragraph should be self-contained and usable directly as a character description in any image generation prompt.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { influencerId, optimizeVideoPrompt, videoModelId, userIdea, promptDescriptor: pdOverride, presetId, realisticImageUrl: fallbackRealisticUrl, anglesGridUrl: fallbackAnglesUrl, bodyGridUrl: fallbackBodyUrl } = body as {
      influencerId: string
      optimizeVideoPrompt?: boolean
      videoModelId?: string
      userIdea?: string
      promptDescriptor?: string
      presetId?: 'producto' | 'rapido' | 'premium'
      realisticImageUrl?: string
      anglesGridUrl?: string
      bodyGridUrl?: string
    }

    if (!influencerId) {
      return NextResponse.json({ error: 'influencerId es requerido' }, { status: 400 })
    }

    // Get Google API key (Gemini only for analysis)
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google en Settings' }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)

    // Video prompt optimization mode
    if (optimizeVideoPrompt && userIdea) {
      try {
        const optimizerSystem = `You are an expert video prompt optimizer for AI video generation models. Your job is to take a character description and a user's video idea, and produce a highly detailed, model-optimized prompt.

MODEL-SPECIFIC GUIDES:
For Kling models (kling-*): Focus on camera movement, step-by-step actions, lighting, clothing movement. Keep under 500 chars.
For Veo models (veo-*): Use cinematic language, describe audio atmosphere, emotional tone, film styles. Keep under 1000 chars.
For Sora (sora-*): Be specific about physics, camera angles, environmental details, temporal progression. Keep under 1000 chars.

RULES:
- Output ONLY the optimized prompt, nothing else
- Always maintain the character's appearance consistency
- The character ALWAYS speaks in Spanish with a natural Latin American accent. This is mandatory and must be included in EVERY prompt.
- Write the prompt in English for technical quality, BUT include this mandatory instruction at the START of every prompt: "The character speaks naturally in Spanish with a Latin American accent."
- If the user's idea is in Spanish, understand it but write the technical prompt in English with the Spanish speech instruction
- Do NOT include any headers, explanations, or formatting`

        const UGC_OPTIMIZER_SYSTEM = `You are an expert UGC (User-Generated Content) video prompt creator for AI video generation, specialized in e-commerce and dropshipping content for Latin American markets.

STYLE REQUIREMENTS:
- UGC aesthetic: natural, candid, unpolished, authentic
- Camera: Amateur iPhone quality, slightly imperfect framing, handheld feel
- Realism: Visible imperfections, real-world environments, casual clothing
- Voice: MANDATORY "The character speaks naturally in Spanish with a Colombian paisa accent, warm and close tone"
- Duration: Include "15 seconds" or appropriate duration in every prompt

DIALOGUE STRUCTURE (mandatory):
- Hook (first 3 seconds): Grab attention with a relatable problem or shocking statement
- Solution (next 8 seconds): Present the product as the answer
- CTA (final 4 seconds): Clear call to action
- MAX 130 characters or 25 words for total dialogue

CHARACTER GUIDELINES:
- Age range: 21-38 years old
- Diverse appearances (varied ethnicity, gender, body types)
- Natural imperfections (blemishes, messy hair, uneven skin)
- Real-world settings (bedroom, kitchen, bathroom, office, gym, park)

CAMERA KEYWORDS TO INCLUDE:
"unremarkable amateur iPhone video, slightly shaky handheld, natural lighting, casual framing"

OUTPUT FORMAT:
- Write the prompt in English for technical quality
- ALWAYS include the Spanish speech instruction
- Include specific camera movements and angles
- Describe the character's emotion and body language
- Include environmental details and lighting

RULES:
- Output ONLY the optimized prompt, nothing else
- No headers, explanations, or formatting
- Keep prompts under 800 characters for best results`

        // Select system prompt based on preset
        const isUGCPreset = presetId && ['producto', 'rapido', 'premium'].includes(presetId)
        const systemPrompt = isUGCPreset ? UGC_OPTIMIZER_SYSTEM : optimizerSystem

        // Build user message
        let userMessage = `Character description: ${pdOverride || ''}\n\nUser's video idea: ${userIdea}\n\nTarget model: ${videoModelId || 'kling-3.0'}`

        if (presetId === 'producto') {
          userMessage += `\n\nIMPORTANT: This is a PRODUCT-ONLY video. The character will be generated from the text description only (Sora model). Focus the prompt on the character naturally showcasing/using the product. Include the full character description in the prompt.`
        } else if (presetId === 'rapido') {
          userMessage += `\n\nIMPORTANT: This video uses the character's PHOTO as the starting frame (Veo model). The prompt should describe what the character DOES in the video, not how they look. Focus on action, camera movement, and dialogue. Duration: 8 seconds.`
        } else if (presetId === 'premium') {
          userMessage += `\n\nIMPORTANT: This is a PREMIUM video with Kling 3.0 (supports audio natively). The character's photo is used as reference. Focus on cinematic quality while maintaining UGC authenticity. Include detailed camera movements, lighting changes, and emotional progression. Duration: 10-15 seconds.`
        }

        userMessage += `\n\nGenerate the optimized video prompt:`

        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
        const response = await fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          return NextResponse.json({ success: true, optimized_prompt: text.trim() })
        }
      } catch (err: any) {
        console.error('[Influencer/VideoPromptOptimizer] Error:', err.message)
      }
      return NextResponse.json({ success: false, optimized_prompt: '' })
    }

    // Get influencer data
    const { data: inf } = await supabase
      .from('influencers')
      .select('realistic_image_url, angles_grid_url, body_grid_url')
      .eq('id', influencerId)
      .eq('user_id', user.id)
      .single()

    // Use DB values first, then fallback to values sent from frontend
    const realisticUrl = inf?.realistic_image_url || fallbackRealisticUrl
    const anglesUrl = inf?.angles_grid_url || fallbackAnglesUrl
    const bodyUrl = inf?.body_grid_url || fallbackBodyUrl

    if (!realisticUrl) {
      return NextResponse.json({ error: 'No se encontro imagen realista' }, { status: 400 })
    }

    console.log(`[Influencer/VisualAnalysis] User: ${user.id.substring(0, 8)}..., Influencer: ${influencerId.substring(0, 8)}...`)

    // Download images and convert to base64
    const imageParts: any[] = []

    // Realistic image
    const realisticRes = await fetch(realisticUrl)
    if (realisticRes.ok) {
      const buffer = await realisticRes.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = realisticRes.headers.get('content-type') || 'image/jpeg'
      imageParts.push({
        inline_data: { mime_type: mimeType, data: base64 },
      })
    }

    // Angles grid image (if available)
    if (anglesUrl) {
      const anglesRes = await fetch(anglesUrl)
      if (anglesRes.ok) {
        const buffer = await anglesRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = anglesRes.headers.get('content-type') || 'image/jpeg'
        imageParts.push({
          inline_data: { mime_type: mimeType, data: base64 },
        })
      }
    }

    // Body grid image (if available)
    if (bodyUrl) {
      const bodyRes = await fetch(bodyUrl)
      if (bodyRes.ok) {
        const buffer = await bodyRes.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = bodyRes.headers.get('content-type') || 'image/jpeg'
        imageParts.push({
          inline_data: { mime_type: mimeType, data: base64 },
        })
      }
    }

    if (imageParts.length === 0) {
      return NextResponse.json({ error: 'No se pudieron descargar las imagenes' }, { status: 500 })
    }

    // Call Gemini for visual analysis
    const parts = [
      ...imageParts,
      { text: 'Analyze these reference images of the same person and generate an exhaustive visual analysis following the format specified in your instructions.' },
    ]

    // Try Gemini 2.5 Pro first, then 2.0 Flash
    const models = ['gemini-2.5-pro-preview-06-05', 'gemini-2.0-flash']
    let lastError = ''

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        const response = await fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: ANALYSIS_SYSTEM }] },
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
            },
          }),
        })

        if (!response.ok) {
          const errBody = await response.text()
          console.error(`[Influencer/VisualAnalysis] ${model} failed (${response.status}):`, errBody.substring(0, 300))
          lastError = `${model}: ${response.status}`
          continue
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (!text) {
          lastError = `${model}: empty response`
          continue
        }

        // Extract PROMPT DESCRIPTOR section
        let promptDescriptor = ''
        // Intentar múltiples patrones para extraer el descriptor
        const patterns = [
          /PROMPT DESCRIPTOR[:\s]*\n+([\s\S]*?)(?:\n\n---|$)/i,
          /PROMPT DESCRIPTOR[:\s]*\n+([\s\S]*?)$/i,
          /prompt.descriptor[:\s]*\n+([\s\S]{100,})/i,
        ]

        for (const pattern of patterns) {
          const match = text.match(pattern)
          if (match && match[1].trim().length > 50) {
            promptDescriptor = match[1].trim()
            console.log('[VisualAnalysis] Descriptor extracted, length:', promptDescriptor.length)
            break
          }
        }

        // Si no se encontró con regex, intentar extraer el último párrafo largo (>100 chars)
        if (!promptDescriptor) {
          const paragraphs = text.split('\n\n').filter((p: string) => p.trim().length > 100)
          if (paragraphs.length > 0) {
            promptDescriptor = paragraphs[paragraphs.length - 1].trim()
            console.log('[VisualAnalysis] Descriptor from last paragraph, length:', promptDescriptor.length)
          }
        }

        if (!promptDescriptor) {
          console.warn('[VisualAnalysis] WARNING: Could not extract prompt descriptor from analysis')
        }

        // Parse sections into structured character_profile
        const characterProfile: Record<string, string> = {}
        const sections = ['FACE', 'HAIR', 'EXPRESSION AND BODY LANGUAGE', 'CLOTHING', 'ACCESSORIES', 'IMMEDIATE VISUAL CONTEXT']
        for (const section of sections) {
          const regex = new RegExp(`(?:^|\\n)(?:#+\\s*)?(?:\\d+\\.\\s*)?${section}[:\\s]*\\n([\\s\\S]*?)(?=\\n(?:#+\\s*)?(?:\\d+\\.\\s*)?(?:${sections.join('|')}|PROMPT DESCRIPTOR)|$)`, 'i')
          const match = text.match(regex)
          if (match) {
            characterProfile[section.toLowerCase().replace(/ /g, '_')] = match[1].trim()
          }
        }

        // Update influencer with analysis results
        const { error: updateError } = await supabase
          .from('influencers')
          .update({
            visual_dna: text,
            prompt_descriptor: promptDescriptor,
            character_profile: characterProfile,
            current_step: 6,
            updated_at: new Date().toISOString(),
          })
          .eq('id', influencerId)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('[Influencer/VisualAnalysis] DB update FAILED:', updateError.message)
        } else {
          console.log(`[Influencer/VisualAnalysis] DB update OK, descriptor length: ${promptDescriptor.length}`)
        }

        console.log(`[Influencer/VisualAnalysis] Done with ${model}, visual_dna length: ${text.length}`)

        return NextResponse.json({
          success: true,
          visual_dna: text,
          prompt_descriptor: promptDescriptor,
          character_profile: characterProfile,
        })

      } catch (modelError: any) {
        console.error(`[Influencer/VisualAnalysis] ${model} error:`, modelError.message)
        lastError = modelError.message
        continue
      }
    }

    return NextResponse.json({ error: `Error al analizar: ${lastError}` }, { status: 500 })

  } catch (error: any) {
    console.error('[Influencer/VisualAnalysis] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al analizar' }, { status: 500 })
  }
}
