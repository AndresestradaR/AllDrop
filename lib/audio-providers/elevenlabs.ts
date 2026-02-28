// ElevenLabs Audio Provider
import {
  Voice,
  GenerateAudioRequest,
  GenerateAudioResult,
  ListVoicesResult,
} from './types'
import { logAI } from '../services/ai-monitor'

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1'

const SPANISH_KEYWORDS = [
  'spanish', 'espanol', 'latin', 'latino', 'latina',
  'mexican', 'mexicano', 'mexicana', 'mexico',
  'colombia', 'colombian', 'colombiano', 'colombiana',
  'argentin', 'argentina', 'argentino',
  'chile', 'chilean', 'chileno', 'chilena',
  'peru', 'peruvian', 'peruano', 'peruana',
  'venezuel', 'venezuela', 'venezolano', 'venezolana',
  'ecuator', 'ecuador', 'ecuatoriano',
  'hispanic', 'castilian', 'castellano',
  'dominican', 'dominicano', 'puerto',
  'guatemal', 'cubano', 'boliviano', 'paraguayo', 'uruguayo'
]

function isSpanishVoice(voice: any): boolean {
  const searchText = [
    voice.name, voice.description, voice.labels?.accent,
    voice.labels?.language, voice.labels?.description
  ].filter(Boolean).join(' ').toLowerCase()
  return SPANISH_KEYWORDS.some(keyword => searchText.includes(keyword))
}

export async function generateSpeech(
  request: GenerateAudioRequest,
  apiKey: string
): Promise<GenerateAudioResult> {
  const t0 = Date.now()
  try {
    const modelId = request.modelId || 'eleven_multilingual_v2'
    const body: Record<string, any> = { text: request.text, model_id: modelId }

    if (request.settings) {
      body.voice_settings = {
        stability: request.settings.stability ?? 0.5,
        similarity_boost: request.settings.similarityBoost ?? 0.75,
        style: request.settings.style ?? 0,
        use_speaker_boost: request.settings.useSpeakerBoost ?? true,
      }
      if (request.settings.speed && request.settings.speed !== 1) {
        body.voice_settings.speed = request.settings.speed
      }
    }

    if (request.languageCode) body.language_code = request.languageCode
    const outputFormat = request.outputFormat || 'mp3_44100_128'

    const response = await fetch(
      `${ELEVENLABS_API_BASE}/text-to-speech/${request.voiceId}?output_format=${outputFormat}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `ElevenLabs API error: ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail?.message || errorJson.detail || errorMessage
      } catch (e) { errorMessage = errorText || errorMessage }
      throw new Error(errorMessage)
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const charactersUsed = parseInt(response.headers.get('character-count') || String(request.text.length))

    logAI({ service: 'audio', provider: 'elevenlabs', status: 'success', response_ms: Date.now() - t0, model: modelId })
    return { success: true, audioBase64, contentType, charactersUsed, provider: 'elevenlabs' }
  } catch (error: any) {
    logAI({ service: 'audio', provider: 'elevenlabs', status: 'error', response_ms: Date.now() - t0, error_message: error.message })
    return { success: false, error: error.message || 'Speech generation failed', provider: 'elevenlabs' }
  }
}

export async function listVoices(
  apiKey: string,
  options?: { search?: string; category?: string; filterSpanish?: boolean }
): Promise<ListVoicesResult> {
  try {
    const params = new URLSearchParams()
    params.set('page_size', '100')
    if (options?.search) params.set('search', options.search)
    if (options?.category) params.set('category', options.category)

    const response = await fetch(
      `${ELEVENLABS_API_BASE}/voices?${params.toString()}`,
      { method: 'GET', headers: { 'xi-api-key': apiKey } }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to list voices: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const allVoices = data.voices || []
    const shouldFilter = options?.filterSpanish !== false
    const filteredVoices = shouldFilter ? allVoices.filter(isSpanishVoice) : allVoices
    
    const voices: Voice[] = filteredVoices.map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      description: v.description,
      previewUrl: v.preview_url,
      language: v.labels?.language || 'Espanol',
      accent: v.labels?.accent || 'Latino',
      gender: v.labels?.gender?.toLowerCase(),
      category: v.category,
      provider: 'elevenlabs' as const,
      labels: v.labels,
    }))

    console.log('[ElevenLabs] Found', allVoices.length, 'total,', voices.length, 'Spanish/LATAM')
    return { success: true, voices }
  } catch (error: any) {
    return { success: false, voices: [], error: error.message }
  }
}

export async function getVoice(voiceId: string, apiKey: string): Promise<Voice | null> {
  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/voices/${voiceId}`,
      { method: 'GET', headers: { 'xi-api-key': apiKey } }
    )
    if (!response.ok) return null
    const v = await response.json()
    return {
      id: v.voice_id, name: v.name, description: v.description, previewUrl: v.preview_url,
      language: v.labels?.language, accent: v.labels?.accent,
      gender: v.labels?.gender?.toLowerCase() as 'male' | 'female' | 'neutral',
      category: v.category, provider: 'elevenlabs', labels: v.labels,
    }
  } catch (error) { return null }
}

export async function getSubscriptionInfo(apiKey: string) {
  try {
    const response = await fetch(
      `${ELEVENLABS_API_BASE}/user/subscription`,
      { method: 'GET', headers: { 'xi-api-key': apiKey } }
    )
    if (!response.ok) return null
    const data = await response.json()
    return {
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      canExtend: data.can_extend_character_limit,
      tier: data.tier,
    }
  } catch (error) { return null }
}
