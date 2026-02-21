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

// NUEVA FUNCIÓN: Extraer precios usando Gemini Vision (para precios en imágenes)
async function extractPricesWithVision(screenshotBase64: string): Promise<PriceOffer[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

  if (!apiKey || !screenshotBase64) {
    console.log('[Vision Extract] No API key or no screenshot')
    return []
  }

  console.log('[Vision Extract] Analyzing screenshot with Gemini Vision...')

  const prompt = `Eres un experto en extraer precios de tiendas de dropshipping colombianas.

CONTEXTO: Esta es una captura de pantalla de una página de producto con diferentes opciones de compra.

TU TAREA:
Extrae las OFERTAS/OPCIONES de compra del producto principal que veas en la imagen. Busca patrones como:
- "1 Frasco $79.900" / "2 Frascos $109.900" / "3 Frascos $159.600"
- "1 UNIDAD $49.900" / "2 UNIDADES $99.800"
- "Lleva 1 $X" / "Lleva 2 $Y" / "Lleva 3 $Z"
- "2x1 $119.900" / "4x2 $197.600"

REGLAS CRÍTICAS:
1. SOLO extrae precios de las OFERTAS/OPCIONES del producto principal
2. IGNORA precios tachados (precio anterior, antes, era, con línea)
3. IGNORA precios de ahorro/descuento (ej: "Ahorra $50.000")
4. Los precios colombianos usan punto como separador de miles: $79.900 = 79900

Responde ÚNICAMENTE con un JSON array (sin explicaciones ni texto adicional):
[
  {"quantity": 1, "label": "1 Frasco", "price": 79900},
  {"quantity": 2, "label": "2 Frascos", "price": 109900}
]

Si no encuentras ofertas claras del producto principal, responde: []`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: screenshotBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    )

    if (!response.ok) {
      console.log('[Vision Extract] API error:', response.status)
      return []
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Extraer JSON del response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log('[Vision Extract] No JSON found in response')
      return []
    }

    const prices = JSON.parse(jsonMatch[0])
    console.log('[Vision Extract] Extracted prices:', JSON.stringify(prices))

    return prices.map((p: any) => ({
      label: p.label || `${p.quantity} unidad${p.quantity > 1 ? 'es' : ''}`,
      quantity: p.quantity || 1,
      price: typeof p.price === 'number' ? p.price : parseInt(String(p.price).replace(/\./g, ''))
    })).filter((p: PriceOffer) => p.price >= 20000 && p.price <= 500000)

  } catch (error: any) {
    console.error('[Vision Extract] Error:', error.message)
    return []
  }
}

