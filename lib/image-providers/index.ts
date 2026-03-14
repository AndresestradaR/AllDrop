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
import { generateViaWavespeed } from './wavespeed'
import { logAI } from '../services/ai-monitor'

/**
 * Hard timeout wrapper — guarantees a promise resolves/rejects within `ms`.
 * Unlike soft timeouts (polling loops), this kills the step even if fetch() hangs.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label}: tiempo agotado (${Math.round(ms / 1000)}s)`)),
      ms
    )
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

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

  // Safety block or empty response (Gemini returns 200 but no image — silent safety filter)
  if (l.includes('safety') || l.includes('blocked') || l.includes('harmful') || l.includes('inappropriate') || l.includes('no devolvio imagen'))
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
  const unique = Array.from(new Set(friendly))

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
 * Generate image with UNIVERSAL cascade driven by model config.
 *
 * TIME-BUDGET-AWARE: each cascade step gets a portion of the total time budget.
 * If a step times out, the remaining time goes to the next step — guarantees
 * the cascade always has time to try fallbacks instead of Vercel killing the function.
 *
 * Budget split (dynamic based on total budget):
 *   KIE:       65% of remaining, cap = max(total*0.5, 75s) — cheapest, try first
 *              Banner gen (250s) → up to 125s. Studio (112s) → up to 75s.
 *   fal.ai:    max 50s (or remaining - 10s) — reliable fallback
 *   Direct API: remaining time              — most expensive, last resort
 *
 * Each model defines its own `cascade` config in types.ts:
 *   cascade.kie   → KIE model IDs for T2I and I2I
 *   cascade.fal   → fal.ai paths for T2I and I2I
 *   cascade.directApi → final fallback ('gemini' | 'openai' | 'bfl')
 */
