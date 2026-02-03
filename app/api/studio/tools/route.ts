import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

type ToolType = 'variations' | 'upscale' | 'remove-bg' | 'camera-angle' | 'mockup' | 'lip-sync'

const KIE_API_BASE = 'https://api.kie.ai/api/v1'

// Tool-specific prompts for Gemini
const TOOL_PROMPTS: Record<string, string> = {
  variations: `Create a variation of this image. Keep the same subject, style, and quality but vary the composition, lighting, or perspective slightly to create an interesting alternative version. Maintain the same level of detail and professionalism.`,

  upscale: `Enhance this image to higher resolution and quality. Improve sharpness, details, and clarity while maintaining the original composition, colors, and style exactly. Make it look more professional and crisp.`,

  'camera-angle': `Reimagine this exact scene from a completely different camera angle. Create a new perspective as if the camera was positioned from above, below, from the side, or at a dramatic angle. Keep the same subject, lighting style, and quality but change the viewpoint dramatically.`,

  mockup: `Transform this product into a professional e-commerce mockup. Place the product in a clean, minimalist studio setting with professional soft lighting. Use a neutral background (white or light gray) with subtle shadows. Make it look like a high-end product photography shot ready for an online store.`,
}

/**
 * Generate image with Gemini (for variations, upscale, camera-angle, mockup)
 * Uses the correct API structure with inline_data and IMAGE modality
 */
async function generateWithGemini(
  imageBase64: string,
  mimeType: string,
  toolType: ToolType,
  apiKey: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  const prompt = TOOL_PROMPTS[toolType]
  if (!prompt) {
    return { success: false, error: 'Herramienta no soportada para Gemini' }
  }

  // Use gemini-2.0-flash for image generation (more reliable)
  const apiModelId = 'gemini-2.0-flash-exp-image-generation'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:generateContent`

  const parts = [
    {
      inline_data: {
        mime_type: mimeType,
        data: imageBase64,
      },
    },
    { text: prompt },
  ]

  console.log(`[Tools/Gemini] Starting ${toolType} with model: ${apiModelId}`)

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Tools/Gemini] API error: ${response.status} - ${errorText}`)

      if (response.status === 429) {
        return { success: false, error: 'Limite de API excedido. Espera un momento e intenta de nuevo.' }
      }
      if (response.status === 400 && errorText.includes('SAFETY')) {
        return { success: false, error: 'Imagen bloqueada por filtros de seguridad.' }
      }
      if (response.status === 403) {
        return { success: false, error: 'API key invalida o sin permisos para generacion de imagenes.' }
      }

      return { success: false, error: `Error de Gemini: ${response.status}` }
    }

    const data = await response.json()

    // Extract image from response
    for (const candidate of data.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data) {
          console.log(`[Tools/Gemini] ${toolType} completed successfully`)
          return {
            success: true,
            imageBase64: part.inlineData.data,
          }
        }
      }
    }

    // Check for blocked content
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      return { success: false, error: 'Contenido bloqueado por filtros de seguridad.' }
    }

    console.error('[Tools/Gemini] No image in response:', JSON.stringify(data).substring(0, 500))
    return { success: false, error: 'No se genero imagen. Intenta de nuevo.' }

  } catch (error: any) {
    console.error('[Tools/Gemini] Error:', error.message)
    return { success: false, error: error.message || 'Error en la generacion' }
  }
}

/**
 * Remove background using BFL FLUX Kontext Pro
 * Uses polling to wait for the result
 */
async function removeBackground(
  imageBase64: string,
  apiKey: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  console.log('[Tools/BFL] Starting background removal')

  try {
    // Clean base64 if it has data URL prefix
    const cleanedBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64

    // Create the task
    const createResponse = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-key': apiKey,
      },
      body: JSON.stringify({
        prompt: 'Remove the background completely, keep only the main subject with a clean transparent background. Do not modify the subject in any way.',
        input_image: cleanedBase64,
        output_format: 'png',
      }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}))
      console.error('[Tools/BFL] Create error:', errorData)
      return { success: false, error: errorData.detail || 'Error al iniciar proceso' }
    }

    const createData = await createResponse.json()
    const pollingUrl = createData.polling_url || createData.id

    if (!pollingUrl) {
      return { success: false, error: 'No se recibio ID de tarea' }
    }

    console.log(`[Tools/BFL] Task created: ${pollingUrl}`)

    // Poll for result (max 2 minutes)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000))

      const url = pollingUrl.startsWith('http')
        ? pollingUrl
        : `https://api.bfl.ai/v1/get_result?id=${pollingUrl}`

      const statusResponse = await fetch(url, {
        headers: { 'x-key': apiKey },
      })

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        console.log(`[Tools/BFL] Status: ${statusData.status}`)

        if (statusData.status === 'Ready' && statusData.result?.sample) {
          // Download the image
          const imageResponse = await fetch(statusData.result.sample)
          const imageBuffer = await imageResponse.arrayBuffer()
          const resultBase64 = Buffer.from(imageBuffer).toString('base64')

          console.log('[Tools/BFL] Background removal completed')
          return { success: true, imageBase64: resultBase64 }
        }

        if (statusData.status === 'Error' || statusData.status === 'Failed') {
          return { success: false, error: statusData.error || 'Error en el procesamiento' }
        }
      }
    }

    return { success: false, error: 'Tiempo de espera agotado' }

  } catch (error: any) {
    console.error('[Tools/BFL] Error:', error.message)
    return { success: false, error: error.message || 'Error en el procesamiento' }
  }
}