// NUEVA FUNCIÓN: Extraer precios usando Gemini
async function extractPricesWithLLM(modalText: string, priceAreaText: string, fullText: string): Promise<PriceOffer[]> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

  // Priorizar: modal > priceArea > primeros 1500 chars de fullText
  let textToAnalyze = ''
  let source = ''

  if (modalText && modalText.length > 50) {
    textToAnalyze = modalText
    source = 'modal'
  } else if (priceAreaText && priceAreaText.length > 30) {
    textToAnalyze = priceAreaText
    source = 'priceArea'
  } else if (fullText) {
    // Solo usar una porción limitada del fullText para evitar otros productos
    textToAnalyze = fullText.substring(0, 1500)
    source = 'fullText'
  }

  if (!apiKey || !textToAnalyze) {
    console.log('[LLM Extract] No API key or no text to analyze')
    return []
  }

  console.log('[LLM Extract] Using source:', source, 'length:', textToAnalyze.length)

  const prompt = `Eres un experto en extraer precios de tiendas de dropshipping colombianas.

CONTEXTO: Esta es una página de UN SOLO PRODUCTO con diferentes opciones de compra (1 unidad, 2 unidades, combo, etc).

TEXTO DEL MODAL/PÁGINA:
${textToAnalyze.substring(0, 2500)}

TU TAREA:
Extrae las OFERTAS/OPCIONES de compra del producto principal. Busca patrones como:
- "1 Frasco $79.900" / "2 Frascos $109.900" / "3 Frascos $159.600"
- "1 UNIDAD $49.900" / "2 UNIDADES $99.800"
- "Lleva 1 $X" / "Lleva 2 $Y" / "Lleva 3 $Z"
- "2x1 $119.900" / "4x2 $197.600"

REGLAS CRÍTICAS:
1. SOLO extrae precios de las OFERTAS/OPCIONES del producto principal
2. IGNORA precios tachados (precio anterior, antes, era, con línea)
3. IGNORA precios de ahorro/descuento (ej: "Ahorra $50.000")
4. IGNORA precios de OTROS productos diferentes listados en la página
5. Los precios colombianos usan punto como separador de miles: $79.900 = 79900

Responde ÚNICAMENTE con un JSON array (sin explicaciones ni texto adicional):
[
  {"quantity": 1, "label": "1 Frasco", "price": 79900},
  {"quantity": 2, "label": "2 Frascos", "price": 109900}
]

Si no encuentras ofertas claras del producto principal, responde: []`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
  await new Promise(r => setTimeout(r, 3000));

  // PASO 1: Intentar EasySell primero (prefijo "es-")
  const easySellSelector = '#es-popup-button, [class*="es-popup-button"], easysell-form [class*="button"], easysell-form button';
  try {
    await page.waitForSelector(easySellSelector, { timeout: 5000 });
    const esBtn = await page.$(easySellSelector);
    if (esBtn) {
      await esBtn.click();
      clickedButton = "EASYSELL-BUTTON";
      clickSuccess = true;
      await new Promise(r => setTimeout(r, 4000));
    }
  } catch (e) {}

  // PASO 2: Intentar Releasit
  if (!clickSuccess) {
    try {
      await page.waitForSelector('[id*="_rsi-buy-now-button"]', { timeout: 5000 });
      const rsiBtn = await page.$('[id*="_rsi-buy-now-button"]');
      if (rsiBtn) {
        await rsiBtn.click();
        clickedButton = "RSI-BUTTON";
        clickSuccess = true;
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (e) {}
  }

  // PASO 2: Fallback - buscar form de Shopify estándar
  if (!clickSuccess) {
    try {
      const shopifyBtn = await page.$('form[action*="cart"] button[type="submit"], form[action*="cart"] input[type="submit"], [data-add-to-cart], .product-form__submit, .add-to-cart-button');
      if (shopifyBtn) {
        const isVisible = await shopifyBtn.evaluate(e => {
          const rect = e.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (isVisible) {
          await shopifyBtn.click();
          clickedButton = "SHOPIFY-FORM";
          clickSuccess = true;
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    } catch (e) {}
  }

  // PASO 3: Último fallback - buscar por keywords (solo si todo lo anterior falló)
  if (!clickSuccess) {
    const buttonKeywords = ["QUIERO", "OFERTA", "COMPRAR", "PEDIR", "AGREGAR", "CONTRA ENTREGA", "CONTRAENTREGA", "ORDENAR"];
    const buttonSelectors = ["button", "[role='button']", "[class*='btn']", "[class*='cta']", "a[class*='btn']"];

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
                  const rect = e.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
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
  }

  // PASO 4: Capturar texto del modal de Releasit/EasySell (con waitForSelector)
  let modalText = "";

  // Primero intentar capturar modal de Releasit/EasySell específicamente
  if (clickSuccess) {
    const rsiModalSelectors = [
      // EasySell selectors
      '.es-popup-content',
      '[class*="es-popup-content"]',
      '[class*="es-modal"]',
      '[class*="easysell"] [class*="modal"]',
      '[class*="easysell"] [class*="popup"]',
      'easysell-form [class*="content"]',
      'easysell-form [class*="popup"]',
      // Releasit selectors
      '[class*="rsi-modal"]',
      '[class*="rsi-popup"]',
      '[id*="rsi-modal"]',
      '.shopify-block[class*="rsi"]',
      '[class*="cod-form"]'
    ];

    for (const selector of rsiModalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000, visible: true });
        const modalEl = await page.$(selector);
        if (modalEl) {
          const text = await modalEl.evaluate(el => el.innerText);
          if (text && text.length > 10) {
            modalText = text;
            break;
          }
        }
      } catch (e) {}
    }
  }

  // Fallback: captura genérica de modal/popup/drawer
  if (!modalText) {
    modalText = await page.evaluate(() => {
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
  }

  // PASO 5: Capturar texto de área de precios (fallback)
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

  // PASO 6: Texto completo como último recurso
  const fullText = await page.evaluate(() => {
    return (document.body.innerText || "").substring(0, 8000);
  });

  // PASO 7: Tomar screenshot para Vision fallback
  let screenshotBase64 = "";
  try {
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80, fullPage: false });
    screenshotBase64 = screenshot.toString("base64");
  } catch (e) {
    console.log("Screenshot failed:", e.message);
  }

  return {
    modalText: modalText.substring(0, 4000),
    priceAreaText: priceAreaText.substring(0, 2000),
    fullText,
    clickedButton,
    clickSuccess,
    screenshotBase64
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
    console.log('[Browserless] Screenshot captured:', data.screenshotBase64 ? 'YES' : 'NO')

    // USAR LLM PARA EXTRAER PRECIOS
    let prices = await extractPricesWithLLM(
      data.modalText || '',
      data.priceAreaText || '',
      data.fullText || ''
    )

    // Si no encontramos suficientes precios con texto, intentar con Vision
    if (prices.length <= 1 && data.screenshotBase64) {
      console.log('[Browserless] LLM found <=1 prices, trying Vision fallback...')
      const visionPrices = await extractPricesWithVision(data.screenshotBase64)
      if (visionPrices.length > prices.length) {
        console.log('[Browserless] Vision found more prices:', visionPrices.length)
        prices = visionPrices
      }
    }

    return buildResult(prices, data)

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
