import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { generateAIText, getAIKeys, requireAIKeys } from '@/lib/services/ai-text'
import { generateVideo, VIDEO_MODELS } from '@/lib/video-providers'
import {
  generateImage,
  pollForResult,
  type GenerateImageRequest,
  type ImageModelId,
} from '@/lib/image-providers'

// Extended timeout for video generation
export const maxDuration = 120

// ============================================
// SYSTEM PROMPT PARA GENERAR GUION
// ============================================
const SCRIPT_SYSTEM_PROMPT = `Eres un experto en crear guiones de resenas UGC (User Generated Content) para productos de e-commerce en Latinoamerica.

REGLAS:
- SIEMPRE en espanol latinoamericano (no usar "vosotros", usar "ustedes")
- Lenguaje natural, como si hablara a camara de celular
- Si es "casual": relajado, como contandole a una amiga
- Si es "entusiasta": emocionado, con enfasis en lo bueno
- Si es "esceptico-convencido": empezar dudando, terminar recomendando
- Incluir el beneficio de forma natural
- Terminar con recomendacion o llamado a la accion
- Ajustar longitud al tiempo (15s = ~40 palabras, 30s = ~80, 60s = ~160)

GENERA SOLO EL GUION, sin explicaciones ni comillas.`

// ============================================
// PROMPTS PARA GENERAR CARA
// ============================================
const FACE_PROMPTS: Record<string, string> = {
  'mujer-joven': 'Portrait photo of a young Latina woman, age 20-28, natural beauty, warm smile, casual style, looking at camera, soft natural lighting, smartphone selfie style, realistic, photorealistic, 4K',
  'mujer-adulta': 'Portrait photo of a Latina woman, age 35-45, elegant natural beauty, confident smile, professional casual style, looking at camera, soft natural lighting, smartphone selfie style, realistic, photorealistic, 4K',
  'hombre-joven': 'Portrait photo of a young Latino man, age 20-28, clean look, friendly smile, casual style, looking at camera, soft natural lighting, smartphone selfie style, realistic, photorealistic, 4K',
  'hombre-adulto': 'Portrait photo of a Latino man, age 35-45, mature handsome look, confident smile, professional casual style, looking at camera, soft natural lighting, smartphone selfie style, realistic, photorealistic, 4K',
}

// ============================================
// CHARACTER PROFILING PROMPT
// ============================================
const CHARACTER_PROFILE_PROMPT = `Analyze this facial image and extract detailed measurements and characteristics for consistent video generation:

1. Face shape and structure
2. Eye distance, shape, and color
3. Nose structure and proportions
4. Jawline and chin characteristics
5. Cheekbone position and prominence
6. Skin tone (specific description)
7. Hair color, style, and texture
8. Distinctive features (moles, dimples, etc.)
9. Approximate age range
10. Overall facial proportions

Respond in a structured format that can be used as a prompt modifier for video generation to maintain facial consistency.`

interface ResenaUGCRequest {
  productName: string
  productBenefit?: string
  imageSource: 'upload' | 'generate'
  imageBase64?: string // If uploaded
  imageModel?: 'nano-banana' | 'gemini' | 'imagen3'
  persona?: string
  videoModel: 'kling' | 'veo' | 'sora'
  tone: 'casual' | 'entusiasta' | 'esceptico-convencido'
  duration: '15' | '30' | '60'
  customScript?: string
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body: ResenaUGCRequest = await request.json()
    const {
      productName,
      productBenefit,
      imageSource,
      imageBase64,
      imageModel = 'nano-banana',
      persona = 'mujer-joven',
      videoModel,
      tone,
      duration,
      customScript,
    } = body

    if (!productName) {
      return NextResponse.json({ error: 'Nombre del producto requerido' }, { status: 400 })
    }

    // Get user's API keys
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key, kie_api_key, openai_api_key, bfl_api_key, fal_api_key')
      .eq('id', user.id)
      .single()

    // Get AI text keys (for text generation: character profiling & script)
    const aiKeys = await getAIKeys(supabase, user.id)
    requireAIKeys(aiKeys)

    // Video keys — BYOK first, then platform env var fallbacks
    const kieApiKey = profile?.kie_api_key ? decrypt(profile.kie_api_key) : (process.env.KIE_API_KEY || '')
    const falApiKey = profile?.fal_api_key ? decrypt(profile.fal_api_key) : (process.env.FAL_API_KEY || undefined)

    if (!kieApiKey && !falApiKey) {
      return NextResponse.json({
        error: 'No hay API keys disponibles para generar videos. Configura KIE.ai o fal.ai en Settings.',
      }, { status: 400 })
    }

