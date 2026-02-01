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
  console.log('[Browserless] API Key preview:', apiKey ? apiKey.substring(0, 10) + '...' : 'NONE')
  console.log('[Browserless] Target URL:', url)

  if (!apiKey) {
    console.log('[Browserless] SKIPPING - No API key!')
    return null
  }

  try {
    console.log('[Browserless] Making request to /function endpoint...')

    const escapedUrl = url.replace(/'/g, "\\'").replace(/"/g, '\\"')

    const puppeteerCode = `
export default async function({ page }) {
  let clickedButton = "none";
  let clickSuccess = false;

  await page.goto("${escapedUrl}", { waitUntil: "networkidle2", timeout: 25000 });
  await new Promise(r => setTimeout(r, 2000));

  // PASO 1: Buscar y hacer click en botones de compra
  const buttonKeywords = ["QUIERO", "OFERTA", "COMPRAR", "PEDIR", "AGREGAR", "AÑADIR", "VER PRECIO", "VER OFERTA", "OBTENER", "ORDENAR"];

  try {
    const buttonSelectors = [
      "button",
      "a[href*='cart']",
      "a[href*='checkout']",
      "[role='button']",
      "[class*='btn']",
      "[class*='button']",
      "[class*='cta']",
      "[class*='buy']",
      "[class*='comprar']",
      "[class*='pedir']",
      "[class*='add-to-cart']",
      "[data-action='buy']",
      "[data-action='add-to-cart']",
      "form[action*='cart'] button",
      ".product-form button"
    ];

    for (const selector of buttonSelectors) {
      if (clickSuccess) break;

      try {
        const elements = await page.$$(selector);

        for (const el of elements) {
          try {
            const text = await el.evaluate(e => (e.innerText || e.textContent || "").toUpperCase().trim());

            for (const keyword of buttonKeywords) {
              if (text.includes(keyword) && text.length < 100) {
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
      } catch (e) {}
    }
  } catch (e) {}

  // PASO 2: LIMPIEZA AGRESIVA de precios tachados del DOM
  await page.evaluate(() => {
    // 2.1 Tags HTML de tachado
    document.querySelectorAll('del, s, strike, ins').forEach(el => el.remove());

    // 2.2 Clases de precio anterior/tachado (más completo)
    const oldPriceSelectors = [
      '[class*="old"]', '[class*="was"]', '[class*="before"]',
      '[class*="compare"]', '[class*="regular"]', '[class*="original"]',
      '[class*="tachado"]', '[class*="crossed"]', '[class*="scratch"]',
      '[class*="previous"]', '[class*="retail"]', '[class*="msrp"]',
      '[class*="list-price"]', '[class*="strike"]', '[class*="lined"]',
      '[data-price-type="old"]', '[data-compare]', '[data-original]',
      '.price-was', '.was-price', '.old-price', '.compare-price',
      '[class*="antes"]', '[class*="anterior"]'
    ];
    document.querySelectorAll(oldPriceSelectors.join(',')).forEach(el => el.remove());

    // 2.3 Cualquier elemento con text-decoration: line-through (y sus hijos)
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        if (style.textDecoration && style.textDecoration.includes('line-through')) {
          el.remove();
        }
        if (style.textDecorationLine && style.textDecorationLine.includes('line-through')) {
          el.remove();
        }
      } catch (e) {}
    });

    // 2.4 Remover elementos que contengan texto de ahorro/descuento
    document.querySelectorAll('*').forEach(el => {
      const text = (el.innerText || '').toLowerCase();
      if (el.children.length === 0) { // Solo hojas
        if (/ahorra|ahorras|descuento|antes|era\\s|was\\s|save\\s/i.test(text)) {
          if (text.length < 100) { // Solo elementos pequeños
            el.remove();
          }
        }
      }
    });
  });

  // PASO 3: Extraer ofertas estructuradas (cantidad + precio) - MEJORADO
  const structuredOffers = await page.evaluate(() => {
    const offers = [];

    // Selectores para contenedores de opciones/variantes
    const optionSelectors = [
      '[class*="offer"]', '[class*="option"]', '[class*="variant"]',
      '[class*="package"]', '[class*="bundle"]', '[class*="quantity-option"]',
      '[class*="product-option"]', '[class*="price-option"]',
      '[role="radio"]', '[role="option"]', 'label:has(input[type="radio"])',
      '[class*="card"]:has([class*="price"])', '[class*="plan"]',
      '[class*="frasco"]', '[class*="unidad"]', '[class*="combo"]',
      '[class*="selector"]', '[class*="choice"]', '[class*="tier"]',
      'label', '.swatch', '[data-variant]', '[data-option]'
    ];

    // Patrones mejorados para detectar ofertas
    const patterns = [
      /(\\d+)\\s*(?:frasco|unidad|mes|paquete|caja|kit|botella|pote|sobre|tableta)[s]?[^\\$]*\\$\\s*([\\d][\\d.,]*)/i,
      /(?:lleva|compra|pide)\\s*(\\d+)[^\\$]*\\$\\s*([\\d][\\d.,]*)/i,
      /(\\d+)\\s*[xX]\\s*[^\\$]*\\$\\s*([\\d][\\d.,]*)/i,
      /combo\\s*(?:de\\s*)?(\\d+)[^\\$]*\\$\\s*([\\d][\\d.,]*)/i,
      /pack\\s*(?:de\\s*)?(\\d+)[^\\$]*\\$\\s*([\\d][\\d.,]*)/i,
      /\\$\\s*([\\d][\\d.,]*).*?(\\d+)\\s*(?:frasco|unidad|mes|paquete|caja|kit|botella)[s]?/i
    ];

    document.querySelectorAll(optionSelectors.join(',')).forEach(el => {
      // Verificar que no esté tachado
      try {
        const style = window.getComputedStyle(el);
        if (style.textDecoration && style.textDecoration.includes('line-through')) return;
      } catch (e) {}

      const text = (el.innerText || "").replace(/\\n/g, ' ');
      if (!text || text.length > 300) return;

      // Ignorar si contiene palabras de descuento
      if (/ahorra|descuento|antes|era\\s|was\\s|save/i.test(text)) return;

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          let quantity, priceStr;

          // El último patrón tiene el precio primero
          if (pattern.source.startsWith('\\\\\\$')) {
            priceStr = match[1];
            quantity = parseInt(match[2]) || 1;
          } else {
            quantity = parseInt(match[1]) || 1;
            priceStr = match[2];
          }

          const price = parseInt(priceStr.replace(/\\./g, '').replace(/,/g, ''));
          if (price >= 15000 && price <= 500000) {
            offers.push({
              quantity: quantity,
              unit: 'unidad',
              price: price,
              text: text.substring(0, 80)
            });
          }
          break;
        }
      }
    });

    // Deduplicar por precio (mantener el primero encontrado)
    const unique = [];
    const seenPrices = new Set();
    offers.forEach(o => {
      if (!seenPrices.has(o.price)) {
        seenPrices.add(o.price);
        unique.push(o);
      }
    });

    return unique.sort((a, b) => a.price - b.price);
  });

  // PASO 4: Extraer precios del DOM (ya limpio de tachados)
  const allPrices = await page.evaluate(() => {
    const prices = [];

    // Selectores de precio (excluyendo clases de precio viejo)
    const priceSelectors = '[class*="price"]:not([class*="old"]):not([class*="before"]):not([class*="compare"]):not([class*="was"]):not([class*="original"]), [class*="precio"]:not([class*="anterior"]), [class*="valor"], [class*="total"], [class*="amount"], [class*="cost"], [class*="monto"]';

    document.querySelectorAll(priceSelectors).forEach(el => {
      // Doble verificación de tachado
      try {
        const style = window.getComputedStyle(el);
        if (style.textDecoration && style.textDecoration.includes('line-through')) return;
        if (style.textDecorationLine && style.textDecorationLine.includes('line-through')) return;
      } catch (e) {}

      // Verificar ancestros tachados
      if (el.closest('del, s, strike, [class*="old"], [class*="before"], [class*="tachado"], [class*="compare"], [class*="was"], [class*="original"]')) return;

      const text = el.innerText || "";

      // Ignorar si contiene palabras de descuento/ahorro
      if (/ahorra|descuento|antes|era\\s|was\\s|save/i.test(text)) return;

      // Extraer precios con regex
      const priceMatches = text.matchAll(/\\$\\s*([\\d]{1,3}(?:[.,]\\d{3})*)/g);
      for (const match of priceMatches) {
        const price = parseInt(match[1].replace(/\\./g, '').replace(/,/g, ''));
        if (price >= 15000 && price <= 500000) {
          prices.push(price);
        }
      }
    });

    return [...new Set(prices)].sort((a, b) => a - b);
  });

  // PASO 5: Extraer texto completo (ya limpio)
  const fullText = await page.evaluate(() => document.body.innerText);

  // PASO 6: Extraer texto de modals/popups
  const modalText = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="drawer"], [role="dialog"], [class*="overlay"][style*="visible"], [class*="lightbox"]');
    return Array.from(els).map(e => e.innerText).join(" | ");
  });

  // PASO 7: Extraer texto de elementos de precio
  const priceText = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="price"], [class*="precio"], [class*="offer"], [class*="total"]');
    return Array.from(els).map(e => e.innerText).join(" | ");
  });

  return {
    fullText: fullText.substring(0, 10000),
    priceText,
    modalText,
    structuredOffers,
    allPrices,
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
      console.log('[Browserless] ERROR response:', response.status)
      console.log('[Browserless] Error body:', errorText.substring(0, 500))
      return null
    }

    const data = await response.json()
    console.log('[Browserless] SUCCESS!')
    console.log('[Browserless] Clicked button:', data.clickedButton || 'none')
    console.log('[Browserless] Click success:', data.clickSuccess)
    console.log('[Browserless] Structured offers:', JSON.stringify(data.structuredOffers || []))
    console.log('[Browserless] All prices:', JSON.stringify(data.allPrices || []))
    console.log('[Browserless] fullText length:', data.fullText?.length || 0)
    console.log('[Browserless] priceText:', data.priceText?.substring(0, 300))
    console.log('[Browserless] modalText:', data.modalText?.substring(0, 300))

    const result = parseScrapedData(data)
    console.log('[Browserless] Final parsed prices:', result.prices.length, 'main price:', result.price)

    return result

  } catch (error: any) {
    console.error('[Browserless] EXCEPTION:', error.message)
    console.error('[Browserless] Stack:', error.stack?.substring(0, 300))
    return null
  }
}

function parseScrapedData(data: any): ScrapedOffer {
  const allText = [data.fullText, data.priceText, data.modalText].filter(Boolean).join(' ')
  const prices: PriceOffer[] = []

  // PRIORIDAD 1: Si hay 2+ ofertas estructuradas, usarlas directamente (mejor calidad)
  if (data.structuredOffers && data.structuredOffers.length >= 2) {
    console.log('[parseScrapedData] Usando', data.structuredOffers.length, 'ofertas estructuradas')
    for (const offer of data.structuredOffers) {
      prices.push({
        label: `${offer.quantity} ${offer.unit || 'unidad'}`,
        quantity: offer.quantity || 1,
        price: offer.price
      })
    }
    // Si tenemos ofertas estructuradas, no necesitamos más
    prices.sort((a, b) => a.price - b.price)
    return buildResult(prices, allText, data)
  }

  // PRIORIDAD 2: Usar ofertas estructuradas + complementar con allPrices
  if (data.structuredOffers && data.structuredOffers.length > 0) {
    for (const offer of data.structuredOffers) {
      prices.push({
        label: `${offer.quantity} ${offer.unit || 'unidad'}`,
        quantity: offer.quantity || 1,
        price: offer.price
      })
    }
  }

  // Agregar precios del DOM que no estén ya incluidos
  if (data.allPrices && data.allPrices.length > 0) {
    for (const price of data.allPrices) {
      if (!prices.find(p => p.price === price)) {
        prices.push({
          label: 'Precio',
          quantity: 1,
          price: price
        })
      }
    }
  }

  // PRIORIDAD 3: Extraer del texto con regex (última opción)
  if (prices.length === 0) {
    // Limpiar texto de descuentos y precios anteriores
    const cleanText = allText
      .replace(/ahorra[s]?\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/descuento[s]?\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/antes\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/era\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/precio\s*anterior\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/precio\s*regular\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/precio\s*original\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/regular\s*:?\s*\$?\s*[\d.,]+/gi, '')
      .replace(/\$[\d.,]+\s*(?:antes|tachado|regular|original)/gi, '')
      .replace(/-\s*\$[\d.,]+/g, '')

    // Buscar ofertas estructuradas en el texto
    const offerPattern = /(\d+)\s*(frasco|unidad|mes|paquete|caja)[s]?[^\$]*\$\s*([\d.,]+)/gi
    let match
    while ((match = offerPattern.exec(cleanText)) !== null) {
      const price = parseInt(match[3].replace(/\./g, '').replace(/,/g, ''))
      if (price >= 15000 && price <= 500000) {
        prices.push({
          label: `${match[1]} ${match[2]}`,
          quantity: parseInt(match[1]),
          price: price
        })
      }
    }

    // Si aún no hay precios, buscar precios sueltos
    if (prices.length === 0) {
      const pricePattern = /\$\s*([\d]{1,3}(?:[.,]\d{3})*)/g
      while ((match = pricePattern.exec(cleanText)) !== null) {
        const price = parseInt(match[1].replace(/\./g, '').replace(/,/g, ''))
        if (price >= 15000 && price <= 500000) {
          if (!prices.find(p => p.price === price)) {
            prices.push({
              label: 'Precio',
              quantity: 1,
              price: price
            })
          }
        }
      }
    }
  }

  // Ordenar por precio
  prices.sort((a, b) => a.price - b.price)

  return buildResult(prices, allText, data)
}

function buildResult(prices: PriceOffer[], allText: string, data: any): ScrapedOffer {
  // Detectar combos
  const hasCombo = /combo|2x1|3x2|\d+\s*frasco|\d+\s*unidad|\d+\s*mes/i.test(allText)

  // Detectar regalos
  const giftMatch = allText.match(/regalo[:\s]*([^,.\n]{3,40})|gratis[:\s]*([^,.\n]{3,40})|incluye[:\s]*([^,.\n]{3,40})/i)
  const hasGift = /regalo|gratis|incluye|bonus|env[ií]o\s*gratis/i.test(allText)
  const giftDescription = giftMatch ? (giftMatch[1] || giftMatch[2] || giftMatch[3])?.trim() || null : null

  // Detectar CTA
  const ctaMatch = allText.match(/pedir\s*ahora|comprar\s*ahora|agregar\s*al\s*carrito|pagar\s*ahora|lo\s*quiero/i)

  return {
    price: prices.length > 0 ? prices[0].price : null,
    prices: prices,
    hasCombo,
    hasGift,
    giftDescription,
    cta: ctaMatch ? ctaMatch[0] : null,
    fullText: allText.substring(0, 2000),
    clickedButton: data.clickedButton || 'none'
  }
}
