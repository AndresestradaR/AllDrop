import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON } from '@/lib/services/ai-text'

export const maxDuration = 60

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — Estratega de Contenido Digital para Dropshipping LATAM
// ---------------------------------------------------------------------------
const ANALYZE_SYSTEM = `Eres un estratega de contenido digital senior especializado en crear productos digitales complementarios (ebooks, guias, manuales) para tiendas de dropshipping en Latinoamerica.

## TU MISION
Analizar un producto fisico y sugerir 3 ideas CREATIVAS de ebooks que complementen ese producto, agregando VALOR REAL al comprador. Los ebooks NO son manuales del producto — son CONTENIDO EDUCATIVO relacionado que hace al producto mas valioso y justifica la compra.

## TU EXPERIENCIA
- Conoces profundamente el mercado LATAM de dropshipping COD (contraentrega)
- Sabes que los compradores buscan soluciones a PROBLEMAS, no solo productos
- Entiendes que un ebook complementario puede ser el factor diferenciador que cierra la venta
- Manejas las categorias: salud-bienestar, belleza-cuidado, tecnologia, hogar-cocina, moda-estilo, universal

## COMO ANALIZAS EL PRODUCTO
1. Identifica QUE ES el producto (categoria, tipo, funcion principal)
2. Identifica PARA QUIEN es (edad, genero, estilo de vida, nivel socioeconomico)
3. Identifica QUE PROBLEMA resuelve (dolor principal, frustracion, deseo)
4. Identifica los BENEFICIOS mas valorados por el comprador
5. Identifica TEMAS RELACIONADOS que el comprador querria aprender
6. Si hay imagen del producto, extrae informacion visual (marca, ingredientes, textos del empaque, claims)

## REGLAS PARA LAS IDEAS DE EBOOK
- Cada ebook debe tener entre 20 y 50 paginas de contenido util
- El titulo debe ser ATRACTIVO y en ESPANOL (sin tildes para compatibilidad)
- El ebook debe ser algo que el comprador QUIERA leer, no solo un relleno
- Debe complementar el producto — no competir con el. Ejemplo: corrector de postura → guia de anatomia y ejercicios para la espalda, NO un ebook sobre otros correctores
- Piensa en guias, recetarios, rutinas, planes, manuales de conocimiento
- Cada idea debe tener un enfoque DIFERENTE (no 3 variaciones del mismo tema)
- Una idea puede ser mas tecnica/educativa, otra mas practica/paso-a-paso, otra mas inspiracional/lifestyle

## EJEMPLOS DE PRODUCTOS Y EBOOKS COMPLEMENTARIOS
- Corrector de postura → "Anatomia practica: Guia completa para una espalda sana" (educativo)
- Suplemento de magnesio → "Minerales esenciales: La guia definitiva para tu salud" (cientifico)
- Sarten antiadherente → "50 recetas saludables sin aceite para toda la familia" (recetario)
- Crema facial anti-edad → "Rutinas de skincare: Secretos de dermatologas para cada tipo de piel" (guia practica)
- Aspiradora robot → "Hogar minimalista: Guia para organizar y limpiar tu casa en 30 minutos" (lifestyle)
- Banda de resistencia → "Plan de entrenamiento en casa: 12 semanas para transformar tu cuerpo" (plan)
- Organizador de cocina → "Meal prep para principiantes: Planifica, cocina y ahorra tiempo" (guia practica)

## ASIGNACION DE CATEGORIA
Asigna UNA categoria por idea segun el tema principal del ebook:
- salud-bienestar: suplementos, postura, fitness, bienestar mental, sueño
- belleza-cuidado: skincare, cabello, maquillaje, cuidado personal
- tecnologia: gadgets, electronica, productividad digital
- hogar-cocina: recetas, limpieza, organizacion, decoracion
- moda-estilo: ropa, accesorios, imagen personal, tendencias
- universal: temas transversales que no encajan en una sola categoria

## SELECCION DE PLANTILLA SUGERIDA
Basandote en el producto y la idea principal, sugiere cual plantilla visual seria mas apropiada para el ebook (usa el ID de la categoria que mejor encaje visualmente).

## FORMATO JSON DE RESPUESTA
Responde SOLO en JSON valido:
{
  "analysis": "string (2-3 oraciones analizando el producto: que es, para quien, que problema resuelve, y por que un ebook complementario agrega valor)",
  "ideas": [
    {
      "id": "idea-1",
      "title": "string (titulo atractivo en espanol, sin tildes, maximo 60 caracteres)",
      "subtitle": "string (subtitulo descriptivo, 1 linea, sin tildes)",
      "description": "string (2 oraciones: que contiene el ebook y por que el comprador lo querria)",
      "category": "string (una de: salud-bienestar, belleza-cuidado, tecnologia, hogar-cocina, moda-estilo, universal)",
      "targetAudience": "string (1 oracion: quien leeria este ebook, edad, perfil)"
    },
    {
      "id": "idea-2",
      "title": "...",
      "subtitle": "...",
      "description": "...",
      "category": "...",
      "targetAudience": "..."
    },
    {
      "id": "idea-3",
      "title": "...",
      "subtitle": "...",
      "description": "...",
      "category": "...",
      "targetAudience": "..."
    }
  ],
  "suggestedTemplate": "string (ID de categoria sugerida: salud-bienestar, belleza-cuidado, tecnologia, hogar-cocina, moda-estilo, o universal)"
}`

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { productName, productDescription, productImages } = body as {
      productName: string
      productDescription: string
      productImages?: string[]
    }

    if (!productName?.trim()) {
      return NextResponse.json(
        { error: 'El nombre del producto es requerido' },
        { status: 400 }
      )
    }

    if (!productDescription?.trim()) {
      return NextResponse.json(
        { error: 'La descripcion del producto es requerida' },
        { status: 400 }
      )
    }

    // Get AI keys (getAIKeys already handles env var fallbacks internally)
    const keys = await getAIKeys(supabase, user.id)

    // Merge with env var fallbacks at route level for extra safety
    const envFallbacks = {
      gemini: process.env.GEMINI_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      kie: process.env.KIE_API_KEY,
    }
    if (!keys.googleApiKey && envFallbacks.gemini) keys.googleApiKey = envFallbacks.gemini
    if (!keys.openaiApiKey && envFallbacks.openai) keys.openaiApiKey = envFallbacks.openai
    if (!keys.kieApiKey && envFallbacks.kie) keys.kieApiKey = envFallbacks.kie

    requireAIKeys(keys)

    // Build user message
    const promptParts: string[] = [
      `## PRODUCTO: ${productName}`,
      `## DESCRIPCION: ${productDescription}`,
    ]

    if (productImages && productImages.length > 0) {
      promptParts.push(`\nSe adjunta 1 imagen del producto. Analiza el empaque, textos visibles, ingredientes, marca y beneficios impresos para mejorar tus sugerencias.`)
    }

    promptParts.push(`\nAnaliza este producto y sugiere 3 ideas creativas de ebook complementario. Responde en JSON.`)

    // Build images array for multimodal input (first image only)
    const images: { mimeType: string; base64: string }[] = []
    if (productImages && productImages.length > 0 && productImages[0]) {
      const firstImage = productImages[0]
      const base64Clean = firstImage.includes(',')
        ? firstImage.split(',')[1]
        : firstImage
      if (base64Clean) {
        // Detect mime type from data URL prefix if available
        let mimeType = 'image/jpeg'
        if (firstImage.startsWith('data:')) {
          const detectedMime = firstImage.split(':')[1]?.split(';')[0]
          if (detectedMime) mimeType = detectedMime
        }
        images.push({ mimeType, base64: base64Clean })
      }
    }

    console.log(`[Ebook/Analyze] User: ${user.id.substring(0, 8)}..., Product: ${productName}, HasImage: ${images.length > 0}`)

    const responseText = await generateAIText(keys, {
      systemPrompt: ANALYZE_SYSTEM,
      userMessage: promptParts.join('\n'),
      images: images.length > 0 ? images : undefined,
      temperature: 0.8,
      jsonMode: true,
      googleFirst: true,
      googleModel: 'gemini-3.1-pro-preview',
    })

    let parsed: any
    try {
      parsed = JSON.parse(extractJSON(responseText))
    } catch {
      console.error('[Ebook/Analyze] Failed to parse JSON:', responseText.substring(0, 500))
      return NextResponse.json({
        error: 'Error al analizar el producto. Intenta de nuevo.',
      }, { status: 500 })
    }

    // Validate response structure
    if (!parsed.analysis || !parsed.ideas || !Array.isArray(parsed.ideas) || parsed.ideas.length === 0) {
      console.error('[Ebook/Analyze] Invalid response structure:', JSON.stringify(parsed).substring(0, 500))
      return NextResponse.json({
        error: 'La respuesta de la IA no tiene el formato esperado. Intenta de nuevo.',
      }, { status: 500 })
    }

    // Ensure each idea has an id
    parsed.ideas = parsed.ideas.map((idea: any, index: number) => ({
      ...idea,
      id: idea.id || `idea-${index + 1}`,
    }))

    console.log(`[Ebook/Analyze] Success — ${parsed.ideas.length} ideas, Template: ${parsed.suggestedTemplate}`)

    return NextResponse.json({
      analysis: parsed.analysis,
      ideas: parsed.ideas,
      suggestedTemplate: parsed.suggestedTemplate || 'universal',
    })

  } catch (error: any) {
    console.error('[Ebook/Analyze] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al analizar el producto',
    }, { status: 500 })
  }
}
