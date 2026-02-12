import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

const TRANSLATE_SYSTEM = `Eres un experto traductor y adaptador de guiones publicitarios para Latinoamérica.

Tu trabajo es tomar una transcripción de un video viral y adaptarla/traducirla al español latino para un producto de dropshipping.

## REGLAS:
1. Mantener el tono y ritmo del original
2. Adaptar expresiones culturales al mercado LATAM
3. Reemplazar menciones del producto original por el nuevo producto
4. Mantener la misma estructura y timing del guión
5. Si el original ya está en español, mejorar el copy para LATAM dropshipping

Responde SOLO en JSON válido:
{
  "translated_script": "string (guión traducido/adaptado)",
  "original_language": "string",
  "adaptations_made": ["string (lista de adaptaciones realizadas)"],
  "timing_notes": "string (notas sobre el timing del guión)"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { transcript, product_name, target_language = 'es-LATAM' } = body as {
      transcript: string
      product_name?: string
      target_language?: string
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Se requiere la transcripción' }, { status: 400 })
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
      systemInstruction: TRANSLATE_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
    })

    const parts = [`Transcripción original:\n"""${transcript}"""`]
    if (product_name) parts.push(`\nProducto destino: ${product_name}`)
    parts.push(`\nIdioma destino: ${target_language}`)

    const result = await model.generateContent(parts.join('\n'))
    const responseText = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      return NextResponse.json({ error: 'Error al traducir' }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[CloneViral/Translate] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al traducir' }, { status: 500 })
  }
}
