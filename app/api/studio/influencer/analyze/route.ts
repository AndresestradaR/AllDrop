import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

const ANALYZE_SYSTEM = `Eres un experto en análisis facial y creación de Character Profiles para personajes virtuales consistentes.

Analiza la imagen proporcionada y genera un perfil detallado del personaje que permita recrearlo de forma consistente en diferentes escenas.

Responde SOLO en JSON válido:
{
  "gender": "string (male/female)",
  "estimated_age": "string (ej: 25-30)",
  "skin_tone": "string (light/medium/olive/brown/dark)",
  "hair_color": "string",
  "hair_style": "string (ej: long wavy, short straight)",
  "eye_color": "string",
  "face_shape": "string (ej: oval, round, square, heart)",
  "distinctive_features": ["string (ej: dimples, freckles, strong jawline)"],
  "build": "string (slim/athletic/average/curvy)",
  "style_notes": "string (observaciones sobre estilo de vestimenta si es visible)",
  "prompt_descriptor": "string (descripción completa en inglés del personaje para usar en prompts de generación de imagen, 2-3 oraciones)"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { image_base64 } = body as { image_base64: string }

    if (!image_base64) {
      return NextResponse.json(
        { error: 'Se requiere una imagen' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de Google en Settings',
      }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: ANALYZE_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    })

    // Clean base64 data
    const base64Clean = image_base64.includes(',')
      ? image_base64.split(',')[1]
      : image_base64

    const result = await model.generateContent([
      'Analyze this person and generate a detailed Character Profile.',
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Clean,
        },
      },
    ])

    const responseText = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      console.error('[Influencer/Analyze] Failed to parse JSON:', responseText.substring(0, 500))
      return NextResponse.json({
        error: 'Error al analizar la imagen. Intenta de nuevo.',
      }, { status: 500 })
    }

    console.log(`[Influencer/Analyze] User: ${user.id.substring(0, 8)}..., Gender: ${parsed.gender}, Age: ${parsed.estimated_age}`)

    return NextResponse.json({ character_profile: parsed })

  } catch (error: any) {
    console.error('[Influencer/Analyze] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al analizar imagen',
    }, { status: 500 })
  }
}
