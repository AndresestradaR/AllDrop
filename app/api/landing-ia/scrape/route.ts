import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

function extractImagesFromMarkdown(content: string): string[] {
  const matches = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/g)
  if (!matches) return []
  return matches
    .map(m => m.match(/\((https?:\/\/[^)]+)\)/)?.[1])
    .filter((url): url is string => !!url && !url.includes('svg') && !url.includes('icon') && !url.includes('logo'))
    .slice(0, 8)
}

async function extractWithGemini(geminiKey: string, pageContent: string, imageUrls: string[]): Promise<any> {
  const sanitized = pageContent
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .slice(0, 5000)

  const extractPrompt = `Analyze this e-commerce product page and extract structured info.

Page content:
${sanitized}

Return a JSON object with these keys. Keep values SHORT:
- title: product name (max 8 words, in Spanish)
- description: what it does, who it's for (max 30 words, in Spanish)
- benefits: array of 5 short benefit strings (max 8 words each, in Spanish)
- pains: array of 3 customer pain points (max 10 words each, in Spanish)
- price: price string or null
- category: one of belleza/salud/hogar/ropa/tecnologia/mascotas/deportes/otro
- angles: array of EXACTLY 4 objects, each with:
  - id: "a1", "a2", "a3", "a4"
  - emoji: a relevant emoji
  - titulo: short powerful sales angle title (4-6 words, in Spanish)
  - descripcion: for [customer type] who [specific need] (15-20 words, in Spanish)
  - tagline: catchy phrase 4-6 words summarizing the angle (in Spanish)
  The 4 angles must be DIFFERENT approaches: emotional, functional, urgency, identity.

Do NOT include "images" in the JSON.
Write all text in Spanish for Latin American audience (COD/cash-on-delivery market).`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
        generationConfig: {
          temperature: 0.7,
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
    console.error('[scrape] Gemini empty response:', JSON.stringify(data).slice(0, 500))
    throw new Error('Gemini returned empty response')
  }

  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  let parsed = JSON.parse(clean)

  // Gemini sometimes wraps in array
  if (Array.isArray(parsed)) {
    parsed = parsed[0] || {}
  }

  // Attach images extracted from markdown (more reliable than Gemini)
  parsed.images = imageUrls

  return parsed
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
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!jinaRes.ok) {
      console.error('[scrape] Jina error:', jinaRes.status)
      return NextResponse.json({ error: 'No se pudo leer la pagina. Verifica la URL.' }, { status: 400 })
    }

    const pageContent = await jinaRes.text()
    console.log('[scrape] Jina content length:', pageContent.length)

    if (pageContent.length < 100) {
      return NextResponse.json({ error: 'La pagina no tiene suficiente contenido. Intenta con otra URL.' }, { status: 400 })
    }

    // Detect captcha/blocked pages
    const lower = pageContent.toLowerCase()
    if (lower.includes('captcha') || lower.includes('verify you are human') || lower.includes('access denied') || lower.includes('robot')) {
      console.error('[scrape] Captcha/block detected')
      return NextResponse.json({ error: 'La pagina tiene proteccion anti-bots. Intenta con otra URL (Shopify o tiendas sin captcha funcionan mejor).' }, { status: 400 })
    }

    // 5. Extract images from markdown before sanitizing
    const imageUrls = extractImagesFromMarkdown(pageContent)
    console.log('[scrape] Images found:', imageUrls.length)

    // 6. Extract metadata with Gemini (retry once)
    let metadata: any
    try {
      metadata = await extractWithGemini(geminiKey, pageContent, imageUrls)
    } catch (firstErr: any) {
      console.error('[scrape] First attempt failed:', firstErr.message)
      try {
        metadata = await extractWithGemini(geminiKey, pageContent, imageUrls)
      } catch (retryErr: any) {
        console.error('[scrape] Retry failed:', retryErr.message)
        return NextResponse.json({
          error: 'No se pudo extraer info del producto. Intenta con otra URL o completa manualmente.'
        }, { status: 400 })
      }
    }

    // Validate
    if (!metadata.title) metadata.title = 'Producto'
    if (!metadata.description) metadata.description = ''
    if (!Array.isArray(metadata.benefits)) metadata.benefits = []
    if (!Array.isArray(metadata.pains)) metadata.pains = []
    if (!Array.isArray(metadata.angles)) metadata.angles = []
    if (!Array.isArray(metadata.images)) metadata.images = []

    return NextResponse.json({ success: true, metadata })

  } catch (e: any) {
    console.error('[scrape] error:', e.message)
    return NextResponse.json({ error: 'Error al analizar la URL. Intenta de nuevo.' }, { status: 500 })
  }
}
