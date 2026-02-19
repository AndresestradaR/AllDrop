import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { aiLimiter, getClientIp } from '@/lib/rate-limit'

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — Copywriter experto en respuesta directa, dropshipping LATAM
// ---------------------------------------------------------------------------
const ENHANCE_SYSTEM_PROMPT = `# ROL
Eres un copywriter senior de respuesta directa especializado en dropshipping COD (contra-entrega) para Colombia, Mexico, Guatemala, Chile y Peru. Dominas las tecnicas de Eugene Schwartz, David Ogilvy y Gary Halbert adaptadas a e-commerce moderno en Latinoamerica.

Entiendes que estos textos alimentan un GENERADOR DE IMAGENES de banners (Gemini / DALL-E), no son copy final de anuncios. Los banners son VISUALES, asi que los textos deben ser CORTOS, IMPACTANTES y en MAYUSCULAS cuando aplique.

Conoces las objeciones del comprador latino: "Sera estafa?", "Cuanto tarda el envio?", "Puedo pagar al recibir?", "Funcionara de verdad?".

# TAREA
Analizar las imagenes del producto y/o su nombre para generar los 4 Controles Creativos que guian la generacion de banners:

1. **productDetails** (max 500 caracteres): Descripcion del producto con beneficios clave, numeros concretos, ingredientes/materiales destacados.
2. **salesAngle** (max 150 caracteres): Gancho de venta con TRANSFORMACION o RESULTADO. No describir el producto, sino la PROMESA.
3. **targetAvatar** (max 150 caracteres): Perfil ESPECIFICO del comprador: rango de edad, genero, actividad/estilo de vida, motivacion de compra.
4. **additionalInstructions** (max 200 caracteres): Directrices para el banner: tipo de persona/modelo, ambiente, 1-2 badges de texto, paleta de colores, "Sin tildes en textos del banner".

Ademas, genera 2 variantes alternativas para cada campo (total 3 opciones por campo).

# CADENA DE PENSAMIENTO (aplica SIEMPRE antes de escribir)
Antes de generar los textos, analiza internamente paso a paso:
1. IDENTIFICAR CATEGORIA: Que tipo de producto es? (salud, belleza, hogar, tecnologia, fitness, cocina, moda, mascotas, etc.)
2. EXTRAER INFORMACION: De las imagenes y/o texto, extraer: nombre, beneficios, ingredientes/materiales, precio si visible, marca
3. DETERMINAR PAIN POINTS: Que problema resuelve? Que frustracion tiene el comprador?
4. SELECCIONAR ANGULO: Que gancho emocional funciona mejor? (urgencia, transformacion, autoridad, comparacion, FOMO, prueba social)
5. DEFINIR AVATAR: Quien compra esto? Edad, genero, estilo de vida, motivacion
6. GENERAR TEXTOS: Escribir cada campo optimizado para VENTA

# FEW-SHOT: EJEMPLOS DE PRODUCTOS REALES

## Ejemplo 1 — Suplemento Testosterona
productDetails: "Potenciador natural de testosterona con Tribulus, Zinc y Maca. Aumenta energia, fuerza y rendimiento. 60 capsulas para 30 dias. Sin efectos secundarios. Resultados desde la semana 2."
salesAngle: "Potenciador de testosterona para hombres que quieren mas fuerza y energia sin quimicos"
targetAvatar: "Hombres 25-45 anos, van al gimnasio 3+ veces/semana, quieren mas masa muscular y energia"
additionalInstructions: "Hombre atletico en gimnasio. Colores oscuros masculinos. Badge RESULTADOS EN 14 DIAS. Sin tildes en textos del banner."

## Ejemplo 2 — Sarten Antiadherente
productDetails: "Sarten antiadherente ceramica premium 28cm. Cocina sin aceite, no se pega NADA. Mango ergonomico resistente al calor. Compatible con todas las estufas incluida induccion."
salesAngle: "Cocina sano sin aceite - la sarten que las chefs profesionales usan en casa"
targetAvatar: "Mujeres 30-55 anos, amas de casa que cocinan diario, quieren cocinar mas sano y facil"
additionalInstructions: "Senora cocinando en cocina moderna. Comida real viendose deliciosa. Badge ENVIO GRATIS. Colores calidos."

## Ejemplo 3 — Crema Facial Anti-edad
productDetails: "Crema facial con acido hialuronico, retinol y vitamina C. Reduce arrugas 67% en 28 dias comprobado. Hidratacion 24h. Textura ligera no grasa. 50ml rinde 2 meses."
salesAngle: "El secreto anti-edad de las dermatologas colombianas - resultados visibles en 4 semanas"
targetAvatar: "Mujeres 35-60 anos, preocupadas por arrugas y manchas, buscan alternativa a procedimientos caros"
additionalInstructions: "Mujer madura sonriendo, piel radiante. Ambiente spa. Badge 67% MENOS ARRUGAS. Sin tildes en textos del banner."

## Ejemplo 4 — Audifonos Bluetooth
productDetails: "Audifonos inalambricos Bluetooth 5.3 con cancelacion de ruido activa. Bateria 40 horas. Resistentes al agua IPX5. Sonido Hi-Fi con bajos profundos. Estuche de carga incluido."
salesAngle: "Sonido de $500.000 a precio de oferta - audifonos pro para tu dia a dia"
targetAvatar: "Jovenes 18-35 anos, escuchan musica y podcasts diario, van al gym o usan transporte publico"
additionalInstructions: "Persona joven con audifonos puestos disfrutando musica. Fondo urbano moderno. Badge 40H BATERIA. Sin tildes."

## Ejemplo 5 — Kit de Limpieza Hogar
productDetails: "Kit 5 en 1 limpieza profunda: desengrasante, multiusos, vidrios, banos y pisos. Formula concentrada rinde 3X mas. Aroma lavanda natural. Libre de quimicos toxicos."
salesAngle: "Una casa impecable en la mitad del tiempo - el kit que reemplaza 10 productos"
targetAvatar: "Mujeres 25-50 anos, amas de casa o profesionales, quieren limpiar rapido y efectivo sin toxicos"
additionalInstructions: "Mujer sonriente en sala limpia. Mostrar 5 productos juntos. Badge KIT COMPLETO. Colores verde/azul frescos."

# REGLAS OBLIGATORIAS

1. IDIOMA: Todo en ESPANOL latinoamericano. SIN TILDES (para evitar errores de renderizado en banners). Usar "mas" no "más", "facil" no "fácil".
2. FORMATO: Headlines cortos en MAYUSCULAS. Descripciones largas en minusculas normal.
3. LONGITUD: Respetar ESTRICTAMENTE los limites de caracteres de cada campo.
4. PALABRAS PODER segun contexto:
   - Urgencia: HOY, AHORA, ULTIMA OPORTUNIDAD, SOLO POR HOY, QUEDAN POCAS
   - Valor: GRATIS, OFERTA, DESCUENTO, 2X1, COMBO, AHORRA
   - Resultados: RESULTADOS, COMPROBADO, GARANTIZADO, FUNCIONA, TRANSFORMA
   - Confianza: GARANTIA, ENVIO GRATIS, PAGO CONTRAENTREGA, DEVOLUCION
   - Emocion: INCREIBLE, POTENTE, SECRETO, DESCUBRE
5. NUMEROS CONCRETOS siempre que sea posible: "67% menos arrugas" > "reduce arrugas", "en 14 dias" > "rapido".
6. BENEFICIOS > CARACTERISTICAS: "Cocina sin aceite" > "Antiadherente ceramico", "Piel 10 anos mas joven" > "Con acido hialuronico".
7. additionalInstructions SIEMPRE incluye: tipo persona/modelo, ambiente/escenario, 1-2 badges, paleta colores, "Sin tildes en textos del banner".
8. NUNCA textos genericos como "Producto de alta calidad" o "La mejor opcion del mercado". Cada texto debe ser ESPECIFICO al producto.
9. salesAngle debe incluir TRANSFORMACION o RESULTADO, no solo describir. "De cansado a imparable" no "Suplemento energetico".
10. targetAvatar ESPECIFICO: rango edad + genero + actividad + motivacion.

# CONTEXTO POR TIPO DE SECCION (si se proporciona sectionType)
- hero: Impacto visual, headline poderoso, producto prominente
- oferta: Precios, comparacion, badges descuento, urgencia maxima
- antes-despues: Transformacion, resultados con numeros, antes/despues visual
- beneficios: 3-4 iconos con beneficios especificos, layout limpio
- tabla-comparativa: Tu producto vs competencia generica, checkmarks
- prueba-autoridad: Certificaciones, estudios, endorsements
- testimonios: Quotes de clientes, ratings estrellas, fotos reales
- modo-uso: Pasos simples 1-2-3, instructivo visual
- logistica: Envio gratis, contraentrega, tiempos de entrega
- preguntas: FAQs comunes del nicho

# FORMATO DE RESPUESTA
Responde SOLO en JSON valido con esta estructura exacta:
{
  "productDetails": "string (max 500 chars, la MEJOR recomendacion)",
  "salesAngle": "string (max 150 chars)",
  "targetAvatar": "string (max 150 chars)",
  "additionalInstructions": "string (max 200 chars)",
  "variants": {
    "productDetails": ["string alternativa 1", "string alternativa 2"],
    "salesAngle": ["string alternativa 1", "string alternativa 2"],
    "targetAvatar": ["string alternativa 1", "string alternativa 2"],
    "additionalInstructions": ["string alternativa 1", "string alternativa 2"]
  }
}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const [header, data] = dataUrl.split(',')
  const mimeType = header.split(':')[1]?.split(';')[0] || 'image/jpeg'
  return { data, mimeType }
}

const COUNTRY_CONTEXT: Record<string, string> = {
  CO: 'Colombia — moneda COP, contraentrega popular, envio 2-5 dias habiles, Servientrega/Inter Rapidisimo',
  MX: 'Mexico — moneda MXN, envio 3-7 dias, pago contraentrega o Oxxo, Fedex/Estafeta',
  GT: 'Guatemala — moneda GTQ, envio 3-7 dias, contraentrega en zona metropolitana, Cargo Expreso',
  CL: 'Chile — moneda CLP, envio 2-5 dias, Chilexpress/Starken, transferencia o tarjeta',
  PE: 'Peru — moneda PEN, envio 3-7 dias, contraentrega en Lima, Olva Courier',
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { success } = aiLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      templateUrl,
      productPhotos,
      productName,
      sectionType,
      targetCountry,
      productContext,
    } = body as {
      templateUrl?: string
      productPhotos?: string[]
      productName?: string
      sectionType?: string
      targetCountry?: string
      productContext?: {
        description?: string
        benefits?: string
        problems?: string
        ingredients?: string
        differentiator?: string
      }
    }

    // Get user's API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google' }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)

    // Build multimodal parts
    const parts: any[] = []

    // Add template image
    if (templateUrl) {
      const parsed = parseDataUrl(templateUrl)
      if (parsed) {
        parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } })
      }
    }

    // Add product photos
    if (productPhotos) {
      for (const photo of productPhotos) {
        if (photo) {
          const parsed = parseDataUrl(photo)
          if (parsed) {
            parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } })
          }
        }
      }
    }

    // Build user prompt with all context
    const promptLines: string[] = []
    promptLines.push(`Producto: ${productName || 'Analiza las imagenes para identificar el producto'}`)

    if (templateUrl) {
      promptLines.push('Imagen 1: Plantilla de diseno del banner (referencia de estilo visual)')
    }
    if (productPhotos?.length) {
      promptLines.push(`Imagenes del producto: ${productPhotos.length} foto(s) — analiza empaques, textos visibles, ingredientes, marca, beneficios impresos`)
    }
    if (sectionType) {
      promptLines.push(`Tipo de seccion del banner: ${sectionType} — adapta additionalInstructions a este tipo`)
    }
    if (targetCountry && COUNTRY_CONTEXT[targetCountry]) {
      promptLines.push(`Pais destino: ${COUNTRY_CONTEXT[targetCountry]}`)
    }

    if (productContext) {
      if (productContext.description) promptLines.push(`Descripcion del producto: ${productContext.description}`)
      if (productContext.benefits) promptLines.push(`Beneficios: ${productContext.benefits}`)
      if (productContext.problems) promptLines.push(`Problemas que resuelve: ${productContext.problems}`)
      if (productContext.ingredients) promptLines.push(`Ingredientes/materiales: ${productContext.ingredients}`)
      if (productContext.differentiator) promptLines.push(`Diferenciador: ${productContext.differentiator}`)
    }

    promptLines.push('')
    promptLines.push('Genera los 4 Controles Creativos optimizados para VENTA + 2 variantes alternativas por campo, en JSON.')

    parts.push({ text: promptLines.join('\n') })

    // Try Gemini 2.5 Pro first, fallback to 2.0 Flash
    const models = [
      'gemini-2.5-pro-preview-06-05',
      'gemini-2.0-flash',
    ]

    let lastError: string = ''

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        const response = await fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: ENHANCE_SYSTEM_PROMPT }] },
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.8,
            },
          }),
        })

        if (!response.ok) {
          const errBody = await response.text()
          console.error(`[EnhancePrompt] ${model} failed (${response.status}):`, errBody.substring(0, 300))
          lastError = `${model}: ${response.status}`
          continue
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        const suggestions = JSON.parse(text)

        console.log(`[EnhancePrompt] User: ${user.id.substring(0, 8)}..., Model: ${model}, Product: ${productName || 'images-only'}`)

        return NextResponse.json({ success: true, suggestions })
      } catch (modelError: any) {
        console.error(`[EnhancePrompt] ${model} error:`, modelError.message)
        lastError = modelError.message
        continue
      }
    }

    // Both models failed
    return NextResponse.json({ error: `Error al generar sugerencias: ${lastError}` }, { status: 500 })

  } catch (error: any) {
    console.error('[EnhancePrompt] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar sugerencias' }, { status: 500 })
  }
}
