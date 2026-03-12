import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys, extractJSON } from '@/lib/services/ai-text'

export const maxDuration = 60

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — Generador de estructura de ebook
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Eres un experto en creacion de contenido educativo y ebooks digitales para el mercado latinoamericano de e-commerce y dropshipping.

## TU OBJETIVO
Generar la estructura completa de un ebook profesional basado en un producto fisico. El ebook sirve como complemento digital (bonus/lead magnet) que agrega valor al producto principal.

## REGLAS DE ESTRUCTURA
1. Cada capitulo debe tener un titulo CREATIVO y ATRACTIVO en espanol (sin tildes). No uses titulos genericos como "Capitulo 1: Introduccion".
2. Los capitulos deben seguir un flujo logico:
   - Primeros capitulos: conceptos basicos, contexto del problema, por que importa
   - Capitulos intermedios: conocimiento profundo, tecnicas, datos respaldados
   - Capitulos avanzados: tips practicos, rutinas, recetas, guias paso a paso
   - Ultimos capitulos: errores comunes, mitos vs realidad, plan de accion personalizado
3. El resumen de cada capitulo debe tener 3-4 oraciones describiendo el contenido especifico que se cubrira. Se CONCRETO, no vago.
4. El campo imageKeyword debe ser una descripcion EN INGLES de 3-6 palabras, especifica y visual, para generar una imagen con IA. Ejemplo: "woman applying face serum mirror", "healthy breakfast bowl fruits", "clean kitchen modern appliances".
5. La introduccion debe dar la bienvenida al lector, explicar que encontrara en el ebook, y motivar a leerlo completo. 2-3 parrafos.
6. La conclusion debe resumir los puntos clave, motivar a la accion, y conectar con el producto. 2-3 parrafos.

## REGLAS DE CONTENIDO
- Todo el texto en ESPANOL latinoamericano SIN TILDES (usar "mas" no "mas", "facil" no "facil")
- Contenido EDUCATIVO y ACCIONABLE — el lector debe poder aplicar lo aprendido
- Orientado al publico LATAM: referencias culturales, ingredientes locales, habitos de la region
- Tono profesional pero cercano, como un experto amigo que te explica
- Incluir datos, estadisticas o referencias cuando sea posible (pueden ser aproximadas pero realistas)
- El ebook debe funcionar como contenido de VALOR REAL, no como un folleto publicitario del producto
- El producto se menciona naturalmente donde sea relevante, sin forzarlo

## FORMATO JSON DE RESPUESTA
Responde SOLO en JSON valido:
{
  "title": "Titulo principal del ebook (creativo, max 60 chars)",
  "subtitle": "Subtitulo descriptivo (max 80 chars)",
  "introduction": "Texto de introduccion de 2-3 parrafos",
  "chapters": [
    {
      "number": 1,
      "title": "Titulo creativo del capitulo",
      "summary": "Resumen de 3-4 oraciones describiendo el contenido especifico",
      "imageKeyword": "descriptive english keyword for AI image"
    }
  ],
  "conclusion": "Texto de conclusion de 2-3 parrafos"
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
    const {
      productName,
      productDescription,
      selectedIdea,
      chaptersCount = 8,
    } = body as {
      productName: string
      productDescription: string
      selectedIdea: {
        title: string
        subtitle: string
        description: string
        category: string
      }
      chaptersCount?: number
    }

    // Validate required fields
    if (!productName || !selectedIdea?.title) {
      return NextResponse.json(
        { error: 'El nombre del producto y la idea seleccionada son requeridos' },
        { status: 400 }
      )
    }

    // Clamp chapters count
    const chapters = Math.max(5, Math.min(12, chaptersCount))

    // Get AI keys with env var fallbacks
    const keys = await getAIKeys(supabase, user.id)
    const envFallbacks = {
      gemini: process.env.GEMINI_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      kie: process.env.KIE_API_KEY,
    }
    if (!keys.kieApiKey && envFallbacks.kie) keys.kieApiKey = envFallbacks.kie
    if (!keys.openaiApiKey && envFallbacks.openai) keys.openaiApiKey = envFallbacks.openai
    if (!keys.googleApiKey && envFallbacks.gemini) keys.googleApiKey = envFallbacks.gemini
    requireAIKeys(keys)

    // Build user message
    const userMessage = [
      `Producto: ${productName}`,
      productDescription ? `Descripcion: ${productDescription}` : '',
      ``,
      `Idea seleccionada para el ebook:`,
      `- Titulo: ${selectedIdea.title}`,
      `- Subtitulo: ${selectedIdea.subtitle}`,
      `- Descripcion: ${selectedIdea.description}`,
      `- Categoria: ${selectedIdea.category}`,
      ``,
      `Genera un ebook con EXACTAMENTE ${chapters} capitulos.`,
      `Sigue el flujo logico: conceptos basicos → conocimiento profundo → tips practicos → avanzado → plan de accion.`,
    ].filter(Boolean).join('\n')

    console.log(`[EbookOutline] User: ${user.id.substring(0, 8)}..., Product: ${productName}, Chapters: ${chapters}`)

    const responseText = await generateAIText(keys, {
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      jsonMode: true,
      temperature: 0.7,
      googleFirst: true,
      googleModel: 'gemini-3.1-pro-preview',
    })

    const parsed = JSON.parse(extractJSON(responseText))

    console.log(`[EbookOutline] Success — ${parsed.chapters?.length || 0} chapters generated`)

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('[EbookOutline] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al generar la estructura del ebook',
    }, { status: 500 })
  }
}
