import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys } from '@/lib/services/ai-text'
import { generateImage, hasCascadeKey, type ImageModelId } from '@/lib/image-providers'
import { decrypt } from '@/lib/services/encryption'
import { tryUploadToR2 } from '@/lib/services/r2-upload'
import { renderToBuffer } from '@react-pdf/renderer'
import { EbookDocument } from '@/lib/ebook/pdf-builder'
import React from 'react'
import type { EbookOutline, EbookTemplate, GenerationStep } from '@/lib/ebook/types'

export const maxDuration = 300 // 5 minutes

// ============================================
// SYSTEM PROMPT — Chapter Content Generation
// ============================================
const CHAPTER_SYSTEM_PROMPT = `Eres un escritor profesional de ebooks educativos en español para audiencia LATAM.

REGLAS:
- Escribe contenido PROFESIONAL, educativo y atractivo
- Todo en español neutro latinoamericano
- Usa párrafos bien desarrollados (4-6 oraciones cada uno)
- Incluye datos relevantes, ejemplos prácticos y consejos accionables
- El tono debe ser cercano pero experto, como un profesor que sabe mucho del tema
- NO uses markdown, headers ni bullets — solo texto en párrafos fluidos
- NO uses emojis
- Separa párrafos con doble salto de línea
- Cada capítulo debe tener entre 800 y 1200 palabras (4-6 párrafos sustanciosos)
- El contenido debe ser ÚNICO y ÚTIL — no relleno genérico
- Relaciona siempre el contenido con el uso práctico del producto
- Incluye al menos un consejo práctico "pro tip" por capítulo

Responde SOLO con el texto del capítulo. Sin títulos, sin headers, solo el contenido.`

// ============================================
// Helper: Get image API keys from profile
// ============================================
async function getImageApiKeys(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key, fal_api_key')
    .eq('id', userId)
    .single()

  const apiKeys: { gemini?: string; openai?: string; kie?: string; bfl?: string; fal?: string } = {}

  if (profile?.google_api_key) apiKeys.gemini = decrypt(profile.google_api_key)
  if (profile?.openai_api_key) apiKeys.openai = decrypt(profile.openai_api_key)
  if (profile?.kie_api_key) apiKeys.kie = decrypt(profile.kie_api_key)
  if (profile?.bfl_api_key) apiKeys.bfl = decrypt(profile.bfl_api_key)
  if (profile?.fal_api_key) apiKeys.fal = decrypt(profile.fal_api_key)

  // Env var fallbacks
  if (!apiKeys.gemini && process.env.GEMINI_API_KEY) apiKeys.gemini = process.env.GEMINI_API_KEY
  if (!apiKeys.openai && process.env.OPENAI_API_KEY) apiKeys.openai = process.env.OPENAI_API_KEY
  if (!apiKeys.kie && process.env.KIE_API_KEY) apiKeys.kie = process.env.KIE_API_KEY
  if (!apiKeys.bfl && process.env.BFL_API_KEY) apiKeys.bfl = process.env.BFL_API_KEY
  if (!apiKeys.fal && process.env.FAL_API_KEY) apiKeys.fal = process.env.FAL_API_KEY

  return apiKeys
}

// ============================================
// Helper: Generate a single illustration
// ============================================
async function generateIllustration(
  keyword: string,
  ebookTitle: string,
  apiKeys: any,
  modelId: ImageModelId = 'nano-banana-2',
  timeoutMs: number = 25000
): Promise<string | null> {
  try {
    const prompt = `Professional ebook illustration: ${keyword}. Clean, modern, editorial style. High quality, detailed, suitable for a professional digital guide about "${ebookTitle}". No text overlay.`

    const result = await generateImage(
      {
        provider: 'gemini',
        modelId,
        prompt,
        aspectRatio: '16:9',
      },
      apiKeys,
      { maxTotalMs: timeoutMs }
    )

    if (result.success && result.imageBase64) {
      return `data:image/png;base64,${result.imageBase64}`
    }

    // Some providers return URL directly
    if (result.success && (result as any).imageUrl) {
      return (result as any).imageUrl
    }

    return null
  } catch (err) {
    console.error('[Ebook] Image generation failed:', err)
    return null
  }
}

