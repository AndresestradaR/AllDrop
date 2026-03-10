import { decrypt } from './encryption'
import { logAI } from './ai-monitor'

// ── Types ──────────────────────────────────────────────────────

export interface AITextKeys {
  kieApiKey?: string
  openaiApiKey?: string
  googleApiKey?: string
}

export interface AIImageInput {
  mimeType: string
  base64: string // raw base64 without data: prefix
}

export interface AIMultimodalPart {
  text?: string
  fileData?: { fileUri: string; mimeType: string }
  inlineData?: { data: string; mimeType: string }
}

export interface AITextOptions {
  systemPrompt?: string
  userMessage: string // Required for KIE/OpenAI. Can be empty string when using multimodalParts (Google only).
  images?: AIImageInput[]
  multimodalParts?: AIMultimodalPart[] // For video/image URLs + text (Google only, bypasses KIE/OpenAI)
  temperature?: number
  jsonMode?: boolean
  kieModel?: string    // default: 'gemini-2.5-flash'
  googleModel?: string // default: 'gemini-2.5-flash'
  signal?: AbortSignal
  reasoningEffort?: 'none' | 'low' | 'medium' // default: 'none'. Use 'low' for structured JSON output
  skipKIE?: boolean    // true = skip KIE, go straight to OpenAI/Google (use for strict JSON schema)
  onSuccess?: (meta: { provider: AIProvider; fallbacks: string[] }) => void
}

// ── Main entry point ───────────────────────────────────────────

export type AIProvider = 'kie' | 'openai' | 'google'

/**
 * Unified AI text generation. Cascade: KIE → OpenAI → Google Gemini.
 * Returns the raw text string. Use onSuccess callback to get provider metadata.
 */
export async function generateAIText(
  keys: AITextKeys,
  options: AITextOptions
): Promise<string> {
  const errors: string[] = []
  const fallbacks: string[] = []

  // Skip KIE when route needs strict JSON schema (KIE doesn't support responseMimeType)
  if (keys.kieApiKey && !options.skipKIE) {
    const t0 = Date.now()
    try {
      const text = await callKIE(keys.kieApiKey, options)
      logAI({ service: 'text', provider: 'kie', status: 'success', response_ms: Date.now() - t0, model: options.kieModel || 'gemini-2.5-flash', was_fallback: false })
      options.onSuccess?.({ provider: 'kie', fallbacks })
      return text
    } catch (err: any) {
      logAI({ service: 'text', provider: 'kie', status: 'error', response_ms: Date.now() - t0, model: options.kieModel || 'gemini-2.5-flash', error_message: err.message, was_fallback: false })
      errors.push(`KIE: ${err.message}`)
      fallbacks.push(`KIE: ${err.message}`)
      console.error('[AI Text] KIE failed:', err.message)
    }
  }

  // Skip OpenAI when multimodal parts are present (video URLs only work with Google)
  if (keys.openaiApiKey && !options.multimodalParts?.length) {
    const t0 = Date.now()
    const wasFallback = fallbacks.length > 0
    try {
      const text = await callOpenAI(keys.openaiApiKey, options)
      logAI({ service: 'text', provider: 'openai', status: 'success', response_ms: Date.now() - t0, model: 'gpt-4o-mini', was_fallback: wasFallback })
      options.onSuccess?.({ provider: 'openai', fallbacks })
      return text
    } catch (err: any) {
      logAI({ service: 'text', provider: 'openai', status: 'error', response_ms: Date.now() - t0, model: 'gpt-4o-mini', error_message: err.message, was_fallback: wasFallback })
      errors.push(`OpenAI: ${err.message}`)
      fallbacks.push(`OpenAI: ${err.message}`)
      console.error('[AI Text] OpenAI failed:', err.message)
    }
  }

  if (keys.googleApiKey) {
    const t0 = Date.now()
    const wasFallback = fallbacks.length > 0
    try {
      const text = await callGoogle(keys.googleApiKey, options)
      logAI({ service: 'text', provider: 'google', status: 'success', response_ms: Date.now() - t0, model: options.googleModel || 'gemini-2.5-flash', was_fallback: wasFallback })
      options.onSuccess?.({ provider: 'google', fallbacks })
      return text
    } catch (err: any) {
      logAI({ service: 'text', provider: 'google', status: 'error', response_ms: Date.now() - t0, model: options.googleModel || 'gemini-2.5-flash', error_message: err.message, was_fallback: wasFallback })
      errors.push(`Google: ${err.message}`)
      fallbacks.push(`Google: ${err.message}`)
      console.error('[AI Text] Google failed:', err.message)
    }
  }

  if (errors.length === 0) {
    throw new Error('Configura tu API key de KIE, OpenAI o Google en Settings')
  }

  throw new Error(`Error en generación de texto: ${errors.join('; ')}`)
}

