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

function buildContentPrompt(
  promptDescriptor: string,
  situation: string,
  mode: 'solo' | 'with_product',
  productInfo?: { name: string; position: string }
): string {
  let prompt = `A hyperrealistic photograph of ${promptDescriptor}. `
  prompt += `Scene: ${situation}. `

  if (mode === 'with_product' && productInfo) {
    const positionMap: Record<string, string> = {
      en_la_mano: 'holding the product naturally in their hand, showing it to the camera',
      junto_al_rostro: 'holding the product next to their face, as in a beauty ad',
      en_la_mesa: 'sitting at a table with the product placed in front of them',
      usando: 'actively using the product in a natural way',
    }
    prompt += `The person is ${positionMap[productInfo.position] || 'holding the product naturally'}. `
    prompt += `The product is: ${productInfo.name}. `
  }

  prompt += `Shot on iPhone 14 Pro, natural lighting, hyperrealistic, editorial quality, 8K detail.`
  return prompt
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
    const {
      influencerId,
      modelId,
      mode,
      situation,
      productName,
      productPosition,
      productImageBase64,
      productImageMimeType,
      promptDescriptor: fallbackDescriptor,
      realisticImageUrl: fallbackRealisticUrl,
    } = body as {
      influencerId: string
      modelId: ImageModelId
      mode: 'solo' | 'with_product'
      situation: string
      productName?: string
      productPosition?: string
      productImageBase64?: string
      productImageMimeType?: string
      promptDescriptor?: string
      realisticImageUrl?: string
    }

    if (!influencerId || !modelId || !situation) {
      return NextResponse.json({ error: 'influencerId, modelId y situation son requeridos' }, { status: 400 })
    }

    const modelConfig = IMAGE_MODELS[modelId]
    if (!modelConfig) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 400 })
    }

    // Get influencer data (use DB values first, fallback to frontend-provided)
    const { data: inf } = await supabase
      .from('influencers')
      .select('prompt_descriptor, realistic_image_url')
      .eq('id', influencerId)
      .eq('user_id', user.id)
      .single()

    const descriptor = inf?.prompt_descriptor || fallbackDescriptor || 'a person'
    const realisticUrl = inf?.realistic_image_url || fallbackRealisticUrl

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

    // Build prompt
    const prompt = buildContentPrompt(
      descriptor,
      situation,
      mode,
      mode === 'with_product' && productName
        ? { name: productName, position: productPosition || 'en_la_mano' }
        : undefined
    )

    console.log(`[Influencer/GenerateContent] User: ${user.id.substring(0, 8)}..., Mode: ${mode}, Model: ${modelId}`)

    // Get reference image for image-to-image models
    let refImages: { data: string; mimeType: string }[] = []
    let productImageUrls: string[] | undefined

    if (realisticUrl) {
      const imgRes = await fetch(realisticUrl)
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer()
        const base64 = Buffer.from(imgBuffer).toString('base64')
        const mime = imgRes.headers.get('content-type') || 'image/jpeg'
        refImages.push({ data: base64, mimeType: mime })

        // Upload to get public URL (needed for KIE-based providers)
        const needsPublicUrls = selectedProvider === 'seedream' || (selectedProvider === 'gemini' && apiKeys.kie)
        if (needsPublicUrls) {
          const buffer = Buffer.from(base64, 'base64')
          const ext = mime.includes('png') ? 'png' : 'jpg'
          const tmpPath = `influencers/${user.id}/tmp_content_ref.${ext}`

          await supabase.storage
            .from('landing-images')
            .upload(tmpPath, buffer, { contentType: mime, upsert: true })

          const { data: { publicUrl } } = supabase.storage
            .from('landing-images')
            .getPublicUrl(tmpPath)

          productImageUrls = [publicUrl]
        }
      }
    }

    // Add product image if provided
    if (mode === 'with_product' && productImageBase64) {
      refImages.push({ data: productImageBase64, mimeType: productImageMimeType || 'image/jpeg' })

      const needsProductUrl = selectedProvider === 'seedream' || (selectedProvider === 'gemini' && apiKeys.kie)
      if (needsProductUrl) {
        const buffer = Buffer.from(productImageBase64, 'base64')
        const ext = (productImageMimeType || '').includes('png') ? 'png' : 'jpg'
        const tmpPath = `influencers/${user.id}/tmp_product_ref.${ext}`

        await supabase.storage
          .from('landing-images')
          .upload(tmpPath, buffer, { contentType: productImageMimeType || 'image/jpeg', upsert: true })

        const { data: { publicUrl } } = supabase.storage
          .from('landing-images')
          .getPublicUrl(tmpPath)

        if (!productImageUrls) productImageUrls = []
        productImageUrls.push(publicUrl)
      }
    }

    // Generate content image
    const generateRequest: GenerateImageRequest = {
      provider: selectedProvider,
      modelId,
      prompt,
      productImagesBase64: refImages.length > 0 ? refImages : undefined,
      productImageUrls,
      aspectRatio: '9:16',
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
        error: result.error || 'No se pudo generar el contenido',
      }, { status: 200 })
    }

    // Upload result
    const ext = result.mimeType?.includes('png') ? 'png' : 'jpg'
    const buffer = Buffer.from(result.imageBase64, 'base64')
    const storagePath = `influencers/${user.id}/${Date.now()}_content.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(storagePath, buffer, { contentType: result.mimeType || 'image/png', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(storagePath)

    // Save to gallery (graceful — table may not exist yet)
    let galleryId: string | null = null
    try {
      const { data: galleryRow } = await supabase
        .from('influencer_gallery')
        .insert({
          influencer_id: influencerId,
          user_id: user.id,
          image_url: publicUrl,
          type: mode,
          product_name: mode === 'with_product' ? productName : null,
          product_image_url: null,
          prompt_used: prompt,
          situation,
        })
        .select('id')
        .single()
      galleryId = galleryRow?.id || null
    } catch (e) {
      console.warn('[Influencer/GenerateContent] Gallery insert skipped:', e)
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[Influencer/GenerateContent] Done in ${totalTime}s`)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      galleryId,
    })

  } catch (error: any) {
    console.error('[Influencer/GenerateContent] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar contenido' }, { status: 500 })
  }
}
