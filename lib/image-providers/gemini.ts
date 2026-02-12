import { ImageProvider, GenerateImageRequest, GenerateImageResult, IMAGE_MODELS, getApiModelId } from './types'

function buildPricingSection(request: GenerateImageRequest): string {
  const { creativeControls } = request
  const currencySymbol = creativeControls?.currencySymbol || '$'
  const priceAfter = creativeControls?.priceAfter
  const priceBefore = creativeControls?.priceBefore
  const priceCombo2 = creativeControls?.priceCombo2
  const priceCombo3 = creativeControls?.priceCombo3

  const hasPricing = priceAfter || priceBefore || priceCombo2 || priceCombo3

  if (!hasPricing) {
    return 'NO incluir precios en este banner - es solo para branding/awareness.'
  }

  const lines: string[] = ['PRECIOS EXACTOS (usa estos valores, NO inventes):']

  if (priceAfter) {
    lines.push(`- Precio OFERTA: ${currencySymbol}${priceAfter} (precio principal, grande y destacado)`)
  }
  if (priceBefore) {
    lines.push(`- Precio ANTES: ${currencySymbol}${priceBefore} (precio tachado, mas pequeno)`)
  }
  if (priceCombo2) {
    lines.push(`- Precio 2 UNIDADES: ${currencySymbol}${priceCombo2}`)
  }
  if (priceCombo3) {
    lines.push(`- Precio 3 UNIDADES: ${currencySymbol}${priceCombo3}`)
  }

  return lines.join('\n')
}

function buildPrompt(request: GenerateImageRequest): string {
  const { productName, creativeControls } = request
  const targetCountry = creativeControls?.targetCountry || 'CO'

  const countryNames: Record<string, string> = {
    CO: 'Colombia', MX: 'Mexico', PA: 'Panama', EC: 'Ecuador',
    PE: 'Peru', CL: 'Chile', PY: 'Paraguay', AR: 'Argentina',
    GT: 'Guatemala', ES: 'Espana',
  }
  const countryName = countryNames[targetCountry] || 'Colombia'

  const pricingSection = buildPricingSection(request)

  const productDetails = creativeControls?.productDetails || ''
  const salesAngle = creativeControls?.salesAngle || ''
  const targetAvatar = creativeControls?.targetAvatar || ''
  const additionalInstructions = creativeControls?.additionalInstructions || ''

  return `Eres un director creativo experto en publicidad e-commerce para LATAM. Tu trabajo es crear banners que VENDEN.

=== PASO 1: ANALISIS DEL PRODUCTO (PIENSA ANTES DE DISENAR) ===

Producto: ${productName}
${productDetails ? `Detalles: ${productDetails}` : ''}
${salesAngle ? `Angulo de venta: ${salesAngle}` : ''}

Antes de disenar, ANALIZA:
1. Que CATEGORIA es este producto? (cocina, fitness, belleza, tecnologia, hogar, salud, etc.)
2. En que CONTEXTO se usa? (cocina, gimnasio, bano, oficina, exterior, etc.)
3. Que ACCION realiza la persona al usarlo? (cocinar, ejercitar, aplicar, limpiar, etc.)
4. Que EMOCION transmite el beneficio? (energia, tranquilidad, confianza, felicidad, etc.)

=== PASO 2: DEFINIR LA PERSONA DEL BANNER ===

${targetAvatar ? `AVATAR ESPECIFICADO POR EL CLIENTE: ${targetAvatar}` : 'Persona: adulto latinoamericano apropiado para el producto'}

REGLA CRITICA: La persona del banner debe:
- Coincidir con el avatar especificado (edad, genero, apariencia)
- Estar en un AMBIENTE COHERENTE con el producto
- Realizar una ACCION que tenga sentido con el producto
- Transmitir la emocion del beneficio

EJEMPLOS DE COHERENCIA:
- Sarten de cocina -> Persona en COCINA, cocinando, con delantal
- Suplemento fitness -> Persona atletica en GIMNASIO o entrenando
- Crema facial -> Persona en BANO o ambiente spa, aplicandose crema
- Aspiradora -> Persona en SALA/HOGAR, limpiando
- Auriculares -> Persona relajada escuchando musica

=== PASO 3: COMPOSICION DEL BANNER ===

USA EL TEMPLATE (imagen 1) COMO REFERENCIA DE:
- Estructura y layout general
- Posicion de elementos (producto hero, badges de precio, beneficios)
- Estilo tipografico y colores
- Efectos visuales (splashes, brillos, decoraciones)

PERO ADAPTA COMPLETAMENTE:
- La PERSONA -> debe coincidir con el avatar y contexto del producto
- El AMBIENTE/FONDO -> debe ser coherente con el uso del producto
- La POSE/ACCION -> debe mostrar uso natural del producto
- Los ELEMENTOS DECORATIVOS -> deben ser relevantes al producto

=== PASO 4: CONTENIDO DEL BANNER ===

PRODUCTO: ${productName}
PAIS: ${countryName}

${pricingSection}

TEXTOS:
- TODO en ESPANOL PERFECTO, sin errores
- Fuentes GRANDES, BOLD, legibles
- Headlines orientados a VENTA y BENEFICIO
- Usa los precios EXACTOS proporcionados

=== PASO 5: ELEMENTOS OBLIGATORIOS ===

1. PRODUCTO HERO: Grande, prominente, con el empaque/etiquetas EXACTOS de las imagenes del usuario
2. PERSONA: Coherente con avatar + contexto + accion natural
3. HEADLINE: Impactante, orientado a beneficios
4. BENEFICIOS: 3-4 iconos con texto corto
5. PRECIO: Badge destacado (si se proporciono)
6. FOOTER: Sellos de confianza (envio gratis, garantia, etc.)

${additionalInstructions ? `=== INSTRUCCIONES ESPECIALES DEL CLIENTE ===\n${additionalInstructions}` : ''}

=== PROHIBIDO ===
- Persona en contexto incoherente (atleta con sarten, chef en gimnasio)
- Texto con errores o letras random
- Precios inventados
- Ignorar el avatar especificado
- Copiar LITERALMENTE la persona del template sin adaptar

=== RESULTADO ESPERADO ===
Banner profesional donde:
- La persona coincide con el avatar del cliente
- El contexto/ambiente es coherente con el producto
- La accion de la persona tiene sentido
- Se mantiene la calidad visual y estructura del template
- Todo el texto esta perfecto en espanol`
}

