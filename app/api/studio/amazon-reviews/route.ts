import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

// Extract ASIN from Amazon URL or return as-is if already an ASIN
function extractASIN(input: string): string | null {
  const trimmed = input.trim()

  // Already an ASIN (10 alphanumeric chars starting with B0)
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) return trimmed.toUpperCase()

  // Extract from URL patterns: /dp/ASIN, /product/ASIN, /gp/product/ASIN
  const urlPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
  ]

  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern)
    if (match) return match[1].toUpperCase()
  }

  return null
}

// Detect Amazon marketplace from URL
function detectMarketplace(input: string): string {
  const domainMap: Record<string, string> = {
    'amazon.com': 'com',
    'amazon.com.mx': 'com.mx',
    'amazon.es': 'es',
    'amazon.co.uk': 'co.uk',
    'amazon.de': 'de',
    'amazon.com.br': 'com.br',
    'amazon.ca': 'ca',
    'amazon.it': 'it',
    'amazon.fr': 'fr',
    'amazon.co.jp': 'co.jp',
  }

  for (const [domain, code] of Object.entries(domainMap)) {
    if (input.includes(domain)) return code
  }

  return 'com' // default
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Admin-only while in development
    if (user.email !== 'trucosecomydrop@gmail.com') {
      return NextResponse.json({ error: 'Esta herramienta estara disponible proximamente' }, { status: 403 })
    }

    const apifyApiKey = process.env.APIFY_API_TOKEN
    if (!apifyApiKey) {
      return NextResponse.json({
        error: 'API key de Apify no configurada en el servidor.',
      }, { status: 500 })
    }

    const body = await request.json()
    const { amazon_url, max_pages = 3 } = body as {
      amazon_url: string
      max_pages?: number
    }

    if (!amazon_url?.trim()) {
      return NextResponse.json(
        { error: 'La URL o ASIN de Amazon es requerido' },
        { status: 400 }
      )
    }

    const asin = extractASIN(amazon_url)
    if (!asin) {
      return NextResponse.json(
        { error: 'No se pudo extraer el ASIN. Pega una URL de Amazon valida o un ASIN (ej: B0DCCXW835)' },
        { status: 400 }
      )
    }

    const marketplace = detectMarketplace(amazon_url)
    const pages = Math.min(Math.max(Number(max_pages) || 3, 1), 10)

    console.log(`[AmazonReviews] User: ${user.id.substring(0, 8)}..., ASIN: ${asin}, Marketplace: ${marketplace}, Pages: ${pages}`)

    // Call Apify actor: axesso_data/amazon-reviews-scraper
    const apifyUrl = `https://api.apify.com/v2/acts/axesso_data~amazon-reviews-scraper/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=90`

    const apifyResponse = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asin,
        domainCode: marketplace,
        sortBy: 'recent',
        maxPages: pages,
        filterByStar: 'all_stars',
      }),
    })

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text()
      console.error('[AmazonReviews] Apify error:', apifyResponse.status, errorText.substring(0, 500))
      return NextResponse.json({
        error: 'Error al obtener reviews de Amazon. Verifica que el ASIN sea correcto e intenta de nuevo.',
      }, { status: 502 })
    }

    const rawReviews = await apifyResponse.json()

    if (!Array.isArray(rawReviews) || rawReviews.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron reviews para este producto. Verifica el ASIN o intenta con otro producto.',
      }, { status: 404 })
    }

    // Normalize reviews to a consistent format
    const reviews = rawReviews.slice(0, 200).map((r: any) => ({
      title: r.ReviewTitle || r.title || '',
      content: r.ReviewContent || r.reviewDescription || r.text || '',
      rating: r.RatingScore || r.rating || r.stars || 0,
      verified: r.Verified ?? r.isVerified ?? false,
      helpful: r.HelpfulCounts || r.helpfulVotes || 0,
      date: r.ReviewDate || r.date || '',
    })).filter((r: any) => r.content && r.content.length > 10)

    // Calculate summary stats
    const totalReviews = reviews.length
    const avgRating = totalReviews > 0
      ? (reviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / totalReviews).toFixed(1)
      : '0'
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews.forEach((r: any) => {
      const star = Math.round(Number(r.rating))
      if (star >= 1 && star <= 5) ratingDistribution[star]++
    })

    console.log(`[AmazonReviews] Found ${totalReviews} reviews, avg rating: ${avgRating}`)

    return NextResponse.json({
      asin,
      marketplace,
      total_reviews: totalReviews,
      avg_rating: avgRating,
      rating_distribution: ratingDistribution,
      reviews,
    })

  } catch (error: any) {
    console.error('[AmazonReviews] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al buscar reviews de Amazon',
    }, { status: 500 })
  }
}