    // Image generation keys — BYOK first, then platform env var fallbacks
    const imageApiKeys: { gemini?: string; openai?: string; kie?: string; bfl?: string; fal?: string } = {}
    if (profile?.google_api_key) imageApiKeys.gemini = decrypt(profile.google_api_key)
    else if (process.env.GEMINI_API_KEY) imageApiKeys.gemini = process.env.GEMINI_API_KEY
    if (profile?.openai_api_key) imageApiKeys.openai = decrypt(profile.openai_api_key)
    else if (process.env.OPENAI_API_KEY) imageApiKeys.openai = process.env.OPENAI_API_KEY
    imageApiKeys.kie = kieApiKey || process.env.KIE_API_KEY || ''
    if (profile?.bfl_api_key) imageApiKeys.bfl = decrypt(profile.bfl_api_key)
    else if (process.env.BFL_API_KEY) imageApiKeys.bfl = process.env.BFL_API_KEY
    if (falApiKey) imageApiKeys.fal = falApiKey
    else if (process.env.FAL_API_KEY) imageApiKeys.fal = process.env.FAL_API_KEY

    console.log(`[ResenaUGC] Starting - User: ${user.id.substring(0, 8)}...`)
    console.log(`[ResenaUGC] Product: ${productName}, Model: ${videoModel}, Duration: ${duration}s`)

    // ============================================
    // STEP 1: Get or Generate Face Image
    // ============================================
    let faceImageUrl: string | null = null
    let faceImageBase64: string | null = imageBase64 || null

    if (imageSource === 'generate') {
      console.log(`[ResenaUGC] Step 1: Generating face via image cascade...`)

      // Check we have at least one image generation key
      if (!imageApiKeys.gemini && !imageApiKeys.openai && !imageApiKeys.kie && !imageApiKeys.bfl && !imageApiKeys.fal) {
        return NextResponse.json({
          error: 'No hay API keys disponibles para generar imágenes. Configura al menos una en Settings.',
        }, { status: 400 })
      }

      const facePrompt = FACE_PROMPTS[persona] || FACE_PROMPTS['mujer-joven']

      // Use image cascade: KIE→fal→Gemini direct (T2I, no reference image)
      const faceModelId: ImageModelId = 'gemini-3-pro-image' as ImageModelId
      const faceRequest: GenerateImageRequest = {
        provider: 'gemini',
        modelId: faceModelId,
        prompt: facePrompt,
        aspectRatio: '9:16',
      }

      try {
        const genStartTime = Date.now()
        let faceResult = await generateImage(faceRequest, imageApiKeys, {
          maxTotalMs: 60000,
        })

        // Poll if async
        if (faceResult.success && faceResult.status === 'processing' && faceResult.taskId) {
          const elapsedMs = Date.now() - genStartTime
          const remainingMs = Math.max(60000 - elapsedMs, 15000)
          const pollKey = imageApiKeys.kie || imageApiKeys.bfl || imageApiKeys.fal || ''
          faceResult = await pollForResult('gemini', faceResult.taskId, pollKey, {
            maxAttempts: Math.floor(remainingMs / 1000),
            intervalMs: 1000,
            timeoutMs: remainingMs,
          })
        }

        if (faceResult.success && faceResult.imageBase64) {
          faceImageBase64 = faceResult.imageBase64
          console.log(`[ResenaUGC] Face generated via cascade`)
        } else {
          console.error('[ResenaUGC] Face generation failed:', faceResult.error)
          return NextResponse.json({
            error: 'Error generando imagen de cara. Intenta de nuevo.',
          }, { status: 500 })
        }
      } catch (error: any) {
        console.error('[ResenaUGC] Face generation error:', error.message)
        return NextResponse.json({
          error: 'Error generando imagen de cara.',
        }, { status: 500 })
      }
    }

    if (!faceImageBase64) {
      return NextResponse.json({
        error: 'No se pudo obtener imagen de la persona',
      }, { status: 400 })
    }

    // ============================================
    // STEP 2: Create Character Profile (for consistency)
    // ============================================
    console.log('[ResenaUGC] Step 2: Creating character profile...')

    let characterProfile = ''
    try {
      characterProfile = await generateAIText(aiKeys, {
        userMessage: CHARACTER_PROFILE_PROMPT,
        images: [{ mimeType: 'image/png', base64: faceImageBase64 }],
      })
      console.log('[ResenaUGC] Character profile created:', characterProfile.substring(0, 200))
    } catch (error: any) {
      console.error('[ResenaUGC] Character profiling failed:', error.message)
      // Continue without profile - video might be less consistent
      characterProfile = `Person matching the reference image, ${persona.replace('-', ' ')}`
    }