function isGeminiModel(modelId: string): boolean {
  return modelId.startsWith('gemini-')
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 110000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('La generacion tardo demasiado. Intenta de nuevo o usa otro modelo.')
    }
    throw error
  }
}

async function generateWithGemini(
  request: GenerateImageRequest,
  apiKey: string,
  apiModelId: string
): Promise<GenerateImageResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:generateContent`

  const parts: any[] = []

  if (request.templateBase64 && request.templateMimeType) {
    parts.push({
      inline_data: {
        mime_type: request.templateMimeType,
        data: request.templateBase64,
      },
    })
  }

  if (request.productImagesBase64) {
    for (const photo of request.productImagesBase64) {
      parts.push({
        inline_data: {
          mime_type: photo.mimeType,
          data: photo.data,
        },
      })
    }
  }

  const prompt = request.prompt && request.prompt.trim()
    ? request.prompt
    : buildPrompt(request)
  parts.push({ text: prompt })

  console.log(`[Gemini] Starting generation with model: ${apiModelId}`)
  const startTime = Date.now()

  const response = await fetchWithTimeout(
    `${endpoint}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: request.aspectRatio || '9:16',
          },
        },
      }),
    },
    110000
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Gemini] Response received in ${elapsed}s, status: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Gemini] API error: ${response.status} - ${errorText}`)
    
    // === ERRORES DETALLADOS Y ACCIONABLES ===
    const errorLower = errorText.toLowerCase()

    // --- 429: Rate Limit / Cuota ---
    if (response.status === 429) {
      if (errorLower.includes('resource_exhausted') || errorLower.includes('quota')) {
        throw new Error('Limite diario de tu API de Google alcanzado. Opciones:\n1. Espera 24 horas para que se renueve\n2. Ve a console.cloud.google.com → APIs → Gemini API → Quotas para aumentar tu limite\n3. Prueba con otro modelo (OpenAI, Seedream)')
      }
      throw new Error('Demasiadas solicitudes seguidas. Espera 30 segundos e intenta de nuevo.')
    }

    // --- 400: Bad Request ---
    if (response.status === 400) {
      if (errorLower.includes('safety') || errorLower.includes('block_reason')) {
        throw new Error('Imagen bloqueada por filtros de seguridad de Google. Intenta:\n1. Cambiar la plantilla por una menos provocativa\n2. Modificar el texto/descripcion del producto\n3. Quitar instrucciones sobre personas en el prompt')
      }
      if (errorLower.includes('invalid') && (errorLower.includes('image') || errorLower.includes('mime'))) {
        throw new Error('Formato de imagen no soportado. Google acepta: JPG, PNG, WebP y GIF.\nSi tu imagen es BMP, TIFF o SVG, conviertela a JPG antes de subir.')
      }
      if (errorLower.includes('size') || errorLower.includes('too large') || errorLower.includes('payload')) {
        throw new Error('Imagen demasiado grande. El limite es 20MB por imagen.\nComprime tus fotos antes de subir (usa tinypng.com o similar).')
      }
      if (errorLower.includes('invalid_argument') || errorLower.includes('bad request')) {
        throw new Error('Error en los datos enviados a Google. Intenta:\n1. Subir la foto del producto de nuevo\n2. Seleccionar otra plantilla\n3. Si persiste, cambia de modelo en la configuracion')
      }
      throw new Error(`Error de solicitud (400): ${errorText.substring(0, 200)}`)
    }

    // --- 403: Permission / Billing ---
    if (response.status === 403) {
      if (errorLower.includes('billing') || errorLower.includes('payment') || errorLower.includes('account_billing')) {
        throw new Error('Tu cuenta de Google Cloud NO tiene facturacion activa. Para generar imagenes:\n1. Ve a console.cloud.google.com/billing\n2. Click en "Establecer cuenta" o "Link a billing account"\n3. Agrega un metodo de pago\n4. Vuelve a intentar (el cambio aplica en 1-2 minutos)')
      }
      if (errorLower.includes('permission_denied') || errorLower.includes('forbidden')) {
        throw new Error('Tu API key no tiene permisos para generacion de imagenes. Verifica:\n1. Que habilitaste la "Generative Language API" en console.cloud.google.com → APIs\n2. Que la API key no tiene restricciones de IP/referrer que bloqueen\n3. Que la facturacion este activa (requerida para Imagen 3)')
      }
      if (errorLower.includes('api_key')) {
        throw new Error('API key invalida. Ve a Settings y verifica que copiaste la key correctamente desde console.cloud.google.com → Credentials')
      }
      throw new Error('Acceso denegado (403). Verifica tu API key y facturacion en console.cloud.google.com')
    }

    // --- 404: Model Not Found ---
    if (response.status === 404) {
      throw new Error(`Modelo "${apiModelId}" no disponible. Puede que Google lo haya cambiado de nombre o retirado.\nVe a Settings y selecciona otro modelo de la lista.`)
    }

    // --- 500/503: Server Error ---
    if (response.status >= 500) {
      throw new Error('Error temporal en los servidores de Google. Esto NO es tu culpa.\nEspera 2-3 minutos e intenta de nuevo. Si persiste, prueba con otro modelo.')
    }

    // --- Default ---
    throw new Error(`Error inesperado de Google (codigo ${response.status}). Detalles: ${errorText.substring(0, 300)}\n\nSi este error persiste, copia este mensaje y envialo a soporte.`)
  }

  const data = await response.json()

  for (const candidate of data.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        console.log(`[Gemini] Image generated successfully in ${elapsed}s`)
        return {
          success: true,
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
          provider: 'gemini',
        }
      }
    }
  }

  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    return {
      success: false,
      error: 'Contenido bloqueado por filtros de seguridad. Modifica el prompt.',
      provider: 'gemini',
    }
  }

  console.error('[Gemini] No image in response:', JSON.stringify(data).substring(0, 500))
  return {
    success: false,
    error: 'No se genero imagen. Intenta con otro prompt.',
    provider: 'gemini',
  }
}

async function generateWithImagen(
  request: GenerateImageRequest,
  apiKey: string,
  apiModelId: string
): Promise<GenerateImageResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:predict`

  const prompt = request.prompt && request.prompt.trim()
    ? request.prompt
    : buildPrompt(request)

  const aspectRatioMap: Record<string, string> = {
    '1:1': '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
    '4:3': '4:3',
    '3:4': '3:4',
    '4:5': '4:3',
    '3:2': '16:9',
    '2:3': '9:16',
  }

  console.log(`[Imagen] Starting generation with model: ${apiModelId}`)
  const startTime = Date.now()

  const response = await fetchWithTimeout(
    `${endpoint}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatioMap[request.aspectRatio || '9:16'] || '9:16',
          personGeneration: 'allow_adult',
        },
      }),
    },
    110000
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Imagen] Response received in ${elapsed}s, status: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Imagen] API error: ${response.status} - ${errorText}`)
    const errorLower = errorText.toLowerCase()

    if (response.status === 429) {
      if (errorLower.includes('resource_exhausted') || errorLower.includes('quota')) {
        throw new Error('Limite diario de tu API de Google alcanzado. Opciones:\n1. Espera 24 horas para que se renueve\n2. Ve a console.cloud.google.com → APIs → Quotas para aumentar tu limite\n3. Prueba con otro modelo (OpenAI, Seedream)')
      }
      throw new Error('Demasiadas solicitudes seguidas. Espera 30 segundos e intenta de nuevo.')
    }
    if (response.status === 400) {
      if (errorLower.includes('safety') || errorLower.includes('block_reason')) {
        throw new Error('Imagen bloqueada por filtros de seguridad de Google. Intenta:\n1. Cambiar la plantilla por una menos provocativa\n2. Modificar el texto/descripcion del producto')
      }
      throw new Error(`Error de solicitud (400): ${errorText.substring(0, 200)}`)
    }
    if (response.status === 403) {
      if (errorLower.includes('billing') || errorLower.includes('payment')) {
        throw new Error('Tu cuenta de Google Cloud NO tiene facturacion activa.\nVe a console.cloud.google.com/billing para activarla.')
      }
      throw new Error('Acceso denegado (403). Verifica tu API key y facturacion en console.cloud.google.com')
    }
    if (response.status === 404) {
      throw new Error(`Modelo "${apiModelId}" no disponible. Ve a Settings y selecciona otro modelo.`)
    }
    if (response.status >= 500) {
      throw new Error('Error temporal en los servidores de Google. Espera 2-3 minutos e intenta de nuevo.')
    }
    throw new Error(`Error inesperado de Imagen (codigo ${response.status}): ${errorText.substring(0, 300)}`)
  }

  const data = await response.json()

  if (data.predictions && data.predictions.length > 0) {
    const prediction = data.predictions[0]
    if (prediction.bytesBase64Encoded) {
      console.log(`[Imagen] Image generated successfully in ${elapsed}s`)
      return {
        success: true,
        imageBase64: prediction.bytesBase64Encoded,
        mimeType: 'image/png',
        provider: 'gemini',
      }
    }
  }

  if (data.generatedImages && data.generatedImages.length > 0) {
    const image = data.generatedImages[0]
    if (image.image?.imageBytes) {
      return {
        success: true,
        imageBase64: image.image.imageBytes,
        mimeType: image.image.mimeType || 'image/png',
        provider: 'gemini',
      }
    }
  }

  return {
    success: false,
    error: 'No image generated by Imagen',
    provider: 'gemini',
  }
}

export const geminiProvider: ImageProvider = {
  id: 'gemini',

  async generate(request: GenerateImageRequest, apiKey: string): Promise<GenerateImageResult> {
    try {
      const apiModelId = request.modelId ? getApiModelId(request.modelId) : 'gemini-2.0-flash-exp-image-generation'

      console.log(`[Gemini Provider] Using model: ${request.modelId} -> API: ${apiModelId}`)

      if (isGeminiModel(request.modelId || 'gemini-2.5-flash')) {
        return await generateWithGemini(request, apiKey, apiModelId)
      } else {
        return await generateWithImagen(request, apiKey, apiModelId)
      }
    } catch (error: any) {
      console.error('[Gemini Provider] Error:', error.message)
      return {
        success: false,
        error: error.message || 'Error en la generacion con Google',
        provider: 'gemini',
      }
    }
  },
}