// ── KIE.ai Chat API (OpenAI-compatible) ────────────────────────

// KIE text model: only use flash (pro is slower and causes cascade timeouts)
const KIE_TEXT_MODELS = ['gemini-2.5-flash']

async function callKIE(apiKey: string, options: AITextOptions): Promise<string> {
  // If caller specified a model, use only that one; otherwise cascade
  const models = options.kieModel
    ? [options.kieModel]
    : KIE_TEXT_MODELS

  const errors: string[] = []

  for (const model of models) {
    try {
      const result = await callKIESingleModel(apiKey, model, options)
      return result
    } catch (err: any) {
      console.warn(`[AI Text] KIE model ${model} failed: ${err.message}`)
      errors.push(`${model}: ${err.message}`)
    }
  }

  throw new Error(`KIE: todos los modelos fallaron — ${errors.join('; ')}`)
}

async function callKIESingleModel(
  apiKey: string,
  model: string,
  options: AITextOptions
): Promise<string> {
  const url = `https://api.kie.ai/${model}/v1/chat/completions`

  const messages: any[] = []

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }

  if (options.images?.length) {
    const content: any[] = [{ type: 'text', text: options.userMessage }]
    for (const img of options.images) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      })
    }
    messages.push({ role: 'user', content })
  } else {
    messages.push({ role: 'user', content: options.userMessage })
  }

  const body: any = { messages, stream: false }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }

  // 'none' = fast but may ignore JSON schema. Omit entirely for structured output.
  if (!options.reasoningEffort || options.reasoningEffort === 'none') {
    body.reasoning_effort = 'none'
  }
  // 'low'/'medium': don't send the param — let model think naturally (KIE may not support it)

  // NOTE: Do NOT send response_format to KIE — it's not supported by all
  // OpenAI-compatible providers. The system prompt already asks for JSON.

  // Safety timeout: 90s max per model
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)
  const signal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal

  try {
    console.log(`[AI Text] KIE: calling ${model}...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`KIE API ${model} (${response.status}): ${errText.substring(0, 300)}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      throw new Error(`KIE ${model}: respuesta vacia`)
    }

    console.log(`[AI Text] KIE ${model} success (${text.length} chars)`)
    return text
  } finally {
    clearTimeout(timeout)
  }
}

/** Combine multiple AbortSignals into one */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const s of signals) {
    if (s.aborted) { controller.abort(s.reason); return controller.signal }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true })
  }
  return controller.signal
}

// ── OpenAI Chat Completions API ────────────────────────────────

