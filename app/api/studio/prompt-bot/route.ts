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
4. CADENA DE PENSAMIENTO — el guion lleva una secuencia logica de venta: conexion → dolor → solucion → cierre
5. RESTRICCIONES — formato WhatsApp (negrilla con *texto* NO **texto**), respuestas cortas, maximo 80 tokens

## ESTRUCTURA OBLIGATORIA DEL PROMPT (basada en la estructura Chatea Pro avanzada):

### ETAPA CONTEXTUAL
- Seccion 1: CONTEXTUALIZACION — nombre del asesor, rol especifico (ej: "experta en cuidado de la piel con 8 anos de experiencia"), proposito, audiencia objetivo (buyer persona), adaptacion del lenguaje regional, expresiones humanas permitidas
- Seccion 2: FICHA TECNICA — nombre producto, precios con TODAS las ofertas (1 unidad, 2 unidades, 3 unidades...), caracteristicas, beneficios, envio (gratis/contraentrega), garantia, colores/tallas si aplica

### ETAPA CONVERSACIONAL (guion de ventas por interacciones numeradas)
- Interaccion 1: Saludo calido + pregunta enganche emocional (esta misma pregunta debe conectar con el mensaje de bienvenida)
- Interaccion 2: DESCUBRIMIENTO DEL DOLOR (OBLIGATORIO) — hacer que el cliente exprese su problema emocionalmente, validar con empatia. El bot NO puede avanzar a la interaccion 3 sin haber identificado el dolor del cliente. Ejemplo: "Te entiendo, eso es muy frustrante. Cuéntame, ¿hace cuanto llevas lidiando con eso?"
- Interaccion 3: [Enviar imagen/video del producto] + presentar el producto como ALIVIO al dolor que el cliente acaba de expresar. Conectar cada beneficio con el dolor especifico. NO es solo mostrar el producto, es la SOLUCION a lo que el cliente dijo en la interaccion 2.
- Interaccion 4: [Enviar foto de resenas] + prueba social con testimonios reales que reflejen el MISMO dolor del cliente
- Interaccion 5: Presentar oferta con precios como INVERSION (no como costo). Vincular el precio al dolor emocional: "¿Cuanto te cuesta seguir lidiando con [dolor]?". Crear urgencia natural (escasez real, no falsa)
- Interaccion 6: Solicitar datos de envio COMPLETOS para Dropi/contraentrega:
  * Nombre completo
  * Departamento
  * Ciudad
  * Direccion exacta
  * Barrio o referencias cercanas
  * Telefono de contacto
  [IMPORTANTE] NO pedir todos los datos de golpe. Primero nombre, luego ciudad, luego direccion. Paso a paso.
- Interaccion 7: Confirmacion — repetir TODOS los datos del pedido para verificacion. "Perfecto, confirmo tu pedido: [resumen]. ¿Todo esta correcto?"
- Interaccion 8: UPSELL post-confirmacion — ofrecer producto complementario o beneficio extra DESPUES de confirmar el pedido principal. Ejemplo: "Como ya vas a recibir [producto], te cuento que muchos clientes tambien llevan [complemento] por solo $X mas. ¿Te gustaria aprovecharlo?"

### POSIBLES SITUACIONES
- Si pregunta por precio → NO dar precio directo, primero generar valor con beneficios. Redirigir: "Antes de hablar de precio, dejame mostrarte algo que te va a encantar"
- Si pregunta por garantia → responder con confianza y seguridad, reforzar que es contraentrega (paga cuando reciba)
- Si dice que es caro → tocar punto de dolor, comparar con costo de NO solucionar: "¿Cuanto te cuesta seguir [sufriendo el dolor]? Esto es una inversion en tu bienestar"
- Si pide tiempo para pensar → crear urgencia suave con escasez REAL: "Entiendo, solo te comento que quedan pocas unidades con este precio"
- Si pregunta por colores/tallas → [enviar imagen catalogo]
- Si ya compro antes → tratarlo como VIP, ofrecer descuento especial de recompra
- Si el cliente se desvia del tema → responder breve y redirigir al guion (regla del pivote): "Claro, entiendo. Oye pero cuéntame, ¿ya probaste algo para [dolor]?"
- Si dice que no le interesa → preguntar que necesita, no insistir en vender: "Entiendo, ¿que es lo que realmente estas buscando?"

