import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

// Extract ASIN from Amazon URL or return as-is if already an ASIN
// Handles: direct URLs, URL-encoded redirects (/ap/signin?...return_to=...%2Fdp%2FASIN), raw ASIN
function extractASIN(input: string): string | null {
  const trimmed = input.trim()

  // Already an ASIN (10 alphanumeric chars starting with B0)
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) return trimmed.toUpperCase()

  // URL-decode the full input to handle Amazon redirect/signin URLs
  // e.g. /ap/signin?openid.return_to=https%3A%2F%2Fwww.amazon.com%2F...%2Fdp%2FB0DGQ7L856
  let decoded = trimmed
  try {
    // Decode up to 3 times to handle double/triple encoding
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
  } catch {
    // ignore decode errors
  }

  // Search in both original and decoded versions
  const candidates = [trimmed, decoded]

  const urlPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
  ]

  for (const text of candidates) {
    for (const pattern of urlPatterns) {
      const match = text.match(pattern)
      if (match) return match[1].toUpperCase()
    }
  }

  return null
}

// Detect Amazon marketplace from URL — longer domains MUST come first
function detectMarketplace(input: string): string {
  const domainMap: [string, string][] = [
    ['amazon.com.mx', 'com.mx'],
    ['amazon.com.br', 'com.br'],
    ['amazon.co.uk', 'co.uk'],
    ['amazon.co.jp', 'co.jp'],
    ['amazon.com', 'com'],
    ['amazon.es', 'es'],
    ['amazon.de', 'de'],
    ['amazon.ca', 'ca'],
    ['amazon.it', 'it'],
    ['amazon.fr', 'fr'],
  ]

  for (const [domain, code] of domainMap) {
    if (input.includes(domain)) return code
  }

  return 'com'
}

// Scrape reviews for one star filter using junglee actor
async function scrapeReviews(
  apifyApiKey: string,
  cleanAmazonUrl: string,
  filterByRating?: string,
): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/junglee~amazon-reviews-scraper/run-sync-get-dataset-items?token=${apifyApiKey}&timeout=60`

  const body: any = {
    productUrls: [{ url: cleanAmazonUrl }],
    maxReviews: 30,
    proxy: { useApifyProxy: true },
  }
  if (filterByRating) body.filterByRating = filterByRating

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) return []

  const data = await res.json()
  return Array.isArray(data) ? data : []
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
    const { amazon_url } = body as { amazon_url: string }

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
    const cleanAmazonUrl = `https://www.amazon.${marketplace}/dp/${asin}`

    console.log(`[AmazonReviews] ASIN: ${asin}, Marketplace: ${marketplace}`)

    // Strategy: 2 parallel calls — "top reviews" + "one_star" — to get both positive AND negative
    // junglee actor returns ~8 reviews per call (Amazon page limit)
    // Combining top (mostly positive) + negative gives the AI the best material for:
    //   - Pain points & objections (from negative reviews)
    //   - Sales angles & benefits (from positive reviews)
    const [topReviews, negativeReviews] = await Promise.all([
      scrapeReviews(apifyApiKey, cleanAmazonUrl),
      scrapeReviews(apifyApiKey, cleanAmazonUrl, 'one_star'),
    ])

    // Deduplicate by reviewId
    const seen = new Set<string>()
    const allRaw: any[] = []
    for (const r of [...topReviews, ...negativeReviews]) {
      const id = r.reviewId || `${r.reviewTitle}-${r.ratingScore}`
      if (!seen.has(id)) {
        seen.add(id)
        allRaw.push(r)
      }
    }

    if (allRaw.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron reviews para este producto. Verifica el ASIN o intenta con otro producto.',
      }, { status: 404 })
    }

    // Total ratings on Amazon (metadata from junglee actor)
    const totalAmazonRatings = allRaw[0]?.totalCategoryRatings || allRaw.length

    // Normalize — field names verified by local testing against junglee actor
    const reviews = allRaw.map((r: any) => ({
      title: r.reviewTitle || '',
      content: r.reviewDescription || '',
      rating: typeof r.ratingScore === 'number' ? r.ratingScore : 0,
      verified: r.isVerified ?? false,
      helpful: typeof r.reviewReaction === 'string'
        ? parseInt(r.reviewReaction.replace(/\D/g, '') || '0', 10)
        : 0,
      date: r.date || '',
    })).filter((r: any) => r.content && r.content.length > 10)

    // Stats
    const totalReviews = reviews.length
    const avgRating = totalReviews > 0
      ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : '0'
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews.forEach((r: any) => {
      const star = Math.round(r.rating)
      if (star >= 1 && star <= 5) ratingDistribution[star]++
    })

    console.log(`[AmazonReviews] ${totalReviews} reviews scraped (${totalAmazonRatings} total on Amazon), avg: ${avgRating}`)

    return NextResponse.json({
      asin,
      marketplace,
      total_reviews: totalReviews,
      total_amazon_ratings: totalAmazonRatings,
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
