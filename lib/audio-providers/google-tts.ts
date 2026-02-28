// Gemini TTS Provider (Google AI Studio)
// Uses Gemini 2.5 Flash Preview TTS - dedicated text-to-speech model
// Docs: https://ai.google.dev/gemini-api/docs/speech-generation

import { Voice, GenerateAudioResult, ListVoicesResult } from './types'
import { logAI } from '../services/ai-monitor'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Gemini 2.5 TTS available voices
// Reference: https://ai.google.dev/gemini-api/docs/speech-generation
const GEMINI_VOICES = [
  { id: 'Puck', name: 'Puck', gender: 'male', description: 'Voz masculina natural' },
  { id: 'Charon', name: 'Charon', gender: 'male', description: 'Voz masculina profunda' },
  { id: 'Kore', name: 'Kore', gender: 'female', description: 'Voz femenina natural' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'male', description: 'Voz masculina energica' },
  { id: 'Aoede', name: 'Aoede', gender: 'female', description: 'Voz femenina melodica' },
]

// Convert raw PCM to WAV format
// Gemini returns PCM: 24000 Hz, 16-bit, mono
function pcmToWav(pcmBase64: string): string {
  const pcmData = Buffer.from(pcmBase64, 'base64')
  
  const sampleRate = 24000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8

  const wavBuffer = Buffer.alloc(headerSize + dataSize)

  // RIFF header
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(fileSize, 4)
  wavBuffer.write('WAVE', 8)

  // fmt subchunk
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, 20) // AudioFormat (1 = PCM)
  wavBuffer.writeUInt16LE(numChannels, 22)
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(byteRate, 28)
  wavBuffer.writeUInt16LE(blockAlign, 32)
  wavBuffer.writeUInt16LE(bitsPerSample, 34)

  // data subchunk
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(dataSize, 40)
  pcmData.copy(wavBuffer, 44)

  return wavBuffer.toString('base64')
}

export async function generateSpeech(
  text: string,
  voiceId: string,
  apiKey: string,
  options?: {
    languageCode?: string
  }
): Promise<GenerateAudioResult> {
  const t0 = Date.now()
  try {
    // Use Gemini 2.5 Flash Preview TTS model
    // Docs: https://ai.google.dev/gemini-api/docs/speech-generation
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: text
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceId || 'Kore'
            }
          }
        }
      }
    }

    console.log('[Audio/GeminiTTS] Generating speech:', {
      voiceId,
      textLength: text.length,
    })

    const response = await fetch(
      `${GEMINI_API_BASE}/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `Gemini TTS error: ${response.status}`
      console.error('[Audio/GeminiTTS] Error:', response.status, errorData)
      throw new Error(errorMessage)
    }

    const data = await response.json()

    // Extract audio from response
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData

    if (!audioData?.data) {
      console.error('[Audio/GeminiTTS] No audio in response:', JSON.stringify(data).slice(0, 500))
      throw new Error('No audio content returned from Gemini')
    }

    console.log('[Audio/GeminiTTS] Raw audio type:', audioData.mimeType)

    // Convert PCM to WAV for browser playback
    const wavBase64 = pcmToWav(audioData.data)

    console.log('[Audio/GeminiTTS] Success, converted to WAV')

    logAI({ service: 'audio', provider: 'google-tts', status: 'success', response_ms: Date.now() - t0, model: 'gemini-2.5-flash-preview-tts' })
    return {
      success: true,
      audioBase64: wavBase64,
      contentType: 'audio/wav',
      charactersUsed: text.length,
      provider: 'google-tts',
    }
  } catch (error: any) {
    logAI({ service: 'audio', provider: 'google-tts', status: 'error', response_ms: Date.now() - t0, model: 'gemini-2.5-flash-preview-tts', error_message: error.message })
    console.error('[Audio/GeminiTTS] Error:', error.message)
    return {
      success: false,
      error: error.message || 'Gemini TTS generation failed',
      provider: 'google-tts',
    }
  }
}

export async function listVoices(apiKey: string): Promise<ListVoicesResult> {
  try {
    // Return static list of Gemini voices
    const voices: Voice[] = GEMINI_VOICES.map((v) => ({
      id: v.id,
      name: v.name,
      description: v.description,
      gender: v.gender as 'male' | 'female',
      language: 'Multilingue',
      accent: 'Natural',
      category: 'generated' as const,
      provider: 'google-tts' as const,
    }))

    console.log('[Audio/GeminiTTS] Returning', voices.length, 'Gemini voices')

    return { success: true, voices }
  } catch (error: any) {
    console.error('[Audio/GeminiTTS] Error listing voices:', error.message)
    return { success: false, voices: [], error: error.message }
  }
}

export function getVoiceInfo(voiceId: string): Voice | null {
  const config = GEMINI_VOICES.find((v) => v.id === voiceId)
  if (!config) return null

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    gender: config.gender as 'male' | 'female',
    language: 'Multilingue',
    accent: 'Natural',
    provider: 'google-tts',
  }
}
