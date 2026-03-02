import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import {
  generateImage,
  pollForResult,
  ImageProviderType,
  GenerateImageRequest,
  IMAGE_MODELS,
  modelIdToProviderType,
  hasCascadeKey,
  type ImageModelId,
} from '@/lib/image-providers'
import { tryUploadToR2 } from '@/lib/services/r2-upload'

// Mark this route as requiring extended timeout (Vercel Pro)
export const maxDuration = 120 // 2 minutes max

// Upload base64 image to Supabase Storage and return public URL
async function uploadImageToStorage(
  supabase: any,
  base64Data: string,
  mimeType: string,
  userId: string,
  index: number
): Promise<string | null> {
  try {
    // Decode base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Determine file extension from mime type
    const ext = mimeType.includes('png') ? 'png' : 
                mimeType.includes('webp') ? 'webp' : 'jpg'
    
    // Generate unique filename (temp/ prefix for automatic cleanup)
    const filename = `temp/${userId}/${Date.now()}-${index}.${ext}`
    
    // Upload to Supabase Storage (landing-images bucket)
    const { data, error } = await supabase.storage
      .from('landing-images')
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: true,
      })
    
    if (error) {
      console.error('[Studio] Storage upload error:', error)
      return null
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(filename)
    
    console.log(`[Studio] Uploaded image to: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    console.error('[Studio] Upload error:', err)
    return null
  }
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
      modelId,
      prompt,
      aspectRatio = '1:1',
      quality = '1k',
      referenceImages,
    } = body as {
      modelId: ImageModelId
      prompt: string
      aspectRatio?: string
      quality?: string
      referenceImages?: { data: string; mimeType: string }[]
    }

    if (!modelId || !prompt) {
      return NextResponse.json(
        { error: 'Modelo y prompt son requeridos' },
        { status: 400 }
      )
    }

    // Validate model exists
    const modelConfig = IMAGE_MODELS[modelId]
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Modelo no encontrado' },
        { status: 400 }
      )
    }

    console.log(`[Studio] Request received - Model: ${modelId}, User: ${user.id.substring(0, 8)}...`)

    // Get API keys from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key, fal_api_key')
      .eq('id', user.id)
      .single()

    // Build API keys object
    const apiKeys: {
      gemini?: string
      openai?: string
      kie?: string
      bfl?: string
      fal?: string
    } = {}

    if (profile?.google_api_key) {
      apiKeys.gemini = decrypt(profile.google_api_key)
    }
    if (profile?.openai_api_key) {
      apiKeys.openai = decrypt(profile.openai_api_key)
    }
    if (profile?.kie_api_key) {
      apiKeys.kie = decrypt(profile.kie_api_key)
    }
    if (profile?.bfl_api_key) {
      apiKeys.bfl = decrypt(profile.bfl_api_key)
    }
    if (profile?.fal_api_key) {
      apiKeys.fal = decrypt(profile.fal_api_key)
    }

    // Environment variable fallbacks (platform keys)
    if (!apiKeys.openai && process.env.OPENAI_API_KEY) {
      apiKeys.openai = process.env.OPENAI_API_KEY
    }
    if (!apiKeys.kie && process.env.KIE_API_KEY) {
      apiKeys.kie = process.env.KIE_API_KEY
    }
    if (!apiKeys.bfl && process.env.BFL_API_KEY) {
      apiKeys.bfl = process.env.BFL_API_KEY
    }
    if (!apiKeys.fal && process.env.FAL_API_KEY) {
      apiKeys.fal = process.env.FAL_API_KEY
    }
    if (!apiKeys.gemini && process.env.GEMINI_API_KEY) {
      apiKeys.gemini = process.env.GEMINI_API_KEY
    }

    // Get provider from model
    const selectedProvider = modelIdToProviderType(modelId)

    // Validate we have at least one usable API key for the model's cascade
    if (!hasCascadeKey(modelId, apiKeys)) {
      return NextResponse.json({
        error: 'Configura al menos una API key compatible (KIE, fal.ai, Google, OpenAI o BFL) en Settings',
      }, { status: 400 })
    }

    // Parse reference images if provided
    const productImagesBase64: { data: string; mimeType: string }[] = []
    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        if (img.data && img.mimeType) {
          productImagesBase64.push(img)
        }
      }
    }

    console.log(`[Studio] Starting generation with ${selectedProvider}/${modelId}`)
    console.log(`[Studio] Prompt (first 100 chars): ${prompt.substring(0, 100)}...`)
    if (productImagesBase64.length > 0) {
      console.log(`[Studio] Reference images: ${productImagesBase64.length}`)
    }

    // Upload images to get public URLs (needed for KIE + fal.ai cascade)
    // All cascade providers require public URLs, not base64
    let productImageUrls: string[] | undefined
    if (productImagesBase64.length > 0) {
      console.log(`[Studio] Uploading ${productImagesBase64.length} images to temp storage...`)
      const urls: string[] = []

      for (let i = 0; i < productImagesBase64.length; i++) {
        const img = productImagesBase64[i]
        const url = await uploadImageToStorage(supabase, img.data, img.mimeType, user.id, i)
        if (url) {
          urls.push(url)
        }
      }

      if (urls.length > 0) {
        productImageUrls = urls
        console.log(`[Studio] Successfully uploaded ${urls.length} temp images`)
      }
    }

    // Build generation request
    const generateRequest: GenerateImageRequest = {
      provider: selectedProvider,
      modelId: modelId,
      prompt: prompt,
      productImagesBase64: productImagesBase64.length > 0 ? productImagesBase64 : undefined,
      productImageUrls: productImageUrls, // For Seedream (requires public URLs)
      aspectRatio: aspectRatio as '9:16' | '1:1' | '16:9',
    }

    // Generate image
    const elapsedMs = Date.now() - startTime
    let result = await generateImage(generateRequest, apiKeys, {
      maxTotalMs: Math.max(95000 - elapsedMs, 30000),
    })

    // For async providers (KIE, BFL), poll for result
    // Use shorter timeout to stay within Vercel limits
    if (result.success && result.status === 'processing' && result.taskId) {
      console.log(`[Studio] Async task created: ${result.taskId}, polling...`)

      const providerKeyMap: Record<ImageProviderType, keyof typeof apiKeys> = {
        gemini: 'gemini', openai: 'openai', seedream: 'kie', flux: 'bfl', fal: 'fal',
      }
      const apiKey = apiKeys[providerKeyMap[selectedProvider]]!
      const elapsedMs = Date.now() - startTime
      const remainingMs = Math.max(100000 - elapsedMs, 30000) // At least 30s, max until 100s total

      result = await pollForResult(selectedProvider, result.taskId, apiKey, {
        maxAttempts: Math.floor(remainingMs / 1000), // 1 attempt per second
        intervalMs: 1000,
        timeoutMs: remainingMs,
      })
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    if (!result.success || !result.imageBase64) {
      console.error(`[Studio] Generation failed after ${totalTime}s:`, result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'No se pudo generar la imagen',
        provider: selectedProvider,
      }, { status: 200 })
    }

    console.log(`[Studio] ✓ Image generated successfully in ${totalTime}s with ${selectedProvider}`)

    // Try R2 upload (optional, non-blocking)
    const resultMime = result.mimeType || 'image/png'
    const ext = resultMime.includes('png') ? 'png' : resultMime.includes('webp') ? 'webp' : 'jpg'
    const r2Url = await tryUploadToR2(
      user.id,
      Buffer.from(result.imageBase64, 'base64'),
      `images/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`,
      resultMime
    )
    if (r2Url) console.log(`[Studio] ✓ Image saved to R2: ${r2Url}`)

    // Cleanup temp images from storage (fire-and-forget)
    if (productImageUrls?.length) {
      Promise.all(
        productImageUrls.map(url => {
          const path = url.split('/landing-images/')[1]
          return path?.startsWith('temp/')
            ? supabase.storage.from('landing-images').remove([path])
            : Promise.resolve()
        })
      ).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      imageBase64: result.imageBase64,
      mimeType: resultMime,
      provider: selectedProvider,
      r2Url,
    })

  } catch (error: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[Studio] Error after ${totalTime}s:`, error.message)
    
    // Return user-friendly error messages
    let userMessage = 'Error interno del servidor'
    if (error.message?.includes('timeout') || error.message?.includes('tardó demasiado')) {
      userMessage = 'La generación tardó demasiado. Intenta de nuevo.'
    } else if (error.message?.includes('API key')) {
      userMessage = error.message
    } else if (error.message?.includes('SAFETY') || error.message?.includes('bloqueado')) {
      userMessage = 'Contenido bloqueado por filtros de seguridad. Modifica el prompt.'
    }
    
    return NextResponse.json({ 
      success: false,
      error: userMessage 
    }, { status: 500 })
  }
}
