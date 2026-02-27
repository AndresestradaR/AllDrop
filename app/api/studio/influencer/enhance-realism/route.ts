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

const REALISM_PROMPT = `Transform this character reference into a hyperrealistic photograph matching this exact style:

Shot on iPhone 14 Pro main camera, real optical behavior, natural lens falloff, true depth of field, subtle computational optics, micro-aberrations, realistic smartphone lens distortion, handheld imperfection.

Tight extreme close-up portrait, intimate selfie framing, casual eye-level angle, slight handheld micro-movement feel.

Soft natural daylight from window, diffused directional key light, balanced contrast, gentle highlight roll-off, realistic skin sheen, physically accurate subsurface scattering, light penetrating epidermal layers, no beauty lighting, no flattening.

Preserve the EXACT natural identity and bone structure from the reference. Relaxed micro-smile, realistic smile lines and micro-creases around lips, natural asymmetry, authentic expression, visible pores on cheeks nose and around mouth, slight redness and tone variation, tiny barely noticeable blemish, faint texture irregularities, natural skin oils reflecting light on lips and cheekbones.

Minimal makeup only, light base that does not hide pores, visible skin grain through foundation, natural lip texture with realistic gloss buildup, not plastic, not flat.

Ultra-detailed skin textures, visible pores, fine skin grain, micro-hair, natural blemishes, realistic specular highlights, organic surface variation.

Hyperrealistic detail, ultra sharp optics, natural grain, photometric accuracy, subsurface scattering, tactile skin texture, editorial realism, smartphone photography authenticity, imperfect beauty, human realism, soft diffusion, tonal richness, realistic highlights, depth realism, color discipline, natural variance, unretouched look.`

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { influencerId, modelId, baseImageBase64, baseImageMimeType } = body as {
      influencerId: string
      modelId: ImageModelId
      baseImageBase64?: string
      baseImageMimeType?: string
    }

    if (!influencerId || !modelId) {
      return NextResponse.json({ error: 'influencerId y modelId son requeridos' }, { status: 400 })
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

    const selectedProvider = modelIdToProviderType(modelId)

    const providerKeyMap: Record<ImageProviderType, keyof typeof apiKeys> = {
      gemini: 'gemini', openai: 'openai', seedream: 'kie', flux: 'bfl', fal: 'fal',
    }

    // For Gemini: accept either Google key OR KIE key (KIE provides Gemini models)
    const hasRequiredKey = selectedProvider === 'gemini'
      ? !!(apiKeys.gemini || apiKeys.kie)
      : !!apiKeys[providerKeyMap[selectedProvider]]

    if (!hasRequiredKey) {
      const keyNames: Record<ImageProviderType, string> = {
        gemini: 'Google (Gemini) o KIE.ai', openai: 'OpenAI', seedream: 'KIE.ai', flux: 'Black Forest Labs', fal: 'fal.ai',
      }
      return NextResponse.json({
        error: `Configura tu API key de ${keyNames[selectedProvider]} en Settings`,
      }, { status: 400 })
    }

    // If base64 not provided, fetch from storage
    let refBase64 = baseImageBase64
    let refMime = baseImageMimeType || 'image/jpeg'

    if (!refBase64) {
      // Fetch the influencer to get base_image_url
      const { data: inf } = await supabase
        .from('influencers')
        .select('base_image_url')
        .eq('id', influencerId)
        .eq('user_id', user.id)
        .single()

      if (!inf?.base_image_url) {
        return NextResponse.json({ error: 'No se encontro imagen base' }, { status: 400 })
      }

      // Download the image
      const imgRes = await fetch(inf.base_image_url)
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Error al descargar imagen base' }, { status: 500 })
      }
      const imgBuffer = await imgRes.arrayBuffer()
      refBase64 = Buffer.from(imgBuffer).toString('base64')
      refMime = imgRes.headers.get('content-type') || 'image/jpeg'
    }

    console.log(`[Influencer/EnhanceRealism] User: ${user.id.substring(0, 8)}..., Model: ${modelId}`)

    // Upload reference image to get public URL (needed for KIE-based providers)
    let productImageUrls: string[] | undefined
    const needsPublicUrls = selectedProvider === 'seedream' || (selectedProvider === 'gemini' && apiKeys.kie)
    if (needsPublicUrls) {
      const buffer = Buffer.from(refBase64, 'base64')
      const ext = refMime.includes('png') ? 'png' : 'jpg'
      const tmpPath = `influencers/${user.id}/tmp_realism_ref.${ext}`

      await supabase.storage
        .from('landing-images')
        .upload(tmpPath, buffer, { contentType: refMime, upsert: true })

      const { data: { publicUrl } } = supabase.storage
        .from('landing-images')
        .getPublicUrl(tmpPath)

      productImageUrls = [publicUrl]
    }

    // Generate enhanced image
    const generateRequest: GenerateImageRequest = {
      provider: selectedProvider,
      modelId,
      prompt: REALISM_PROMPT,
      productImagesBase64: [{ data: refBase64, mimeType: refMime }],
      productImageUrls,
      aspectRatio: '9:16',
    }

    const elapsedMs = Date.now() - startTime
    let result = await generateImage(generateRequest, apiKeys, {
      maxTotalMs: Math.max(95000 - elapsedMs, 30000), // Fit in 120s maxDuration
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
        error: result.error || 'No se pudo mejorar la imagen',
      }, { status: 200 })
    }

    // Upload result to storage
    const ext = result.mimeType?.includes('png') ? 'png' : 'jpg'
    const buffer = Buffer.from(result.imageBase64, 'base64')
    const storagePath = `influencers/${user.id}/${Date.now()}_realistic.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(storagePath, buffer, { contentType: result.mimeType || 'image/png', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(storagePath)

    // Update influencer
    await supabase
      .from('influencers')
      .update({
        realistic_image_url: publicUrl,
        current_step: 3,
        updated_at: new Date().toISOString(),
      })
      .eq('id', influencerId)
      .eq('user_id', user.id)

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[Influencer/EnhanceRealism] Done in ${totalTime}s`)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
    })

  } catch (error: any) {
    console.error('[Influencer/EnhanceRealism] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al mejorar imagen' }, { status: 500 })
  }
}
