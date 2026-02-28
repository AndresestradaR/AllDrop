// Multi-model image generation router
import {
  ImageProvider,
  ImageProviderType,
  GenerateImageRequest,
  GenerateImageResult,
  IMAGE_PROVIDERS,
  IMAGE_MODELS,
} from './types'
import { geminiProvider, buildGeminiPrompt } from './gemini'
import { openaiProvider } from './openai'
import { seedreamProvider } from './kie-seedream'
import { fluxProvider } from './bfl-flux'
import { generateViaFal, falImageToBase64 } from './fal'
import { classifyError, wrapError, formatCascadeError, type AIProviderError } from '../services/ai-errors'
import { logAI } from '../services/ai-monitor'

// Provider registry (fal not registered here — handled directly via generateViaFal)
const providers: Record<string, ImageProvider> = {
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
 * Generate image with UNIVERSAL iron cascade.
 *
 * No matter what model the user selects, the cascade ALWAYS runs:
 *
 * If OpenAI/FLUX selected → try that provider first, then cascade
 * ALWAYS: KIE (nano-banana-pro → nano-banana → seedream/4.5)
 *       → fal.ai (nano-banana-2 or model's falModelId)
 *       → Google direct
 *
 * NEVER breaks. If one level fails, the next one picks up.
 *
 * @param options.maxTotalMs - Max time budget for cascade (default 80s).
 */
export async function generateImage(
  request: GenerateImageRequest,
  apiKeys: {
    gemini?: string
    openai?: string
    kie?: string
    bfl?: string
    fal?: string
  },
  options?: { maxTotalMs?: number }
): Promise<GenerateImageResult> {
  const cascadeErrors: string[] = []
  const modelConfig = IMAGE_MODELS[request.modelId]
  const prompt = request.prompt?.trim() || buildGeminiPrompt(request)

  // ── Step 1: If OpenAI or FLUX selected, try them first ──
  if (request.provider === 'openai' && apiKeys.openai) {
    const t0 = Date.now()
    const result = await getProvider('openai')!.generate(request, apiKeys.openai)
    if (result.success) {
      logAI({ service: 'image', provider: 'openai', status: 'success', response_ms: Date.now() - t0, model: request.modelId })
      return result
    }
    logAI({ service: 'image', provider: 'openai', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: result.error })
    cascadeErrors.push(`OpenAI: ${result.error || 'fallido'}`)
    console.warn(`[Cascade] OpenAI failed, continuing cascade...`)
  }

  if (request.provider === 'flux' && apiKeys.bfl) {
    const t0 = Date.now()
    const result = await getProvider('flux')!.generate(request, apiKeys.bfl)
    if (result.success) {
      logAI({ service: 'image', provider: 'bfl', status: 'success', response_ms: Date.now() - t0, model: request.modelId })
      return result
    }
    logAI({ service: 'image', provider: 'bfl', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: result.error })
    cascadeErrors.push(`FLUX: ${result.error || 'fallido'}`)
    console.warn(`[Cascade] FLUX failed, continuing cascade...`)
  }

  // ── Step 2: KIE cascade (ALWAYS — iron rule) ──
  if (apiKeys.kie) {
    const t0 = Date.now()
    const kieResult = await generateViaKieCascade(request, apiKeys.kie, options?.maxTotalMs)
    if (kieResult.success) {
      logAI({ service: 'image', provider: 'kie', status: 'success', response_ms: Date.now() - t0, model: 'kie-cascade', was_fallback: cascadeErrors.length > 0 })
      return { ...kieResult, provider: request.provider }
    }
    logAI({ service: 'image', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: 'kie-cascade', error_message: kieResult.error, was_fallback: cascadeErrors.length > 0 })
    cascadeErrors.push(`KIE: ${kieResult.error || 'fallido'}`)
    console.warn(`[Cascade] KIE failed, trying fal.ai...`)
  }

  // ── Step 3: fal.ai (ALWAYS — iron rule) ──
  if (apiKeys.fal) {
    const falModelId = modelConfig?.falModelId || 'nano-banana-2'
    const t0 = Date.now()
    const falResult = await generateViaFal(apiKeys.fal, falModelId, {
      prompt,
      imageUrls: request.productImageUrls,
      aspectRatio: request.aspectRatio || '9:16',
      timeoutMs: 45000,
    })

    if (falResult.success && falResult.imageUrl) {
      const imageData = await falImageToBase64(falResult.imageUrl)
      if (imageData) {
        logAI({ service: 'image', provider: 'fal', status: 'success', response_ms: Date.now() - t0, model: falModelId, was_fallback: cascadeErrors.length > 0 })
        console.log(`[Cascade] fal.ai succeeded${cascadeErrors.length > 0 ? ' (fallback)' : ''}`)
        return {
          success: true,
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          provider: request.provider,
        }
      }
    }

    logAI({ service: 'image', provider: 'fal', status: 'error', response_ms: Date.now() - t0, model: falModelId, error_message: falResult.error, was_fallback: cascadeErrors.length > 0 })
    cascadeErrors.push(`fal.ai: ${falResult.error || 'fallido'}`)
    console.warn(`[Cascade] fal.ai failed, trying Google direct...`)
  }

  // ── Step 4: Google direct (ALWAYS — last resort) ──
  if (apiKeys.gemini) {
    const geminiProvider = getProvider('gemini')
    if (geminiProvider) {
      console.log('[Cascade] Using direct Google API (final fallback)')
      const t0 = Date.now()
      const result = await geminiProvider.generate(request, apiKeys.gemini)
      if (result.success) {
        logAI({ service: 'image', provider: 'google', status: 'success', response_ms: Date.now() - t0, model: 'gemini-direct', was_fallback: true })
        return { ...result, provider: request.provider }
      }
      logAI({ service: 'image', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: 'gemini-direct', error_message: result.error, was_fallback: true })
      cascadeErrors.push(`Google: ${result.error || 'fallido'}`)
    }
  }

  // ── All failed ──
  if (cascadeErrors.length === 0) {
    return {
      success: false,
      error: 'Configura al menos una API key (KIE, fal.ai, o Google) en Settings',
      provider: request.provider,
    }
  }

  return {
    success: false,
    error: `Todos los proveedores fallaron:\n${cascadeErrors.join('\n')}`,
    provider: request.provider,
  }
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

    // Per-model timeout: use remaining time but cap at 150s per model
    // KIE queues jobs, so later jobs in bulk generation need more time
    const modelTimeout = Math.min(remaining - 3000, 150000)
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
