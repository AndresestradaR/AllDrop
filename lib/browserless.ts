const BROWSERLESS_URL = 'https://chrome.browserless.io/function'

interface PriceOffer {
  label: string
  quantity: number
  price: number
  originalPrice?: number
}

export interface ScrapedOffer {
  prices: PriceOffer[]
  price: number | null
  hasCombo: boolean
  hasGift: boolean
  giftDescription: string | null
  cta: string | null
  fullText: string
  clickedButton: string
}

// NUEVA FUNCIÓN: Extraer precios usando Gemini
async function extractPricesWithLLM(modalText: string, fullText: string): Promise<PriceOffer[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

  if (!apiKey || !modalText) {
    console.log('[LLM Extract] No API key or no modal text')
    return []
  }

  const textToAnalyze = modalText.length > 100 ? modalText : fullText

  const prompt = `Analiza este texto de una tienda online colombiana y extrae SOLO los precios de venta actuales (NO los precios tachados/anteriores).

TEXTO:
${textToAnalyze.substring(0, 3000)}

REGLAS:
1. Los precios tachados (antes, era, precio anterior, con línea encima) son precios VIEJOS - ignóralos
2. Los precios actuales/de venta son los que el cliente paga - extrae SOLO estos
3. Busca ofertas como "1 frasco $X", "2 frascos $Y", "2x1 $Z", etc.
4. Los precios colombianos tienen formato $XX.XXX o $XXX.XXX (con punto como separador de miles)
5. Ignora precios de ahorro/descuento (ej: "Ahorra $50.000")

Responde SOLO con un JSON array así (sin explicaciones):
[
  {"quantity": 1, "label": "1 unidad", "price": 79900},
  {"quantity": 2, "label": "2 unidades", "price": 109900}
]

Si no encuentras precios válidos, responde: []`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    )

    if (!response.ok) {
      console.log('[LLM Extract] API error:', response.status)
      return []
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Extraer JSON del response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('[LLM Extract] No JSON found in response')
      return []
    }

    const prices = JSON.parse(jsonMatch[0])
    console.log('[LLM Extract] Extracted prices:', JSON.stringify(prices))

    return prices.map((p: any) => ({
      label: p.label || `${p.quantity} unidad${p.quantity > 1 ? 'es' : ''}`,
      quantity: p.quantity || 1,
      price: typeof p.price === 'number' ? p.price : parseInt(String(p.price).replace(/\./g, ''))
    })).filter((p: PriceOffer) => p.price >= 20000 && p.price <= 500000)

  } catch (error: any) {
    console.error('[LLM Extract] Error:', error.message)
    return []
  }
}

