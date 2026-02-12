// KIE.ai Video Provider - All video models go through KIE.ai API
// Docs: https://docs.kie.ai

import {
  VideoModelId,
  GenerateVideoRequest,
  GenerateVideoResult,
  VIDEO_MODELS,
  getVideoApiModelId,
} from './types'

const KIE_API_BASE = 'https://api.kie.ai/api/v1'

/**
 * Convert standard aspect ratio to Sora format
 * Sora uses "landscape" / "portrait" instead of "16:9" / "9:16"
 */
function convertAspectRatioForSora(aspectRatio: string | undefined): string {
  switch (aspectRatio) {
    case '9:16':
      return 'portrait'
    case '1:1':
      return 'landscape' // Sora doesn't have 1:1, default to landscape
    case '16:9':
    default:
      return 'landscape'
  }
}

/**
 * Convert resolution for Hailuo format
 * Hailuo uses "768P" / "1080P" (uppercase P)
 */
function convertResolutionForHailuo(resolution: string | undefined): string {
  switch (resolution) {
    case '1080p':
    case '1080P':
      return '1080P'
    case '768p':
    case '768P':
    default:
      return '768P'
  }
}

/**
 * Generate video using KIE.ai API
 * 
 * Important:
 * - Veo models use different endpoint: /api/v1/veo/generate
 * - Other models use: /api/v1/jobs/createTask
 * - Images must be public URLs (not base64)
 */
export async function generateVideo(
  request: GenerateVideoRequest,
  apiKey: string
): Promise<GenerateVideoResult> {
  try {
    const modelConfig = VIDEO_MODELS[request.modelId]
    if (!modelConfig) {
      throw new Error(`Unknown video model: ${request.modelId}`)
    }

    const hasImage = !!(request.imageUrls && request.imageUrls.length > 0)
    const apiModelId = getVideoApiModelId(request.modelId, hasImage)

    console.log(`[Video] Model: ${request.modelId} -> API model: ${apiModelId}`)
    console.log(`[Video] Has image: ${hasImage}`)
    console.log(`[Video] Request imageUrls:`, request.imageUrls)

    // Veo models use different endpoint
    if (modelConfig.useVeoEndpoint) {
      return await generateVeoVideo(request, apiKey, request.modelId)
    }

    // Standard models use createTask endpoint
    return await generateStandardVideo(request, apiKey, apiModelId, modelConfig)

  } catch (error: any) {
    console.error('[Video] Error:', error.message)
    return {
      success: false,
      error: error.message || 'Video generation failed',
      provider: 'kie',
    }
  }
}

/**
 * Generate video with Veo 3.1 (special endpoint)
 * Endpoint: POST /api/v1/veo/generate
 *
 * From KIE docs (https://docs.kie.ai/veo3-api/generate-veo-3-video):
 * - model: "veo3" (Quality, 250 credits) or "veo3_fast" (Fast, 60 credits)
 * - aspect_ratio: "16:9", "9:16", or "Auto"
 * - generationType: TEXT_2_VIDEO, FIRST_AND_LAST_FRAMES_2_VIDEO, REFERENCE_2_VIDEO
 * - imageUrls: array of public URLs (for image-to-video)
 * - enableTranslation: boolean (translate prompt to English)
 * - seed: number (10000-99999) for reproducible results
 *
 * IMPORTANT:
 * - Parameter is "model" NOT "mode"!
 * - Valid values: "veo3" or "veo3_fast"
 * - REFERENCE_2_VIDEO only works with veo3_fast
 */
