/**
 * WaveSpeed AI video generation provider (cascade fallback between KIE and fal.ai).
 *
 * API pattern:
 *   POST https://api.wavespeed.ai/api/v3/{model-path}  -> {data: {id, status, outputs, urls}}
 *   GET  https://api.wavespeed.ai/api/v3/predictions/{id}/result -> same shape
 *
 * Auth: Authorization: Bearer {apiKey}
 *
 * Video generation is always async — polling required.
 * Supports T2V and I2V with native `image` + `last_image` params.
 *
 * Key video endpoints:
 *   T2V: google/veo3.1/text-to-video, google/veo3.1-fast/text-to-video
 *   I2V: google/veo3.1/image-to-video, google/veo3.1-fast/image-to-video
 *   Extend: google/veo3.1-fast/video-extend, google/veo3.1/video-extend
 */

import { GenerateVideoResult } from './types'

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3'

export interface WavespeedVideoOptions {
  prompt: string
  /** WaveSpeed model path for T2V, e.g. 'google/veo3.1-fast/text-to-video' */
  t2vPath: string
  /** WaveSpeed model path for I2V, e.g. 'google/veo3.1-fast/image-to-video' */
  i2vPath?: string
  /** Start frame image URL */
  imageUrl?: string
  /** End frame image URL (for first-last-frame interpolation) */
  lastImageUrl?: string
  aspectRatio?: string
  duration?: number
  resolution?: string
  generateAudio?: boolean
  negativePrompt?: string
  seed?: number
  /** Max polling time in ms */
  timeoutMs?: number
}

/**
 * Submit a video generation task to WaveSpeed AI.
 * Returns taskId for polling via checkWavespeedVideoStatus().
 *
 * Unlike images, video generation always uses async mode.
 * The caller (kie-video.ts cascade) handles polling via video-status API route.
 */
