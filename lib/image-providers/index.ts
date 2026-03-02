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
import { logAI } from '../services/ai-monitor'

/**
 * Convert raw error messages to friendly Spanish that anyone can understand.
 * No JSON, no technical jargon, no model IDs — just plain language.
 */
function humanizeOne(raw: string): string {
  const l = raw.toLowerCase()

  // No credits / quota / billing
  if (l.includes('quota') || l.includes('credit') || l.includes('saldo') || l.includes('billing') ||
      l.includes('payment') || l.includes('resource_exhausted') || l.includes('insufficient'))
    return 'No tienes saldo suficiente. Recarga tu cuenta en el proveedor de IA.'

  // Timeout
  if (l.includes('timeout') || l.includes('tiempo') || l.includes('timed out') || l.includes('agotado'))
    return 'El servicio esta tardando demasiado. Intenta de nuevo en unos minutos.'

  // Rate limit
  if (l.includes('rate limit') || l.includes('too many') || l.includes('429'))
    return 'Muchas solicitudes seguidas. Espera 30 segundos e intenta de nuevo.'

  // API key invalid
  if (l.includes('unauthorized') || l.includes('invalid') && l.includes('key') || l.includes('401'))
    return 'Tu API key no es valida. Revisala en Settings.'

  // Access denied
  if (l.includes('forbidden') || l.includes('403') || l.includes('permission') || l.includes('access'))
    return 'Tu cuenta no tiene permisos. Verifica la configuracion en el proveedor.'

  // Safety block
  if (l.includes('safety') || l.includes('blocked') || l.includes('harmful') || l.includes('inappropriate'))
    return 'La imagen fue bloqueada por filtros de seguridad. Prueba con otra plantilla o texto diferente.'

  // Server down
  if (l.includes('500') || l.includes('502') || l.includes('503') || l.includes('server') || l.includes('unavailable'))
    return 'El servicio esta caido temporalmente. Intenta de nuevo en unos minutos.'

  // Connection
  if (l.includes('connection') || l.includes('network') || l.includes('fetch') || l.includes('econnrefused'))
    return 'Error de conexion. Verifica tu internet e intenta de nuevo.'

  // Model not found
  if (l.includes('not found') || l.includes('404') || l.includes('activad'))
    return 'El modelo no esta disponible. Activa el modelo en tu cuenta del proveedor (kie.ai/market).'

  // Generic fallback — still friendly
  return 'Hubo un problema generando la imagen. Intenta de nuevo.'
}

/**
 * Take all cascade errors and produce ONE friendly message for the user.
 */
function humanizeErrors(rawErrors: string[]): string {
  const friendly = rawErrors.map(humanizeOne)
  // Deduplicate
  const unique = [...new Set(friendly)]

  if (unique.length === 1) {
    return unique[0]
  }

  return `No pudimos generar tu imagen.\n\n${unique.map(e => `• ${e}`).join('\n')}\n\nSi el problema sigue, prueba con otro modelo en Settings.`
}

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
    cascadeErrors.push(result.error || 'OpenAI fallo')
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
    cascadeErrors.push(result.error || 'FLUX fallo')
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
    cascadeErrors.push(kieResult.error || 'KIE fallo')
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
    cascadeErrors.push(falResult.error || 'fal.ai fallo')
    console.warn(`[Cascade] fal.ai failed`)
  }

  // ── Step 4: Google direct (last resort — NOT for seedream models) ──
  const isSeedream = modelConfig?.company === 'bytedance' || request.modelId === 'seedream-5-lite' || request.modelId === 'seedream-5'
  if (!isSeedream && apiKeys.gemini) {
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
      cascadeErrors.push(result.error || 'Google fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: googleModelId, error_message: err.message, was_fallback: true })
      cascadeErrors.push(err.message || 'Google fallo')
    }
  }

  // ── All failed — show FRIENDLY error to user ──
  if (cascadeErrors.length === 0) {
    return {
      success: false,
      error: 'No tienes ninguna API configurada. Ve a Settings y agrega al menos una (KIE, fal.ai o Google).',
      provider: request.provider,
    }
  }

  return {
    success: false,
    error: humanizeErrors(cascadeErrors),
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