async function generateVeoVideo(
  request: GenerateVideoRequest,
  apiKey: string,
  modelId: VideoModelId
): Promise<GenerateVideoResult> {
  // Map our model IDs to KIE's expected values
  // veo-3.1 -> "veo3" (Quality, 250 credits)
  // veo-3-fast -> "veo3_fast" (Fast, 60 credits)
  const kieModel = modelId === 'veo-3.1' ? 'veo3' : 'veo3_fast'

  const body: Record<string, any> = {
    model: kieModel, // "veo3" or "veo3_fast"
    prompt: request.prompt,
    aspect_ratio: request.aspectRatio || '16:9', // "16:9", "9:16", "Auto"
    enableTranslation: true,
  }

  // Add seed if provided (10000-99999)
  if (request.veoSeed && request.veoSeed >= 10000 && request.veoSeed <= 99999) {
    body.seed = request.veoSeed
  }

  // Determine generation type - use explicit type if provided, otherwise infer from images
  if (request.veoGenerationType) {
    body.generationType = request.veoGenerationType

    // Add images based on generation type
    if (request.veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO') {
      // 1-2 images for first/last frame
      if (request.imageUrls && request.imageUrls.length > 0) {
        body.imageUrls = request.imageUrls.slice(0, 2)
      }
    } else if (request.veoGenerationType === 'REFERENCE_2_VIDEO') {
      // 1-3 images for reference (only veo3_fast)
      if (kieModel !== 'veo3_fast') {
        throw new Error('REFERENCE_2_VIDEO solo funciona con Veo 3 Fast')
      }
      if (request.imageUrls && request.imageUrls.length > 0) {
        body.imageUrls = request.imageUrls.slice(0, 3)
      }
    }
    // TEXT_2_VIDEO doesn't need images
  } else {
    // Fallback: infer from images (legacy behavior)
    if (request.imageUrls && request.imageUrls.length > 0) {
      body.imageUrls = request.imageUrls
      body.generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
    } else {
      body.generationType = 'TEXT_2_VIDEO'
    }
  }

  console.log('[Video/Veo] Request:', JSON.stringify({
    ...body,
    prompt: body.prompt?.substring(0, 50) + '...',
    imageUrls: body.imageUrls ? `[${body.imageUrls.length} URLs]` : undefined,
  }))

  const response = await fetch(`${KIE_API_BASE}/veo/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()
  console.log('[Video/Veo] Response:', response.status, responseText.substring(0, 500))

  let data: any
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`)
  }

  if (data.code !== 200) {
    throw new Error(`Veo API error: ${data.msg || data.message || JSON.stringify(data)}`)
  }

  const taskId = data.data?.taskId
  if (!taskId) {
    throw new Error(`No taskId in Veo response`)
  }

  return {
    success: true,
    taskId: taskId,
    status: 'processing',
    provider: 'kie-veo',
  }
}

/**
 * Generate video with standard models (Sora, Kling, Hailuo, Wan, Seedance)
 * Endpoint: POST /api/v1/jobs/createTask
 * 
 * IMPORTANT: Different models have different parameter requirements:
 * 
 * IMAGE FIELD NAMES:
 * - Kling 2.6: image_urls (array)
 * - Sora 2: image_urls (array)
 * - Wan 2.6: image_urls (array)
 * - Wan 2.5: image_url (singular string) ← DIFFERENT!
 * - Seedance 1.5 Pro: input_urls (array)
 * - Seedance 1.0 Fast: image_url (singular string)
 * - Kling v2.5 Turbo: image_url (singular string)
 * - Hailuo: image_url (singular string)
 * 
 * ASPECT RATIO:
 * - Sora 2: "landscape" / "portrait" (NOT "16:9" / "9:16"!)
 * - Seedance 1.5 Pro: "16:9", "9:16", "1:1" (REQUIRED)
 * - Others: "16:9", "9:16", "1:1"
 * 
 * DURATION:
 * - Kling: duration as STRING ("5" or "10")
 * - Sora: n_frames as STRING ("10" or "15")
 * - Hailuo: duration as STRING ("6" or "10")
 * - Seedance 1.5 Pro: duration as STRING ("4", "8", "12") - REQUIRED
 * - Seedance 1.0 Fast: duration as STRING ("5" or "10")
 * - Wan: duration as STRING ("5", "10", "15")
 * 
 * RESOLUTION:
 * - Hailuo: "768P" / "1080P" (uppercase P)
 * - Seedance/Wan: "480p", "720p", "1080p"
 * - Others: "720p", "1080p"
 * 
 * AUDIO:
 * - Kling 2.6: sound (boolean) - REQUIRED
 * - Seedance 1.5 Pro: generate_audio (boolean)
 * - Wan: NO audio param in image-to-video
 * - Kling v2.5/Hailuo/Seedance 1.0: no audio support
 */