    // ============================================
    // STEP 3: Generate Script (if not custom)
    // ============================================
    let script = customScript || ''

    if (!script) {
      console.log('[ResenaUGC] Step 3: Generating script...')

      try {
        const personaLabel = {
          'mujer-joven': 'Mujer joven (18-30)',
          'mujer-adulta': 'Mujer adulta (30-50)',
          'hombre-joven': 'Hombre joven (18-30)',
          'hombre-adulto': 'Hombre adulto (30-50)',
        }[persona] || 'Mujer joven'

        const toneLabel = {
          'casual': 'Casual - relajado, como contandole a una amiga',
          'entusiasta': 'Entusiasta - emocionado, con enfasis en lo bueno',
          'esceptico-convencido': 'Esceptico convencido - empezar dudando, terminar recomendando',
        }[tone]

        const scriptPrompt = `PRODUCTO: ${productName}
BENEFICIO: ${productBenefit || 'No especificado'}
PERSONA: ${personaLabel}
TONO: ${toneLabel}
DURACION: ${duration} segundos

Genera el guion de la resena UGC.`

        script = await generateAIText(aiKeys, {
          systemPrompt: SCRIPT_SYSTEM_PROMPT,
          userMessage: scriptPrompt,
        })
        script = script.trim()

        console.log('[ResenaUGC] Script generated:', script.substring(0, 100))
      } catch (error: any) {
        console.error('[ResenaUGC] Script generation failed:', error.message)
        // Fallback to simple script
        script = `Hola! Les quiero contar mi experiencia con ${productName}. ${productBenefit ? `Lo mejor es que ${productBenefit.toLowerCase()}.` : ''} Lo recomiendo totalmente!`
      }
    }

    // ============================================
    // STEP 4: Upload image to storage
    // ============================================
    console.log('[ResenaUGC] Step 4: Uploading image to storage...')

    const buffer = Buffer.from(faceImageBase64, 'base64')
    const timestamp = Date.now()
    const filename = `studio/resena-ugc/${user.id}/${timestamp}.png`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error('[ResenaUGC] Upload error:', uploadError)
      return NextResponse.json({
        error: 'Error subiendo imagen',
      }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('landing-images')
      .getPublicUrl(filename)

    faceImageUrl = urlData.publicUrl
    console.log('[ResenaUGC] Image uploaded:', faceImageUrl)

    // ============================================
    // STEP 5: Generate Video with Dialog
    // ============================================
    console.log('[ResenaUGC] Step 5: Generating video...')

    // Map UI model names to actual model IDs
    const modelMapping: Record<string, string> = {
      'kling': 'kling-2.6',
      'veo': 'veo-3.1',
      'sora': 'sora-2',
    }

    const actualModelId = modelMapping[videoModel] || 'kling-2.6'
    const modelConfig = VIDEO_MODELS[actualModelId as keyof typeof VIDEO_MODELS]

    // Build video prompt with character profile and script
    const videoPrompt = `UGC style video testimonial. ${characterProfile}

The person is speaking directly to camera in a casual smartphone video style. Natural lighting, authentic feel.

DIALOG (in Spanish): "${script}"

Style: Casual UGC, smartphone recording, natural expressions matching the dialog, ${tone} tone.
The person should be speaking the dialog naturally, with appropriate facial expressions and gestures.`

    console.log('[ResenaUGC] Video prompt:', videoPrompt.substring(0, 300))

    const videoResult = await generateVideo(
      {
        modelId: actualModelId as any,
        prompt: videoPrompt,
        duration: parseInt(duration),
        aspectRatio: '9:16', // Vertical for UGC/TikTok style
        enableAudio: modelConfig?.supportsAudio ?? true,
        imageUrls: [faceImageUrl],
      },
      kieApiKey,
      falApiKey
    )

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    if (!videoResult.success) {
      console.error(`[ResenaUGC] Video generation failed after ${elapsed}s:`, videoResult.error)
      return NextResponse.json({
        success: false,
        error: videoResult.error || 'Error generando video',
      }, { status: 200 })
    }

    console.log(`[ResenaUGC] Task created in ${elapsed}s: ${videoResult.taskId}`)

    // Return task ID for polling
    return NextResponse.json({
      success: true,
      taskId: videoResult.taskId,
      status: 'processing',
      script: script,
      characterProfile: characterProfile.substring(0, 500),
      faceImageUrl: faceImageUrl,
      message: 'Video en proceso. El frontend debe hacer polling a /api/studio/video-status',
    })

  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[ResenaUGC] Error after ${elapsed}s:`, error.message)

    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno'
    }, { status: 500 })
  }
}
