import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { aiLimiter, getClientIp } from '@/lib/rate-limit'

const ENHANCE_SYSTEM_PROMPT = `Eres un experto en marketing y copywriting para e-commerce en español.

Tu tarea es analizar una plantilla de banner y fotos de un producto para generar sugerencias de marketing.

Responde SOLO en formato JSON con esta estructura exacta:
{
  "productDetails": "Descripción detallada del producto basada en las fotos (máx 200 caracteres)",
  "salesAngle": "Ángulo de venta persuasivo para este producto (máx 150 caracteres)",
  "targetAvatar": "Descripción del cliente ideal para este producto (máx 150 caracteres)",
  "additionalInstructions": "Instrucciones específicas para mejorar el banner (máx 200 caracteres)"
}

Analiza:
1. El estilo visual de la plantilla
2. El tipo de producto en las fotos
3. Los colores y branding del producto
4. El público objetivo probable

Genera sugerencias en ESPAÑOL que sean persuasivas y específicas para dropshipping/e-commerce.`

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const [header, data] = dataUrl.split(',')
  const mimeType = header.split(':')[1]?.split(';')[0] || 'image/jpeg'
  return { data, mimeType }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { success } = aiLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { templateUrl, productPhotos, productName } = body

    // Get user's API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google' }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

    // Build parts with images
    const parts: any[] = []

    // Add template
    if (templateUrl) {
      const parsed = parseDataUrl(templateUrl)
      if (parsed) {
        parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } })
      }
    }

    // Add product photos
    if (productPhotos) {
      for (const photo of productPhotos) {
        if (photo) {
          const parsed = parseDataUrl(photo)
          if (parsed) {
            parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } })
          }
        }
      }
    }

    parts.push({
      text: `Producto: ${productName || 'Sin nombre'}

Imagen 1: Plantilla de diseño a usar como referencia
Imágenes siguientes: Fotos del producto a promocionar

Genera las sugerencias de marketing en JSON.`
    })

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ENHANCE_SYSTEM_PROMPT }] },
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
    })

    if (!response.ok) {
      throw new Error('Error al comunicarse con Gemini')
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    const suggestions = JSON.parse(text)

    return NextResponse.json({ success: true, suggestions })
  } catch (error: any) {
    console.error('Enhance prompt error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
