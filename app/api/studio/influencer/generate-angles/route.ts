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

const ANGLES_PROMPT = `Create a professional character reference sheet: a 3x3 grid (9 images) showing the EXACT same person from the reference image, photographed from different angles.

Maintain PERFECT identity consistency across ALL images - same face shape, same eyes, same nose, same skin texture, same features, same accessories.

Grid layout:
Top row: Close-up high angle portrait | Medium frontal portrait | Medium close-up 3/4 angle
Middle row: Close-up low angle selfie | Extreme close-up eyes macro | Profile side view left
Bottom row: Looking up smiling | Back of head 3/4 rear | Profile side view right

All shots: Same soft natural daylight, same wardrobe, same skin texture, white/light neutral background. iPhone photography quality, hyperrealistic.

CRITICAL: Every single image must be recognizably the SAME person. Do not change any facial features between angles.`

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { influencerId, modelId, realisticImageBase64, realisticImageMimeType } = body as {
      influencerId: string
      modelId: ImageModelId
      realisticImageBase64?: string
      realisticImageMimeType?: string
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
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key')
      .eq('id', user.id)
      .single()

    const apiKeys: { gemini?: string; openai?: string; kie?: string; bfl?: string } = {}
    if (profile?.google_api_key) apiKeys.gemini = decrypt(profile.google_api_key)
    if (profile?.openai_api_key) apiKeys.openai = decrypt(profile.openai_api_key)
    if (profile?.kie_api_key) apiKeys.kie = decrypt(profile.kie_api_key)
    if (profile?.bfl_api_key) apiKeys.bfl = decrypt(profile.bfl_api_key)

    const selectedProvider = modelIdToProviderType(modelId)

    const providerKeyMap: Record<ImageProviderType, keyof typeof apiKeys> = {
      gemini: 'gemini', openai: 'openai', seedream: 'kie', flux: 'bfl',
    }

    if (!apiKeys[providerKeyMap[selectedProvider]]) {
      const keyNames: Record<ImageProviderType, string> = {
        gemini: 'Google (Gemini)', openai: 'OpenAI', seedream: 'KIE.ai', flux: 'Black Forest Labs',
      }
      return NextResponse.json({
        error: `Configura tu API key de ${keyNames[selectedProvider]} en Settings`,
      }, { status: 400 })
    }

    // If base64 not provided, fetch from storage
    let refBase64 = realisticImageBase64
    let refMime = realisticImageMimeType || 'image/jpeg'

    if (!refBase64) {
      const { data: inf } = await supabase
        .from('influencers')
        .select('realistic_image_url')
        .eq('id', influencerId)
        .eq('user_id', user.id)
        .single()

      if (!inf?.realistic_image_url) {
        return NextResponse.json({ error: 'No se encontro imagen realista' }, { status: 400 })
      }

      const imgRes = await fetch(inf.realistic_image_url)
      if (!imgRes.ok) {
        return NextResponse.json({ error: 'Error al descargar imagen realista' }, { status: 500 })
      }
      const imgBuffer = await imgRes.arrayBuffer()
      refBase64 = Buffer.from(imgBuffer).toString('base64')
      refMime = imgRes.headers.get('content-type') || 'image/jpeg'
    }

    console.log(`[Influencer/GenerateAngles] User: ${user.id.substring(0, 8)}..., Model: ${modelId}`)

    // For Seedream, upload reference image to get public URL
    let productImageUrls: string[] | undefined
    if (selectedProvider === 'seedream') {
      const buffer = Buffer.from(refBase64, 'base64')
      const ext = refMime.includes('png') ? 'png' : 'jpg'
      const tmpPath = `influencers/${user.id}/tmp_angles_ref.${ext}`

      await supabase.storage
        .from('landing-images')
        .upload(tmpPath, buffer, { contentType: refMime, upsert: true })

      const { data: { publicUrl } } = supabase.storage
        .from('landing-images')
        .getPublicUrl(tmpPath)

      productImageUrls = [publicUrl]
    }

    // Generate angles grid (1:1 aspect ratio)
    const generateRequest: GenerateImageRequest = {
      provider: selectedProvider,
      modelId,
      prompt: ANGLES_PROMPT,
      productImagesBase64: [{ data: refBase64, mimeType: refMime }],
      productImageUrls,
      aspectRatio: '1:1',
    }

    let result = await generateImage(generateRequest, apiKeys)

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
        error: result.error || 'No se pudo generar el grid',
      }, { status: 200 })
    }

    // Upload result
    const ext = result.mimeType?.includes('png') ? 'png' : 'jpg'
    const buffer = Buffer.from(result.imageBase64, 'base64')
    const storagePath = `influencers/${user.id}/${Date.now()}_angles.${ext}`

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
        angles_grid_url: publicUrl,
        current_step: 4,
        updated_at: new Date().toISOString(),
      })
      .eq('id', influencerId)
      .eq('user_id', user.id)

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[Influencer/GenerateAngles] Done in ${totalTime}s`)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
    })

  } catch (error: any) {
    console.error('[Influencer/GenerateAngles] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar grid' }, { status: 500 })
  }
}
