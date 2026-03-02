// Multi-model image generation router
import {
  ImageProvider,
  ImageProviderType,
  ImageModelId,
  GenerateImageRequest,
  GenerateImageResult,
  IMAGE_PROVIDERS,
  IMAGE_MODELS,
} from './types'
import { geminiProvider, buildGeminiPrompt, generateWithGemini } from './gemini'
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
 * ALWAYS: KIE (ONE model — the equivalent of what the user selected)
 *       → fal.ai (model's falModelId or nano-banana-2)
 *       → Google direct
 *
 * The cascade drops down PROVIDERS, not models within a provider.
 * Each provider tries ONE model. NEVER breaks.
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

  // ── Step 2: KIE — ONE model per user selection (ALWAYS — iron rule) ──
  if (apiKeys.kie) {
    const kieModel = getKieModel(request.modelId)
    const t0 = Date.now()
    const kieResult = await generateViaKie(request, apiKeys.kie, kieModel, options?.maxTotalMs || 80000)
    if (kieResult.success) {
      logAI({ service: 'image', provider: 'kie', status: 'success', response_ms: Date.now() - t0, model: kieModel.model, was_fallback: cascadeErrors.length > 0 })
      return { ...kieResult, provider: request.provider }
    }
    logAI({ service: 'image', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: kieModel.model, error_message: kieResult.error, was_fallback: cascadeErrors.length > 0 })
    cascadeErrors.push(`KIE (${kieModel.model}): ${kieResult.error || 'fallido'}`)
    console.warn(`[Cascade] KIE ${kieModel.model} failed, trying fal.ai...`)
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
  // Uses the mapped Google model for the user's selection
  if (apiKeys.gemini) {
    const googleModelId = getGoogleDirectModelId(request.modelId)
    console.log(`[Cascade] Google direct fallback with ${googleModelId}`)
    const t0 = Date.now()
    try {
      const result = await generateWithGemini(request, apiKeys.gemini, googleModelId)
      if (result.success) {
        logAI({ service: 'image', provider: 'google', status: 'success', response_ms: Date.now() - t0, model: googleModelId, was_fallback: true })
        return { ...result, provider: request.provider }
      }
      logAI({ service: 'image', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: googleModelId, error_message: result.error, was_fallback: true })
      cascadeErrors.push(`Google (${googleModelId}): ${result.error || 'fallido'}`)
    } catch (err: any) {
      logAI({ service: 'image', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: googleModelId, error_message: err.message, was_fallback: true })
      cascadeErrors.push(`Google (${googleModelId}): ${err.message || 'fallido'}`)
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
 * Map user's selected model to its KIE equivalent.
 * The cascade drops down PROVIDERS, not models.
 * Each provider tries ONE model — the equivalent of what the user selected.
 */
function getKieModel(modelId: ImageModelId): { model: string; supportsImageInput: boolean; isSeedream: boolean } {
  const config = IMAGE_MODELS[modelId]

  // Google Pro → nano-banana-pro (KIE's Gemini 3 Pro)
  if (modelId === 'gemini-3-pro-image') {
    return { model: 'nano-banana-pro', supportsImageInput: true, isSeedream: false }
  }

  // ALL seedream models (ByteDance + fal) → seedream/5 on KIE (never 4.5)
  if (config?.company === 'bytedance' || modelId === 'seedream-5-lite' || modelId === 'seedream-5') {
    return { model: 'seedream/5-text-to-image', supportsImageInput: config?.supportsImageInput ?? true, isSeedream: true }
  }

  // gemini-2.5-flash → nano-banana (old Flash on KIE)
  if (modelId === 'gemini-2.5-flash') {
    return { model: 'nano-banana', supportsImageInput: true, isSeedream: false }
  }

  // Everything else (nano-banana-2, OpenAI, FLUX, etc.) → gemini-3.1-flash-image-preview
  return { model: 'gemini-3.1-flash-image-preview', supportsImageInput: true, isSeedream: false }
}

/**
 * Map user's selected model to its Google direct API model ID.
 * Used as final fallback in the cascade.
 */
function getGoogleDirectModelId(modelId: ImageModelId): string {
  // Google Pro → use its own model
  if (modelId === 'gemini-3-pro-image') {
    return 'gemini-3-pro-image-preview'
  }
  // gemini-2.5-flash → use its own model
  if (modelId === 'gemini-2.5-flash') {
    return 'gemini-2.5-flash-image'
  }
  // ALL other models → Gemini 3.1 Flash Image (nano-banana-2 equivalent on Google direct)
  return 'gemini-3.1-flash-image-preview'
}

/**
 * Try ONE model on KIE. No multi-model cascade within a provider.
 */
async function generateViaKie(
  request: GenerateImageRequest,
  kieApiKey: string,
  kieModel: { model: string; supportsImageInput: boolean; isSeedream: boolean },
  timeoutMs: number = 80000
): Promise<GenerateImageResult> {
  const prompt = request.prompt?.trim() || buildGeminiPrompt(request)

  // Collect public image URLs for KIE (requires URLs, not base64)
  const imageUrls: string[] = []
  if (request.templateUrl?.startsWith('http')) imageUrls.push(request.templateUrl)
  if (request.productImageUrls?.length) imageUrls.push(...request.productImageUrls)

  // Build input
  const input: any = {
    prompt,
    aspect_ratio: request.aspectRatio || '9:16',
    output_format: 'png',
  }

  if (kieModel.isSeedream) {
    // Seedream models
    input.quality = 'basic'
    if (imageUrls.length > 0 && kieModel.supportsImageInput) {
      // Try edit variant first
      const editModel = kieModel.model.replace('text-to-image', 'edit')
      console.log(`[KIE] Seedream with images, trying edit model: ${editModel}`)
      const editResult = await callKieCreateTask(editModel, { ...input, image_urls: imageUrls }, kieApiKey, Math.min(timeoutMs - 3000, 70000))
      if (editResult.success) return { ...editResult, provider: 'gemini' }
      console.warn(`[KIE] Seedream edit failed, trying text-only`)
    }
  } else {
    // Nano Banana models (Flash/Pro)
    input.resolution = '1K'
    if (imageUrls.length > 0 && kieModel.supportsImageInput) {
      input.image_input = imageUrls
    }
  }

  console.log(`[KIE] Trying ${kieModel.model}, timeout: ${Math.round(timeoutMs / 1000)}s...`)
  const result = await callKieCreateTask(kieModel.model, input, kieApiKey, timeoutMs)

  if (result.success) {
    console.log(`[KIE] ${kieModel.model} succeeded!`)
    return { ...result, provider: 'gemini' }
  }

  return {
    success: false,
    error: result.error || 'KIE: generacion fallida',
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
