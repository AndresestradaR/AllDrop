import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import {
  generateImage,
  pollForResult,
  modelIdToProviderType,
  IMAGE_MODELS,
  type ImageModelId,
  type ImageProviderType,
  type GenerateImageRequest,
} from '@/lib/image-providers'

export const maxDuration = 120

interface FormData {
  gender: string
  age_range: string
  skin_tone: string
  hair_color: string
  hair_style: string
  eye_color: string
  build: string
  style_vibe: string
  accessories: string[]
  custom_details: string
}

function buildBasePrompt(f: FormData): string {
  const genderText = f.gender === 'male' ? 'a young man' :
                     f.gender === 'female' ? 'a young woman' : 'a young person'

  const pronoun = f.gender === 'male' ? 'He' : f.gender === 'female' ? 'She' : 'They'
  const possessive = f.gender === 'male' ? 'His' : f.gender === 'female' ? 'Her' : 'Their'

  const ageMap: Record<string, string> = {
    '18-25': 'in their early twenties',
    '25-30': 'in their mid to late twenties',
    '30-40': 'in their thirties',
    '40-50': 'in their forties',
  }

  const buildMap: Record<string, string> = {
    'delgada': 'slim',
    'atletica': 'athletic',
    'media': 'average',
    'robusta': 'stocky',
  }

  const accessoryMap: Record<string, string> = {
    'piercing_nariz': 'a small nose ring',
    'aretes': 'earrings',
    'gafas': 'glasses',
    'tatuajes': 'visible tattoos on arms',
    'panuelo': 'a colorful headband/bandana',
  }

  const accessoryDesc = f.accessories?.length > 0
    ? f.accessories.map(a => accessoryMap[a] || a).join(', ')
    : ''

  return `A handheld extreme close-up selfie, showing ${genderText} ${ageMap[f.age_range] || 'in their twenties'} with ${f.skin_tone} skin and ${f.hair_color}, ${f.hair_style} hair. ${pronoun} has ${f.eye_color} eyes and a natural, relaxed expression with a direct gaze into the camera. ${possessive} skin is ultra-realistic with visible pores and natural texture. ${accessoryDesc ? `Wearing ${accessoryDesc}.` : ''} ${f.build ? `${buildMap[f.build] || f.build} build.` : ''} ${f.style_vibe ? `${f.style_vibe} style clothing.` : ''} Diffused natural daylight from a window on the left illuminates the face, creating gentle shadows. The background is a neutral beige indoor wall, softly out of focus with natural lens falloff. Shot on iPhone 14 Pro, hyperrealistic, editorial quality. 9:16 aspect ratio.${f.custom_details ? ' ' + f.custom_details : ''}`
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { formData, modelId, influencerId } = body as {
      formData: FormData
      modelId: ImageModelId
      influencerId?: string
    }

    if (!formData || !modelId) {
      return NextResponse.json({ error: 'Datos del formulario y modelo son requeridos' }, { status: 400 })
    }

    const modelConfig = IMAGE_MODELS[modelId]
    if (!modelConfig) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 400 })
    }

    // Get API keys
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key, fal_api_key')
      .eq('id', user.id)
      .single()

    const apiKeys: { gemini?: string; openai?: string; kie?: string; bfl?: string; fal?: string } = {}
    if (profile?.google_api_key) apiKeys.gemini = decrypt(profile.google_api_key)
    if (profile?.openai_api_key) apiKeys.openai = decrypt(profile.openai_api_key)
    if (profile?.kie_api_key) apiKeys.kie = decrypt(profile.kie_api_key)
    if (profile?.bfl_api_key) apiKeys.bfl = decrypt(profile.bfl_api_key)
    if (profile?.fal_api_key) apiKeys.fal = decrypt(profile.fal_api_key)

    // Environment variable fallbacks (platform keys)
    if (!apiKeys.openai && process.env.OPENAI_API_KEY) apiKeys.openai = process.env.OPENAI_API_KEY
    if (!apiKeys.kie && process.env.KIE_API_KEY) apiKeys.kie = process.env.KIE_API_KEY
    if (!apiKeys.bfl && process.env.BFL_API_KEY) apiKeys.bfl = process.env.BFL_API_KEY
    if (!apiKeys.fal && process.env.FAL_API_KEY) apiKeys.fal = process.env.FAL_API_KEY
    if (!apiKeys.gemini && process.env.GEMINI_API_KEY) apiKeys.gemini = process.env.GEMINI_API_KEY

    const selectedProvider = modelIdToProviderType(modelId)

    const providerKeyMap: Record<ImageProviderType, keyof typeof apiKeys> = {
      gemini: 'gemini', openai: 'openai', seedream: 'kie', flux: 'bfl',
    }

    // For Gemini: accept either Google key OR KIE key (KIE provides Gemini models)
    const hasRequiredKey = selectedProvider === 'gemini'
      ? !!(apiKeys.gemini || apiKeys.kie)
      : !!apiKeys[providerKeyMap[selectedProvider]]

    if (!hasRequiredKey) {
      const keyNames: Record<ImageProviderType, string> = {
        gemini: 'Google (Gemini) o KIE.ai', openai: 'OpenAI', seedream: 'KIE.ai', flux: 'Black Forest Labs',
      }
      return NextResponse.json({
        error: `Configura tu API key de ${keyNames[selectedProvider]} en Settings`,
      }, { status: 400 })
    }

    // Build prompt from form data
    const prompt = buildBasePrompt(formData)

    console.log(`[Influencer/GenerateBase] User: ${user.id.substring(0, 8)}..., Model: ${modelId}`)
    console.log(`[Influencer/GenerateBase] Prompt (first 150): ${prompt.substring(0, 150)}...`)

    // Generate image
    const generateRequest: GenerateImageRequest = {
      provider: selectedProvider,
      modelId,
      prompt,
      aspectRatio: '9:16',
    }

    const genElapsed = Date.now() - startTime
    let result = await generateImage(generateRequest, apiKeys, {
      maxTotalMs: Math.max(95000 - genElapsed, 30000),
    })

    // Poll for async providers
    if (result.success && result.status === 'processing' && result.taskId) {
      const apiKey = apiKeys[providerKeyMap[selectedProvider]]!
      const elapsedMs = Date.now() - startTime
      const remainingMs = Math.max(100000 - elapsedMs, 30000)

      result = await pollForResult(selectedProvider, result.taskId, apiKey, {
        maxAttempts: Math.floor(remainingMs / 1000),
        intervalMs: 1000,
        timeoutMs: remainingMs,
      })
    }

    if (!result.success || !result.imageBase64) {
      return NextResponse.json({
        success: false,
        error: result.error || 'No se pudo generar la imagen',
      }, { status: 200 })
    }

    // Upload to Supabase Storage
    const ext = result.mimeType?.includes('png') ? 'png' : 'jpg'
    const buffer = Buffer.from(result.imageBase64, 'base64')
    const storagePath = `influencers/${user.id}/${Date.now()}_base.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(storagePath, buffer, { contentType: result.mimeType || 'image/png', upsert: true })

    if (uploadError) {
      console.error('[Influencer/GenerateBase] Upload error:', uploadError)
      return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(storagePath)

    // Save or update influencer record
    let savedInfluencer
    if (influencerId) {
      const { data, error } = await supabase
        .from('influencers')
        .update({
          ...formData,
          base_image_url: publicUrl,
          base_prompt: prompt,
          current_step: 2,
          updated_at: new Date().toISOString(),
        })
        .eq('id', influencerId)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      savedInfluencer = data
    } else {
      const { data, error } = await supabase
        .from('influencers')
        .insert({
          user_id: user.id,
          name: 'Mi Influencer',
          ...formData,
          base_image_url: publicUrl,
          base_prompt: prompt,
          current_step: 2,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      savedInfluencer = data
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[Influencer/GenerateBase] Done in ${totalTime}s, URL: ${publicUrl}`)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      prompt,
      influencer: savedInfluencer,
    })

  } catch (error: any) {
    console.error('[Influencer/GenerateBase] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar imagen' }, { status: 500 })
  }
}