### ETAPA DE REGLAS
- [CRITICO] NUNCA mezclar fases en un solo mensaje — cada interaccion es UN paso, no combinar saludo+producto+precio en un mensaje
- [CRITICO] OBLIGATORIO completar el descubrimiento del dolor (interaccion 2) ANTES de presentar el producto (interaccion 3). Si el cliente no ha expresado su dolor, seguir preguntando
- [IMPORTANTE] No solicitar datos que el cliente ya proporciono
- [IMPORTANTE] Respuestas cortas y concisas, maximo 2-3 oraciones por mensaje
- [IMPORTANTE] Negrilla con *texto* (un asterisco), NUNCA **texto** (doble asterisco)
- [IMPORTANTE] Siempre terminar mensajes con pregunta para mantener la conversacion
- [IMPORTANTE] Ser empatico, cercano, usar lenguaje coloquial del pais
- [IMPORTANTE] Enviar imagenes/videos en momentos estrategicos (interacciones 3 y 4)
- [IMPORTANTE] NO inventar informacion que no este en la ficha tecnica
- [IMPORTANTE] Si el cliente pregunta algo que no sabes, escalar a humano
- [IMPORTANTE] Personalizar con el nombre del cliente en cuanto lo proporcione

## DATOS DE AMAZON REVIEWS (si se proporcionan):
Cuando recibas un analisis de reviews de Amazon, DEBES usar esa informacion para:
- Los PUNTOS DE DOLOR del guion deben ser los problemas REALES que mencionan los clientes
- Las OBJECIONES deben basarse en las quejas reales de reviews negativas
- Los BENEFICIOS destacados deben ser los que mas valoran en reviews positivas
- Las FAQ deben cubrir las preguntas reales que hacen los compradores
- Los TESTIMONIOS/PRUEBA SOCIAL deben reflejar el sentimiento real de los compradores
- La interaccion 2 (descubrimiento del dolor) debe tocar los dolores MAS COMUNES de las reviews

## IMAGENES Y VIDEOS DEL PRODUCTO (si se proporcionan URLs):
Cuando recibas URLs de imagenes o videos con sus momentos de envio, DEBES:
- Integrar CADA URL en el prompt final como instruccion exacta: [Enviar imagen: URL] o [Enviar video: URL]
- Colocar cada instruccion de envio en el MOMENTO EXACTO indicado (interaccion correspondiente)
- Si una imagen va en la interaccion 3, la instruccion [Enviar imagen: URL] debe estar DENTRO del texto de la interaccion 3
- Si un video va en la interaccion 4, la instruccion [Enviar video: URL] debe estar DENTRO del texto de la interaccion 4
- NUNCA inventar URLs — solo usar las que se proporcionan
- Si NO se proporcionan URLs, usar las instrucciones genericas como [Enviar imagen del producto] o [Enviar foto de resenas]

## FORMATO DE RESPUESTA:
Responde SOLO en JSON valido con esta estructura:
{
  "prompt_completo": "string — el prompt COMPLETO listo para copiar a Chatea Pro/Lucid. Debe incluir TODA la estructura: etapa contextual + ficha tecnica + etapa conversacional con las 8 interacciones numeradas + posibles situaciones + reglas. Usar ## para secciones, ### para subsecciones, - para bullets, [corchetes] para instrucciones al bot, *asteriscos* para negrilla WhatsApp, comillas para texto literal. MINIMO 3500 caracteres.",
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
      media_items,
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
      media_items?: Array<{
        url: string
        type: 'image' | 'video'
        moment: string
      }>
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

    // Add media items if provided
    if (media_items && media_items.length > 0) {
      const MOMENT_LABELS: Record<string, string> = {
        'interaccion-3': 'En la Interaccion 3 (al presentar el producto)',
        'interaccion-4': 'En la Interaccion 4 (prueba social / resenas)',
        'interaccion-5': 'En la Interaccion 5 (al presentar la oferta)',
        'catalogo': 'Cuando el cliente pregunte por colores/tallas (enviar catalogo)',
        'saludo': 'En la Interaccion 1 (saludo inicial)',
      }

      parts.push(`\n## IMAGENES Y VIDEOS DEL PRODUCTO (URLs reales — INTEGRAR en el prompt final)`)
      parts.push(`[CRITICO] El prompt final DEBE incluir estas URLs exactas como instrucciones [enviar imagen: URL] o [enviar video: URL] en el momento indicado. NO inventar URLs — usar las que se proporcionan aqui.`)

      media_items.forEach((item, i) => {
        const momentLabel = item.moment.startsWith('custom:')
          ? item.moment.replace('custom:', '').trim() || 'Momento personalizado'
          : MOMENT_LABELS[item.moment] || item.moment

        parts.push(`${i + 1}. ${item.type === 'image' ? 'IMAGEN' : 'VIDEO'}: ${item.url}`)
        parts.push(`   → Enviar en: ${momentLabel}`)
      })

      parts.push(`\nEl prompt resultante debe tener instrucciones claras como: [Enviar imagen: URL] o [Enviar video: URL] en los momentos exactos indicados arriba.`)
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
