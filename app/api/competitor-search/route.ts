import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const APIFY_API_URL = 'https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items'

// CTAs que indican ecommerce/dropshipping
const ECOMMERCE_CTAS = [
  'shop_now', 'shop now', 'comprar', 'comprar ahora',
  'get_offer', 'get offer', 'obtener oferta',
  'order_now', 'order now', 'realizar pedido', 'pedir ahora', 'hacer pedido',
  'learn_more', 'learn more', 'más información', 'mas informacion', 'ver más', 'ver mas',
  'buy_now', 'buy now', 'compra ahora',
  'see_more', 'see more', 'ver oferta',
]

// CTAs a excluir (apps, servicios, etc)
const EXCLUDED_CTAS = [
  'download', 'descargar', 'instalar',
  'sign_up', 'sign up', 'registrarse', 'registrate',
  'book_now', 'book now', 'reservar', 'agendar',
  'contact_us', 'contact us', 'contactar', 'contactanos',
  'call_now', 'call now', 'llamar',
  'send_message', 'send message', 'enviar mensaje',
  'watch_more', 'watch more', 'ver video',
  'listen_now', 'listen now', 'escuchar',
  'play_game', 'play game', 'jugar',
  'apply_now', 'apply now', 'aplicar', 'postular',
]

// Dominios a excluir (no son landing pages de ecommerce)
const EXCLUDED_DOMAINS = [
  'facebook.com', 'fb.com', 'fb.me',
  'instagram.com',
  'tiktok.com',
  'youtube.com', 'youtu.be',
  'twitter.com', 'x.com',
  'linkedin.com',
  'wa.me', 'whatsapp.com',
  'bit.ly', 't.co', 'goo.gl',
  't.me', 'telegram.me',
  'play.google.com', 'apps.apple.com', // App stores
]

// Keywords que indican dropshipping/COD en LATAM
const DROPSHIPPING_KEYWORDS = [
  'envío gratis', 'envio gratis',
  'pago contra entrega', 'pago contraentrega', 'contraentrega',
  'paga en casa', 'paga cuando recibas', 'paga al recibir',
  'pago contra reembolso', 'contrareembolso',
  'cod', 'cash on delivery',
  'oferta especial', 'oferta limitada', 'oferta exclusiva',
  'últimas unidades', 'ultimas unidades', 'pocas unidades',
  'compra ahora', 'pídelo ahora', 'pidelo ahora',
  'garantía de satisfacción', 'garantia de satisfaccion',
  'devolución gratis', 'devolucion gratis',
  '50%', '60%', '70%', 'descuento',
  'precio especial', 'promoción', 'promocion',
  'sin riesgo', 'prueba gratis',
]

function isEcommerceCta(ctaText: string | null | undefined): boolean {
  if (!ctaText) return true // Si no hay CTA, no filtrar
  const cta = ctaText.toLowerCase().trim()
  
  // Primero verificar si es un CTA excluido
  if (EXCLUDED_CTAS.some(excluded => cta.includes(excluded))) {
    return false
  }
  
  // Verificar si es un CTA de ecommerce (o si no está en ninguna lista, dejarlo pasar)
  return ECOMMERCE_CTAS.some(ecom => cta.includes(ecom)) || 
         !EXCLUDED_CTAS.some(excluded => cta.includes(excluded))
}

function isValidLandingUrl(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase()
    return !EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded))
  } catch {
    return false
  }
}

