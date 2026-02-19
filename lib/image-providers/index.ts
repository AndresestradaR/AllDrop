// Multi-model image generation router
import {
  ImageProvider,
  ImageProviderType,
  GenerateImageRequest,
  GenerateImageResult,
  IMAGE_PROVIDERS,
} from './types'
import { geminiProvider, buildGeminiPrompt } from './gemini'
import { openaiProvider } from './openai'
import { seedreamProvider } from './kie-seedream'
import { fluxProvider } from './bfl-flux'

// Provider registry
const providers: Record<ImageProviderType, ImageProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  seedream: seedreamProvider,
  flux: fluxProvider,
}

/**
 * Get a provider by ID
 */
export function getProvider(providerId: ImageProviderType): ImageProvider | null {
  return providers[providerId] || null
}

/**
 * Get provider configuration
 */
export function getProviderConfig(providerId: ImageProviderType) {
  return IMAGE_PROVIDERS[providerId]
}

/**
 * Get all available providers
 */
export function getAllProviders() {
  return Object.values(IMAGE_PROVIDERS)
}

/**
 * Generate image with automatic provider routing.
 *
 * For Gemini: routes through KIE (Nano Banana Pro) as primary for stability.
 * Direct Google API is used as fallback only if KIE fails or is unavailable.
 */
export async function generateImage(
  request: GenerateImageRequest,
  apiKeys: {
    gemini?: string
    openai?: string
    kie?: string
    bfl?: string
  }
): Promise<GenerateImageResult> {
  const provider = getProvider(request.provider)

  if (!provider) {
    return {
      success: false,
      error: `Provider "${request.provider}" not found`,
      provider: request.provider,
    }
  }

  // ── Gemini special routing: KIE primary, Google direct fallback ──
  if (request.provider === 'gemini' && apiKeys.kie) {
    console.log('[generateImage] Gemini via KIE (Nano Banana Pro) — primary path')
    try {
      const kieResult = await generateViaKie(request, apiKeys.kie)
      if (kieResult.success) {
        console.log('[generateImage] KIE success!')
        return kieResult
      }
      console.warn('[generateImage] KIE failed:', kieResult.error)
    } catch (e: any) {
      console.error('[generateImage] KIE exception:', e.message)
    }

    // KIE failed — try direct Google as fallback if key available
    if (apiKeys.gemini) {
      console.log('[generateImage] Falling back to direct Google API...')
      return provider.generate(request, apiKeys.gemini)
    }

    return {
      success: false,
      error: 'No se pudo generar la imagen via KIE. Verifica tus creditos en kie.ai o configura una API key de Google como respaldo.',
      provider: 'gemini',
    }
  }

  // ── Normal flow for all other providers (and Gemini without KIE key) ──
  let apiKey: string | undefined
  switch (request.provider) {
    case 'gemini':
      apiKey = apiKeys.gemini
      break
    case 'openai':
      apiKey = apiKeys.openai
      break
    case 'seedream':
      apiKey = apiKeys.kie
      break
    case 'flux':
      apiKey = apiKeys.bfl
      break
  }

  if (!apiKey) {
    return {
      success: false,
      error: `No API key configured for provider "${request.provider}"`,
      provider: request.provider,
    }
  }

  return provider.generate(request, apiKey)
}

/**
 * Generate image via KIE's Nano Banana Pro (Gemini 3 Pro Image).
 * Uses the same prompt style as the Gemini provider but routes through KIE's stable servers.
 * Handles the full async cycle: createTask → poll → return image.
 */
async function generateViaKie(
  request: GenerateImageRequest,
  kieApiKey: string
): Promise<GenerateImageResult> {
  const prompt = request.prompt?.trim() || buildGeminiPrompt(request)

  // Collect public image URLs for KIE (requires URLs, not base64)
  const imageUrls: string[] = []
  if (request.templateUrl?.startsWith('http')) {
    imageUrls.push(request.templateUrl)
  }
  if (request.productImageUrls?.length) {
    imageUrls.push(...request.productImageUrls)
  }

  console.log(`[KIE] Prompt length: ${prompt.length}, image URLs: ${imageUrls.length}`)

  // Create task via KIE API with Nano Banana Pro (Gemini 3 Pro Image)
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${kieApiKey}`,
    },
    body: JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt,
        ...(imageUrls.length > 0 ? { image_input: imageUrls } : {}),
        aspect_ratio: request.aspectRatio || '9:16',
        resolution: '1K',
        output_format: 'png',
      },
    }),
  })

  const responseText = await createResponse.text()
  console.log(`[KIE] Create response: ${createResponse.status} - ${responseText.substring(0, 300)}`)

  let createData: any
  try {
    createData = JSON.parse(responseText)
  } catch {
    return {
      success: false,
      error: 'KIE: respuesta invalida del servidor',
      provider: 'gemini',
    }
  }

  if (createData.code !== 200 && createData.code !== 0) {
    return {
      success: false,
      error: `KIE: ${createData.msg || JSON.stringify(createData).substring(0, 200)}`,
      provider: 'gemini',
    }
  }

  const taskId = createData.data?.taskId || createData.taskId
  if (!taskId) {
    return {
      success: false,
      error: 'KIE: no se recibio taskId',
      provider: 'gemini',
    }
  }

  console.log(`[KIE] Task created: ${taskId}, polling...`)

  // KIE is primary — give it generous time (100s, well within Vercel 120s limit)
  const pollResult = await pollForResult('seedream', taskId, kieApiKey, {
    maxAttempts: 60,
    intervalMs: 2000,
    timeoutMs: 100000,
  })

  return { ...pollResult, provider: 'gemini' }
}

/**
 * Check status for async providers
 */
export async function checkGenerationStatus(
  provider: ImageProviderType,
  taskId: string,
  apiKey: string
): Promise<GenerateImageResult> {
  const providerInstance = getProvider(provider)

  if (!providerInstance) {
    return {
      success: false,
      error: `Provider "${provider}" not found`,
      provider: provider,
    }
  }

  if (!providerInstance.checkStatus) {
    return {
      success: false,
      error: `Provider "${provider}" does not support status checking`,
      provider: provider,
    }
  }

  return providerInstance.checkStatus(taskId, apiKey)
}

/**
 * Poll for result with timeout and retries
 */
export async function pollForResult(
  provider: ImageProviderType,
  taskId: string,
  apiKey: string,
  options: {
    maxAttempts?: number
    intervalMs?: number
    timeoutMs?: number
  } = {}
): Promise<GenerateImageResult> {
  const {
    maxAttempts = 60,
    intervalMs = 1000,
    timeoutMs = 120000,
  } = options

  const startTime = Date.now()
  let attempts = 0

  while (attempts < maxAttempts) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      return {
        success: false,
        error: 'Generation timed out',
        provider: provider,
      }
    }

    const result = await checkGenerationStatus(provider, taskId, apiKey)

    // If completed or failed, return result
    if (result.status === 'completed' || !result.success) {
      return result
    }

    // Still processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    attempts++
  }

  return {
    success: false,
    error: 'Max polling attempts reached',
    provider: provider,
  }
}

// Re-export types
export * from './types'