export async function generateVideoViaWavespeed(
  apiKey: string,
  options: WavespeedVideoOptions
): Promise<GenerateVideoResult> {
  const hasImage = !!options.imageUrl
  const modelPath = hasImage && options.i2vPath ? options.i2vPath : options.t2vPath

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Build request body
  const body: Record<string, any> = {
    prompt: options.prompt,
  }

  if (options.aspectRatio) {
    body.aspect_ratio = options.aspectRatio
  }

  if (options.duration) {
    // WaveSpeed accepts specific duration values per model
    // Normalize to nearest valid value to avoid 400 errors
    const d = options.duration
    if (modelPath.includes('veo')) {
      // Veo: 4, 6, 8
      body.duration = d <= 5 ? 4 : d <= 7 ? 6 : 8
    } else if (modelPath.includes('sora')) {
      // Sora 2: 4, 8, 12
      body.duration = d <= 6 ? 4 : d <= 10 ? 8 : 12
    } else if (modelPath.includes('kling')) {
      // Kling: 5, 10
      body.duration = d <= 7 ? 5 : 10
    } else if (modelPath.includes('seedance')) {
      // Seedance: 5, 8, 10
      body.duration = d <= 6 ? 5 : d <= 9 ? 8 : 10
    } else {
      body.duration = d
    }
    if (body.duration !== d) {
      console.log(`[WaveSpeed/video] Duration normalized: ${d}s → ${body.duration}s for ${modelPath}`)
    }
  }

  if (options.resolution) {
    body.resolution = options.resolution
  }

  if (options.generateAudio !== undefined) {
    body.generate_audio = options.generateAudio
  }

  if (options.negativePrompt) {
    body.negative_prompt = options.negativePrompt
  }

  if (options.seed) {
    body.seed = options.seed
  }

  // I2V: image and optional last_image for interpolation
  if (options.imageUrl) {
    body.image = options.imageUrl
  }

  if (options.lastImageUrl) {
    body.last_image = options.lastImageUrl
  }

  try {
    console.log(`[WaveSpeed/video] Submitting to ${modelPath} (hasImage=${hasImage}, lastImage=${!!options.lastImageUrl})`)

    const submitRes = await fetch(`${WAVESPEED_API_BASE}/${modelPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      console.error(`[WaveSpeed/video] Submit error ${submitRes.status}: ${errText.substring(0, 300)}`)
      return {
        success: false,
        error: `WaveSpeed: ${errText.substring(0, 200)}`,
        provider: 'wavespeed',
      }
    }

    const submitData = await submitRes.json()

    if (submitData.code !== 200 && submitData.code !== 0) {
      const msg = submitData.message || submitData.data?.error || JSON.stringify(submitData).substring(0, 200)
      console.error(`[WaveSpeed/video] API error: ${msg}`)
      return {
        success: false,
        error: `WaveSpeed: ${msg}`,
        provider: 'wavespeed',
      }
    }

    const data = submitData.data
    const taskId = data?.id

    if (!taskId) {
      return {
        success: false,
        error: 'WaveSpeed: no task ID in response',
        provider: 'wavespeed',
      }
    }

    console.log(`[WaveSpeed/video] Task created: ${taskId}`)

    return {
      success: true,
      taskId: `ws_${taskId}`, // Prefix to identify WaveSpeed tasks in video-status polling
      status: 'processing',
      provider: 'wavespeed',
    }
  } catch (err: any) {
    console.error(`[WaveSpeed/video] Error:`, err.message)
    return {
      success: false,
      error: err.message || 'WaveSpeed: error de conexion',
      provider: 'wavespeed',
    }
  }
}

/**
 * Check video generation status on WaveSpeed AI.
 * Called by video-status API route when taskId starts with 'ws_'.
 */
export async function checkWavespeedVideoStatus(
  taskId: string,
  apiKey: string
): Promise<GenerateVideoResult> {
  // Remove ws_ prefix
  const wsTaskId = taskId.startsWith('ws_') ? taskId.slice(3) : taskId

  try {
    const res = await fetch(`${WAVESPEED_API_BASE}/predictions/${wsTaskId}/result`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    if (!res.ok) {
      return {
        success: false,
        error: `WaveSpeed: status check failed (${res.status})`,
        provider: 'wavespeed',
      }
    }

    const data = await res.json()
    const taskData = data.data

    if (!taskData) {
      return {
        success: false,
        error: 'WaveSpeed: no data in status response',
        provider: 'wavespeed',
      }
    }

    const status = taskData.status

    if (status === 'completed' && taskData.outputs?.length > 0) {
      const videoUrl = taskData.outputs[0]
      console.log(`[WaveSpeed/video] Complete: ${videoUrl.substring(0, 80)}`)
      return {
        success: true,
        videoUrl,
        status: 'completed',
        provider: 'wavespeed',
      }
    }

    if (status === 'failed') {
      return {
        success: false,
        error: taskData.error || 'Video generation failed',
        provider: 'wavespeed',
      }
    }

    // created / processing
    return {
      success: true,
      taskId: `ws_${wsTaskId}`,
      status: 'processing',
      provider: 'wavespeed',
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'WaveSpeed: status check error',
      provider: 'wavespeed',
    }
  }
}

/**
 * Extend a video via WaveSpeed AI.
 * Appends 7s continuation to an existing WaveSpeed-generated video.
 */
export async function extendWavespeedVideo(
  videoUrl: string,
  prompt: string,
  apiKey: string,
  options: {
    modelPath?: string // e.g. 'google/veo3.1-fast/video-extend'
    resolution?: string
  } = {}
): Promise<GenerateVideoResult> {
  const modelPath = options.modelPath || 'google/veo3.1-fast/video-extend'

  try {
    const body: Record<string, any> = {
      video: videoUrl,
      prompt,
    }

    if (options.resolution) {
      body.resolution = options.resolution
    }

    console.log(`[WaveSpeed/video] Extend via ${modelPath}`)

    const res = await fetch(`${WAVESPEED_API_BASE}/${modelPath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      return {
        success: false,
        error: `WaveSpeed extend: ${errText.substring(0, 200)}`,
        provider: 'wavespeed',
      }
    }

    const data = await res.json()
    const taskId = data.data?.id

    if (!taskId) {
      return {
        success: false,
        error: 'WaveSpeed extend: no task ID',
        provider: 'wavespeed',
      }
    }

    return {
      success: true,
      taskId: `ws_${taskId}`,
      status: 'processing',
      provider: 'wavespeed',
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'WaveSpeed extend error',
      provider: 'wavespeed',
    }
  }
}
