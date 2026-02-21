import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateVideo, VIDEO_MODELS } from '@/lib/video-providers'

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
      .select('google_api_key, kie_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de Google AI en Settings',
      }, { status: 400 })
    }

    if (!profile?.kie_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de KIE.ai en Settings para generar videos',
      }, { status: 400 })
    }

    const googleApiKey = decrypt(profile.google_api_key)
    const kieApiKey = decrypt(profile.kie_api_key)
    const genAI = new GoogleGenerativeAI(googleApiKey)

    console.log(`[ResenaUGC] Starting - User: ${user.id.substring(0, 8)}...`)
    console.log(`[ResenaUGC] Product: ${productName}, Model: ${videoModel}, Duration: ${duration}s`)

    // ============================================
    // STEP 1: Get or Generate Face Image
    // ============================================
    let faceImageUrl: string | null = null
    let faceImageBase64: string | null = imageBase64 || null

    if (imageSource === 'generate') {
      console.log(`[ResenaUGC] Step 1: Generating face with ${imageModel}...`)

      const facePrompt = FACE_PROMPTS[persona] || FACE_PROMPTS['mujer-joven']

      if (imageModel === 'gemini' || imageModel === 'imagen3') {
        // Use Google's Imagen 3
        try {
          const imageGenModel = genAI.getGenerativeModel({
            model: 'imagen-3.0-generate-002'
          })

          const result = await imageGenModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: facePrompt }] }],
            generationConfig: { responseMimeType: 'image/png' },
          })

          const response = await result.response
          const parts = response.candidates?.[0]?.content?.parts || []

          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
              faceImageBase64 = part.inlineData.data
              break
            }
          }
        } catch (error: any) {
          console.error('[ResenaUGC] Imagen 3 failed:', error.message)
          return NextResponse.json({
            error: 'Error generando imagen de cara. Verifica tu API key de Google AI.',
          }, { status: 500 })
        }
      } else {
        // TODO: Implement Nano Banana Pro for face generation
        // For now, fall back to Imagen 3
        console.log('[ResenaUGC] Nano Banana not implemented, using Imagen 3')
        try {
          const imageGenModel = genAI.getGenerativeModel({
            model: 'imagen-3.0-generate-002'
          })

          const result = await imageGenModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: facePrompt }] }],
            generationConfig: { responseMimeType: 'image/png' },
          })

          const response = await result.response
          const parts = response.candidates?.[0]?.content?.parts || []

          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('image/')) {
              faceImageBase64 = part.inlineData.data
              break
            }
          }
        } catch (error: any) {
          console.error('[ResenaUGC] Image generation failed:', error.message)
          return NextResponse.json({
            error: 'Error generando imagen de cara.',
          }, { status: 500 })
        }
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
      const thinkingModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash'
      })

      const profileResult = await thinkingModel.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: faceImageBase64
          }
        },
        { text: CHARACTER_PROFILE_PROMPT }
      ])

      characterProfile = profileResult.response.text() || ''
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
        const scriptModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: SCRIPT_SYSTEM_PROMPT
        })

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

        const scriptResult = await scriptModel.generateContent(scriptPrompt)
        script = scriptResult.response.text()?.trim() || ''

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
      kieApiKey
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
