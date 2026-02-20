import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

async function extractWithGemini(geminiKey: string, pageContent: string): Promise<any> {
  // Sanitize: remove URLs, excessive whitespace, and non-printable chars
  const sanitized = pageContent
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .slice(0, 5000)

  const extractPrompt = `Extract product info from this e-commerce page content.

Page content:
${sanitized}

Return a JSON object with these keys. Keep values SHORT (max 20 words each):
- title: product name (max 8 words)
- description: what it does, who it's for (max 30 words)
- benefits: array of 5 short benefit strings (max 8 words each)
- pains: array of 3 customer pain points (max 10 words each)
- angles: array of 3 sales angles (max 8 words each)
- price: price string or null
- images: empty array []
- category: one of belleza/salud/hogar/ropa/tecnologia/mascotas/deportes/otro

Write in Spanish. If a field is unclear, invent reasonable values.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        }
      })
    }
  )

  const data = await res.json()

  if (!res.ok) {
    console.error('[scrape] Gemini API error:', JSON.stringify(data).slice(0, 500))
    throw new Error(`Gemini API error: ${data.error?.message || res.status}`)
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) {
    console.error('[scrape] Gemini empty response, full data:', JSON.stringify(data).slice(0, 500))
    throw new Error('Gemini returned empty response')
  }

  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}

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

    // 4. Scraping con Jina AI Reader
    const jinaUrl = `https://r.jina.ai/${url}`
    const jinaRes = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!jinaRes.ok) {
      console.error('[scrape] Jina error:', jinaRes.status, jinaRes.statusText)
      return NextResponse.json({ error: 'No se pudo leer la pagina. Verifica la URL.' }, { status: 400 })
    }

    const pageContent = await jinaRes.text()
    console.log('[scrape] Jina content length:', pageContent.length)

    if (pageContent.length < 100) {
      console.error('[scrape] Jina returned too little content:', pageContent.slice(0, 200))
      return NextResponse.json({ error: 'La pagina no tiene suficiente contenido. Intenta con otra URL o completa manualmente.' }, { status: 400 })
    }

    // 5. Extraer metadata con Gemini (retry once on failure)
    let metadata: any
    try {
      metadata = await extractWithGemini(geminiKey, pageContent)
    } catch (firstErr: any) {
      console.error('[scrape] First Gemini attempt failed:', firstErr.message)
      // Retry once
      try {
        metadata = await extractWithGemini(geminiKey, pageContent)
      } catch (retryErr: any) {
        console.error('[scrape] Retry also failed:', retryErr.message)
        return NextResponse.json({
          error: 'No se pudo extraer info del producto. Intenta con otra URL o completa manualmente.'
        }, { status: 400 })
      }
    }

    // Validate required fields
    if (!metadata.title) {
      metadata.title = 'Producto'
    }
    if (!metadata.description) {
      metadata.description = ''
    }
    if (!Array.isArray(metadata.benefits)) {
      metadata.benefits = []
    }
    if (!Array.isArray(metadata.pains)) {
      metadata.pains = []
    }
    if (!Array.isArray(metadata.angles)) {
      metadata.angles = []
    }
    if (!Array.isArray(metadata.images)) {
      metadata.images = []
    }

    return NextResponse.json({ success: true, metadata })

  } catch (e: any) {
    console.error('[scrape] error:', e.message)
    return NextResponse.json({ error: 'Error al analizar la URL. Intenta de nuevo o completa manualmente.' }, { status: 500 })
  }
}
