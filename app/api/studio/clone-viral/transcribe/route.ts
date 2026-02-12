import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const TRANSCRIBE_SYSTEM = `Eres un experto en transcripción de audio/video. Transcribe el contenido hablado del video de forma precisa.

Responde SOLO en JSON válido:
{
  "transcript": "string (transcripción completa del audio)",
  "language": "string (idioma detectado, ej: es, en, pt)",
  "duration_estimate": "string (duración estimada del contenido hablado)"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { video_url } = body as { video_url: string }

    if (!video_url) {
      return NextResponse.json({ error: 'Se requiere URL del video' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google en Settings' }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: TRANSCRIBE_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    // Download video and send as file to Gemini
    const videoResponse = await fetch(video_url)
    const videoBuffer = await videoResponse.arrayBuffer()
    const base64Video = Buffer.from(videoBuffer).toString('base64')
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4'

    console.log(`[CloneViral/Transcribe] User: ${user.id.substring(0, 8)}..., Video size: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB`)

    const result = await model.generateContent([
      'Transcribe all spoken audio from this video accurately.',
      {
        inlineData: {
          mimeType: contentType,
          data: base64Video,
        },
      },
    ])

    const responseText = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      return NextResponse.json({ error: 'Error al transcribir' }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[CloneViral/Transcribe] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al transcribir' }, { status: 500 })
  }
}
