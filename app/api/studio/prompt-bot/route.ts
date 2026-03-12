import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON } from '@/lib/services/ai-text'

export const maxDuration = 120

const BOT_PROMPT_SYSTEM = `Eres el mejor ingeniero de prompts conversacionales del mundo para bots de ventas por WhatsApp en Latinoamerica, especializado en dropshipping COD (contraentrega).

Tu mision: generar un PROMPT CONVERSACIONAL COMPLETO, listo para copiar y pegar en Chatea Pro, Lucid, o cualquier plataforma de chatbot. El prompt que generes debe lograr que el bot sea TAN HUMANO que el cliente no se de cuenta que habla con una IA.

## PRINCIPIOS DE PROMPT ENGINEERING QUE APLICAS (Google + IBM + Andrew NG):
1. CLARIDAD y ESPECIFICIDAD extrema — cada instruccion es precisa, sin ambiguedades
2. CONTEXTO COMPLETO — el bot sabe todo sobre el producto, audiencia y negocio
3. FEW-SHOT PROMPTING — incluyes ejemplos reales de como responder
4. CADENA DE PENSAMIENTO — el guion lleva una secuencia logica de venta
5. RESTRICCIONES — formato WhatsApp (negrilla con *texto* NO **texto**), respuestas cortas, maximo 80 tokens

## ESTRUCTURA OBLIGATORIA DEL PROMPT (basada en la estructura Chatea Pro avanzada):

### ETAPA CONTEXTUAL
- Seccion 1: CONTEXTUALIZACION — nombre del asesor, rol especifico (ej: "experta en cuidado de la piel con 8 anos de experiencia"), proposito, audiencia objetivo (buyer persona), adaptacion del lenguaje regional, expresiones humanas permitidas
- Seccion 2: FICHA TECNICA — nombre producto, precios con TODAS las ofertas (1 unidad, 2 unidades, 3 unidades...), caracteristicas, beneficios, envio (gratis/contraentrega), garantia, colores/tallas si aplica

### ETAPA CONVERSACIONAL (guion de ventas por interacciones numeradas)
- Interaccion 1: Saludo calido + pregunta enganche emocional (esta misma pregunta debe conectar con el mensaje de bienvenida)
- Interaccion 2: Identificar necesidad con empatia, tocar PUNTO DE DOLOR real
- Interaccion 3: [Enviar imagen/video del producto] + presentar beneficio principal
- Interaccion 4: [Enviar foto de resenas] + prueba social con testimonios reales
- Interaccion 5: Presentar oferta con precios y crear urgencia natural
- Interaccion 6: Solicitar datos de envio (nombre, ciudad, direccion, telefono)
- Interaccion 7: Confirmacion y cierre calido

### POSIBLES SITUACIONES
- Si pregunta por precio → no dar precio directo, primero generar valor
- Si pregunta por garantia → responder con confianza y seguridad
- Si dice que es caro → tocar punto de dolor, comparar con costo de NO solucionar
- Si pide tiempo para pensar → crear urgencia suave con escasez
- Si pregunta por colores/tallas → [enviar imagen catalogo]
- Si ya compro antes → tratarlo como VIP, ofrecer descuento especial

### ETAPA DE REGLAS
- [IMPORTANTE] No solicitar datos que el cliente ya proporciono
- [IMPORTANTE] Respuestas cortas y concisas, maximo 2-3 oraciones por mensaje
- [IMPORTANTE] Negrilla con *texto* (un asterisco), NUNCA **texto** (doble asterisco)
- [IMPORTANTE] Siempre terminar mensajes con pregunta para mantener la conversacion
- [IMPORTANTE] Ser empatico, cercano, usar lenguaje coloquial del pais
- [IMPORTANTE] Enviar imagenes/videos en momentos estrategicos (interacciones 3 y 4)
- [IMPORTANTE] NO inventar informacion que no este en la ficha tecnica
- [IMPORTANTE] Si el cliente pregunta algo que no sabes, escalar a humano

## DATOS DE AMAZON REVIEWS (si se proporcionan):
Cuando recibas un analisis de reviews de Amazon, DEBES usar esa informacion para:
- Los PUNTOS DE DOLOR del guion deben ser los problemas REALES que mencionan los clientes
- Las OBJECIONES deben basarse en las quejas reales de reviews negativas
- Los BENEFICIOS destacados deben ser los que mas valoran en reviews positivas
- Las FAQ deben cubrir las preguntas reales que hacen los compradores
- Los TESTIMONIOS/PRUEBA SOCIAL deben reflejar el sentimiento real de los compradores

## FORMATO DE RESPUESTA:
Responde SOLO en JSON valido con esta estructura:
{
  "prompt_completo": "string — el prompt COMPLETO listo para copiar a Chatea Pro/Lucid. Debe incluir TODA la estructura: etapa contextual + ficha tecnica + etapa conversacional con interacciones numeradas + posibles situaciones + reglas. Usar ## para secciones, ### para subsecciones, - para bullets, [corchetes] para instrucciones al bot, *asteriscos* para negrilla WhatsApp, comillas para texto literal. MINIMO 3000 caracteres.",
  "welcome_message": "string — mensaje de bienvenida corto y calido, con emoji moderado, que termine con la misma pregunta de la interaccion 1",
  "analysis": {
    "pain_points": ["string — puntos de dolor identificados (de Amazon o inferidos)"],
    "sales_angles": ["string — angulos de venta mas efectivos"],
    "common_questions": ["string — preguntas frecuentes de clientes"],
    "objection_handlers": [{"objection": "string", "response": "string"}]
  }
}`

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

    const body = await request.json()
    const {
      product_name,
      product_benefits,
      pricing_tiers,
      agent_name,
      tone = 'amigable',
      bot_platform = 'whatsapp',
      country = 'Colombia',
      business_name,
      shipping_info,
      guarantee,
      existing_prompt,
      amazon_reviews,
    } = body as {
      product_name: string
      product_benefits?: string
      pricing_tiers?: string
      agent_name?: string
      tone?: string
      bot_platform?: string
      country?: string
      business_name?: string
      shipping_info?: string
      guarantee?: string
      existing_prompt?: string
      amazon_reviews?: {
        total_reviews: number
        avg_rating: string
        reviews: Array<{
          title: string
          content: string
          rating: number
          verified: boolean
          helpful: number
        }>
      }
    }

    if (!product_name?.trim()) {
      return NextResponse.json(
        { error: 'El nombre del producto es requerido' },
        { status: 400 }
      )
    }

    const keys = await getAIKeys(supabase, user.id)
    requireAIKeys(keys)

    // Build the user prompt with all context
    const parts: string[] = []

    parts.push(`## PRODUCTO: ${product_name}`)
    if (agent_name) parts.push(`## NOMBRE DEL AGENTE VENDEDOR: ${agent_name}`)
    parts.push(`## PLATAFORMA: ${bot_platform}`)
    parts.push(`## PAIS: ${country}`)
    parts.push(`## TONO: ${tone}`)

    if (business_name) parts.push(`## NEGOCIO: ${business_name}`)
    if (product_benefits) parts.push(`## BENEFICIOS:\n${product_benefits}`)
    if (pricing_tiers) parts.push(`## PRECIOS Y OFERTAS:\n${pricing_tiers}`)
    if (shipping_info) parts.push(`## ENVIO: ${shipping_info}`)
    if (guarantee) parts.push(`## GARANTIA: ${guarantee}`)

    if (existing_prompt) {
      parts.push(`\n## PROMPT EXISTENTE (de Chatea Pro o Lucid) — MEJORALO con la estructura avanzada:\n${existing_prompt}`)
    }

    // Add Amazon reviews analysis if available
    if (amazon_reviews && amazon_reviews.reviews && amazon_reviews.reviews.length > 0) {
      const positiveReviews = amazon_reviews.reviews
        .filter(r => r.rating >= 4)
        .sort((a, b) => b.helpful - a.helpful)
        .slice(0, 15)

      const negativeReviews = amazon_reviews.reviews
        .filter(r => r.rating <= 2)
        .sort((a, b) => b.helpful - a.helpful)
        .slice(0, 10)

      const midReviews = amazon_reviews.reviews
        .filter(r => r.rating === 3)
        .slice(0, 5)

      parts.push(`\n## ANALISIS DE ${amazon_reviews.total_reviews} REVIEWS DE AMAZON (Rating promedio: ${amazon_reviews.avg_rating}/5)`)

      if (positiveReviews.length > 0) {
        parts.push(`\n### REVIEWS POSITIVAS (lo que mas valoran los clientes):`)
        positiveReviews.forEach((r, i) => {
          parts.push(`${i + 1}. [${r.rating}★${r.verified ? ' ✓Verificada' : ''}] "${r.title}" — ${r.content.substring(0, 300)}`)
        })
      }

      if (negativeReviews.length > 0) {
        parts.push(`\n### REVIEWS NEGATIVAS (objeciones y problemas reales):`)
        negativeReviews.forEach((r, i) => {
          parts.push(`${i + 1}. [${r.rating}★${r.verified ? ' ✓Verificada' : ''}] "${r.title}" — ${r.content.substring(0, 300)}`)
        })
      }

      if (midReviews.length > 0) {
        parts.push(`\n### REVIEWS MEDIAS (dudas comunes):`)
        midReviews.forEach((r, i) => {
          parts.push(`${i + 1}. [${r.rating}★] "${r.title}" — ${r.content.substring(0, 200)}`)
        })
      }

      parts.push(`\nUSA ESTA INFORMACION REAL DE AMAZON para construir los puntos de dolor, angulos de venta, objeciones y FAQ del prompt. Los clientes reales ya te dijeron que les importa.`)
    }

    const userPrompt = parts.join('\n')

    console.log(`[PromptBot] User: ${user.id.substring(0, 8)}..., Product: ${product_name}, Agent: ${agent_name || 'auto'}, Reviews: ${amazon_reviews?.total_reviews || 0}`)

    const responseText = await generateAIText(keys, {
      systemPrompt: BOT_PROMPT_SYSTEM,
      userMessage: userPrompt,
      temperature: 0.7,
      jsonMode: true,
      skipKIE: true,
      googleModel: 'gemini-3.1-pro-preview',
    })

    let parsed: any
    try {
      parsed = JSON.parse(extractJSON(responseText))
    } catch {
      console.error('[PromptBot] Failed to parse JSON:', responseText.substring(0, 500))
      return NextResponse.json({
        error: 'Error al procesar la respuesta. Intenta de nuevo.',
      }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[PromptBot] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al generar prompt de bot',
    }, { status: 500 })
  }
}