export async function scrapeWithBrowser(url: string): Promise<ScrapedOffer | null> {
  const apiKey = process.env.BROWSERLESS_API_KEY

  console.log('========== BROWSERLESS DEBUG ==========')
  console.log('[Browserless] Target URL:', url)

  if (!apiKey) {
    console.log('[Browserless] SKIPPING - No API key!')
    return null
  }

  try {
    const escapedUrl = url.replace(/'/g, "\\'").replace(/"/g, '\\"')

    // Código Puppeteer simplificado - solo captura texto
    const puppeteerCode = `
export default async function({ page }) {
  let clickedButton = "none";
  let clickSuccess = false;

  await page.goto("${escapedUrl}", { waitUntil: "networkidle2", timeout: 25000 });
  await new Promise(r => setTimeout(r, 2000));

  // PASO 1: Click en botón de compra
  const buttonKeywords = ["QUIERO", "OFERTA", "COMPRAR", "PEDIR", "AGREGAR", "CONTRA ENTREGA", "CONTRAENTREGA", "ORDENAR", "VER OFERTA", "VER PRECIO"];
  const buttonSelectors = ["button", "[role='button']", "[class*='btn']", "[class*='cta']", "[class*='buy']", "[class*='comprar']", "[class*='pedir']", "a[class*='btn']"];

  try {
    for (const selector of buttonSelectors) {
      if (clickSuccess) break;
      const elements = await page.$$(selector);
      for (const el of elements) {
        try {
          const text = await el.evaluate(e => (e.innerText || "").toUpperCase().trim());
          for (const keyword of buttonKeywords) {
            if (text.includes(keyword) && text.length < 80) {
              const isVisible = await el.evaluate(e => {
                const style = window.getComputedStyle(e);
                const rect = e.getBoundingClientRect();
                return style.display !== 'none' &&
                       style.visibility !== 'hidden' &&
                       style.opacity !== '0' &&
                       rect.width > 0 &&
                       rect.height > 0;
              });
              if (isVisible) {
                await el.click();
                clickedButton = text.substring(0, 50);
                clickSuccess = true;
                await new Promise(r => setTimeout(r, 4000));
                break;
              }
            }
          }
          if (clickSuccess) break;
        } catch (e) {}
      }
    }
  } catch (e) {}

  // PASO 2: Capturar texto del modal/popup (SIN modificar el DOM)
  const modalText = await page.evaluate(() => {
    const modalSelectors = [
      '[class*="modal"]:not([style*="display: none"])',
      '[class*="popup"]:not([style*="display: none"])',
      '[class*="drawer"]:not([style*="display: none"])',
      '[role="dialog"]',
      '[class*="cart-drawer"]',
      '[class*="slideout"]',
      '[class*="overlay"][class*="active"]',
      '[class*="lightbox"]'
    ];

    for (const sel of modalSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const isVisible = rect.width > 100 &&
                           rect.height > 100 &&
                           style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0';
          if (isVisible && el.innerText.length > 50) {
            return el.innerText;
          }
        }
      } catch (e) {}
    }
    return "";
  });

  // PASO 3: Capturar texto de área de precios (fallback)
  const priceAreaText = await page.evaluate(() => {
    const selectors = [
      '[class*="product-form"]',
      '[class*="price-wrapper"]',
      '[class*="offer-section"]',
      '[class*="buy-box"]',
      '[class*="purchase"]',
      'form[action*="cart"]'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.innerText.length > 30) {
          return el.innerText;
        }
      } catch (e) {}
    }
    return "";
  });

  // PASO 4: Texto completo como último recurso
  const fullText = await page.evaluate(() => {
    return (document.body.innerText || "").substring(0, 8000);
  });

  return {
    modalText: modalText.substring(0, 4000),
    priceAreaText: priceAreaText.substring(0, 2000),
    fullText,
    clickedButton,
    clickSuccess
  };
}
`;

    const response = await fetch(`${BROWSERLESS_URL}?token=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: puppeteerCode })
    })

    console.log('[Browserless] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('[Browserless] ERROR:', errorText.substring(0, 500))
      return null
    }

    const data = await response.json()
    console.log('[Browserless] SUCCESS!')
    console.log('[Browserless] Clicked:', data.clickedButton)
    console.log('[Browserless] Click success:', data.clickSuccess)
    console.log('[Browserless] Modal text length:', data.modalText?.length || 0)
    console.log('[Browserless] Modal text preview:', data.modalText?.substring(0, 500))

    // USAR LLM PARA EXTRAER PRECIOS
    const llmPrices = await extractPricesWithLLM(
      data.modalText || data.priceAreaText || '',
      data.fullText || ''
    )

    return buildResult(llmPrices, data)

  } catch (error: any) {
    console.error('[Browserless] EXCEPTION:', error.message)
    return null
  }
}

function buildResult(prices: PriceOffer[], data: any): ScrapedOffer {
  const allText = [data.modalText, data.priceAreaText, data.fullText].filter(Boolean).join(' ')

  // Ordenar por precio
  prices.sort((a, b) => a.price - b.price)

  // Detectar combos
  const hasCombo = /combo|2x1|3x2|4x2|\d+\s*frasco|\d+\s*unidad|\d+\s*cápsula/i.test(allText)

  // Detectar regalos
  const giftPatterns = [
    /regalo[:\s]+([^,.!\n]{3,40})/i,
    /gratis[:\s]+([^,.!\n]{3,40})/i,
    /\+\s*([^,.!\n]{3,30})\s*gratis/i,
    /envío\s*gratis/i
  ]
  let giftDescription: string | null = null
  let hasGift = false
  for (const pat of giftPatterns) {
    const m = allText.match(pat)
    if (m) {
      hasGift = true
      giftDescription = m[1]?.trim() || null
      break
    }
  }

  // Detectar CTA
  const ctaMatch = allText.match(/pedir\s*(?:contra\s*)?entrega|comprar\s*ahora|lo\s*quiero|ordenar\s*ahora|agregar\s*al\s*carrito/i)

  return {
    price: prices.length > 0 ? prices[0].price : null,
    prices: prices.slice(0, 5),
    hasCombo,
    hasGift,
    giftDescription,
    cta: ctaMatch ? ctaMatch[0] : null,
    fullText: allText.substring(0, 2000),
    clickedButton: data.clickedButton || 'none'
  }
}