async function generateStandardVideo(
  request: GenerateVideoRequest,
  apiKey: string,
  model: string,
  modelConfig: any
): Promise<GenerateVideoResult> {
  // Build input object
  const input: Record<string, any> = {
    prompt: request.prompt,
  }

  // Model type detection - be SPECIFIC about versions!
  const isKling30 = request.modelId === 'kling-3.0'
  const isKling26 = request.modelId === 'kling-2.6'
  const isKlingV25 = request.modelId === 'kling-v25-turbo'
  const isKling = request.modelId.startsWith('kling')
  const isSora = request.modelId === 'sora-2'
  const isWan26 = request.modelId === 'wan-2.6'
  const isWan25 = request.modelId === 'wan-2.5'
  const isWan = isWan26 || isWan25
  const isHailuo = request.modelId.startsWith('hailuo')
  const isSeedance15 = request.modelId === 'seedance-1.5-pro'
  const isSeedance10 = request.modelId === 'seedance-1.0-fast'
  const isSeedance = isSeedance15 || isSeedance10

  console.log(`[Video] Model detection: isKling30=${isKling30}, isWan26=${isWan26}, isWan25=${isWan25}, isKling26=${isKling26}, isSora=${isSora}, isHailuo=${isHailuo}, isSeedance15=${isSeedance15}, isSeedance10=${isSeedance10}`)

  // Image URLs - DIFFERENT MODELS USE DIFFERENT FIELD NAMES!
  if (request.imageUrls && request.imageUrls.length > 0) {
    if (isKling30 || isKling26 || isSora || isWan26) {
      // Kling 3.0, Kling 2.6, Sora 2, and Wan 2.6 use image_urls (plural array)
      input.image_urls = request.imageUrls
      console.log(`[Video] Using image_urls (array) for ${request.modelId}`)
    } else if (isWan25) {
      // Wan 2.5 uses image_url (singular string)
      input.image_url = request.imageUrls[0]
      console.log(`[Video] Using image_url (singular) for ${request.modelId}`)
    } else if (isSeedance15) {
      // Seedance 1.5 Pro uses input_urls (array)
      input.input_urls = request.imageUrls
      console.log(`[Video] Using input_urls (array) for ${request.modelId}`)
    } else if (isSeedance10) {
      // Seedance 1.0 Fast uses image_url (singular string)
      input.image_url = request.imageUrls[0]
      console.log(`[Video] Using image_url (singular) for ${request.modelId}`)
    } else if (isKlingV25) {
      // Kling v2.5 Turbo uses image_url (SINGULAR string!)
      input.image_url = request.imageUrls[0]
      // Also supports tail_image_url for end frame
      if (request.imageUrls.length > 1) {
        input.tail_image_url = request.imageUrls[1]
      }
      console.log(`[Video] Using image_url (singular) for ${request.modelId}`)
    } else if (isHailuo) {
      // Hailuo uses image_url (singular)
      input.image_url = request.imageUrls[0]
      console.log(`[Video] Using image_url (singular) for ${request.modelId}`)
    } else {
      // Fallback - use singular image_url
      input.image_url = request.imageUrls[0]
      console.log(`[Video] Fallback: Using image_url (singular) for ${request.modelId}`)
    }
  }

  // Aspect ratio - SORA USES DIFFERENT FORMAT!
  if (request.aspectRatio) {
    if (isSora) {
      // Sora uses "landscape" / "portrait" instead of "16:9" / "9:16"
      input.aspect_ratio = convertAspectRatioForSora(request.aspectRatio)
    } else {
      input.aspect_ratio = request.aspectRatio
    }
  } else if (isSeedance15) {
    // Seedance 1.5 Pro requires aspect_ratio, default to 16:9
    input.aspect_ratio = '16:9'
  }

  // Duration - model specific handling
  // ALL these models require duration as STRING
  if (request.duration) {
    if (isSora) {
      // Sora uses n_frames as string ("10" or "15")
      input.n_frames = request.duration.toString()
    } else if (isKling || isHailuo || isSeedance || isWan) {
      // Kling, Hailuo, Seedance, and Wan ALL require duration as STRING
      input.duration = request.duration.toString()
    } else {
      // Fallback - use as provided
      input.duration = request.duration
    }
  } else if (isSeedance15) {
    // Seedance 1.5 Pro requires duration, default to 8s
    input.duration = '8'
  } else if (isSeedance10) {
    // Seedance 1.0 Fast - duration is optional but use 5s as default
    input.duration = '5'
  }

  // Audio parameter - different names for different models
  if (isKling30 || isKling26) {
    // Kling 3.0 and 2.6 use "sound" (boolean) - THIS IS REQUIRED!
    input.sound = request.enableAudio ?? false
  } else if (isSeedance15) {
    // Only Seedance 1.5 Pro supports generate_audio
    if (modelConfig.supportsAudio) {
      input.generate_audio = request.enableAudio ?? false
    }
  }
  // Note: Wan image-to-video doesn't have audio param
  // Note: Kling v2.5, Hailuo, Sora, and Seedance 1.0 don't support audio

  // Wan 2.6 specific: multi_shots option
  if (isWan26 && modelConfig.supportsMultiShots) {
    input.multi_shots = false // default to single shot
  }

  // Kling 3.0 multi-shot support
  if (isKling30 && request.multiShots && request.multiPrompt && request.multiPrompt.length > 0) {
    input.multi_shots = true
    input.multi_prompt = request.multiPrompt
  }

  // Kling 3.0 element references
  if (isKling30 && request.klingElements && request.klingElements.length > 0) {
    input.kling_elements = request.klingElements
  }

  // Resolution - ONLY if model accepts it
  // Some models like Kling v2.5 Turbo don't accept resolution parameter
  if (request.resolution && !modelConfig.noResolutionParam) {
    if (isHailuo) {
      // Hailuo uses "768P" / "1080P" (uppercase P)
      input.resolution = convertResolutionForHailuo(request.resolution)
    } else {
      input.resolution = request.resolution
    }
  }

  // Kling v2.5 specific params
  if (isKlingV25) {
    // Default cfg_scale for better results
    input.cfg_scale = 0.5
    // Optional: negative prompt for quality
    input.negative_prompt = 'blur, distort, low quality'
  }

  // Watermark removal (if available)
  input.remove_watermark = true

  // FULL DEBUG LOG - show exactly what we're sending
  const fullPayload = {
    model: model,
    input: input,
  }
  console.log('[Video] FULL PAYLOAD:', JSON.stringify(fullPayload))

  const response = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(fullPayload),
  })

  const responseText = await response.text()
  console.log('[Video] Response:', response.status, responseText.substring(0, 500))

  let data: any
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    throw new Error(`Invalid JSON: ${responseText.substring(0, 200)}`)
  }

  if (data.code !== 200 && data.code !== 0) {
    throw new Error(`KIE API error: ${data.msg || data.message || JSON.stringify(data)}`)
  }

  const taskId = data.data?.taskId || data.taskId
  if (!taskId) {
    throw new Error(`No taskId in response`)
  }

  return {
    success: true,
    taskId: taskId,
    status: 'processing',
    provider: 'kie',
  }
}

