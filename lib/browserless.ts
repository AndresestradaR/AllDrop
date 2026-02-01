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

export async function scrapeWithBrowser(url: string): Promise<ScrapedOffer | null> {
  const apiKey = process.env.BROWSERLESS_API_KEY

  console.log('========== BROWSERLESS DEBUG ==========')
  console.log('[Browserless] API Key exists:', !!apiKey)
  console.log('[Browserless] Target URL:', url)

  if (!apiKey) {
    console.log('[Browserless] SKIPPING - No API key!')
    return null
  }

  try {
    const escapedUrl = url.replace(/'/g, "\\'").replace(/"/g, '\\"')

    // CÓDIGO PUPPETEER COMPLETAMENTE REESCRITO
    const puppeteerCode = `
export default async function({ page }) {
  let clickedButton = "none";
  let clickSuccess = false;

  await page.goto("${escapedUrl}", { waitUntil: "networkidle2", timeout: 25000 });
  await new Promise(r => setTimeout(r, 2000));

  // PASO 1: Click en botón de compra
  const buttonKeywords = ["QUIERO", "OFERTA", "COMPRAR", "PEDIR", "AGREGAR", "CONTRA ENTREGA", "CONTRAENTREGA", "ORDENAR"];
  const buttonSelectors = ["button", "[role='button']", "[class*='btn']", "[class*='cta']", "[class*='buy']", "[class*='comprar']", "[class*='pedir']"];

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
                return style.display !== 'none' && style.visibility !== 'hidden' && e.offsetParent !== null;
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

  // PASO 2: LIMPIAR precios tachados del DOM
  await page.evaluate(() => {
    // Remover tags de tachado
    document.querySelectorAll('del, s, strike').forEach(el => el.remove());
    
    // Remover por clases específicas de precio viejo
    const oldSelectors = [
      '[class*="compare-price"]', '[class*="was-price"]', '[class*="old-price"]',
      '[class*="original-price"]', '[class*="regular-price"]', '[class*="list-price"]',
      '[class*="precio-antes"]', '[class*="precio-anterior"]', '[class*="precio-tachado"]',
      '.compare-at-price', '.product-price--compare', '[data-compare-price]'
    ];
    document.querySelectorAll(oldSelectors.join(',')).forEach(el => el.remove());
    
    // Remover elementos con line-through
    document.querySelectorAll('*').forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        if (style.textDecoration.includes('line-through') || style.textDecorationLine.includes('line-through')) {
          el.remove();
        }
      } catch (e) {}
    });
  });

  // PASO 3: Extraer ofertas del MODAL (más confiable)
  const modalOffers = await page.evaluate(() => {
    const offers = [];
    
    // Buscar modal/popup activo
    const modalSelectors = [
      '[class*="modal"]:not([style*="display: none"])',
      '[class*="popup"]:not([style*="display: none"])',
      '[class*="drawer"]:not([style*="display: none"])',
      '[role="dialog"]',
      '[class*="cart-drawer"]'
    ];
    
    let container = null;
    for (const sel of modalSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && el.innerText.length > 50) {
        container = el;
        break;
      }
    }
    if (!container) container = document.body;
    
    // Buscar cards de ofertas/opciones
    const cardSelectors = [
      '[class*="option"]', '[class*="variant"]', '[class*="package"]',
      '[class*="bundle"]', '[class*="tier"]', '[class*="plan"]',
      'label:has(input[type="radio"])', '[class*="offer-card"]',
      '[class*="price-card"]', '[class*="producto-item"]'
    ];
    
    container.querySelectorAll(cardSelectors.join(',')).forEach(el => {
      // Ignorar si está tachado
      try {
        const style = window.getComputedStyle(el);
        if (style.textDecoration.includes('line-through')) return;
      } catch (e) {}
      
      const text = (el.innerText || "").replace(/\\n/g, ' ').replace(/\\s+/g, ' ').trim();
      if (!text || text.length > 400 || text.length < 8) return;
      
      // Ignorar si es texto de ahorro
      if (/^ahorra|^-\\s*\\$|^descuento/i.test(text)) return;
      
      // REGEX ESTRICTO para precios colombianos: $XX.XXX o $XXX.XXX (mínimo 5 dígitos)
      const priceMatch = text.match(/\\$\\s*([0-9]{2,3}\\.[0-9]{3})(?:\\.[0-9]{3})?(?:,[0-9]{2})?/);
      if (!priceMatch) return;
      
      const priceStr = priceMatch[1].replace(/\\./g, '');
      const price = parseInt(priceStr);
      
      // Solo precios válidos para dropshipping Colombia (mínimo $30.000)
      if (price < 30000 || price > 400000) return;
      
      // Extraer cantidad
      let quantity = 1;
      const qtyMatch = text.match(/(\\d+)\\s*[xX]\\s*\\d|(\\d+)\\s*(?:frasco|unidad|paquete|caja|botella|mes)|(?:lleva|compra)\\s*(\\d+)/i);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1] || qtyMatch[2] || qtyMatch[3]) || 1;
      }
      // Detectar 2x1, 4x2
      const comboMatch = text.match(/(\\d+)[xX](\\d+)/);
      if (comboMatch) quantity = parseInt(comboMatch[1]) || 1;
      
      offers.push({ quantity, price, text: text.substring(0, 80) });
    });
    
    // Deduplicar
    const seen = new Set();
    return offers.filter(o => {
      if (seen.has(o.price)) return false;
      seen.add(o.price);
      return true;
    }).sort((a, b) => a.price - b.price);
  });

  // PASO 4: Si no hay ofertas, buscar en contenedores de PRECIO específicos
  const containerPrices = await page.evaluate(() => {
    const prices = [];
    
    // SOLO contenedores que claramente son de precio de venta
    const priceSelectors = [
      '[class*="sale-price"]', '[class*="current-price"]', '[class*="final-price"]',
      '[class*="offer-price"]', '[class*="precio-actual"]', '[class*="precio-venta"]',
      '[itemprop="price"]', '[data-price]', '[class*="product-price"]:not([class*="compare"])'
    ];
    
    document.querySelectorAll(priceSelectors.join(',')).forEach(el => {
      // Verificar que no esté tachado
      try {
        const style = window.getComputedStyle(el);
        if (style.textDecoration.includes('line-through')) return;
      } catch (e) {}
      
      // Verificar ancestros
      if (el.closest('del, s, strike, [class*="compare"], [class*="was"], [class*="old"]')) return;
      
      const text = (el.innerText || "").trim();
      if (/ahorra|descuento|antes/i.test(text)) return;
      
      // REGEX ESTRICTO
      const match = text.match(/\\$\\s*([0-9]{2,3}\\.[0-9]{3})(?:\\.[0-9]{3})?/);
      if (match) {
        const price = parseInt(match[1].replace(/\\./g, ''));
        if (price >= 30000 && price <= 400000) {
          prices.push(price);
        }
      }
    });
    
    return [...new Set(prices)].sort((a, b) => a - b);
  });

  // PASO 5: Extraer texto del modal
  const modalText = await page.evaluate(() => {
    const selectors = ['[class*="modal"]', '[class*="popup"]', '[class*="drawer"]', '[role="dialog"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return (el.innerText || "").substring(0, 3000);
    }
    return "";
  });

  // PASO 6: Texto completo (limitado)
  const fullText = await page.evaluate(() => {
    document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    return (document.body.innerText || "").substring(0, 6000);
  });

  return { fullText, modalText, modalOffers, containerPrices, clickedButton, clickSuccess };
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
    console.log('[Browserless] Modal offers:', JSON.stringify(data.modalOffers || []))
    console.log('[Browserless] Container prices:', JSON.stringify(data.containerPrices || []))

    return parseScrapedData(data)

  } catch (error: any) {
    console.error('[Browserless] EXCEPTION:', error.message)
    return null
  }
}

function parseScrapedData(data: any): ScrapedOffer {
  const allText = [data.modalText, data.fullText].filter(Boolean).join(' ')
  const prices: PriceOffer[] = []

  // PRIORIDAD 1: Ofertas del modal (más confiables)
  if (data.modalOffers && data.modalOffers.length >= 1) {
    console.log('[parseScrapedData] Usando', data.modalOffers.length, 'ofertas del modal')
    for (const offer of data.modalOffers) {
      prices.push({
        label: offer.quantity > 1 ? `${offer.quantity} unidades` : 'Precio',
        quantity: offer.quantity || 1,
        price: offer.price
      })
    }
  }

  // PRIORIDAD 2: Precios de contenedores específicos
  if (prices.length === 0 && data.containerPrices && data.containerPrices.length > 0) {
    console.log('[parseScrapedData] Usando', data.containerPrices.length, 'precios de contenedores')
    for (const price of data.containerPrices) {
      prices.push({
        label: 'Precio',
        quantity: 1,
        price: price
      })
    }
  }

  // PRIORIDAD 3: Regex sobre texto del modal (último recurso)
  if (prices.length === 0 && data.modalText) {
    console.log('[parseScrapedData] Extrayendo del texto del modal')
    const cleanText = data.modalText
      .replace(/ahorra[s]?\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/descuento[s]?\s*:?\s*-?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/-\s*\$[\d.,]+/g, '')

    // REGEX ESTRICTO: mínimo $XX.XXX (5 dígitos)
    const pricePattern = /\$\s*([0-9]{2,3}\.[0-9]{3})(?:\.[0-9]{3})?/g
    let match
    while ((match = pricePattern.exec(cleanText)) !== null) {
      const price = parseInt(match[1].replace(/\./g, ''))
      if (price >= 30000 && price <= 400000) {
        if (!prices.find(p => p.price === price)) {
          prices.push({ label: 'Precio', quantity: 1, price })
        }
      }
    }
  }

  prices.sort((a, b) => a.price - b.price)
  return buildResult(prices.slice(0, 5), allText, data)
}

function buildResult(prices: PriceOffer[], allText: string, data: any): ScrapedOffer {
  const hasCombo = /combo|2x1|3x2|4x2|\d+\s*frasco|\d+\s*unidad/i.test(allText)

  const giftPatterns = [/regalo[:\s]+([^,.!\n]{3,40})/i, /gratis[:\s]+([^,.!\n]{3,40})/i, /envío\s*gratis/i]
  let giftDescription: string | null = null
  let hasGift = false
  for (const pat of giftPatterns) {
    const m = allText.match(pat)
    if (m) { hasGift = true; giftDescription = m[1]?.trim() || null; break }
  }

  const ctaMatch = allText.match(/pedir\s*(?:contra\s*)?entrega|comprar\s*ahora|lo\s*quiero|ordenar/i)

  return {
    price: prices.length > 0 ? prices[0].price : null,
    prices,
    hasCombo,
    hasGift,
    giftDescription,
    cta: ctaMatch ? ctaMatch[0] : null,
    fullText: allText.substring(0, 2000),
    clickedButton: data.clickedButton || 'none'
  }
}