// Lip Sync model types
type LipSyncModelType = 'kling' | 'infinitalk'

interface LipSyncOptions {
  imageUrl: string
  audioUrl: string
  model: LipSyncModelType
  // Infinitalk-specific options
  prompt?: string
  resolution?: '480p' | '720p'
  seed?: number
}

/**
 * Generate lip sync video using KIE.ai
 * Supports both Kling AI Avatar and Infinitalk models
 * Returns taskId for async polling
 */
async function generateLipSync(
  options: LipSyncOptions,
  apiKey: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const { imageUrl, audioUrl, model, prompt, resolution, seed } = options

  console.log(`[Tools/LipSync] Starting with model: ${model}`)
  console.log('[Tools/LipSync] Image URL:', imageUrl)
  console.log('[Tools/LipSync] Audio URL:', audioUrl)

  try {
    let payload: Record<string, any>

    if (model === 'infinitalk') {
      // Infinitalk model with additional options
      payload = {
        model: 'infinitalk/from-audio',
        input: {
          image_url: imageUrl,
          audio_url: audioUrl,
          ...(prompt && { prompt }),
          resolution: resolution || '720p',
          ...(seed && { seed }),
        },
      }
      console.log('[Tools/LipSync] Infinitalk config:', { prompt: prompt?.substring(0, 50), resolution, seed })
    } else {
      // Kling AI Avatar (default)
      payload = {
        model: 'kling/ai-avatar-standard',
        input: {
          image_url: imageUrl,
          audio_url: audioUrl,
          prompt: prompt || '', // Use provided prompt or empty string
        },
      }
    }

    const response = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log('[Tools/LipSync] Response:', response.status, responseText.substring(0, 500))

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      return { success: false, error: `Respuesta invalida: ${responseText.substring(0, 200)}` }
    }

    if (data.code !== 200 && data.code !== 0) {
      return { success: false, error: data.msg || data.message || 'Error en KIE API' }
    }

    const taskId = data.data?.taskId || data.taskId
    if (!taskId) {
      return { success: false, error: 'No se recibio ID de tarea' }
    }

    console.log(`[Tools/LipSync] Task created: ${taskId}`)
    return { success: true, taskId }

  } catch (error: any) {
    console.error('[Tools/LipSync] Error:', error.message)
    return { success: false, error: error.message || 'Error en lip sync' }
  }
}

/**
 * Check lip sync task status
 */
async function checkLipSyncStatus(
  taskId: string,
  apiKey: string
): Promise<{ success: boolean; videoUrl?: string; status?: string; error?: string }> {
  try {
    const response = await fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      return { success: false, error: `Status check failed: ${response.status}` }
    }

    const data = await response.json()
    const taskData = data.data || data
    const state = taskData.state || ''

    console.log('[Tools/LipSync] Status:', state)

    // Processing states
    if (['waiting', 'queuing', 'generating', 'processing', 'running', 'pending'].includes(state)) {
      return { success: true, status: 'processing' }
    }

    // Failed states
    if (['fail', 'failed', 'error'].includes(state)) {
      return { success: false, error: taskData.failMsg || 'Lip sync failed' }
    }

    // Success - extract video URL
    if (state === 'success' || state === 'completed') {
      let videoUrl: string | undefined

      if (taskData.resultJson) {
        try {
          const result = typeof taskData.resultJson === 'string'
            ? JSON.parse(taskData.resultJson)
            : taskData.resultJson

          videoUrl = result.videoUrl || result.video_url || result.resultUrls?.[0] || result.url
        } catch (e) {
          console.error('[Tools/LipSync] Failed to parse resultJson')
        }
      }

      if (!videoUrl) {
        videoUrl = taskData.videoUrl || taskData.video_url || taskData.resultUrl
      }

      if (videoUrl) {
        return { success: true, videoUrl, status: 'completed' }
      }

      return { success: false, error: 'Video completed but URL not found' }
    }

    // Still initializing
    if (!state) {
      return { success: true, status: 'processing' }
    }

    return { success: false, error: `Unknown status: ${state}` }

  } catch (error: any) {
    return { success: false, error: error.message || 'Status check failed' }
  }
}

/**
 * Upload file to Supabase and return public URL
 * Uses 'landing-images' bucket which is already configured as public
 */