/**
 * Check video generation status
 */
export async function checkVideoStatus(
  taskId: string,
  apiKey: string
): Promise<GenerateVideoResult> {
  try {
    const response = await fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`)
    }

    const data = await response.json()
    const taskData = data.data || data
    const state = taskData.state || ''

    console.log('[Video] Status:', state, '| Data:', JSON.stringify(taskData).substring(0, 200))

    // Processing states
    if (['waiting', 'queuing', 'generating', 'processing', 'running', 'pending'].includes(state)) {
      return {
        success: true,
        taskId: taskId,
        status: 'processing',
        provider: 'kie',
      }
    }

    // Failed states
    if (['fail', 'failed', 'error'].includes(state)) {
      return {
        success: false,
        error: taskData.failMsg || taskData.failCode || 'Video generation failed',
        provider: 'kie',
      }
    }

    // Success - extract video URL
    if (state === 'success' || state === 'completed') {
      let videoUrl: string | undefined

      // Try to get video URL from various fields
      if (taskData.resultJson) {
        try {
          const result = typeof taskData.resultJson === 'string'
            ? JSON.parse(taskData.resultJson)
            : taskData.resultJson

          // Different models return URL in different fields
          videoUrl = result.videoUrl ||
                     result.video_url ||
                     result.resultUrls?.[0] ||
                     result.videos?.[0] ||
                     result.url ||
                     result.output?.url
        } catch (e) {
          console.error('[Video] Failed to parse resultJson:', e)
        }
      }

      // Also check direct fields on taskData
      if (!videoUrl) {
        videoUrl = taskData.videoUrl || taskData.video_url || taskData.resultUrl
      }

      if (videoUrl) {
        return {
          success: true,
          videoUrl: videoUrl,
          status: 'completed',
          provider: 'kie',
        }
      }

      // Have success state but no URL - might still be processing
      console.log('[Video] Success state but no URL found, returning as completed without URL')
      return {
        success: false,
        error: 'Video completed but URL not found',
        provider: 'kie',
      }
    }

    // If state is empty or undefined, task might still be initializing
    if (!state) {
      return {
        success: true,
        taskId: taskId,
        status: 'processing',
        provider: 'kie',
      }
    }

    return {
      success: false,
      error: `Unknown status: ${state}`,
      provider: 'kie',
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Status check failed',
      provider: 'kie',
    }
  }
}

/**
 * Poll for video result with timeout
 */
export async function pollForVideoResult(
  taskId: string,
  apiKey: string,
  options: {
    maxAttempts?: number
    intervalMs?: number
    timeoutMs?: number
  } = {}
): Promise<GenerateVideoResult> {
  const maxAttempts = options.maxAttempts || 300
  const intervalMs = options.intervalMs || 3000 // 3 seconds
  const timeoutMs = options.timeoutMs || 600000 // 10 minutes

  const startTime = Date.now()

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (Date.now() - startTime > timeoutMs) {
      return {
        success: false,
        error: 'Video generation timed out',
        provider: 'kie',
      }
    }

    const result = await checkVideoStatus(taskId, apiKey)

    if (result.status === 'completed' || !result.success) {
      return result
    }

    // Still processing
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return {
    success: false,
    error: 'Max polling attempts reached',
    provider: 'kie',
  }
}
