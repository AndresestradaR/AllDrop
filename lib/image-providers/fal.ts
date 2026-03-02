/**
 * fal.ai image generation provider.
 *
 * Queue API pattern:
 *   1. POST https://queue.fal.run/{model-path}  → {request_id, response_url, status_url}
 *   2. GET  {status_url}                        → {status: 'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED'}
 *   3. GET  {response_url}                      → {images: [{url, ...}]}
 *
 * Auth: Authorization: Key {apiKey}
 */

import { classifyError, wrapError, type AIProviderError } from '../services/ai-errors'

// fal.ai model path mapping (legacy lookups + new cascade full paths)
export const FAL_MODEL_PATHS: Record<string, string> = {
  'nano-banana-2': 'fal-ai/nano-banana-2',
  'nano-banana-pro': 'fal-ai/nano-banana-pro',
  'seedream/5-lite': 'fal-ai/seedream-3.0',
  'seedream/5': 'fal-ai/seedream-3.0/pro',
  'gpt-image-1.5': 'fal-ai/gpt-image-1.5',
  // Seedream via fal.ai (new cascade paths)
  'bytedance/seedream/v4.5/text-to-image': 'fal-ai/bytedance/seedream/v4.5/text-to-image',
  'bytedance/seedream/v4.5/edit': 'fal-ai/bytedance/seedream/v4.5/edit',
  'bytedance/seedream/v5/lite/text-to-image': 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
  'bytedance/seedream/v5/lite/edit': 'fal-ai/bytedance/seedream/v5/lite/edit',
  // FLUX via fal.ai
  'flux-2-max': 'fal-ai/flux-2-max',
  'flux-2-max/edit': 'fal-ai/flux-2-max/edit',
  'flux-2-pro': 'fal-ai/flux-2-pro',
  'flux-2-pro/edit': 'fal-ai/flux-2-pro/edit',
  'flux-2-flex': 'fal-ai/flux-2-flex',
  'flux-2-flex/edit': 'fal-ai/flux-2-flex/edit',
}

export interface FalGenerateOptions {
  prompt: string
  imageUrls?: string[]
  aspectRatio?: string
  timeoutMs?: number
}

export interface FalImageResult {
  success: boolean
  imageUrl?: string
  error?: string
  classifiedError?: AIProviderError
}

/**
 * Generate an image via fal.ai queue API.
 * Submits to queue, polls for completion, returns image URL.
 */
export async function generateViaFal(
  apiKey: string,
  falModelId: string,
  options: FalGenerateOptions
): Promise<FalImageResult> {
  const modelPath = FAL_MODEL_PATHS[falModelId] || falModelId
  const timeoutMs = options.timeoutMs || 45000

  const headers = {
    'Authorization': `Key ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Build input payload
  const input: Record<string, any> = {
    prompt: options.prompt,
  }

  // Image input — all fal.ai models accept image_urls array
  if (options.imageUrls?.length) {
    input.image_urls = options.imageUrls
  }

  // Aspect ratio — seedream models use image_size enum, others use aspect_ratio
  if (options.aspectRatio) {
    if (modelPath.includes('seedream')) {
      const sizeMap: Record<string, string> = {
        '1:1': 'square_hd',
        '9:16': 'portrait_16_9',
        '16:9': 'landscape_16_9',
        '4:5': 'portrait_4_3',
        '4:3': 'landscape_4_3',
        '3:4': 'portrait_4_3',
        '3:2': 'landscape_16_9',
        '2:3': 'portrait_16_9',
      }
      input.image_size = sizeMap[options.aspectRatio] || 'auto_2K'
    } else {
      input.aspect_ratio = options.aspectRatio
    }
  }

  // Resolution for nano-banana models
  if (modelPath.includes('nano-banana')) {
    input.resolution = '1K'
    input.output_format = 'png'
  }

  try {
    // Step 1: Submit to queue
    console.log(`[fal.ai] Submitting to ${modelPath}...`)
    console.log(`[fal.ai] Input keys: ${Object.keys(input).join(', ')}`)
    if (input.image_urls) {
      console.log(`[fal.ai] image_urls count: ${input.image_urls.length}`)
      input.image_urls.forEach((u: string, i: number) => console.log(`[fal.ai]   image[${i}]: ${u.substring(0, 80)}...`))
    } else {
      console.log(`[fal.ai] NO image_urls in input`)
    }
    const submitRes = await fetch(`https://queue.fal.run/${modelPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text()
      console.error(`[fal.ai] Submit error ${submitRes.status}: ${errText.substring(0, 300)}`)
      return {
        success: false,
        error: errText.substring(0, 200),
        classifiedError: classifyError('fal.ai', submitRes.status, errText),
      }
    }

    const submitData = await submitRes.json()
    const { request_id, status_url, response_url } = submitData

    if (!request_id) {
      return {
        success: false,
        error: 'fal.ai: no request_id in response',
        classifiedError: classifyError('fal.ai', undefined, 'No request_id'),
      }
    }

    console.log(`[fal.ai] Queued: ${request_id}, polling...`)

    // Step 2: Poll for completion
    const startTime = Date.now()
    const pollInterval = 2000
    const statusEndpoint = status_url || `https://queue.fal.run/${modelPath}/requests/${request_id}/status`
    const resultEndpoint = response_url || `https://queue.fal.run/${modelPath}/requests/${request_id}`

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, pollInterval))

      try {
        const statusRes = await fetch(statusEndpoint, { headers })
        if (!statusRes.ok) {
          console.warn(`[fal.ai] Status poll error: ${statusRes.status}`)
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
              classifiedError: classifyError('fal.ai', resultRes.status, errText),
            }
          }

          const resultData = await resultRes.json()

          // Extract image URL — fal.ai returns images in various formats
          const imageUrl =
            resultData.images?.[0]?.url ||
            resultData.image?.url ||
            resultData.output?.url

          if (!imageUrl) {
            return {
              success: false,
              error: 'fal.ai: no image URL in result',
            }
          }

          console.log(`[fal.ai] Success! Image: ${imageUrl.substring(0, 80)}...`)
          return { success: true, imageUrl }
        }

        if (status === 'FAILED') {
          const errorMsg = statusData.error || 'Generation failed'
          console.error(`[fal.ai] Task failed: ${errorMsg}`)
          return {
            success: false,
            error: `fal.ai: ${errorMsg}`,
            classifiedError: classifyError('fal.ai', undefined, errorMsg),
          }
        }

        // IN_QUEUE or IN_PROGRESS — keep polling
      } catch (pollErr) {
        console.warn(`[fal.ai] Poll error:`, pollErr)
        // Continue polling on transient errors
      }
    }

    // Timeout
    return {
      success: false,
      error: `fal.ai: Tiempo agotado (${Math.round(timeoutMs / 1000)}s)`,
      classifiedError: classifyError('fal.ai', undefined, 'timeout'),
    }
  } catch (err: any) {
    console.error(`[fal.ai] Error:`, err)
    return {
      success: false,
      error: err.message || 'fal.ai: error de conexion',
      classifiedError: wrapError('fal.ai', err),
    }
  }
}

/**
 * Fetch image from fal.ai URL and convert to base64.
 */
export async function falImageToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null

    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = res.headers.get('content-type') || 'image/png'

    return { base64, mimeType }
  } catch {
    return null
  }
}
