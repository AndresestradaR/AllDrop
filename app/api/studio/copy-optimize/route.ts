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
      "label": "string (nombre del enfoque)",
      "headline": "string",
      "sub_headline": "string",
      "description": "string (párrafo de 2-3 oraciones describiendo el producto y su beneficio principal)",
      "bullets": ["string (5-7 bullets de beneficios)"],
      "objections": ["string (3-4 respuestas a objeciones comunes)"],
      "guarantee": "string (texto de garantía de satisfacción)",
      "cta_primary": "string",
      "cta_whatsapp": "string",
      "short_ad_copy": "string (max 125 chars para ads)",
      "ad_headline": "string (max 40 chars)"
    }
  ],
  "analysis": "string (análisis breve del producto/texto original)"
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
      mode = 'from_scratch',
      product_id,
      product_name,
      price,
      currency = 'COP',
      current_text,
      problem_solved,
      target_audience,
      tone = 'urgente',
    } = body as {
      mode?: 'from_landing' | 'from_scratch'
      product_id?: string
      product_name?: string
      price?: number
      currency?: string
      current_text?: string
      problem_solved?: string
      target_audience?: string
      tone?: string
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

    let resolvedProductName = product_name
    let resolvedDescription = ''

    // For from_landing mode, fetch product info
    if (mode === 'from_landing') {
      if (!product_id) {
        return NextResponse.json(
          { error: 'Selecciona una landing' },
          { status: 400 }
        )
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, description')
        .eq('id', product_id)
        .eq('user_id', user.id)
        .single()

      if (productError || !product) {
        return NextResponse.json(
          { error: 'Landing no encontrada' },
          { status: 404 }
        )
      }

      resolvedProductName = product.name
      resolvedDescription = product.description || ''

      // Get template categories used for this product
      const { data: sections } = await supabase
        .from('landing_sections')
        .select('template:templates(category, name)')
        .eq('product_id', product_id)
        .eq('user_id', user.id)

      if (sections && sections.length > 0) {
        const categories = sections
          .map((s: any) => s.template?.category)
          .filter(Boolean)
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)

        if (categories.length > 0) {
          resolvedDescription += `\nSecciones de la landing actual: ${categories.join(', ')}`
        }
      }
    } else {
      if (!resolvedProductName) {
        return NextResponse.json(
          { error: 'El nombre del producto es requerido' },
          { status: 400 }
        )
      }
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
      `Producto: ${resolvedProductName}`,
    ]
    if (resolvedDescription) parts.push(`Descripción: ${resolvedDescription}`)
    if (price) parts.push(`Precio: ${new Intl.NumberFormat('es-CO', { style: 'decimal', maximumFractionDigits: 0 }).format(price)} ${currency}`)
    if (target_audience) parts.push(`Público objetivo: ${target_audience}`)
    if (problem_solved) parts.push(`Problema que resuelve: ${problem_solved}`)
    if (tone) parts.push(`Tono deseado: ${tone}`)
    if (current_text) parts.push(`\nTexto actual de la landing:\n"""${current_text}"""`)

    if (mode === 'from_landing') {
      parts.push('\nGenera copy optimizado para todas las secciones de esta landing de producto e-commerce.')
    }

    const userPrompt = parts.join('\n')

    console.log(`[CopyOptimizer] User: ${user.id.substring(0, 8)}..., Mode: ${mode}, Product: ${resolvedProductName}`)

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
