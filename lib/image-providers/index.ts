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
 * KIE is the PRIMARY provider for everything. For Gemini models:
 *   1. Try KIE nano-banana-pro (Gemini 3 Pro Image)
 *   2. If fails → try KIE nano-banana (Gemini 2.5 Flash Image)
 *   3. If fails → try KIE seedream/4.5 as ultimate fallback
 *   4. Only if user has NO KIE key → try direct Google API
 *
 * For Seedream models: KIE direct (already works)
 * For other providers: direct call
 *
 * @param options.maxTotalMs - Max time budget for KIE cascade (default 80s).
 *   Routes with more time (e.g. landing = 300s) should pass a larger value.
 */
export async function generateImage(
  request: GenerateImageRequest,
  apiKeys: {
    gemini?: string
    openai?: string
    kie?: string
    bfl?: string
  },
  options?: { maxTotalMs?: number }
): Promise<GenerateImageResult> {
  const provider = getProvider(request.provider)

  if (!provider) {
    return {
      success: false,
      error: `Provider "${request.provider}" not found`,
      provider: request.provider,
    }
  }

  // ── Gemini: ALL through KIE with internal fallback cascade ──
  if (request.provider === 'gemini') {
    if (apiKeys.kie) {
      return generateViaKieCascade(request, apiKeys.kie, options?.maxTotalMs)
    }

    // No KIE key — last resort: direct Google API
    if (apiKeys.gemini) {
      console.log('[generateImage] Gemini: no KIE key, using direct Google API')
      return provider.generate(request, apiKeys.gemini)
    }

    return {
      success: false,
      error: 'Configura tu API key de KIE.ai en Settings',
      provider: 'gemini',
    }
  }

  // ── Normal flow for all other providers ──
  let apiKey: string | undefined
  switch (request.provider) {
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
 * KIE model cascade for Gemini image generation.
 * Time-aware: distributes available time across models.
 *
 *   1. nano-banana-pro  (Gemini 3 Pro Image — best quality)
 *   2. nano-banana       (Gemini 2.5 Flash Image — fast)
 *   3. seedream/4.5-text-to-image (Seedream — always works as ultimate fallback)
 */
const KIE_IMAGE_MODELS = [
  { model: 'nano-banana-pro', name: 'Gemini 3 Pro Image', supportsImageInput: true },
  { model: 'nano-banana', name: 'Gemini 2.5 Flash Image', supportsImageInput: true },
  { model: 'seedream/4.5-text-to-image', name: 'Seedream 4.5', supportsImageInput: false },
]

async function generateViaKieCascade(
  request: GenerateImageRequest,
  kieApiKey: string,
  maxTotalMs?: number
): Promise<GenerateImageResult> {
  const cascadeStart = Date.now()
  const totalBudget = maxTotalMs || 80000 // Default 80s (fits in 120s routes with prep buffer)

  const prompt = request.prompt?.trim() || buildGeminiPrompt(request)

  // Collect public image URLs for KIE (requires URLs, not base64)
  const imageUrls: string[] = []
  if (request.templateUrl?.startsWith('http')) {
    imageUrls.push(request.templateUrl)
  }
  if (request.productImageUrls?.length) {
    imageUrls.push(...request.productImageUrls)
  }

  const errors: string[] = []

  for (const kieModel of KIE_IMAGE_MODELS) {
    const elapsed = Date.now() - cascadeStart
    const remaining = totalBudget - elapsed

    // Need at least 15s to attempt a model
    if (remaining < 15000) {
      console.warn(`[KIE Cascade] Only ${Math.round(remaining / 1000)}s left, skipping ${kieModel.model}`)
      errors.push(`${kieModel.name}: Tiempo insuficiente`)
      break
    }

    // Per-model timeout: use remaining time but cap at 70s per model
    const modelTimeout = Math.min(remaining - 3000, 70000)
    console.log(`[KIE Cascade] Trying ${kieModel.model} (${kieModel.name}), timeout: ${Math.round(modelTimeout / 1000)}s...`)

    // Build input based on model capabilities
    const input: any = {
      prompt,
      aspect_ratio: request.aspectRatio || '9:16',
      output_format: 'png',
    }

    // Nano Banana models support resolution + image_input
    if (kieModel.model.startsWith('nano-banana')) {
      input.resolution = '1K'
      if (imageUrls.length > 0 && kieModel.supportsImageInput) {
        input.image_input = imageUrls
      }
    } else if (kieModel.model.startsWith('seedream')) {
      // Seedream uses different params
      input.quality = 'basic'
      // Seedream edit mode needs image_urls (different field name)
      if (imageUrls.length > 0) {
        const editModel = kieModel.model.replace('text-to-image', 'edit')
        console.log(`[KIE Cascade] Seedream with images, switching to edit model: ${editModel}`)
        const editTimeout = Math.min(remaining - 3000, 70000)
        const editResult = await callKieCreateTask(editModel, { ...input, image_urls: imageUrls }, kieApiKey, editTimeout)
        if (editResult.success) return { ...editResult, provider: 'gemini' }
        console.warn(`[KIE Cascade] Seedream edit failed, trying text-only`)
      }
    }

    const result = await callKieCreateTask(kieModel.model, input, kieApiKey, modelTimeout)

    if (result.success) {
      console.log(`[KIE Cascade] ${kieModel.model} succeeded!`)
      return { ...result, provider: 'gemini' }
    }

    const errorMsg = (result.error || 'Unknown error').toLowerCase()
    errors.push(`${kieModel.name}: ${result.error || 'Unknown error'}`)
    console.warn(`[KIE Cascade] ${kieModel.model} failed: ${result.error}`)

    // Only BREAK on content/safety errors (all models will fail the same way).
    // CONTINUE for transient errors (timeout, rate limit, server, access).
    const isContentError =
      errorMsg.includes('safety') ||
      errorMsg.includes('blocked') ||
      errorMsg.includes('harmful') ||
      errorMsg.includes('inappropriate') ||
      errorMsg.includes('invalid prompt')

    if (isContentError) {
      console.warn(`[KIE Cascade] Content/safety error, stopping cascade`)
      break
    }
  }

  // All KIE models failed
  return {
    success: false,
    error: `Todos los modelos de KIE fallaron. Verifica tu cuenta en kie.ai:\n1. Que tengas creditos suficientes\n2. Que los modelos esten activados en kie.ai/market\n\nDetalles: ${errors.join(' | ')}`,
    provider: 'gemini',
  }
}

/**
 * Create a single KIE task, poll for result, return image.
 * @param timeoutMs - Max time for polling (default 80s)
 */
async function callKieCreateTask(
  model: string,
  input: any,
  kieApiKey: string,
  timeoutMs: number = 80000
): Promise<GenerateImageResult> {
  try {
    const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({ model, input }),
    })

    const responseText = await createResponse.text()
    console.log(`[KIE:${model}] Response: ${createResponse.status} - ${responseText.substring(0, 200)}`)

    let createData: any
    try {
      createData = JSON.parse(responseText)
    } catch {
      return { success: false, error: 'KIE: respuesta invalida', provider: 'gemini' }
    }

    if (createData.code !== 200 && createData.code !== 0) {
      return {
        success: false,
        error: `${createData.msg || JSON.stringify(createData).substring(0, 150)}`,
        provider: 'gemini',
      }
    }

    const taskId = createData.data?.taskId || createData.taskId
    if (!taskId) {
      return { success: false, error: 'KIE: no taskId', provider: 'gemini' }
    }

    console.log(`[KIE:${model}] Task: ${taskId}, polling (max ${Math.round(timeoutMs / 1000)}s)...`)

    const pollResult = await pollForResult('seedream', taskId, kieApiKey, {
      maxAttempts: Math.ceil(timeoutMs / 2000),
      intervalMs: 2000,
      timeoutMs,
    })

    if (!pollResult.success) {
      return {
        success: false,
        error: pollResult.error || 'KIE: generacion fallida',
        provider: 'gemini',
      }
    }

    return pollResult
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'KIE: error de conexion',
      provider: 'gemini',
    }
  }
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