// ============================================
// MAIN ROUTE — SSE Pipeline
// ============================================
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      outline,
      template,
      logoUrl,
      productName,
    } = body as {
      outline: EbookOutline
      template: EbookTemplate
      logoUrl?: string
      productName: string
    }

    if (!outline || !template || !outline.chapters?.length) {
      return NextResponse.json({ error: 'Outline y template son requeridos' }, { status: 400 })
    }

    // Get AI keys for text
    const textKeys = await getAIKeys(supabase, user.id)
    requireAIKeys(textKeys)

    // Get image API keys
    const imageKeys = await getImageApiKeys(supabase, user.id)

    // nano-banana-2: más rápido, misma calidad, más barato
    const imageModel: ImageModelId = 'nano-banana-2' // cascade: KIE → fal.ai → Gemini direct

    const totalSteps = outline.chapters.length + 4 // chapters + cover + compile + upload + done
    let currentStep = 0

    // SSE Stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        function sendProgress(step: GenerationStep) {
          const data = JSON.stringify(step)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        try {
          // ---- STEP 1: Generate cover image (non-blocking) ----
          currentStep++
          sendProgress({
            type: 'cover',
            message: 'Creando portada profesional...',
            progress: Math.round((currentStep / totalSteps) * 100),
          })

          // Start cover generation in background — don't wait
          const coverPromise = generateIllustration(
            `Professional ebook cover illustration for "${outline.title}". Modern, premium, editorial design. Subject: ${productName}. Style: clean, sophisticated, suitable for a digital guide cover. No text.`,
            outline.title,
            imageKeys,
            imageModel,
            30000
          ).catch(() => null)

          // ---- STEP 2: Generate ALL chapter text + images in parallel per chapter ----
          const chaptersWithContent = [...outline.chapters]

          for (let i = 0; i < chaptersWithContent.length; i++) {
            const chapter = chaptersWithContent[i]

            // Check time budget — leave 60s for PDF compilation + upload
            const elapsed = Date.now() - startTime
            const skipImages = elapsed > 180000

            if (skipImages && i > 0) {
              console.warn(`[Ebook] Time budget tight at chapter ${i + 1}, text-only mode`)
            }

            currentStep++
            sendProgress({
              type: 'chapter-text',
              chapter: i + 1,
              totalChapters: chaptersWithContent.length,
              message: skipImages
                ? `Escribiendo capitulo ${i + 1}: ${chapter.title} (modo rapido)...`
                : `Escribiendo e ilustrando capitulo ${i + 1}: ${chapter.title}...`,
              progress: Math.round((currentStep / totalSteps) * 100),
            })

            // Run text + image IN PARALLEL for each chapter
            const textPromise = generateAIText(textKeys, {
              systemPrompt: CHAPTER_SYSTEM_PROMPT,
              userMessage: `Escribe el capítulo "${chapter.title}" para el ebook "${outline.title}".
Contexto del capítulo: ${chapter.summary}
Producto relacionado: ${productName}
${i === 0 ? 'Este es el primer capítulo — introduce los conceptos de forma accesible.' : ''}
${i === chaptersWithContent.length - 1 ? 'Este es el último capítulo — cierra con consejos finales y motivación.' : ''}`,
              temperature: 0.7,
              googleFirst: true,
              googleModel: 'gemini-3.1-pro-preview',
            })

            const imagePromise = skipImages
              ? Promise.resolve(null)
              : generateIllustration(
                  chapter.imageKeyword,
                  outline.title,
                  imageKeys,
                  imageModel,
                  25000
                ).catch(() => null)

            const [chapterContent, imgUrl] = await Promise.all([textPromise, imagePromise])

            chaptersWithContent[i] = {
              ...chaptersWithContent[i],
              content: chapterContent,
              ...(imgUrl ? { imageUrl: imgUrl } : {}),
            }
          }

          // Wait for cover image
          const coverImageUrl = await coverPromise

          // ---- STEP 3: Compile PDF ----
          currentStep++
          sendProgress({
            type: 'compiling',
            message: 'Compilando PDF profesional...',
            progress: Math.round((currentStep / totalSteps) * 100),
          })

          const completeOutline: EbookOutline = {
            ...outline,
            chapters: chaptersWithContent,
          }

          const pdfArrayBuffer = await renderToBuffer(
            React.createElement(EbookDocument, {
              outline: completeOutline,
              template,
              coverImageUrl: coverImageUrl || undefined,
              logoUrl: logoUrl || undefined,
            }) as any
          )
          const pdfBuffer = Buffer.from(pdfArrayBuffer)

          // ---- STEP 4: Upload PDF ----
          currentStep++
          sendProgress({
            type: 'uploading',
            message: 'Guardando ebook...',
            progress: Math.round((currentStep / totalSteps) * 100),
          })

          // Upload to Supabase Storage
          const fileName = `ebooks/${user.id}/${Date.now()}-${outline.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('landing-images')
            .upload(fileName, pdfBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            })

          if (uploadError) {
            console.error('[Ebook] Storage upload failed:', uploadError)
            throw new Error('Error al guardar el PDF')
          }

          const storageRef = `storage:${fileName}`

          // Try R2 upload (non-blocking)
          let r2Url: string | null = null
          try {
            r2Url = await tryUploadToR2(
              user.id,
              pdfBuffer,
              `ebooks/${Date.now()}.pdf`,
              'application/pdf'
            )
          } catch {
            // R2 optional
          }

          // Save to generations table
          const serviceClient = await createServiceClient()
          const { data: genData, error: genError } = await serviceClient
            .from('generations')
            .insert({
              user_id: user.id,
              product_name: `Ebook: ${outline.title}`,
              original_prompt: `${productName} — ${outline.subtitle}`,
              enhanced_prompt: JSON.stringify({
                template: template.id,
                chapters: chaptersWithContent.length,
                pages: Math.max(20, chaptersWithContent.length * 3 + 5),
              }),
              status: 'completed',
              generated_image_url: r2Url || storageRef,
            })
            .select('id')
            .single()

          if (genError) {
            console.warn('[Ebook] DB save failed:', genError.message)
          }

          // ---- DONE ----
          sendProgress({
            type: 'done',
            message: 'Ebook generado exitosamente',
            progress: 100,
          })

          // Send final result
          const finalResult = {
            type: 'result',
            id: genData?.id || null,
            title: outline.title,
            storageUrl: storageRef,
            r2Url,
            coverImageUrl,
            chaptersCount: chaptersWithContent.length,
            pagesEstimate: Math.max(20, chaptersWithContent.length * 3 + 5),
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalResult)}\n\n`))

        } catch (err: any) {
          console.error('[Ebook] Generation error:', err)
          sendProgress({
            type: 'error',
            message: err.message || 'Error al generar el ebook',
            progress: 0,
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('[Ebook] Route error:', err)
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
