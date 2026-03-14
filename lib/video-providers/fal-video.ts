/**
 * fal.ai video generation provider (cascade fallback for KIE).
 *
 * Queue API pattern (same as images):
 *   1. POST https://queue.fal.run/{model-path}  -> {request_id, status_url, response_url}
 *   2. GET  {status_url}                        -> {status: 'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED'}
 *   3. GET  {response_url}                      -> {video: {url, ...}}
 *
 * Auth: Authorization: Key {apiKey}
 */

import { GenerateVideoResult } from './types'

export interface FalVideoOptions {
  prompt: string
  imageUrl?: string
  lastImageUrl?: string // End frame for first-last-frame interpolation
  aspectRatio?: string
  duration?: number
  timeoutMs?: number
}

/**
 * Generate a video via fal.ai queue API.
 * Submits to queue, polls for completion, returns video URL.
 */
export async function generateVideoViaFal(
  apiKey: string,
  falModelPath: string,
  options: FalVideoOptions
): Promise<GenerateVideoResult> {
  const timeoutMs = options.timeoutMs || 120000 // 2 min default for video

  const headers = {
    'Authorization': `Key ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Build input payload
  const input: Record<string, any> = {
    prompt: options.prompt,
  }

  // Image input (reference/start frame)
  if (options.imageUrl) {
    input.image_url = options.imageUrl
  }

  // Last frame image (for first-last-frame interpolation)
  if (options.lastImageUrl) {
    input.last_frame_image_url = options.lastImageUrl
  }

  // Aspect ratio
  if (options.aspectRatio) {
    input.aspect_ratio = options.aspectRatio
  }

  // Duration — normalize to valid values per model to avoid 400 errors
  if (options.duration) {
    const d = options.duration
    const model = falModelPath || ''
    if (model.includes('sora')) {
      // fal.ai Sora 2: 4, 8, 12, 16, 20
      input.duration = d <= 6 ? 4 : d <= 10 ? 8 : d <= 14 ? 12 : d <= 18 ? 16 : 20
    } else {
      input.duration = d
    }
    if (input.duration !== d) {
      console.log(`[fal.ai/video] Duration normalized: ${d}s → ${input.duration}s`)
    }
  }

  try {
    // Step 1: Submit to queue
    console.log(`[fal.ai/video] Submitting to ${falModelPath}...`)
    const submitRes = await fetch(`https://queue.fal.run/${falModelPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      console.error(`[fal.ai/video] Submit error ${submitRes.status}: ${errText.substring(0, 300)}`)
      return {
        success: false,
        error: `fal.ai: ${errText.substring(0, 200)}`,
        provider: 'fal',
      }
    }

    const submitData = await submitRes.json()
    const { request_id, status_url, response_url } = submitData

    if (!request_id) {
      return {
        success: false,
        error: 'fal.ai: no request_id in response',
        provider: 'fal',
      }
    }

    console.log(`[fal.ai/video] Queued: ${request_id}, polling...`)

    // Step 2: Poll for completion
    const startTime = Date.now()
    const pollInterval = 3000 // 3s for video (slower than images)
    const statusEndpoint = status_url || `https://queue.fal.run/${falModelPath}/requests/${request_id}/status`
    const resultEndpoint = response_url || `https://queue.fal.run/${falModelPath}/requests/${request_id}`

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval))

      try {
        const statusRes = await fetch(statusEndpoint, { headers })
        if (!statusRes.ok) {
          console.warn(`[fal.ai/video] Status poll error: ${statusRes.status}`)
          continue
        }

        const statusData = await statusRes.json()
        const status = statusData.status

        if (status === 'COMPLETED') {
          // Step 3: Get result
          const resultRes = await fetch(resultEndpoint, { headers })
          if (!resultRes.ok) {
            const errText = await resultRes.text()
            return {
              success: false,
              error: `fal.ai: error fetching result: ${errText.substring(0, 200)}`,
              provider: 'fal',
            }
          }

          const resultData = await resultRes.json()

          // Extract video URL — fal.ai returns video in various formats
          const videoUrl =
            resultData.video?.url ||
            resultData.videos?.[0]?.url ||
            resultData.output?.url

          if (!videoUrl) {
            return {
              success: false,
              error: 'fal.ai: no video URL in result',
              provider: 'fal',
            }
          }

          console.log(`[fal.ai/video] Success! Video: ${videoUrl.substring(0, 80)}...`)
          return {
            success: true,
            videoUrl,
            status: 'completed',
            provider: 'fal',
          }
        }

        if (status === 'FAILED') {
          const errorMsg = statusData.error || 'Video generation failed'
          console.error(`[fal.ai/video] Task failed: ${errorMsg}`)
          return {
            success: false,
            error: `fal.ai: ${errorMsg}`,
            provider: 'fal',
          }
        }

        // IN_QUEUE or IN_PROGRESS — keep polling
      } catch (pollErr) {
        console.warn(`[fal.ai/video] Poll error:`, pollErr)
      }
    }

    // Timeout
    return {
      success: false,
      error: `fal.ai: Tiempo agotado para video (${Math.round(timeoutMs / 1000)}s)`,
      provider: 'fal',
    }
  } catch (err: any) {
    console.error(`[fal.ai/video] Error:`, err)
    return {
      success: false,
      error: err.message || 'fal.ai: error de conexion',
      provider: 'fal',
    }
  }
}
