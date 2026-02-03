import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import {
  generateVideo,
  VIDEO_MODELS,
  type VideoModelId,
} from '@/lib/video-providers'

// Extended timeout for video generation (Vercel Pro required)
export const maxDuration = 120

/**
 * Upload base64 image to Supabase Storage and get public URL
 * KIE.ai requires public URLs, not base64
 */
async function uploadImageToStorage(
  supabase: any,
  base64Data: string,
  userId: string,
  index: number
): Promise<string> {
  const base64Clean = base64Data.includes(',') 
    ? base64Data.split(',')[1] 
    : base64Data

  const buffer = Buffer.from(base64Clean, 'base64')
  const timestamp = Date.now()
  const filename = `studio/video/${userId}/${timestamp}-${index}.jpg`

  const { data, error } = await supabase.storage
    .from('landing-images')
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (error) {
    console.error('[Video] Storage upload error:', error)
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('landing-images')
    .getPublicUrl(filename)

  console.log('[Video] Uploaded image:', urlData.publicUrl)
  return urlData.publicUrl
}

// Veo generation types
type VeoGenerationType = 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO'

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
      duration = 5,
      aspectRatio = '16:9',
      resolution,
      enableAudio = true,
      imageBase64,
      imageBase64End,
      // Veo-specific parameters
      veoGenerationType,
      veoSeed,
      veoImages,
    } = body as {
      modelId: VideoModelId
      prompt: string
      duration?: number
      aspectRatio?: '16:9' | '9:16' | '1:1'
      resolution?: string
      enableAudio?: boolean
      imageBase64?: string
      imageBase64End?: string
      veoGenerationType?: VeoGenerationType
      veoSeed?: number
      veoImages?: string[]
    }

    const isVeoModel = modelId.startsWith('veo')

    if (!modelId || !prompt) {
      return NextResponse.json(
        { error: 'Modelo y prompt son requeridos' },
        { status: 400 }
      )
    }

    const modelConfig = VIDEO_MODELS[modelId]
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Modelo no encontrado' },
        { status: 400 }
      )
    }

    if (modelConfig.requiresImage && !imageBase64) {
      return NextResponse.json({
        success: false,
        error: `${modelConfig.name} solo soporta image-to-video. Por favor sube una imagen o usa otro modelo.`,
      }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.kie_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de KIE.ai en Settings para generar videos',
      }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)

    console.log(`[Video] Starting - Model: ${modelId}, User: ${user.id.substring(0, 8)}...`)
    console.log(`[Video] Prompt: ${prompt.substring(0, 100)}...`)
    console.log(`[Video] Duration: ${duration}s, Aspect: ${aspectRatio}, Audio: ${enableAudio}`)
    if (isVeoModel) {
      console.log(`[Video] Veo Type: ${veoGenerationType}, Seed: ${veoSeed}`)
    }

    // Upload images to get public URLs
    const imageUrls: string[] = []

    // Handle Veo images
    if (isVeoModel && veoImages && veoImages.length > 0) {
      console.log(`[Video] Uploading ${veoImages.length} Veo images...`)
      for (let i = 0; i < veoImages.length; i++) {
        const url = await uploadImageToStorage(supabase, veoImages[i], user.id, i)
        imageUrls.push(url)
      }
    }
    // Handle regular image-to-video
    else if (imageBase64 && modelConfig.supportsStartEndFrames) {
      console.log('[Video] Uploading start image...')
      const url = await uploadImageToStorage(supabase, imageBase64, user.id, 0)
      imageUrls.push(url)

      if (imageBase64End) {
        console.log('[Video] Uploading end image...')
        const urlEnd = await uploadImageToStorage(supabase, imageBase64End, user.id, 1)
        imageUrls.push(urlEnd)
      }
    }

    console.log(`[Video] Image URLs: ${imageUrls.length}`)

    // Build generation params
    const generationParams: Parameters<typeof generateVideo>[0] = {
      modelId,
      prompt,
      duration,
      aspectRatio,
      resolution: resolution || modelConfig.defaultResolution,
      enableAudio: modelConfig.supportsAudio ? enableAudio : false,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    }

    // Add Veo-specific params
    if (isVeoModel) {
      generationParams.veoGenerationType = veoGenerationType
      generationParams.veoSeed = veoSeed
    }

    // Create video task (returns taskId for async processing)
    const result = await generateVideo(generationParams, kieApiKey)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    if (!result.success) {
      console.error(`[Video] Task creation failed after ${elapsed}s:`, result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'No se pudo iniciar la generación',
      }, { status: 200 })
    }

    // Return taskId immediately - frontend will poll for status
    console.log(`[Video] Task created in ${elapsed}s: ${result.taskId}`)

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      status: 'processing',
      message: 'Video en proceso. Usa /api/studio/video-status para verificar el estado.',
    })

  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`[Video] Error after ${elapsed}s:`, error.message)
    
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error al generar video'
    }, { status: 500 })
  }
}