async function uploadToSupabase(
  supabase: any,
  userId: string,
  file: File | Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const bucket = 'landing-images' // Use existing public bucket
  const path = `studio/lip-sync/${userId}/${Date.now()}-${filename}`

  try {
    const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file

    console.log(`[Upload] Uploading to ${bucket}/${path} (${contentType}, ${fileBuffer.length} bytes)`)

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error('[Upload] Supabase error:', error.message, error)
      return null
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
    const publicUrl = urlData?.publicUrl || null

    console.log(`[Upload] Success: ${publicUrl}`)
    return publicUrl
  } catch (err: any) {
    console.error('[Upload] Exception:', err.message)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const image = formData.get('image') as File | null
    const tool = formData.get('tool') as ToolType
    const audio = formData.get('audio') as File | null // For lip-sync

    if (!tool) {
      return NextResponse.json({ error: 'Herramienta es requerida' }, { status: 400 })
    }

    // Lip sync requires image + audio
    if (tool === 'lip-sync') {
      if (!image || !audio) {
        return NextResponse.json(
          { error: 'Lip sync requiere una imagen y un audio' },
          { status: 400 }
        )
      }
    } else if (!image) {
      return NextResponse.json({ error: 'Imagen es requerida' }, { status: 400 })
    }

    // Get user's API keys
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // Convert image to base64 (for non-lip-sync tools)
    let imageBase64 = ''
    let mimeType = ''
    if (image) {
      const imageBuffer = await image.arrayBuffer()
      imageBase64 = Buffer.from(imageBuffer).toString('base64')
      mimeType = image.type || 'image/png'
    }

    switch (tool) {
      // ========================================
      // GEMINI-based tools (variations, upscale, camera-angle, mockup)
      // ========================================
      case 'variations':
      case 'upscale':
      case 'camera-angle':
      case 'mockup': {
        if (!profile.google_api_key) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de Google para esta herramienta' },
            { status: 400 }
          )
        }

        const apiKey = decrypt(profile.google_api_key)
        const result = await generateWithGemini(imageBase64, mimeType, tool, apiKey)

        if (result.success && result.imageBase64) {
          return NextResponse.json({
            success: true,
            imageBase64: result.imageBase64,
            mimeType: 'image/png',
          })
        }

        return NextResponse.json(
          { error: result.error || `Error al procesar ${tool}` },
          { status: 500 }
        )
      }

      // ========================================
      // BFL FLUX - Background removal
      // ========================================
      case 'remove-bg': {
        if (!profile.bfl_api_key) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de Black Forest Labs para esta herramienta' },
            { status: 400 }
          )
        }

        const apiKey = decrypt(profile.bfl_api_key)
        const result = await removeBackground(imageBase64, apiKey)

        if (result.success && result.imageBase64) {
          return NextResponse.json({
            success: true,
            imageBase64: result.imageBase64,
            mimeType: 'image/png',
          })
        }

        return NextResponse.json(
          { error: result.error || 'Error al quitar fondo' },
          { status: 500 }
        )
      }

      // ========================================
      // KIE.ai - Lip Sync (Kling AI Avatar / Infinitalk)
      // ========================================
      case 'lip-sync': {
        if (!profile.kie_api_key) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de KIE.ai para esta herramienta' },
            { status: 400 }
          )
        }

        const apiKey = decrypt(profile.kie_api_key)

        // Extract lip sync specific fields
        const lipSyncModel = (formData.get('lipSyncModel') as LipSyncModelType) || 'kling'
        const prompt = formData.get('prompt') as string | null
        const resolution = (formData.get('resolution') as '480p' | '720p') || '720p'
        const seedStr = formData.get('seed') as string | null
        const seed = seedStr ? parseInt(seedStr) : undefined

        console.log(`[Tools/LipSync] Model: ${lipSyncModel}, Resolution: ${resolution}, Seed: ${seed}`)

        // Upload image and audio to Supabase to get public URLs
        const imageUrl = await uploadToSupabase(
          supabase,
          user.id,
          image!,
          `lipsync-image.${image!.name.split('.').pop() || 'png'}`,
          image!.type || 'image/png'
        )

        const audioUrl = await uploadToSupabase(
          supabase,
          user.id,
          audio!,
          `lipsync-audio.${audio!.name.split('.').pop() || 'mp3'}`,
          audio!.type || 'audio/mpeg'
        )

        if (!imageUrl || !audioUrl) {
          return NextResponse.json(
            { error: 'Error al subir archivos' },
            { status: 500 }
          )
        }

        const result = await generateLipSync(
          {
            imageUrl,
            audioUrl,
            model: lipSyncModel,
            prompt: prompt || undefined,
            resolution,
            seed,
          },
          apiKey
        )

        if (result.success && result.taskId) {
          return NextResponse.json({
            success: true,
            taskId: result.taskId,
            status: 'processing',
          })
        }

        return NextResponse.json(
          { error: result.error || 'Error al iniciar lip sync' },
          { status: 500 }
        )
      }

      default:
        return NextResponse.json({ error: 'Herramienta no soportada' }, { status: 400 })
    }

  } catch (error) {
    console.error('Studio tools error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * GET endpoint for checking lip-sync status
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId es requerido' }, { status: 400 })
    }

    // Get user's KIE API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.kie_api_key) {
      return NextResponse.json({ error: 'KIE API key no configurada' }, { status: 400 })
    }

    const apiKey = decrypt(profile.kie_api_key)
    const result = await checkLipSyncStatus(taskId, apiKey)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
