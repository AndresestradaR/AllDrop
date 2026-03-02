import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { tryUploadToR2, tryUploadUrlToR2 } from '@/lib/services/r2-upload'

type ToolType = 'variations' | 'upscale' | 'remove-bg' | 'camera-angle' | 'mockup' | 'lip-sync' | 'deep-face'

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

  // Use gemini-2.5-flash for image generation (confirmed working)
  const apiModelId = 'gemini-2.5-flash-image'
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

  // Safety timeout: 90s
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)

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
      signal: controller.signal,
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
    if (error.name === 'AbortError') {
      console.error(`[Tools/Gemini] ${toolType} timeout after 90s`)
      return { success: false, error: 'Tiempo agotado. Intenta de nuevo.' }
    }
    console.error('[Tools/Gemini] Error:', error.message)
    return { success: false, error: error.message || 'Error en la generacion' }
  } finally {
    clearTimeout(timeout)
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

// Deep Face options for Kling 2.6 Motion Control
interface DeepFaceOptions {
  videoUrl: string
  faceUrl: string
  prompt?: string
  orientation: 'video' | 'image'
  mode: '720p' | '1080p'
}

/**
 * Generate deep face video using KIE Kling 2.6 Motion Control
 * Returns taskId for async polling
 */
async function generateDeepFace(
  options: DeepFaceOptions,
  apiKey: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const { videoUrl, faceUrl, prompt, orientation, mode } = options

  console.log(`[Tools/DeepFace] Starting with Kling 2.6 Motion Control`)
  console.log('[Tools/DeepFace] Video URL:', videoUrl)
  console.log('[Tools/DeepFace] Face URL:', faceUrl)
  console.log('[Tools/DeepFace] Orientation:', orientation, 'Mode:', mode)

  try {
    const payload = {
      model: 'kling-2.6/motion-control',
      input: {
        prompt: prompt || '',
        input_urls: [faceUrl],
        video_urls: [videoUrl],
        character_orientation: orientation,
        mode,
      },
    }

    console.log('[Tools/DeepFace] Payload:', JSON.stringify(payload, null, 2))

    const response = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log('[Tools/DeepFace] Response:', response.status, responseText.substring(0, 500))

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

    console.log(`[Tools/DeepFace] Task created: ${taskId}`)
    return { success: true, taskId }

  } catch (error: any) {
    console.error('[Tools/DeepFace] Error:', error.message)
    return { success: false, error: error.message || 'Error en deep face' }
  }
}

/**
 * Check deep face task status (uses same endpoint as lip sync)
 */
async function checkDeepFaceStatus(
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

    console.log('[Tools/DeepFace] Status:', state)

    // Processing states
    if (['waiting', 'queuing', 'generating', 'processing', 'running', 'pending'].includes(state)) {
      return { success: true, status: 'processing' }
    }

    // Failed states
    if (['fail', 'failed', 'error'].includes(state)) {
      return { success: false, error: taskData.failMsg || 'Deep face failed' }
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
          console.error('[Tools/DeepFace] Failed to parse resultJson')
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

    // Check Content-Type to determine how to parse the request
    const contentType = request.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')

    // Variables for form data
    let image: File | null = null
    let audio: File | null = null
    let video: File | null = null
    let tool: ToolType
    let formData: FormData | null = null

    // Variables for JSON data (deep-face with pre-uploaded URLs)
    let jsonBody: {
      tool: ToolType
      videoUrl?: string
      imageUrl?: string
      orientation?: 'video' | 'image'
      mode?: '720p' | '1080p'
      prompt?: string
    } | null = null

    // Lip sync specific fields from FormData
    let lipSyncModel: LipSyncModelType = 'kling'
    let lipSyncPrompt: string | null = null
    let lipSyncResolution: '480p' | '720p' = '720p'
    let lipSyncSeed: number | undefined = undefined

    if (isJson) {
      // Parse JSON body (for deep-face with pre-uploaded URLs)
      jsonBody = await request.json()

      if (!jsonBody || !jsonBody.tool) {
        return NextResponse.json({ error: 'Herramienta es requerida' }, { status: 400 })
      }

      tool = jsonBody.tool

      // Deep face via JSON requires URLs
      if (tool === 'deep-face') {
        if (!jsonBody.videoUrl || !jsonBody.imageUrl) {
          return NextResponse.json(
            { error: 'Deep face requiere videoUrl e imageUrl' },
            { status: 400 }
          )
        }
      }
    } else {
      // Parse FormData (for other tools)
      formData = await request.formData()
      image = formData.get('image') as File | null
      tool = formData.get('tool') as ToolType
      audio = formData.get('audio') as File | null // For lip-sync
      video = formData.get('video') as File | null // For deep-face (legacy, not used anymore)

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
        // Extract lip sync specific fields
        lipSyncModel = (formData.get('lipSyncModel') as LipSyncModelType) || 'kling'
        lipSyncPrompt = formData.get('prompt') as string | null
        lipSyncResolution = (formData.get('resolution') as '480p' | '720p') || '720p'
        const seedStr = formData.get('seed') as string | null
        lipSyncSeed = seedStr ? parseInt(seedStr) : undefined
      } else if (!image) {
        return NextResponse.json({ error: 'Imagen es requerida' }, { status: 400 })
      }
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

    // Convert image to base64 (for non-lip-sync, non-deep-face tools)
    let imageBase64 = ''
    let mimeType = ''
    if (image && !isJson) {
      const imageBuffer = await image.arrayBuffer()
      imageBase64 = Buffer.from(imageBuffer).toString('base64')
      mimeType = image.type || 'image/png'
    }

    switch (tool) {
      // ========================================
      // GEMINI-based tools (variations, upscale, camera-angle, mockup)
      // Cascade: user Google key → platform GEMINI_API_KEY
      // ========================================
      case 'variations':
      case 'upscale':
      case 'camera-angle':
      case 'mockup': {
        const geminiKeys: string[] = []
        if (profile.google_api_key) {
          try { geminiKeys.push(decrypt(profile.google_api_key)) } catch {}
        }
        if (process.env.GEMINI_API_KEY) {
          const platformKey = process.env.GEMINI_API_KEY
          if (!geminiKeys.includes(platformKey)) geminiKeys.push(platformKey)
        }

        if (geminiKeys.length === 0) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de Google para esta herramienta' },
            { status: 400 }
          )
        }

        const geminiErrors: string[] = []
        for (const gKey of geminiKeys) {
          const keyLabel = gKey === process.env.GEMINI_API_KEY ? 'platform' : 'user'
          const result = await generateWithGemini(imageBase64, mimeType, tool, gKey)

          if (result.success && result.imageBase64) {
            if (keyLabel === 'platform') console.log(`[Tools] ${tool} succeeded via platform key (fallback)`)
            // Try R2 upload
            const r2Url = await tryUploadToR2(
              user.id,
              Buffer.from(result.imageBase64, 'base64'),
              `tools/${tool}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`,
              'image/png'
            )
            if (r2Url) console.log(`[Tools] ✓ ${tool} saved to R2: ${r2Url}`)

            return NextResponse.json({
              success: true,
              imageBase64: result.imageBase64,
              mimeType: 'image/png',
              r2Url,
            })
          }

          geminiErrors.push(`Google (${keyLabel}): ${result.error}`)
          console.error(`[Tools] ${tool} failed with ${keyLabel} key: ${result.error}`)
        }

        return NextResponse.json(
          { error: geminiErrors[geminiErrors.length - 1] || `Error al procesar ${tool}` },
          { status: 500 }
        )
      }

      // ========================================
      // BFL FLUX - Background removal
      // Cascade: user BFL key → platform BFL_API_KEY
      // ========================================
      case 'remove-bg': {
        const bflKeys: string[] = []
        if (profile.bfl_api_key) {
          try { bflKeys.push(decrypt(profile.bfl_api_key)) } catch {}
        }
        if (process.env.BFL_API_KEY) {
          const platformKey = process.env.BFL_API_KEY
          if (!bflKeys.includes(platformKey)) bflKeys.push(platformKey)
        }

        if (bflKeys.length === 0) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de Black Forest Labs para esta herramienta' },
            { status: 400 }
          )
        }

        const bflErrors: string[] = []
        for (const bKey of bflKeys) {
          const keyLabel = bKey === process.env.BFL_API_KEY ? 'platform' : 'user'
          const result = await removeBackground(imageBase64, bKey)

          if (result.success && result.imageBase64) {
            if (keyLabel === 'platform') console.log('[Tools] remove-bg succeeded via platform key (fallback)')
            // Try R2 upload
            const r2Url = await tryUploadToR2(
              user.id,
              Buffer.from(result.imageBase64, 'base64'),
              `tools/remove-bg/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`,
              'image/png'
            )
            if (r2Url) console.log(`[Tools] ✓ remove-bg saved to R2: ${r2Url}`)

            return NextResponse.json({
              success: true,
              imageBase64: result.imageBase64,
              mimeType: 'image/png',
              r2Url,
            })
          }

          bflErrors.push(`BFL (${keyLabel}): ${result.error}`)
          console.error(`[Tools] remove-bg failed with ${keyLabel} key: ${result.error}`)
        }

        return NextResponse.json(
          { error: bflErrors[bflErrors.length - 1] || 'Error al quitar fondo' },
          { status: 500 }
        )
      }

      // ========================================
      // KIE.ai - Lip Sync (Kling AI Avatar / Infinitalk)
      // Cascade: user KIE key → platform KIE_API_KEY
      // ========================================
      case 'lip-sync': {
        const kieKeys: string[] = []
        if (profile.kie_api_key) {
          try { kieKeys.push(decrypt(profile.kie_api_key)) } catch {}
        }
        if (process.env.KIE_API_KEY) {
          const platformKey = process.env.KIE_API_KEY
          if (!kieKeys.includes(platformKey)) kieKeys.push(platformKey)
        }

        if (kieKeys.length === 0) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de KIE.ai para esta herramienta' },
            { status: 400 }
          )
        }

        // Use lip sync specific fields extracted earlier
        console.log(`[Tools/LipSync] Model: ${lipSyncModel}, Resolution: ${lipSyncResolution}, Seed: ${lipSyncSeed}`)

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

        const lipSyncErrors: string[] = []
        for (const kKey of kieKeys) {
          const keyLabel = kKey === process.env.KIE_API_KEY ? 'platform' : 'user'
          const result = await generateLipSync(
            {
              imageUrl,
              audioUrl,
              model: lipSyncModel,
              prompt: lipSyncPrompt || undefined,
              resolution: lipSyncResolution,
              seed: lipSyncSeed,
            },
            kKey
          )

          if (result.success && result.taskId) {
            if (keyLabel === 'platform') console.log('[Tools] lip-sync succeeded via platform key (fallback)')
            return NextResponse.json({
              success: true,
              taskId: result.taskId,
              status: 'processing',
            })
          }

          lipSyncErrors.push(`KIE (${keyLabel}): ${result.error}`)
          console.error(`[Tools] lip-sync failed with ${keyLabel} key: ${result.error}`)
        }

        return NextResponse.json(
          { error: lipSyncErrors[lipSyncErrors.length - 1] || 'Error al iniciar lip sync' },
          { status: 500 }
        )
      }

      // ========================================
      // KIE.ai - Deep Face (Kling 2.6 Motion Control)
      // Cascade: user KIE key → platform KIE_API_KEY
      // ========================================
      case 'deep-face': {
        // Deep face expects JSON with pre-uploaded URLs
        if (!jsonBody || !jsonBody.videoUrl || !jsonBody.imageUrl) {
          return NextResponse.json(
            { error: 'Deep face requiere videoUrl e imageUrl (subidos previamente a Supabase)' },
            { status: 400 }
          )
        }

        const dfKieKeys: string[] = []
        if (profile.kie_api_key) {
          try { dfKieKeys.push(decrypt(profile.kie_api_key)) } catch {}
        }
        if (process.env.KIE_API_KEY) {
          const platformKey = process.env.KIE_API_KEY
          if (!dfKieKeys.includes(platformKey)) dfKieKeys.push(platformKey)
        }

        if (dfKieKeys.length === 0) {
          return NextResponse.json(
            { error: 'Necesitas configurar tu API key de KIE.ai para esta herramienta' },
            { status: 400 }
          )
        }

        // Extract deep face specific fields from JSON body
        const { videoUrl, imageUrl, prompt, orientation = 'video', mode = '1080p' } = jsonBody

        console.log(`[Tools/DeepFace] Orientation: ${orientation}, Mode: ${mode}`)
        console.log(`[Tools/DeepFace] Video URL: ${videoUrl}`)
        console.log(`[Tools/DeepFace] Image URL: ${imageUrl}`)

        const dfErrors: string[] = []
        for (const kKey of dfKieKeys) {
          const keyLabel = kKey === process.env.KIE_API_KEY ? 'platform' : 'user'
          const result = await generateDeepFace(
            {
              videoUrl,
              faceUrl: imageUrl,
              prompt: prompt || undefined,
              orientation,
              mode,
            },
            kKey
          )

          if (result.success && result.taskId) {
            if (keyLabel === 'platform') console.log('[Tools] deep-face succeeded via platform key (fallback)')
            return NextResponse.json({
              success: true,
              taskId: result.taskId,
              status: 'processing',
            })
          }

          dfErrors.push(`KIE (${keyLabel}): ${result.error}`)
          console.error(`[Tools] deep-face failed with ${keyLabel} key: ${result.error}`)
        }

        return NextResponse.json(
          { error: dfErrors[dfErrors.length - 1] || 'Error al iniciar deep face' },
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
 * GET endpoint for checking KIE task status (lip-sync and deep-face)
 * Both use the same KIE recordInfo endpoint
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
    const type = searchParams.get('type') || 'lip-sync' // 'lip-sync' or 'deep-face'

    if (!taskId) {
      return NextResponse.json({ error: 'taskId es requerido' }, { status: 400 })
    }

    // Get user's KIE API key (cascade: user key → platform key)
    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', user.id)
      .single()

    let kieKey: string | null = null
    if (profile?.kie_api_key) {
      try { kieKey = decrypt(profile.kie_api_key) } catch {}
    }
    if (!kieKey && process.env.KIE_API_KEY) {
      kieKey = process.env.KIE_API_KEY
    }

    if (!kieKey) {
      return NextResponse.json({ error: 'KIE API key no configurada' }, { status: 400 })
    }

    // Both use the same endpoint, but use appropriate function for logging
    const result = type === 'deep-face'
      ? await checkDeepFaceStatus(taskId, kieKey)
      : await checkLipSyncStatus(taskId, kieKey)

    // If completed with video URL, try R2 upload
    if (result.status === 'completed' && result.videoUrl) {
      const r2Url = await tryUploadUrlToR2(
        user.id,
        result.videoUrl,
        `tools/${type}/${Date.now()}-${taskId.substring(0, 8)}.mp4`,
        'video/mp4'
      )
      if (r2Url) console.log(`[Tools/${type}] ✓ Video saved to R2: ${r2Url}`)
      return NextResponse.json({ ...result, r2Url })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
