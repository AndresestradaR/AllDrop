import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiLimiter, getClientIp } from '@/lib/rate-limit'
import { getAIKeys, requireAIKeys, generateAIText, extractJSON, type AIImageInput } from '@/lib/services/ai-text'

export const maxDuration = 120

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const [header, data] = dataUrl.split(',')
  const mimeType = header.split(':')[1]?.split(';')[0] || 'image/jpeg'
  return { data, mimeType }
}

const COUNTRY_CONTEXT: Record<string, string> = {
  CO: 'Colombia — moneda COP, pago contraentrega popular, envio 2-5 dias',
  MX: 'Mexico — moneda MXN, pago contra entrega u Oxxo, envio 3-7 dias',
  GT: 'Guatemala — moneda GTQ, contraentrega en zona metropolitana',
  CL: 'Chile — moneda CLP, envio 2-5 dias, transferencia o tarjeta',
  PE: 'Peru — moneda PEN, contraentrega en Lima, envio 3-7 dias',
  EC: 'Ecuador — moneda USD, envio 3-7 dias',
  PA: 'Panama — moneda USD, envio 3-7 dias',
  PY: 'Paraguay — moneda PYG, envio 3-7 dias',
  AR: 'Argentina — moneda ARS, envio 3-7 dias',
  ES: 'Espana — moneda EUR, envio 2-5 dias',
}

