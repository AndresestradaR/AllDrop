import { NextRequest, NextResponse } from 'next/server'
import { generateSpeech as generateElevenLabs } from '@/lib/audio-providers/elevenlabs'
import { generateSpeech as generateGeminiTTS } from '@/lib/audio-providers/google-tts'
import { createClient } from '@/lib/supabase/server'
import { type AudioModelId } from '@/lib/audio-providers/types'
import { tryUploadToR2 } from '@/lib/services/r2-upload'

export async function POST(req: NextRequest) {
  try {
    // Auth check (needed for R2 upload)
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    const body = await req.json()
    const {
      text,
      voiceId,
      modelId = 'eleven_multilingual_v2',
      provider = 'elevenlabs',
      settings,
      outputFormat = 'mp3_44100_128',
      languageCode = 'es',
    } = body

    // Validation
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    if (!voiceId || typeof voiceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    // Check text length
    const maxChars = 5000
    if (text.length > maxChars) {
      return NextResponse.json(
        { success: false, error: `Text exceeds maximum length of ${maxChars} characters` },
        { status: 400 }
      )
    }

    console.log('[API/generate-audio] Request:', {
      provider,
      modelId,
      voiceId,
      textLength: text.length,
      languageCode,
    })

    let result: {
      success: boolean
      audioBase64?: string
      contentType?: string
      charactersUsed?: number
      error?: string
      provider: string
    }

    // Generate audio based on provider
    if (provider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'ElevenLabs API key not configured' },
          { status: 500 }
        )
      }

      result = await generateElevenLabs(
        {
          text,
          voiceId,
          modelId: modelId as AudioModelId,
          settings,
          outputFormat,
          languageCode,
        },
        apiKey
      )

    } else if (provider === 'google-tts' || provider === 'google' || provider === 'gemini') {
      // Use GOOGLE_API_KEY or GEMINI_API_KEY from AI Studio
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'Gemini API key not configured. Add GOOGLE_API_KEY or GEMINI_API_KEY to env.' },
          { status: 500 }
        )
      }

      result = await generateGeminiTTS(text, voiceId, apiKey, {
        languageCode: languageCode === 'es' ? 'es-MX' : languageCode,
      })

    } else {
      return NextResponse.json(
        { success: false, error: `Unknown provider: ${provider}` },
        { status: 400 }
      )
    }

    if (!result.success || !result.audioBase64) {
      return NextResponse.json(
        { success: false, error: result.error || 'Audio generation failed' },
        { status: 500 }
      )
    }

    // Determine file extension based on content type
    const isWav = result.contentType?.includes('wav')
    const fileExt = isWav ? 'wav' : 'mp3'
    
    // Upload to Supabase storage
    const supabase = await createClient()
    const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `audio/${fileName}`

    const audioBuffer = Buffer.from(result.audioBase64, 'base64')

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(filePath, audioBuffer, {
        contentType: result.contentType || 'audio/mpeg',
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('[API/generate-audio] Upload error:', uploadError)
      // Try R2 even if Supabase failed
      let r2Url: string | null = null
      if (user) {
        r2Url = await tryUploadToR2(
          user.id,
          audioBuffer,
          `audio/${fileName}`,
          result.contentType || 'audio/mpeg'
        )
      }

      return NextResponse.json({
        success: true,
        audioBase64: result.audioBase64,
        r2Url,
        contentType: result.contentType,
        charactersUsed: result.charactersUsed,
        provider: result.provider,
      })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('landing-images')
      .getPublicUrl(filePath)

    console.log('[API/generate-audio] Success:', {
      audioUrl: urlData.publicUrl,
      charactersUsed: result.charactersUsed,
      provider: result.provider,
    })

    // Try R2 upload (optional, non-blocking)
    let r2Url: string | null = null
    if (user) {
      r2Url = await tryUploadToR2(
        user.id,
        audioBuffer,
        `audio/${fileName}`,
        result.contentType || 'audio/mpeg'
      )
      if (r2Url) console.log(`[API/generate-audio] ✓ Audio saved to R2: ${r2Url}`)
    }

    return NextResponse.json({
      success: true,
      audioUrl: urlData.publicUrl,
      r2Url,
      contentType: result.contentType,
      charactersUsed: result.charactersUsed,
      provider: result.provider,
    })

  } catch (error: any) {
    console.error('[API/generate-audio] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
