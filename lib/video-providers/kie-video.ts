// KIE.ai Video Provider - All video models go through KIE.ai API
// Docs: https://docs.kie.ai

import {
  VideoModelId,
  GenerateVideoRequest,
  GenerateVideoResult,
  VIDEO_MODELS,
  getVideoApiModelId,
} from './types'
import { generateVideoViaFal } from './fal-video'
import { generateVideoViaWavespeed } from './wavespeed-video'
import { logAI } from '../services/ai-monitor'

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
  apiKey: string,
  falApiKey?: string,
  forceFal?: boolean,
  wavespeedApiKey?: string
): Promise<GenerateVideoResult> {
  const t0 = Date.now()
  try {
    const modelConfig = VIDEO_MODELS[request.modelId]
    if (!modelConfig) {
      throw new Error(`Unknown video model: ${request.modelId}`)
    }

    const hasImage = !!(request.imageUrls && request.imageUrls.length > 0)
    const apiModelId = getVideoApiModelId(request.modelId, hasImage)

    console.log(`[Video] Model: ${request.modelId} -> API model: ${apiModelId}`)
    console.log(`[Video] Has image: ${hasImage}, forceFal: ${!!forceFal}`)
    console.log(`[Video] Request imageUrls:`, request.imageUrls)

    // forceFal: skip KIE entirely, go straight to fal.ai (used after KIE polling failures)
    if (forceFal && falApiKey) {
      const falConfig = modelConfig.fal
      const falPath = falConfig ? (hasImage ? (falConfig.i2v || falConfig.t2v) : falConfig.t2v) : modelConfig.falModelId
      if (falPath) {
        console.log(`[Video] forceFal=true, going directly to fal.ai: ${falPath}`)
        const falResult = await generateVideoViaFal(falApiKey, falPath, {
          prompt: request.prompt,
          imageUrl: hasImage ? request.imageUrls?.[0] : undefined,
          aspectRatio: request.aspectRatio,
          duration: request.duration,
          timeoutMs: 120000,
        })
        logAI({ service: 'video', provider: 'fal', status: falResult.success ? 'success' : 'error', response_ms: Date.now() - t0, model: falPath })
        return falResult
      }
    }

    // Sora 2: WaveSpeed FIRST (async submission, fast), then KIE, then fal.ai last
    // NEVER try fal.ai first — it polls internally for up to 120s, causing Vercel 504 timeout
    if (request.modelId === 'sora-2' && wavespeedApiKey && modelConfig.wavespeed) {
      const wsConfig = modelConfig.wavespeed
      const wsPath = hasImage ? (wsConfig.i2v || wsConfig.t2v) : wsConfig.t2v
      if (wsPath) {
        console.log(`[Video/Sora2] Trying WaveSpeed FIRST: ${wsPath}`)
        const t0Ws = Date.now()
        const wsResult = await generateVideoViaWavespeed(wavespeedApiKey, {
          prompt: request.prompt,
          t2vPath: wsConfig.t2v!,
          i2vPath: wsConfig.i2v,
          imageUrl: hasImage ? request.imageUrls?.[0] : undefined,
          aspectRatio: request.aspectRatio,
          duration: request.duration,
          resolution: request.resolution,
          generateAudio: request.enableAudio,
          timeoutMs: 30000,
        })
        if (wsResult.success) {
          logAI({ service: 'video', provider: 'wavespeed', status: 'success', response_ms: Date.now() - t0Ws, model: wsPath })
          return wsResult
        }
        console.warn(`[Video/Sora2] WaveSpeed failed (${wsResult.error}), falling back to KIE`)
        logAI({ service: 'video', provider: 'wavespeed', status: 'error', response_ms: Date.now() - t0Ws, model: wsPath, error_message: wsResult.error })
      }
      // Fall through to standard KIE flow below (KIE → fal.ai)
    }

    // Veo models use different endpoint, with fal.ai fallback
    if (modelConfig.useVeoEndpoint) {
      const veoResult = await generateVeoVideo(request, apiKey, request.modelId)
      logAI({ service: 'video', provider: 'kie', status: veoResult.success ? 'success' : 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: veoResult.success ? undefined : veoResult.error })

      if (veoResult.success) return veoResult

      // WaveSpeed fallback for Veo (before fal.ai)
      if (wavespeedApiKey && modelConfig.wavespeed) {
        const wsConfig = modelConfig.wavespeed
        const wsPath = hasImage ? (wsConfig.i2v || wsConfig.t2v) : wsConfig.t2v
        if (wsPath) {
          console.warn(`[Video/Veo] KIE failed (${veoResult.error}), trying WaveSpeed: ${wsPath}`)
          const t0Ws = Date.now()
          const wsResult = await generateVideoViaWavespeed(wavespeedApiKey, {
            prompt: request.prompt,
            t2vPath: wsConfig.t2v!,
            i2vPath: wsConfig.i2v,
            imageUrl: hasImage ? request.imageUrls?.[0] : undefined,
            lastImageUrl: hasImage && request.imageUrls!.length > 1 ? request.imageUrls![1] : undefined,
            aspectRatio: request.aspectRatio,
            duration: request.duration,
            resolution: request.resolution,
            generateAudio: request.enableAudio,
            timeoutMs: 120000,
          })
          if (wsResult.success) {
            logAI({ service: 'video', provider: 'wavespeed', status: 'success', response_ms: Date.now() - t0Ws, model: wsPath, was_fallback: true })
            return wsResult
          }
          logAI({ service: 'video', provider: 'wavespeed', status: 'error', response_ms: Date.now() - t0Ws, model: wsPath, error_message: wsResult.error, was_fallback: true })
          console.warn(`[Video/Veo] WaveSpeed also failed: ${wsResult.error}`)
        }
      }

      // fal.ai fallback for Veo
      const falConfig = modelConfig.fal
      if (falApiKey && falConfig) {
        const hasImage = !!(request.imageUrls && request.imageUrls.length > 0)
        const hasLastFrame = hasImage && request.imageUrls!.length > 1
        const falPath = hasImage ? (falConfig.i2v || falConfig.t2v) : falConfig.t2v
        if (falPath) {
          const elapsedMs = Date.now() - t0
          const falTimeout = Math.min(Math.max(110000 - elapsedMs, 20000), 100000)
          console.warn(`[Video/Veo] KIE failed (${veoResult.error}), trying fal.ai: ${falPath} (timeout=${Math.round(falTimeout/1000)}s)`)
          const t0Fal = Date.now()
          const falResult = await generateVideoViaFal(falApiKey, falPath, {
            prompt: request.prompt,
            imageUrl: hasImage ? request.imageUrls?.[0] : undefined,
            lastImageUrl: hasLastFrame ? request.imageUrls?.[1] : undefined,
            aspectRatio: request.aspectRatio,
            duration: request.duration,
            timeoutMs: falTimeout,
          })
          if (falResult.success) {
            logAI({ service: 'video', provider: 'fal', status: 'success', response_ms: Date.now() - t0Fal, model: falPath, was_fallback: true })
            return falResult
          }
          logAI({ service: 'video', provider: 'fal', status: 'error', response_ms: Date.now() - t0Fal, model: falPath, error_message: falResult.error, was_fallback: true })
        }
      }

      return veoResult
    }

    // Standard models use createTask endpoint
    const kieResult = await generateStandardVideo(request, apiKey, apiModelId, modelConfig)

    // If KIE succeeded, return
    if (kieResult.success) {
      logAI({ service: 'video', provider: 'kie', status: 'success', response_ms: Date.now() - t0, model: request.modelId })
      return kieResult
    }

    logAI({ service: 'video', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: kieResult.error })

    // WaveSpeed fallback: try before fal.ai (more reliable, similar models)
    if (wavespeedApiKey && modelConfig.wavespeed) {
      const wsConfig = modelConfig.wavespeed
      const wsPath = hasImage ? (wsConfig.i2v || wsConfig.t2v) : wsConfig.t2v
      if (wsPath) {
        console.warn(`[Video] KIE failed (${kieResult.error}), trying WaveSpeed: ${wsPath}`)
        const t0Ws = Date.now()
        const wsResult = await generateVideoViaWavespeed(wavespeedApiKey, {
          prompt: request.prompt,
          t2vPath: wsConfig.t2v!,
          i2vPath: wsConfig.i2v,
          imageUrl: hasImage ? request.imageUrls?.[0] : undefined,
          aspectRatio: request.aspectRatio,
          duration: request.duration,
          resolution: request.resolution,
          generateAudio: request.enableAudio,
          timeoutMs: 120000,
        })
        if (wsResult.success) {
          logAI({ service: 'video', provider: 'wavespeed', status: 'success', response_ms: Date.now() - t0Ws, model: wsPath, was_fallback: true })
          return wsResult
        }
        logAI({ service: 'video', provider: 'wavespeed', status: 'error', response_ms: Date.now() - t0Ws, model: wsPath, error_message: wsResult.error, was_fallback: true })
        console.warn(`[Video] WaveSpeed also failed: ${wsResult.error}`)
      }
    }

    // fal.ai fallback: mode-aware — pick T2V or I2V path from model config
    const falConfig = modelConfig.fal
    if (falApiKey && (falConfig || modelConfig.falModelId)) {
      // Determine fal.ai path based on mode (text-to-video vs image-to-video)
      let falPath: string | undefined
      if (falConfig) {
        falPath = hasImage
          ? (falConfig.i2v || falConfig.t2v)  // I2V preferred, fallback to T2V
          : falConfig.t2v                       // Text-to-video
      }
      // Legacy fallback: single falModelId
      if (!falPath && modelConfig.falModelId) {
        falPath = modelConfig.falModelId
      }

      if (falPath) {
        // Dynamic timeout: use remaining time minus 5s safety margin, max 100s
        const elapsedMs = Date.now() - t0
        const falTimeout = Math.min(Math.max(110000 - elapsedMs, 20000), 100000)
        console.warn(`[Video] KIE failed (${kieResult.error}), trying fal.ai fallback: ${falPath} (hasImage=${hasImage}, timeout=${Math.round(falTimeout/1000)}s)`)
        const t0Fal = Date.now()
        const falResult = await generateVideoViaFal(falApiKey, falPath, {
          prompt: request.prompt,
          imageUrl: hasImage ? request.imageUrls?.[0] : undefined,
          aspectRatio: request.aspectRatio,
          duration: request.duration,
          timeoutMs: falTimeout,
        })
        if (falResult.success) {
          logAI({ service: 'video', provider: 'fal', status: 'success', response_ms: Date.now() - t0Fal, model: falPath, was_fallback: true })
          return falResult
        }
        logAI({ service: 'video', provider: 'fal', status: 'error', response_ms: Date.now() - t0Fal, model: falPath, error_message: falResult.error, was_fallback: true })
        console.warn(`[Video] fal.ai fallback also failed: ${falResult.error}`)
      }
    }

    return kieResult

  } catch (error: any) {
    logAI({ service: 'video', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: error.message })
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
  // veo-3.1-fast -> "veo3_fast" (Fast, 60 credits)
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
        return {
          success: false,
          error: 'REFERENCE_2_VIDEO solo funciona con Veo 3 Fast',
          provider: 'kie-veo',
        }
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
    return {
      success: false,
      error: `Invalid JSON response from KIE Veo: ${responseText.substring(0, 200)}`,
      provider: 'kie-veo',
    }
  }

  if (data.code !== 200) {
    const errorMsg = data.msg || data.message || JSON.stringify(data)
    console.error(`[Video/Veo] KIE error (code ${data.code}): ${errorMsg}`)
    return {
      success: false,
      error: errorMsg,
      provider: 'kie-veo',
    }
  }

  const taskId = data.data?.taskId
  if (!taskId) {
    return {
      success: false,
      error: 'No taskId in Veo response',
      provider: 'kie-veo',
    }
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
 * - Seedance 2.0: image_urls (array)
 * - Wan 2.5: image_url (singular string) ← DIFFERENT!
 * - Seedance 1.5 Pro: input_urls (array)
 * - Seedance 1.0 Fast: image_url (singular string)
 * - Kling v2.5 Turbo: image_url (singular string)
 * - Hailuo: image_url (singular string)
 * 
 * ASPECT RATIO:
 * - Sora 2: "landscape" / "portrait" (NOT "16:9" / "9:16"!)
 * - Seedance 2.0: "16:9", "9:16", "1:1" (REQUIRED)
 * - Seedance 1.5 Pro: "16:9", "9:16", "1:1" (REQUIRED)
 * - Others: "16:9", "9:16", "1:1"
 * 
 * DURATION:
 * - Kling: duration as STRING ("5" or "10")
 * - Sora: n_frames as STRING ("10" or "15")
 * - Hailuo: duration as STRING ("6" or "10")
 * - Seedance 2.0: duration as STRING ("4"-"15") - REQUIRED
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
 * - Seedance 2.0: generate_audio (boolean)
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
  const isSeedance2 = request.modelId === 'seedance-2'
  const isSeedance15 = request.modelId === 'seedance-1.5-pro'
  const isSeedance10 = request.modelId === 'seedance-1.0-fast'
  const isSeedance = isSeedance2 || isSeedance15 || isSeedance10
  const isGrok = request.modelId === 'grok-imagine'

  console.log(`[Video] Model detection: isKling30=${isKling30}, isWan26=${isWan26}, isWan25=${isWan25}, isKling26=${isKling26}, isSora=${isSora}, isHailuo=${isHailuo}, isSeedance2=${isSeedance2}, isSeedance15=${isSeedance15}, isSeedance10=${isSeedance10}, isGrok=${isGrok}`)

  // Image URLs - DIFFERENT MODELS USE DIFFERENT FIELD NAMES!
  if (request.imageUrls && request.imageUrls.length > 0) {
    if (isKling30 || isKling26 || isSora || isWan26 || isSeedance2 || isGrok) {
      // Kling 3.0, Kling 2.6, Sora 2, Wan 2.6, and Seedance 2 use image_urls (plural array)
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
  } else if (isSeedance2 || isSeedance15) {
    // Seedance 2.0 and 1.5 Pro require aspect_ratio, default to 16:9
    input.aspect_ratio = '16:9'
  }

  // Duration - model specific handling
  // ALL these models require duration as STRING and only accept specific values
  if (request.duration) {
    if (isSora) {
      // Sora uses n_frames as string ("10" or "15") — these are seconds, not actual frame counts
      const validFrames = request.duration <= 12 ? 10 : 15
      input.n_frames = validFrames.toString()
      input.remove_watermark = true
    } else if (isKling || isHailuo || isSeedance || isWan || isGrok) {
      // Normalize duration to nearest valid value per model
      let validDuration = request.duration
      if (isKling) {
        // Kling accepts: 5, 10
        validDuration = request.duration <= 7 ? 5 : 10
      } else if (isWan26) {
        // Wan 2.6 accepts: 5, 10, 15
        validDuration = request.duration <= 7 ? 5 : request.duration <= 12 ? 10 : 15
      } else if (isWan25) {
        // Wan 2.5 accepts: 5, 10
        validDuration = request.duration <= 7 ? 5 : 10
      } else if (isHailuo) {
        // Hailuo accepts: 6, 10
        validDuration = request.duration <= 8 ? 6 : 10
      } else if (isGrok) {
        // Grok accepts: 6, 10, 15
        validDuration = request.duration <= 8 ? 6 : request.duration <= 12 ? 10 : 15
      }
      // Seedance durations handled below in their specific blocks
      if (validDuration !== request.duration) {
        console.log(`[Video] Duration normalized: ${request.duration}s → ${validDuration}s for ${request.modelId}`)
      }
      input.duration = validDuration.toString()
    } else {
      // Fallback - use as provided
      input.duration = request.duration
    }
  } else if (isSeedance2 || isSeedance15) {
    // Seedance 2.0 and 1.5 Pro require duration, default to 8s
    input.duration = '8'
  } else if (isSeedance10) {
    // Seedance 1.0 Fast - duration is optional but use 5s as default
    input.duration = '5'
  }

  // Audio parameter - different names for different models
  if (isKling30 || isKling26) {
    // Kling 3.0 and 2.6 use "sound" (boolean) - THIS IS REQUIRED!
    input.sound = request.enableAudio ?? false
  } else if (isSeedance2 || isSeedance15) {
    // Seedance 2.0 and 1.5 Pro support generate_audio
    if (modelConfig.supportsAudio) {
      input.generate_audio = request.enableAudio ?? false
    }
  }
  // Grok Imagine: mode parameter (fun, normal, spicy — spicy not available with external images)
  if (isGrok) {
    input.mode = 'normal'
  }
  // Note: Wan image-to-video doesn't have audio param
  // Note: Kling v2.5, Hailuo, Sora, and Seedance 1.0 don't support audio

  // Wan 2.6 and Seedance 2 specific: multi_shots option
  if ((isWan26 || isSeedance2) && modelConfig.supportsMultiShots) {
    input.multi_shots = false // default to single shot
  }

  // Kling 3.0: "mode" is REQUIRED ("pro" or "std")
  // multi_shots is also REQUIRED (boolean) - KIE rejects if missing
  if (isKling30) {
    input.mode = request.klingMode || 'pro'
    input.multi_shots = false
  }

  // Kling 3.0 multi-shot support
  if (isKling30 && request.multiShots && request.multiPrompt && request.multiPrompt.length > 0) {
    input.multi_shots = true
    // multi_prompt durations are integers (not strings)
    input.multi_prompt = request.multiPrompt.map(mp => ({
      prompt: mp.prompt,
      duration: Math.round(Number(mp.duration)),
    }))
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
    return {
      success: false,
      error: `Invalid JSON response from KIE: ${responseText.substring(0, 200)}`,
      provider: 'kie',
    }
  }

  if (data.code !== 200 && data.code !== 0) {
    const errorMsg = data.msg || data.message || JSON.stringify(data)
    console.error(`[Video] KIE error (code ${data.code}): ${errorMsg}`)
    return {
      success: false,
      error: errorMsg,
      provider: 'kie',
    }
  }

  const taskId = data.data?.taskId || data.taskId
  if (!taskId) {
    return {
      success: false,
      error: 'No taskId in response',
      provider: 'kie',
    }
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

          // Kling format: works[0].resource.resource
          if (!videoUrl && result.works && Array.isArray(result.works) && result.works.length > 0) {
            videoUrl = result.works[0]?.resource?.resource ||
                       result.works[0]?.resource?.url ||
                       result.works[0]?.url ||
                       result.works[0]?.video_url
          }
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
 * Extend a Veo 3.1 video via KIE.ai
 * Endpoint: POST /api/v1/veo/extend
 *
 * Requirements:
 * - The original video MUST have been generated via KIE's /api/v1/veo/generate
 * - You need the original taskId from that generation
 * - Only works with Veo 3.1 models (veo3 / veo3_fast)
 *
 * Parameters:
 * - taskId: original video generation task ID
 * - prompt: continuation prompt for the extended segment
 * - model: "veo3" (quality) or "veo3_fast" (fast)
 */
export async function extendVeoVideo(
  taskId: string,
  prompt: string,
  apiKey: string,
  options: {
    model?: 'veo3' | 'veo3_fast'
  } = {}
): Promise<GenerateVideoResult> {
  const t0 = Date.now()
  try {
    const model = options.model || 'veo3_fast'

    const body = {
      taskId,
      prompt,
      model,
    }

    console.log('[Video/Veo] Extend request:', JSON.stringify({
      taskId,
      prompt: prompt.substring(0, 50) + '...',
      model,
    }))

    const response = await fetch(`${KIE_API_BASE}/veo/extend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const responseText = await response.text()
    console.log('[Video/Veo] Extend response:', response.status, responseText.substring(0, 500))

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`)
    }

    if (data.code !== 200) {
      throw new Error(`Veo Extend error: ${data.msg || data.message || JSON.stringify(data)}`)
    }

    const newTaskId = data.data?.taskId
    if (!newTaskId) {
      throw new Error('No taskId in Veo extend response')
    }

    logAI({ service: 'video', provider: 'kie', status: 'success', response_ms: Date.now() - t0, model: `veo-extend-${model}` })

    return {
      success: true,
      taskId: newTaskId,
      status: 'processing',
      provider: 'kie-veo',
    }
  } catch (error: any) {
    logAI({ service: 'video', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: 'veo-extend', error_message: error.message })
    console.error('[Video/Veo] Extend error:', error.message)
    return {
      success: false,
      error: error.message || 'Video extend failed',
      provider: 'kie-veo',
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
