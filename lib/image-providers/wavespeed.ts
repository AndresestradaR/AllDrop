/**
 * WaveSpeed AI image generation provider (cascade fallback between KIE and fal.ai).
 *
 * API pattern:
 *   POST https://api.wavespeed.ai/api/v3/{model-path}  -> {data: {id, status, outputs, urls}}
 *   GET  https://api.wavespeed.ai/api/v3/predictions/{id}/result -> same shape
 *
 * Auth: Authorization: Bearer {apiKey}
 *
 * Supports sync mode (enable_sync_mode: true) — returns result directly for fast models.
 * Images passed as URLs in `images` array (up to 14).
 * Output: CDN URLs (CloudFront).
 */

import { GenerateImageResult } from './types'

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3'

export interface WavespeedImageOptions {
  prompt: string
  /** WaveSpeed model path for T2I, e.g. 'google/nano-banana-2/text-to-image' */
  modelPath: string
  /** WaveSpeed model path for I2I (edit), e.g. 'google/nano-banana-2/edit' */
  editPath?: string
  /** Reference image URLs for I2I */
  imageUrls?: string[]
  aspectRatio?: string
  resolution?: string // '0.5k' | '1k' | '2k' | '4k'
  outputFormat?: 'png' | 'jpeg'
  /** Use sync mode — blocks until complete (good for images <30s) */
  syncMode?: boolean
  /** Max time for polling in ms */
  timeoutMs?: number
}

/**
 * Generate an image via WaveSpeed AI.
 * Automatically picks T2I or I2I endpoint based on presence of imageUrls.
 */
export async function generateViaWavespeed(
  apiKey: string,
  options: WavespeedImageOptions
): Promise<GenerateImageResult> {
  const timeoutMs = options.timeoutMs || 60000
  const hasImages = !!(options.imageUrls && options.imageUrls.length > 0)
  const modelPath = hasImages && options.editPath ? options.editPath : options.modelPath

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Build request body
  const body: Record<string, any> = {
    prompt: options.prompt,
    enable_sync_mode: options.syncMode ?? true, // sync by default for images
    output_format: options.outputFormat || 'png',
  }

  if (options.aspectRatio) {
    body.aspect_ratio = options.aspectRatio
  }

  if (options.resolution) {
    body.resolution = options.resolution
  }

  // I2I: pass image URLs in `images` array
  if (hasImages) {
    body.images = options.imageUrls
  }

  try {
    console.log(`[WaveSpeed/img] Submitting to ${modelPath} (sync=${body.enable_sync_mode}, images=${hasImages ? options.imageUrls!.length : 0})`)

    const submitRes = await fetch(`${WAVESPEED_API_BASE}/${modelPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      console.error(`[WaveSpeed/img] Submit error ${submitRes.status}: ${errText.substring(0, 300)}`)
      return {
        success: false,
        error: `WaveSpeed: ${errText.substring(0, 200)}`,
        provider: 'gemini',
      }
    }

    const submitData = await submitRes.json()

    if (submitData.code !== 200 && submitData.code !== 0) {
      const msg = submitData.message || submitData.data?.error || JSON.stringify(submitData).substring(0, 200)
      console.error(`[WaveSpeed/img] API error: ${msg}`)
      return {
        success: false,
        error: `WaveSpeed: ${msg}`,
        provider: 'gemini',
      }
    }

    const data = submitData.data
    const taskId = data?.id

    // Sync mode: result is already in the response
    if (data?.status === 'completed' && data?.outputs?.length > 0) {
      const imageUrl = data.outputs[0]
      console.log(`[WaveSpeed/img] Sync complete in ${data.executionTime}ms: ${imageUrl.substring(0, 80)}`)
      return await downloadWavespeedImage(imageUrl)
    }

    if (!taskId) {
      return {
        success: false,
        error: 'WaveSpeed: no task ID in response',
        provider: 'gemini',
      }
    }

    // Async mode: poll for result
    console.log(`[WaveSpeed/img] Task ${taskId}, polling (max ${Math.round(timeoutMs / 1000)}s)...`)
    const pollUrl = data.urls?.get || `${WAVESPEED_API_BASE}/predictions/${taskId}/result`

    const startTime = Date.now()
    const pollInterval = 2000

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval))

      try {
        const pollRes = await fetch(pollUrl, { headers })
        if (!pollRes.ok) {
          console.warn(`[WaveSpeed/img] Poll error: ${pollRes.status}`)
          continue
        }

        const pollData = await pollRes.json()
        const status = pollData.data?.status

        if (status === 'completed' && pollData.data?.outputs?.length > 0) {
          const imageUrl = pollData.data.outputs[0]
          const execTime = pollData.data.executionTime || (Date.now() - startTime)
          console.log(`[WaveSpeed/img] Complete in ${Math.round(execTime / 1000)}s: ${imageUrl.substring(0, 80)}`)
          return await downloadWavespeedImage(imageUrl)
        }

        if (status === 'failed') {
          const errorMsg = pollData.data?.error || 'Image generation failed'
          console.error(`[WaveSpeed/img] Task failed: ${errorMsg}`)
          return {
            success: false,
            error: `WaveSpeed: ${errorMsg}`,
            provider: 'gemini',
          }
        }

        // created / processing — keep polling
      } catch (pollErr: any) {
        console.warn(`[WaveSpeed/img] Poll error:`, pollErr.message)
      }
    }

    // Timeout
    return {
      success: false,
      error: `WaveSpeed: tiempo agotado (${Math.round(timeoutMs / 1000)}s)`,
      provider: 'gemini',
    }
  } catch (err: any) {
    console.error(`[WaveSpeed/img] Error:`, err.message)
    return {
      success: false,
      error: err.message || 'WaveSpeed: error de conexion',
      provider: 'gemini',
    }
  }
}

/**
 * Download a WaveSpeed output image and convert to base64.
 * WaveSpeed returns CDN URLs (CloudFront) that are publicly accessible.
 */
async function downloadWavespeedImage(imageUrl: string): Promise<GenerateImageResult> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) {
      return {
        success: false,
        error: `WaveSpeed: error descargando imagen (${res.status})`,
        provider: 'gemini',
      }
    }

    const contentType = res.headers.get('content-type') || 'image/png'
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    return {
      success: true,
      imageBase64: base64,
      mimeType: contentType.includes('jpeg') || contentType.includes('jpg') ? 'image/jpeg' : 'image/png',
      provider: 'gemini',
    }
  } catch (err: any) {
    return {
      success: false,
      error: `WaveSpeed: error descargando imagen: ${err.message}`,
      provider: 'gemini',
    }
  }
}