const ANGLES_SYSTEM_PROMPT = `# ROL
Eres un estratega de marketing senior especializado en dropshipping COD para Latinoamerica. Dominas las tecnicas de Eugene Schwartz (niveles de consciencia), David Ogilvy (headlines que venden) y Russell Brunson (funnels y angulos).

Tu trabajo es generar ANGULOS DE VENTA diversificados para un producto. Cada angulo es una perspectiva diferente para vender el MISMO producto a DIFERENTES tipos de compradores o con DIFERENTES motivaciones.

# QUE ES UN ANGULO DE VENTA
Un angulo es la PERSPECTIVA o ENFOQUE desde el cual presentas el producto. El mismo suplemento de magnesio puede venderse como:
- Angulo DOLOR: "Deja de sufrir calambres nocturnos"
- Angulo RENDIMIENTO: "Duplica tu energia en el gym"
- Angulo CIENCIA: "El mineral que el 80% de latinos no consume"
- Angulo COMPARACION: "Mejor que cualquier multivitaminico"
- Angulo MIEDO: "La deficiencia silenciosa que envejece tu cuerpo"
- Angulo ASPIRACIONAL: "El secreto de los atletas olimpicos"

# TIPOS DE ANGULO (genera variedad de estos)
1. TRANSFORMACION: Antes/despues, resultado visible, cambio de vida
2. DOLOR/PROBLEMA: Agitar el dolor, mostrar la solucion
3. AUTORIDAD/CIENCIA: Datos, estudios, ingredientes, respaldo profesional
4. URGENCIA/ESCASEZ: Oferta limitada, stock agotandose, solo hoy
5. COMPARACION: Mejor que alternativas, reemplaza X productos
6. ASPIRACIONAL: Lifestyle, como se ven las personas exitosas
7. SOCIAL PROOF: Testimonios, reviews, miles de clientes satisfechos
8. CURIOSIDAD: Secreto revelado, lo que nadie te cuenta, descubre por que

# CADENA DE PENSAMIENTO
1. Analizar producto: que es, beneficios, ingredientes, publico natural
2. Identificar MULTIPLES dolores/deseos que resuelve
3. Para cada dolor/deseo, crear un angulo unico con gancho diferente
4. Asegurar que cada angulo apunta a un AVATAR diferente o motivacion diferente
5. Escribir hooks que generen CURIOSIDAD y CLICK

# REGLAS
- Generar EXACTAMENTE 6 angulos diversificados
- Cada angulo debe ser SUFICIENTEMENTE DIFERENTE del resto
- Los hooks deben ser cortos (max 80 chars), impactantes, en espanol
- SIN TILDES en los hooks y salesAngle (para banners)
- El salesAngle es la version larga del hook (max 150 chars)
- El avatarSuggestion debe ser ESPECIFICO: edad, genero, actividad, motivacion
- El tone debe ser UNA palabra: Urgente, Aspiracional, Cientifico, Emocional, Provocador, Educativo

# FORMATO DE RESPUESTA
JSON valido con esta estructura:
{
  "angles": [
    {
      "id": "angle-1",
      "name": "Nombre corto del angulo (3-5 palabras)",
      "hook": "El gancho principal en max 80 chars SIN TILDES",
      "description": "Descripcion de la estrategia del angulo en 1-2 oraciones",
      "avatarSuggestion": "Perfil especifico: genero, edad, actividad, motivacion",
      "tone": "Urgente|Aspiracional|Cientifico|Emocional|Provocador|Educativo",
      "salesAngle": "Version expandida del hook para el prompt del banner, max 150 chars SIN TILDES"
    }
  ]
}`

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
      productName,
      productPhotos,
      productContext,
      targetCountry,
    } = body as {
      productName?: string
      productPhotos?: string[]
      productContext?: {
        description?: string
        benefits?: string
        problems?: string
        ingredients?: string
        differentiator?: string
      }
      targetCountry?: string
    }

    // Get API keys (KIE primary, Google fallback)
    const aiKeys = await getAIKeys(supabase, user.id)
    try {
      requireAIKeys(aiKeys)
    } catch {
      return NextResponse.json({ error: 'Configura tu API key de KIE o Google en Settings' }, { status: 400 })
    }

    // Build images array for multimodal
    const images: AIImageInput[] = []
    if (productPhotos) {
      for (const photo of productPhotos) {
        if (photo) {
          const parsed = parseDataUrl(photo)
          if (parsed) {
            images.push({ mimeType: parsed.mimeType, base64: parsed.data })
          }
        }
      }
    }

    // Build the user prompt with all available context
    const promptLines: string[] = []

    promptLines.push(`PRODUCTO: ${productName || 'Analiza las imagenes para identificar el producto'}`)

    if (productPhotos?.length) {
      promptLines.push(`\nIMAGENES: ${productPhotos.length} foto(s) del producto — analiza empaques, textos visibles, ingredientes, marca, beneficios impresos`)
    }

    if (productContext) {
      if (productContext.description) {
        promptLines.push(`\nDESCRIPCION: ${productContext.description}`)
      }
      if (productContext.benefits) {
        promptLines.push(`\nBENEFICIOS: ${productContext.benefits}`)
      }
      if (productContext.problems) {
        promptLines.push(`\nPROBLEMAS QUE RESUELVE: ${productContext.problems}`)
      }
      if (productContext.ingredients) {
        promptLines.push(`\nINGREDIENTES/MATERIALES: ${productContext.ingredients}`)
      }
      if (productContext.differentiator) {
        promptLines.push(`\nDIFERENCIADOR: ${productContext.differentiator}`)
      }
    }

    if (targetCountry && COUNTRY_CONTEXT[targetCountry]) {
      promptLines.push(`\nPAIS DESTINO: ${COUNTRY_CONTEXT[targetCountry]}`)
    }

    promptLines.push('\nGenera 6 angulos de venta diversificados en JSON.')

    try {
      const raw = await generateAIText(aiKeys, {
        systemPrompt: ANGLES_SYSTEM_PROMPT,
        userMessage: promptLines.join('\n'),
        images: images.length > 0 ? images : undefined,
        temperature: 0.9,
        jsonMode: true,
        reasoningEffort: 'low',
      })

      const cleaned = extractJSON(raw)
      console.log(`[GenerateAngles] Raw AI response (first 500 chars): ${cleaned.substring(0, 500)}`)
      const result = JSON.parse(cleaned)

      // Robust: accept "angles", "angulos", or a top-level array
      const angles = result.angles || result.angulos || (Array.isArray(result) ? result : null)

      console.log(`[GenerateAngles] User: ${user.id.substring(0, 8)}..., Product: ${productName}, Angles: ${angles?.length || 0}, Keys: ${Object.keys(result).join(',')}`)

      if (!angles || angles.length === 0) {
        console.error(`[GenerateAngles] No angles found. Full response: ${cleaned.substring(0, 1000)}`)
        return NextResponse.json({ error: 'No se generaron ángulos. Intenta de nuevo.' }, { status: 500 })
      }

      return NextResponse.json({ success: true, angles })
    } catch (aiError: any) {
      return NextResponse.json({ error: `Error al generar angulos: ${aiError.message}` }, { status: 500 })
    }

  } catch (error: any) {
    console.error('[GenerateAngles] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar angulos' }, { status: 500 })
  }
}
