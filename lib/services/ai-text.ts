import { decrypt } from './encryption'

// ── Types ──────────────────────────────────────────────────────

export interface AITextKeys {
  kieApiKey?: string
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
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Unified AI text generation. Tries KIE first, falls back to Google.
 */
export async function generateAIText(
  keys: AITextKeys,
  options: AITextOptions
): Promise<string> {
  const errors: string[] = []

  if (keys.kieApiKey) {
    try {
      return await callKIE(keys.kieApiKey, options)
    } catch (err: any) {
      errors.push(`KIE: ${err.message}`)
      console.error('[AI Text] KIE failed:', err.message)
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
    throw new Error('Configura tu API key de KIE o Google en Settings')
  }

  throw new Error(`Error en generación de texto: ${errors.join('; ')}`)
}

// ── KIE.ai Chat API (OpenAI-compatible) ────────────────────────

async function callKIE(apiKey: string, options: AITextOptions): Promise<string> {
  const model = options.kieModel || 'gemini-2.5-flash'
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

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`KIE API (${response.status}): ${errText.substring(0, 300)}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content

  if (!text) {
    throw new Error('KIE returned empty response')
  }

  return text
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
    .select('kie_api_key, google_api_key')
    .eq('id', userId)
    .single()

  const keys: AITextKeys = {}

  if (profile?.kie_api_key) {
    try { keys.kieApiKey = decrypt(profile.kie_api_key) } catch {}
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
  if (!keys.kieApiKey && !keys.googleApiKey) {
    throw new Error('Configura tu API key de KIE o Google en Settings')
  }
}

/**
 * Strip markdown code fences from AI response if present.
 */
export function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : text.trim()
}