function calculateDropshippingScore(adText: string, ctaText: string, linkUrl: string): number {
  const textToAnalyze = `${adText} ${ctaText} ${linkUrl}`.toLowerCase()
  let score = 0
  
  for (const keyword of DROPSHIPPING_KEYWORDS) {
    if (textToAnalyze.includes(keyword.toLowerCase())) {
      score += 1
    }
  }
  
  // Bonus por CTA de compra directa
  const cta = (ctaText || '').toLowerCase()
  if (cta.includes('comprar') || cta.includes('shop') || cta.includes('buy')) {
    score += 3
  } else if (cta.includes('oferta') || cta.includes('offer') || cta.includes('pedido') || cta.includes('order')) {
    score += 2
  }
  
  // Bonus si tiene dominio propio
  try {
    const domain = new URL(linkUrl).hostname.toLowerCase()
    if (!EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded))) {
      score += 2
    }
    // Bonus extra si parece tienda
    if (domain.includes('shop') || domain.includes('tienda') || domain.includes('store')) {
      score += 1
    }
  } catch {
    // URL inválida
  }
  
  return score
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get Apify API key from environment
    const apifyApiKey = process.env.APIFY_API_TOKEN
    if (!apifyApiKey) {
      return NextResponse.json({ 
        error: 'API key de Apify no configurada en el servidor.' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { keyword, country = 'CO', resultsLimit = 10 } = body

    if (!keyword || keyword.trim().length < 2) {
      return NextResponse.json({ error: 'Palabra clave requerida (mínimo 2 caracteres)' }, { status: 400 })
    }

    // Validar límite de resultados (10-50)
    const limit = Math.min(Math.max(Number(resultsLimit) || 10, 10), 50)
    // Pedir 3x más para tener suficientes después de filtrar
    const apifyCount = limit * 3

    // Search Meta Ads Library using Apify
    const metaAdsUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(keyword)}&search_type=keyword_unordered&media_type=all`

    console.log('Searching Meta Ads Library with Apify:', metaAdsUrl, 'limit:', limit)

    const apifyResponse = await fetch(`${APIFY_API_URL}?token=${apifyApiKey}&timeout=90`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [{ url: metaAdsUrl, method: 'GET' }],
        count: apifyCount,
        limitPerSource: apifyCount,
        scrapeAdDetails: true,
      }),
    })

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text()
      console.error('Apify error:', apifyResponse.status, errorText)
      
      if (apifyResponse.status === 408 || errorText.includes('timeout')) {
        throw new Error('La búsqueda tardó demasiado. Intenta con una keyword más específica.')
      }
      throw new Error(`Error buscando en Meta Ads Library: HTTP ${apifyResponse.status}`)
    }

    const apifyData = await apifyResponse.json()
    
    console.log('Apify response received, items:', Array.isArray(apifyData) ? apifyData.length : 'not array')
    
    // Parse, filter and score ads
    let adsFound: Array<{
      id: string
      advertiserName: string
      landingUrl: string
      adText: string
      ctaText: string
      adLibraryUrl: string
      dropshippingScore: number
      imageUrl: string | null
      domain: string
    }> = []
    
    if (Array.isArray(apifyData) && apifyData.length > 0) {
      adsFound = apifyData
        .filter((ad: any) => {
          // Must have link_url and be active
          if (!ad.snapshot?.link_url || !ad.is_active) return false
          // Must be a valid landing page (not social media)
          if (!isValidLandingUrl(ad.snapshot.link_url)) return false
          // Must have ecommerce CTA
          if (!isEcommerceCta(ad.snapshot?.cta_text)) return false
          return true
        })
        .map((ad: any) => {
          const adText = ad.snapshot?.body?.text || ''
          const ctaText = ad.snapshot?.cta_text || ''
          const linkUrl = ad.snapshot.link_url
          
          let domain = ''
          try {
            domain = new URL(linkUrl).hostname.replace('www.', '')
          } catch {}
          
          // Try to get image from snapshot
          let imageUrl = null
          if (ad.snapshot?.images && ad.snapshot.images.length > 0) {
            imageUrl = ad.snapshot.images[0]
          } else if (ad.snapshot?.videos && ad.snapshot.videos.length > 0) {
            imageUrl = ad.snapshot.videos[0]?.thumbnail || null
          }
          
          return {
            id: ad.ad_archive_id || `ad-${Date.now()}-${Math.random()}`,
            advertiserName: ad.page_name || 'Desconocido',
            landingUrl: linkUrl,
            adText: adText.substring(0, 300) + (adText.length > 300 ? '...' : ''),
            ctaText: ctaText,
            adLibraryUrl: ad.ad_library_url || '',
            dropshippingScore: calculateDropshippingScore(adText, ctaText, linkUrl),
            imageUrl,
            domain,
          }
        })
        // Sort by dropshipping score (highest first)
        .sort((a, b) => b.dropshippingScore - a.dropshippingScore)
    }

    console.log(`Found ${adsFound.length} valid ecommerce ads after filtering`)

    // Remove duplicates by domain, keeping highest scored
    const seenDomains = new Set<string>()
    const uniqueAds = adsFound.filter(ad => {
      if (!ad.domain || seenDomains.has(ad.domain)) return false
      seenDomains.add(ad.domain)
      return true
    }).slice(0, limit) // Limit to user-selected number

    return NextResponse.json({
      success: true,
      keyword,
      country,
      totalFound: apifyData?.length || 0,
      filteredCount: adsFound.length,
      ads: uniqueAds,
    })

  } catch (error: any) {
    console.error('Competitor search error:', error)
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 })
  }
}