async function callOpenAI(apiKey: string, options: AITextOptions): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions'

  const messages: any[] = []

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }

  if (options.images?.length) {
    const content: any[] = [{ type: 'text', text: options.userMessage }]
    for (const img of options.images) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      })
    }
    messages.push({ role: 'user', content })
  } else {
    messages.push({ role: 'user', content: options.userMessage })
  }

  const body: any = {
    model: 'gpt-4o-mini',
    messages,
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  // Safety timeout: 90s
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90000)
  const signal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal

  try {
    console.log('[AI Text] OpenAI: calling gpt-4o-mini...')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI API (${response.status}): ${errText.substring(0, 300)}`)
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      throw new Error('OpenAI: respuesta vacia')
    }

    console.log(`[AI Text] OpenAI gpt-4o-mini success (${text.length} chars)`)
    return text
  } finally {
    clearTimeout(timeout)
  }
}

// ── Google Gemini API (direct) ─────────────────────────────────

async function callGoogle(apiKey: string, options: AITextOptions): Promise<string> {
  const model = options.googleModel || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const parts: any[] = []

  // Multimodal parts (video URLs, image URLs, text) — used by viral video analysis
  if (options.multimodalParts?.length) {
    for (const part of options.multimodalParts) {
      if (part.fileData) {
        // Gemini file_data only works with gs:// or Google Files API URLs.
        // For external URLs (Supabase, etc.), download and send as inline_data (base64).
        const uri = part.fileData.fileUri
        if (uri.startsWith('gs://')) {
          parts.push({ file_data: { file_uri: uri, mime_type: part.fileData.mimeType } })
        } else {
          try {
            console.log(`[AI Text] Downloading file for inline: ${uri.substring(0, 80)}...`)
            const fileRes = await fetch(uri)
            if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`)
            const buffer = await fileRes.arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            console.log(`[AI Text] File downloaded: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB`)
            parts.push({ inline_data: { mime_type: part.fileData.mimeType, data: base64 } })
          } catch (dlErr: any) {
            console.error(`[AI Text] Failed to download file: ${dlErr.message}`)
            // Skip this part if download fails
          }
        }
      } else if (part.inlineData) {
        parts.push({ inline_data: { mime_type: part.inlineData.mimeType, data: part.inlineData.data } })
      } else if (part.text) {
        parts.push({ text: part.text })
      }
    }
  } else {
    // Legacy path: base64 images + text message
    if (options.images?.length) {
      for (const img of options.images) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } })
      }
    }
    parts.push({ text: options.userMessage })
  }

  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      // Disable thinking mode to prevent 100s+ responses (Gemini has thinking ON by default)
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] }
  }

  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json'
  }

  // Safety timeout: 90s for text, 110s for multimodal with video (video analysis takes longer)
  const timeoutMs = options.multimodalParts?.some(p => p.fileData?.mimeType?.startsWith('video/')) ? 110000 : 90000
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const signal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal

  try {
    console.log(`[AI Text] Google: calling ${model}...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google API (${response.status}): ${errText.substring(0, 300)}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('Google returned empty response')
    }

    console.log(`[AI Text] Google ${model} success (${text.length} chars)`)
    return text
  } finally {
    clearTimeout(timeout)
  }
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Get AI keys from Supabase profile. Returns whichever keys are configured.
 */
export async function getAIKeys(supabase: any, userId: string): Promise<AITextKeys> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('kie_api_key, openai_api_key, google_api_key')
    .eq('id', userId)
    .single()

  const keys: AITextKeys = {}

  // User BYOK keys (primary)
  if (profile?.kie_api_key) {
    try { keys.kieApiKey = decrypt(profile.kie_api_key) } catch {}
  }
  if (profile?.openai_api_key) {
    try { keys.openaiApiKey = decrypt(profile.openai_api_key) } catch {}
  }
  if (profile?.google_api_key) {
    try { keys.googleApiKey = decrypt(profile.google_api_key) } catch {}
  }

  // Platform fallback keys (env vars) when user has no BYOK key
  if (!keys.kieApiKey && process.env.KIE_API_KEY) {
    keys.kieApiKey = process.env.KIE_API_KEY
  }
  if (!keys.openaiApiKey && process.env.OPENAI_API_KEY) {
    keys.openaiApiKey = process.env.OPENAI_API_KEY
  }
  if (!keys.googleApiKey && process.env.GEMINI_API_KEY) {
    keys.googleApiKey = process.env.GEMINI_API_KEY
  }

  return keys
}

/**
 * Throw if no AI key is configured at all.
 */
export function requireAIKeys(keys: AITextKeys): void {
  if (!keys.kieApiKey && !keys.openaiApiKey && !keys.googleApiKey) {
    throw new Error('Configura tu API key de KIE, OpenAI o Google en Settings')
  }
}

/**
 * Strip markdown code fences from AI response if present.
 */
export function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : text.trim()
}
