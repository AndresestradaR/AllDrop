import { decrypt } from './encryption'

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

export interface AITextOptions {
  systemPrompt?: string
  userMessage: string
  images?: AIImageInput[]
  temperature?: number
  jsonMode?: boolean
  kieModel?: string    // default: 'gemini-2.5-flash'
  googleModel?: string // default: 'gemini-2.5-flash'
  signal?: AbortSignal
  reasoningEffort?: 'none' | 'low' | 'medium' // default: 'none'. Use 'low' for structured JSON output
  skipKIE?: boolean    // true = skip KIE, go straight to OpenAI/Google (use for strict JSON schema)
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Unified AI text generation. Cascade: KIE → OpenAI → Google Gemini.
 */
export async function generateAIText(
  keys: AITextKeys,
  options: AITextOptions
): Promise<string> {
  const errors: string[] = []

  // Skip KIE when route needs strict JSON schema (KIE doesn't support responseMimeType)
  if (keys.kieApiKey && !options.skipKIE) {
    try {
      return await callKIE(keys.kieApiKey, options)
    } catch (err: any) {
      errors.push(`KIE: ${err.message}`)
      console.error('[AI Text] KIE failed:', err.message)
    }
  }

  if (keys.openaiApiKey) {
    try {
      return await callOpenAI(keys.openaiApiKey, options)
    } catch (err: any) {
      errors.push(`OpenAI: ${err.message}`)
      console.error('[AI Text] OpenAI failed:', err.message)
    }
  }

  if (keys.googleApiKey) {
    try {
      return await callGoogle(keys.googleApiKey, options)
    } catch (err: any) {
      errors.push(`Google: ${err.message}`)
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

  if (options.images?.length) {
    for (const img of options.images) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } })
    }
  }

  parts.push({ text: options.userMessage })

  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      thinkingConfig: { thinkingBudget: options.reasoningEffort === 'none' || !options.reasoningEffort ? 0 : options.reasoningEffort === 'low' ? 1024 : 4096 },
    },
  }

  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] }
  }

  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
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

  return text
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

  if (profile?.kie_api_key) {
    try { keys.kieApiKey = decrypt(profile.kie_api_key) } catch {}
  }
  if (profile?.openai_api_key) {
    try { keys.openaiApiKey = decrypt(profile.openai_api_key) } catch {}
  }
  if (profile?.google_api_key) {
    try { keys.googleApiKey = decrypt(profile.google_api_key) } catch {}
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