export async function generateImage(
  request: GenerateImageRequest,
  apiKeys: {
    gemini?: string
    openai?: string
    kie?: string
    bfl?: string
    fal?: string
    wavespeed?: string
  },
  options?: { maxTotalMs?: number }
): Promise<GenerateImageResult> {
  const cascadeErrors: string[] = []
  const modelConfig = IMAGE_MODELS[request.modelId]
  const prompt = request.prompt?.trim() || buildGeminiPrompt(request)
  const cascade = modelConfig?.cascade
  const hasImages = !!(request.productImageUrls?.length || request.productImagesBase64?.length || request.templateUrl)

  // ── Time budget tracking ──
  const totalBudgetMs = options?.maxTotalMs || 112000
  const cascadeStart = Date.now()
  const elapsed = () => Date.now() - cascadeStart
  const remaining = () => Math.max(totalBudgetMs - elapsed(), 0)
  const hasTime = (minMs: number = 8000) => remaining() > minMs

  console.log(`[Cascade] START model=${request.modelId}, hasImages=${hasImages}, budget=${Math.round(totalBudgetMs / 1000)}s`)
  console.log(`[Cascade] keys: kie=${!!apiKeys.kie} wavespeed=${!!apiKeys.wavespeed} fal=${!!apiKeys.fal} gemini=${!!apiKeys.gemini} openai=${!!apiKeys.openai} bfl=${!!apiKeys.bfl}`)
  console.log(`[Cascade] config: kie=${!!cascade?.kie} wavespeed=${!!cascade?.wavespeed} fal=${!!cascade?.fal} directApi=${cascade?.directApi || 'none'}`)

  // ── Step 1: OpenAI direct FIRST (solo para modelos GPT Image) ──
  if (cascade?.directApi === 'openai' && apiKeys.openai && hasTime()) {
    const t0 = Date.now()
    const openAiBudget = Math.min(remaining() * 0.35, 30000)
    try {
      const result = await withTimeout(
        getProvider('openai')!.generate(request, apiKeys.openai),
        openAiBudget, 'OpenAI'
      )
      if (result.success) {
        logAI({ service: 'image', provider: 'openai', status: 'success', response_ms: Date.now() - t0, model: request.modelId })
        return { ...result, usedProvider: 'openai-direct' }
      }
      logAI({ service: 'image', provider: 'openai', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: result.error })
      cascadeErrors.push(result.error || 'OpenAI fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'openai', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: err.message })
      cascadeErrors.push(err.message || 'OpenAI fallo')
    }
    console.warn(`[Cascade] OpenAI direct failed (${Math.round((Date.now() - t0) / 1000)}s), continuing... ${Math.round(remaining() / 1000)}s left`)
  }

  // ── Step 2: KIE — principal, mas barato ──
  // KIE gets 65% of remaining budget, capped relative to total budget.
  // I2I: 43-69s processing + 5-15s image download = up to 84s.
  // Banner gen (250s budget) → cap 120s. Studio (112s) → cap ~73s.
  // withTimeout guarantees we NEVER exceed the budget even if fetch() hangs
  if (cascade?.kie && apiKeys.kie && hasTime()) {
    const kieModelId = hasImages && cascade.kie.i2i ? cascade.kie.i2i : cascade.kie.t2i
    const kieCap = Math.max(totalBudgetMs * 0.5, 75000)
    const kieBudget = Math.min(remaining() * 0.65, kieCap)
    const t0 = Date.now()
    console.log(`[Cascade] KIE ${kieModelId} — budget: ${Math.round(kieBudget / 1000)}s, total remaining: ${Math.round(remaining() / 1000)}s`)
    try {
      const kieResult = await withTimeout(
        generateViaKie(request, apiKeys.kie, { model: kieModelId, mode: cascade.kie.mode }, kieBudget),
        kieBudget + 2000, // 2s grace for cleanup
        'KIE'
      )
      if (kieResult.success) {
        logAI({ service: 'image', provider: 'kie', status: 'success', response_ms: Date.now() - t0, model: kieModelId, was_fallback: cascadeErrors.length > 0 })
        return { ...kieResult, provider: request.provider, usedProvider: `kie:${kieModelId}` }
      }
      logAI({ service: 'image', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: kieModelId, error_message: kieResult.error, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(kieResult.error || 'KIE fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: kieModelId, error_message: err.message, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(err.message || 'KIE fallo')
    }
    console.warn(`[Cascade] KIE ${kieModelId} failed (${Math.round((Date.now() - t0) / 1000)}s), ${Math.round(remaining() / 1000)}s left`)
  }

  // ── Step 2.5: WaveSpeed — fallback de KIE, antes de fal.ai ──
  // WaveSpeed gets 50% of remaining budget, capped at 45s.
  // Uses sync mode for images (blocks until complete, no polling needed).
  if (cascade?.wavespeed && apiKeys.wavespeed && hasTime()) {
    const wsPath = hasImages && cascade.wavespeed.i2i ? cascade.wavespeed.i2i : cascade.wavespeed.t2i
    const wsBudget = Math.min(remaining() * 0.5, 45000)
    const t0 = Date.now()

    // Collect image URLs for WaveSpeed I2I
    const wsImageUrls: string[] = []
    if (hasImages) {
      if (request.templateUrl?.startsWith('http')) wsImageUrls.push(request.templateUrl)
      if (request.productImageUrls?.length) wsImageUrls.push(...request.productImageUrls)
    }

    console.log(`[Cascade] WaveSpeed ${wsPath} — budget: ${Math.round(wsBudget / 1000)}s, images: ${wsImageUrls.length}, remaining: ${Math.round(remaining() / 1000)}s`)

    try {
      const wsResult = await withTimeout(
        generateViaWavespeed(apiKeys.wavespeed, {
          prompt,
          modelPath: cascade.wavespeed.t2i,
          editPath: cascade.wavespeed.i2i,
          imageUrls: wsImageUrls.length > 0 ? wsImageUrls : undefined,
          aspectRatio: request.aspectRatio || '9:16',
          resolution: '1k',
          syncMode: true,
          timeoutMs: wsBudget,
        }),
        wsBudget + 2000, // 2s grace
        'WaveSpeed'
      )

      if (wsResult.success) {
        logAI({ service: 'image', provider: 'wavespeed', status: 'success', response_ms: Date.now() - t0, model: wsPath, was_fallback: cascadeErrors.length > 0 })
        console.log(`[Cascade] WaveSpeed succeeded (${Math.round((Date.now() - t0) / 1000)}s)${cascadeErrors.length > 0 ? ' — fallback' : ''}`)
        return { ...wsResult, provider: request.provider, usedProvider: `wavespeed:${wsPath}` }
      }

      logAI({ service: 'image', provider: 'wavespeed', status: 'error', response_ms: Date.now() - t0, model: wsPath, error_message: wsResult.error, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(wsResult.error || 'WaveSpeed fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'wavespeed', status: 'error', response_ms: Date.now() - t0, model: wsPath, error_message: err.message, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(err.message || 'WaveSpeed fallo')
    }
    console.warn(`[Cascade] WaveSpeed ${wsPath} failed (${Math.round((Date.now() - t0) / 1000)}s), ${Math.round(remaining() / 1000)}s left`)
  }

  // ── Step 3: fal.ai — fallback de KIE ──
  // fal.ai gets remaining time minus 15s buffer for direct API
  // withTimeout guarantees hard cutoff
  if (cascade?.fal && apiKeys.fal && hasTime()) {
    const falPath = hasImages && cascade.fal.i2i ? cascade.fal.i2i : cascade.fal.t2i
    const t0 = Date.now()
    // Collect all image URLs (template + product) — same order as KIE
    const falImageUrls: string[] = []
    if (request.templateUrl?.startsWith('http')) falImageUrls.push(request.templateUrl)
    if (request.productImageUrls?.length) falImageUrls.push(...request.productImageUrls)

    // Budget: remaining minus 15s for potential direct API fallback, capped at 50s
    const hasDirectFallback = cascade.directApi && (
      (cascade.directApi === 'gemini' && apiKeys.gemini) ||
      (cascade.directApi === 'bfl' && apiKeys.bfl)
    )
    const directReserve = hasDirectFallback ? 10000 : 0
    const falBudget = Math.max(Math.min(remaining() - directReserve, 50000), 15000)
    console.log(`[Cascade] fal.ai ${falPath} — budget: ${Math.round(falBudget / 1000)}s, images: ${falImageUrls.length}, remaining: ${Math.round(remaining() / 1000)}s`)

    // Seedream on fal.ai also has text length limits — truncate
    const falPrompt = falPath.includes('seedream') && prompt.length > 800
      ? prompt.substring(0, 800)
      : prompt

    try {
      const falResult = await withTimeout(
        generateViaFal(apiKeys.fal, falPath, {
          prompt: falPrompt,
          imageUrls: falImageUrls.length > 0 ? falImageUrls : undefined,
          aspectRatio: request.aspectRatio || '9:16',
          timeoutMs: falBudget,
        }),
        falBudget + 2000, // 2s grace
        'fal.ai'
      )

      if (falResult.success && falResult.imageUrl) {
        const imageData = await falImageToBase64(falResult.imageUrl)
        if (imageData) {
          logAI({ service: 'image', provider: 'fal', status: 'success', response_ms: Date.now() - t0, model: falPath, was_fallback: cascadeErrors.length > 0 })
          console.log(`[Cascade] fal.ai succeeded (${Math.round((Date.now() - t0) / 1000)}s)${cascadeErrors.length > 0 ? ' — fallback' : ''}`)
          return {
            success: true,
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
            provider: request.provider,
            usedProvider: `fal:${falPath}`,
          }
        }
        console.error(`[Cascade] fal.ai generated image but download failed: ${falResult.imageUrl.substring(0, 80)}`)
        cascadeErrors.push('fal.ai: imagen generada pero no se pudo descargar')
      }
      logAI({ service: 'image', provider: 'fal', status: 'error', response_ms: Date.now() - t0, model: falPath, error_message: falResult.error, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(falResult.error || 'fal.ai fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'fal', status: 'error', response_ms: Date.now() - t0, model: falPath, error_message: err.message, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(err.message || 'fal.ai fallo')
    }
    console.warn(`[Cascade] fal.ai ${falPath} failed (${Math.round((Date.now() - t0) / 1000)}s), ${Math.round(remaining() / 1000)}s left`)
  }

  // ── Step 4: Direct API ultimo fallback (Gemini o BFL — usa todo el tiempo restante) ──
  // withTimeout on remaining budget to guarantee no 504
  if (cascade?.directApi === 'gemini' && apiKeys.gemini && hasTime()) {
    const googleModelId = cascade.directModelId || modelConfig.apiModelId
    const googleBudget = Math.max(remaining() - 2000, 10000)
    console.log(`[Cascade] Google direct fallback with ${googleModelId}, budget: ${Math.round(googleBudget / 1000)}s`)
    const t0 = Date.now()
    try {
      const result = await withTimeout(
        generateWithGemini(request, apiKeys.gemini, googleModelId),
        googleBudget, 'Google'
      )
      if (result.success) {
        logAI({ service: 'image', provider: 'google', status: 'success', response_ms: Date.now() - t0, model: googleModelId, was_fallback: true })
        return { ...result, provider: request.provider, usedProvider: `google:${googleModelId}` }
      }
      logAI({ service: 'image', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: googleModelId, error_message: result.error, was_fallback: true })
      cascadeErrors.push(result.error || 'Google fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: googleModelId, error_message: err.message, was_fallback: true })
      cascadeErrors.push(err.message || 'Google fallo')
    }
  }

  if (cascade?.directApi === 'bfl' && apiKeys.bfl && hasTime()) {
    const bflBudget = Math.max(remaining() - 2000, 10000)
    console.log(`[Cascade] BFL direct fallback, budget: ${Math.round(bflBudget / 1000)}s`)
    const t0 = Date.now()
    try {
      const result = await withTimeout(
        getProvider('flux')!.generate(request, apiKeys.bfl),
        bflBudget, 'BFL'
      )
      if (result.success) {
        logAI({ service: 'image', provider: 'bfl', status: 'success', response_ms: Date.now() - t0, model: request.modelId, was_fallback: cascadeErrors.length > 0 })
        return { ...result, usedProvider: `bfl:${request.modelId}` }
      }
      logAI({ service: 'image', provider: 'bfl', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: result.error, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(result.error || 'BFL fallo')
    } catch (err: any) {
      logAI({ service: 'image', provider: 'bfl', status: 'error', response_ms: Date.now() - t0, model: request.modelId, error_message: err.message, was_fallback: cascadeErrors.length > 0 })
      cascadeErrors.push(err.message || 'BFL fallo')
    }
    console.warn(`[Cascade] BFL direct failed`)
  }

  // ── All failed — show FRIENDLY error to user ──
  console.error(`[Cascade] ALL STEPS FAILED after ${Math.round(elapsed() / 1000)}s — ${cascadeErrors.length} errors`)
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
 * Try ONE model on KIE. No multi-model cascade within a provider.
 */
async function generateViaKie(
  request: GenerateImageRequest,
  kieApiKey: string,
  kieModel: { model: string; mode: 'nano-banana' | 'seedream' | 'gpt-image' },
  timeoutMs: number = 80000
): Promise<GenerateImageResult> {
  let prompt = request.prompt?.trim() || buildGeminiPrompt(request)

  // Seedream on KIE has a strict text length limit — truncate prompt
  if (kieModel.mode === 'seedream' && prompt.length > 800) {
    console.log(`[KIE] Seedream prompt too long (${prompt.length} chars), truncating to 800`)
    prompt = prompt.substring(0, 800)
  }

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

  if (kieModel.mode === 'seedream') {
    // Seedream image-to-image: imagenes via image_urls
    input.quality = 'basic'
    if (imageUrls.length > 0) {
      input.image_urls = imageUrls
    }
  } else if (kieModel.mode === 'gpt-image') {
    // GPT Image image-to-image: imagenes via image_input
    if (imageUrls.length > 0) {
      input.image_input = imageUrls
    }
  } else {
    // Nano Banana models (Flash/Pro): imagenes via image_input
    input.resolution = '1K'
    if (imageUrls.length > 0) {
      input.image_input = imageUrls
    }
  }

  console.log(`[KIE] Trying ${kieModel.model}, timeout: ${Math.round(timeoutMs / 1000)}s...`)
  const result = await callKieCreateTask(kieModel.model, input, kieApiKey, timeoutMs)

  if (result.success) {
    console.log(`[KIE] ${kieModel.model} succeeded!`)
    return { ...result, provider: request.provider }
  }

  return {
    success: false,
    error: result.error || 'KIE: generacion fallida',
    provider: request.provider,
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
