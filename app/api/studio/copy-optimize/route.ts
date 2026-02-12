import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const COPY_OPTIMIZER_SYSTEM_PROMPT = `Eres un equipo de 3 especialistas de copywriting de respuesta directa para e-commerce y dropshipping en Latinoamérica.

## TU MÉTODO (Cadena de 3 especialistas):

### Especialista 1: Estratega de Producto
- Analiza el producto, público objetivo, competencia implícita
- Identifica la emoción principal: miedo, deseo, urgencia, curiosidad
- Define las objeciones principales del cliente
- Identifica el "lenguaje del cliente" — cómo habla tu público

### Especialista 2: Redactor Publicitario
- Usa números específicos en headlines (no "muchos", sino "3 de cada 5")
- Cada bullet es un BENEFICIO, no una característica
- El headline ataca el PROBLEMA, no describe el producto
- CTA en primera persona ("Quiero...", "Necesito...", "Dame...")
- Máximo 3 oraciones por párrafo
- NO uses: "revolucionario", "increíble", "único", "el mejor"
- SÍ usa: cifras, tiempo específico, resultado medible

### Especialista 3: Editor Crítico
- Revisa que cada sección tenga un propósito claro
- Elimina frases que no aportan nada
- Verifica que la emoción sea consistente
- Asegura que las restricciones se cumplan

## REGLAS DE COPY PARA LATAM DROPSHIPPING:
1. Contraentrega = CONFIANZA. Mencionarlo siempre: "Paga al recibir"
2. Envío gratis = OBLIGATORIO mencionarlo si aplica
3. WhatsApp = canal de confianza. Incluir CTA de WhatsApp
4. Precio en moneda local sin decimales
5. Urgencia real, no falsa: "Últimas X unidades" o "Precio válido esta semana"
6. Testimonios estilo: "María de Bogotá lo probó y..."
7. Garantía de satisfacción visible

## FORMATO DE OUTPUT (3 variantes con enfoque diferente):
- Variante 1: URGENCIA + NÚMEROS (cifras específicas, escasez)
- Variante 2: HISTORIA + EMOCIÓN (narrativa, identificación)
- Variante 3: AUTORIDAD + PRUEBA SOCIAL (testimonios, datos)

Responde SOLO en JSON válido con esta estructura exacta:
{
  "variants": [
    {
      "label": "string",
      "headline": "string",
      "sub_headline": "string",
      "bullets": ["string"],
      "cta_primary": "string",
      "cta_whatsapp": "string",
      "short_ad_copy": "string (max 125 chars para ads)",
      "ad_headline": "string (max 40 chars)"
    }
  ],
  "analysis": "string (análisis breve del texto original si fue proporcionado)"
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
      price,
      currency = 'COP',
      current_text,
      problem_solved,
      target_audience,
      tone = 'urgente',
    } = body as {
      product_name: string
      price?: number
      currency?: string
      current_text?: string
      problem_solved?: string
      target_audience?: string
      tone?: string
    }

    if (!product_name) {
      return NextResponse.json(
        { error: 'El nombre del producto es requerido' },
        { status: 400 }
      )
    }

    // Get user's Google API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de Google en Settings para usar el optimizador de copy',
      }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      systemInstruction: COPY_OPTIMIZER_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    })

    // Build the user prompt
    const parts: string[] = [
      `Producto: ${product_name}`,
    ]
    if (price) parts.push(`Precio: ${new Intl.NumberFormat('es-CO', { style: 'decimal', maximumFractionDigits: 0 }).format(price)} ${currency}`)
    if (target_audience) parts.push(`Público objetivo: ${target_audience}`)
    if (problem_solved) parts.push(`Problema que resuelve: ${problem_solved}`)
    if (tone) parts.push(`Tono deseado: ${tone}`)
    if (current_text) parts.push(`\nTexto actual de la landing:\n"""${current_text}"""`)

    const userPrompt = parts.join('\n')

    console.log(`[CopyOptimizer] User: ${user.id.substring(0, 8)}..., Product: ${product_name}`)

    const result = await model.generateContent(userPrompt)
    const responseText = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch {
      console.error('[CopyOptimizer] Failed to parse JSON:', responseText.substring(0, 500))
      return NextResponse.json({
        error: 'Error al procesar la respuesta de la IA. Intenta de nuevo.',
      }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[CopyOptimizer] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al optimizar copy',
    }, { status: 500 })
  }
}
