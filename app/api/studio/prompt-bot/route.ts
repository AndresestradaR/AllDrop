import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

const BOT_PROMPT_SYSTEM = `Eres un experto en diseño de bots de ventas para WhatsApp y atención al cliente en Latinoamérica, especializado en dropshipping y e-commerce.

Tu trabajo es generar system prompts profesionales y completos para bots de ventas, junto con mensajes predefinidos.

## REGLAS:
1. El system_prompt debe ser claro, específico y listo para usar en cualquier plataforma de chatbot
2. Incluir personalidad del bot (nombre, tono, estilo)
3. Incluir reglas de negocio (horarios, envíos, pagos, garantías)
4. Incluir manejo de objeciones comunes de dropshipping LATAM
5. Incluir escalamiento a humano cuando sea necesario
6. El welcome_message debe ser corto, amigable y con emoji moderado
7. Las FAQ deben cubrir las preguntas más comunes de e-commerce LATAM
8. El closing_script debe crear urgencia sin ser agresivo
9. Los objection_handlers deben ser empáticos y persuasivos
10. Todo en español para el mercado seleccionado

Responde SOLO en JSON válido:
{
  "system_prompt": "string (system prompt completo para el bot, 3-5 párrafos)",
  "welcome_message": "string (mensaje de bienvenida del bot)",
  "faq_responses": [
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "closing_script": "string (script de cierre de venta)",
  "objection_handlers": [
    {
      "objection": "string (la objeción del cliente)",
      "response": "string (respuesta del bot)"
    }
  ]
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
      product_price,
      currency = 'COP',
      common_objections,
      tone = 'amigable',
      bot_platform = 'whatsapp',
      country = 'Colombia',
      business_name,
      shipping_info,
    } = body as {
      product_name: string
      product_benefits?: string
      product_price?: string
      currency?: string
      common_objections?: string
      tone?: string
      bot_platform?: string
      country?: string
      business_name?: string
      shipping_info?: string
    }

    if (!product_name?.trim()) {
      return NextResponse.json(
        { error: 'El nombre del producto es requerido' },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de Google en Settings',
      }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)
    const genAI = new GoogleGenerativeAI(apiKey)
    const aiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: BOT_PROMPT_SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    })

    const parts: string[] = [
      `Producto: ${product_name}`,
      `Plataforma: ${bot_platform}`,
      `País: ${country}`,
      `Tono: ${tone}`,
    ]
    if (product_benefits) parts.push(`Beneficios: ${product_benefits}`)
    if (product_price) parts.push(`Precio: ${product_price} ${currency}`)
    if (common_objections) parts.push(`Objeciones comunes: ${common_objections}`)
    if (business_name) parts.push(`Nombre del negocio: ${business_name}`)
    if (shipping_info) parts.push(`Info de envío: ${shipping_info}`)

    const userPrompt = parts.join('\n')

    console.log(`[PromptBot] User: ${user.id.substring(0, 8)}..., Product: ${product_name}, Platform: ${bot_platform}`)

    const result = await aiModel.generateContent(userPrompt)
    const responseText = result.response.text()

    let parsed: any
    try {
      parsed = JSON.parse(responseText)
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
