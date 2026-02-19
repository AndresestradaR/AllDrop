import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { aiLimiter, getClientIp } from '@/lib/rate-limit'
import {
  generateImage,
  pollForResult,
  ImageProviderType,
  GenerateImageRequest,
} from '@/lib/image-providers'

async function optimizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const optimized = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    console.log(`[Optimize] ${buffer.length} -> ${optimized.length} bytes (WebP)`)
    return { buffer: optimized, mimeType: 'image/webp' }
  } catch (e) {
    console.error('[Optimize] Failed, using original:', e)
    return { buffer, mimeType }
  }
}

function getAspectRatio(outputSize: string): '9:16' | '1:1' | '16:9' | '4:5' {
  if (outputSize === '1080x1920' || outputSize === '9:16') return '9:16'
  if (outputSize === '1080x1080' || outputSize === '1:1') return '1:1'
  if (outputSize === '1920x1080' || outputSize === '16:9') return '16:9'
  if (outputSize === '1080x1350' || outputSize === '4:5') return '4:5'
  return '9:16'
}

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const [header, data] = dataUrl.split(',')
  const mimeType = header.split(':')[1]?.split(';')[0] || 'image/jpeg'
  return { data, mimeType }
}

// Upload base64 image to Supabase Storage and return public URL
// Uses 'landing-images' bucket which has INSERT policy for authenticated users
async function uploadToStorage(
  supabase: any,
  base64Data: string,
  mimeType: string,
  userId: string,
  index: number
): Promise<string | null> {
  try {
    // Convert base64 to buffer and optimize
    const rawBuffer = Buffer.from(base64Data, 'base64')
    const optimized = await optimizeImage(rawBuffer, mimeType)
    const uploadBuffer = optimized.buffer
    const uploadMimeType = optimized.mimeType
    const ext = uploadMimeType.split('/')[1] || 'png'
    const fileName = `temp-products/${userId}/${Date.now()}-${index}.${ext}`

    console.log(`[Storage] Uploading to landing-images bucket: ${fileName} (${uploadBuffer.length} bytes)`)

    // Upload to 'landing-images' bucket (has INSERT policy for authenticated)
    const { data, error } = await supabase.storage
      .from('landing-images')
      .upload(fileName, uploadBuffer, {
        contentType: uploadMimeType,
        upsert: true,
      })
    
    if (error) {
      console.error('[Storage] Upload error:', error.message, error)
      return null
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('landing-images')
      .getPublicUrl(fileName)
    
    console.log('[Storage] Upload success:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (e: any) {
    console.error('[Storage] Exception:', e.message)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { success } = aiLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      productId,
      productName,
      templateId,
      templateUrl,
      productPhotos,
      outputSize,
      creativeControls,
      provider = 'gemini', // Default to Gemini
      modelId, // New hierarchical model ID
      targetCountry,
      currencySymbol,
      priceAfter,
      priceBefore,
      priceCombo2,
      priceCombo3,
      colorPalette,
      typography,
      productContext,
    } = body

    if (!templateUrl) {
      return NextResponse.json({ error: 'Plantilla requerida' }, { status: 400 })
    }

    if (!productPhotos || productPhotos.length === 0) {
      return NextResponse.json({ error: 'Al menos una foto del producto requerida' }, { status: 400 })
    }

    // Get API keys from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key')
      .eq('id', user.id)
      .single()

    // Build API keys object
    const apiKeys: {
      gemini?: string
      openai?: string
      kie?: string
      bfl?: string
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

    // Also check environment variables as fallback
    if (!apiKeys.openai && process.env.OPENAI_API_KEY) {
      apiKeys.openai = process.env.OPENAI_API_KEY
    }
    if (!apiKeys.kie && process.env.KIE_API_KEY) {
      apiKeys.kie = process.env.KIE_API_KEY
    }
    if (!apiKeys.bfl && process.env.BFL_API_KEY) {
      apiKeys.bfl = process.env.BFL_API_KEY
    }

    // Validate we have the required API key for the selected provider
    const selectedProvider = provider as ImageProviderType
    const providerKeyMap: Record<ImageProviderType, keyof typeof apiKeys> = {
      gemini: 'gemini',
      openai: 'openai',
      seedream: 'kie',
      flux: 'bfl',
    }

    const requiredKey = providerKeyMap[selectedProvider]
    if (!apiKeys[requiredKey]) {
      const keyNames: Record<ImageProviderType, string> = {
        gemini: 'Google (Gemini)',
        openai: 'OpenAI',
        seedream: 'KIE.ai',
        flux: 'Black Forest Labs',
      }
      return NextResponse.json({
        error: `Configura tu API key de ${keyNames[selectedProvider]} en Settings`,
      }, { status: 400 })
    }

    // Check if templateUrl is a public URL or a data URL
    const isPublicUrl = templateUrl.startsWith('http://') || templateUrl.startsWith('https://')

    // Parse template
    let templateBase64: string
    let templateMimeType: string

    if (templateUrl.startsWith('data:')) {
      const parsed = parseDataUrl(templateUrl)
      if (!parsed) throw new Error('Invalid template')
      templateBase64 = parsed.data
      templateMimeType = parsed.mimeType
    } else {
      const response = await fetch(templateUrl)
      const buffer = await response.arrayBuffer()
      templateBase64 = Buffer.from(buffer).toString('base64')
      templateMimeType = response.headers.get('content-type') || 'image/jpeg'
    }

    // Determine if this provider needs public URLs
    // KIE.ai (Seedream) and BFL (FLUX) require public URLs for images
    const needsPublicUrls = selectedProvider === 'seedream' || selectedProvider === 'flux'
    
    console.log(`[Generate] Provider: ${selectedProvider}, needs public URLs: ${needsPublicUrls}`)

    // Parse product photos
    const productImagesBase64: { data: string; mimeType: string }[] = []
    const productImageUrls: string[] = [] // For providers that need URLs
    
    // Use regular client for uploads (has user context for RLS)
    console.log(`[Generate] Processing ${productPhotos.length} product photos`)
    
    for (let i = 0; i < productPhotos.length; i++) {
      const photoUrl = productPhotos[i]
      console.log(`[Generate] Photo ${i}: ${photoUrl?.substring(0, 50)}...`)
      
      if (photoUrl?.startsWith('data:')) {
        const parsed = parseDataUrl(photoUrl)
        if (parsed) {
          productImagesBase64.push(parsed)
          console.log(`[Generate] Parsed photo ${i}: ${parsed.mimeType}, ${parsed.data.length} chars`)
          
          // Upload to storage if provider needs public URLs
          // Use regular supabase client (with user auth) for RLS
          if (needsPublicUrls) {
            console.log(`[Generate] Uploading photo ${i} to storage...`)
            const publicUrl = await uploadToStorage(
              supabase,
              parsed.data,
              parsed.mimeType,
              user.id,
              i
            )
            if (publicUrl) {
              productImageUrls.push(publicUrl)
              console.log(`[Generate] Photo ${i} uploaded: ${publicUrl}`)
            } else {
              console.error(`[Generate] Failed to upload photo ${i}`)
            }
          }
        }
      } else if (photoUrl?.startsWith('http')) {
        // Already a public URL
        productImageUrls.push(photoUrl)
        console.log(`[Generate] Photo ${i} is already a URL: ${photoUrl}`)
        // Also fetch and convert to base64 for other providers
        try {
          const response = await fetch(photoUrl)
          const buffer = await response.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          const mimeType = response.headers.get('content-type') || 'image/jpeg'
          productImagesBase64.push({ data: base64, mimeType })
        } catch (e) {
          console.error('Failed to fetch product image:', e)
        }
      }
    }

    console.log(`[Generate] Result: ${productImagesBase64.length} base64 images, ${productImageUrls.length} URLs`)

    if (productImagesBase64.length === 0) {
      return NextResponse.json({ error: 'No se pudieron procesar las fotos' }, { status: 400 })
    }

    // Get aspect ratio
    const aspectRatio = getAspectRatio(outputSize)

    // Build generation request with pricing data
    const generateRequest: GenerateImageRequest = {
      provider: selectedProvider,
      modelId: modelId,
      prompt: '',
      // Pass public URL for providers that support it
      templateUrl: isPublicUrl ? templateUrl : undefined,
      templateBase64,
      templateMimeType,
      productImagesBase64,
      // Pass product image URLs for providers that need them
      productImageUrls: productImageUrls.length > 0 ? productImageUrls : undefined,
      aspectRatio,
      productName,
      creativeControls: {
        ...creativeControls,
        currencySymbol: currencySymbol || '$',
        priceAfter,
        priceBefore,
        priceCombo2,
        priceCombo3,
        targetCountry,
        colorPalette,
        typography,
        productContext,
      },
    }

    console.log(`[Generate] Request ready:`)
    console.log(`  - Provider: ${selectedProvider}`)
    console.log(`  - Product: ${productName}`)
    console.log(`  - Aspect ratio: ${aspectRatio}`)
    console.log(`  - Template URL: ${isPublicUrl ? templateUrl : 'N/A (data URL)'}`)
    console.log(`  - Product URLs: ${productImageUrls.length}`)
    console.log(`  - Product Base64: ${productImagesBase64.length}`)

    // Generate image
    let result = await generateImage(generateRequest, apiKeys)

    // For async providers, poll for result
    if (result.success && result.status === 'processing' && result.taskId) {
      console.log(`Task created: ${result.taskId}, polling for result...`)

      const apiKey = apiKeys[requiredKey]!
      result = await pollForResult(selectedProvider, result.taskId, apiKey, {
        maxAttempts: 120,
        intervalMs: 1000,
        timeoutMs: 120000,
      })
    }

    if (!result.success || !result.imageBase64) {
      return NextResponse.json({
        success: false,
        error: result.error || 'No se pudo generar la imagen',
        provider: selectedProvider,
        tip: getProviderTip(selectedProvider),
      }, { status: 200 })
    }

    // Upload to Supabase Storage and get public URL
    const storageUrl = await uploadToStorage(
      await createClient(),
      result.imageBase64,
      result.mimeType || 'image/png',
      user.id,
      0
    )
    const generatedImageUrl = storageUrl || `data:${result.mimeType};base64,${result.imageBase64}`
    console.log(`Banner generated successfully with ${selectedProvider}, storage: ${!!storageUrl}`)

    // Save to database (use service client for bypassing RLS)
    const serviceClient = await createServiceClient()
    const { data: insertedSection, error: insertError } = await serviceClient
      .from('landing_sections')
      .insert({
        product_id: productId,
        user_id: user.id,
        template_id: templateId || null,
        output_size: outputSize,
        generated_image_url: generatedImageUrl,
        prompt_used: `Product: ${productName} | Provider: ${selectedProvider}`,
        status: 'completed',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Error guardando: ${insertError.message}`,
        imageUrl: generatedImageUrl,
      }, { status: 200 })
    }

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      sectionId: insertedSection?.id,
      provider: selectedProvider,
    })
  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getProviderTip(provider: ImageProviderType): string {
  const tips: Record<ImageProviderType, string> = {
    gemini: 'Para usar Gemini necesitas:\n1. API key de Google AI (console.cloud.google.com → Credentials)\n2. Facturacion activa (console.cloud.google.com/billing)\n3. Generative Language API habilitada\n\nSi acabas de activar billing, espera 2 minutos antes de reintentar.',
    openai: 'Para usar OpenAI necesitas:\n1. API key de OpenAI (platform.openai.com → API Keys)\n2. Creditos disponibles (platform.openai.com/account/billing)',
    seedream: 'Para usar Seedream necesitas:\n1. API key de KIE.ai\n2. Creditos disponibles en tu cuenta KIE',
    flux: 'Para usar FLUX necesitas:\n1. API key de Black Forest Labs\n2. Creditos disponibles',
  }
  return tips[provider]
}
