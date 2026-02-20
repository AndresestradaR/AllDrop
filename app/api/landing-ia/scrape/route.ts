import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    // 1. Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Parse body
    const { url } = await request.json()
    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'URL invalida' }, { status: 400 })
    }

    // 3. Obtener google_api_key del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google en Settings' }, { status: 400 })
    }
    const geminiKey = decrypt(profile.google_api_key)

    // 4. Scraping con Jina AI Reader (gratis, sin API key)
    const jinaUrl = `https://r.jina.ai/${url}`
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!jinaRes.ok) {
      return NextResponse.json({ error: 'No se pudo leer la pagina. Verifica la URL.' }, { status: 400 })
    }

    const pageContent = await jinaRes.text()
    // Limitar a 8000 chars para no exceder contexto de Gemini
    const truncated = pageContent.slice(0, 8000)

    // 5. Extraer metadata con Gemini
    const extractPrompt = `
Analiza el siguiente contenido de una pagina de producto de e-commerce y extrae la informacion estructurada.

Contenido de la pagina:
${truncated}

Extrae y devuelve SOLO este JSON (sin markdown, sin explicaciones):
{
  "title": "nombre del producto, conciso y descriptivo",
  "description": "descripcion del producto en 2-3 oraciones, que hace y para quien es",
  "benefits": ["beneficio 1", "beneficio 2", "beneficio 3", "beneficio 4", "beneficio 5"],
  "pains": ["dolor del cliente 1", "dolor del cliente 2", "dolor del cliente 3"],
  "angles": ["angulo de venta 1", "angulo de venta 2", "angulo de venta 3"],
  "price": "precio si aparece en la pagina, ej: 59.900 o null si no hay",
  "images": [],
  "category": "categoria del producto: belleza/salud/hogar/ropa/tecnologia/mascotas/deportes/otro"
}

Si no encuentras algun campo, usa valores por defecto razonables basados en el tipo de producto.
Responde SOLO con el JSON, sin texto adicional, sin markdown.
`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
        })
      }
    )

    const geminiData = await geminiRes.json()
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const metadata = JSON.parse(clean)

    return NextResponse.json({ success: true, metadata })

  } catch (e: any) {
    console.error('[scrape] error:', e.message)
    if (e.message?.includes('JSON')) {
      return NextResponse.json({ error: 'No se pudo extraer info del producto. Intenta con otra URL o completa manualmente.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al analizar la URL' }, { status: 500 })
  }
}
