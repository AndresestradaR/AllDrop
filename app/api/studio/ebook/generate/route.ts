import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys } from '@/lib/services/ai-text'
import type { ImageModelId } from '@/lib/image-providers'
import { tryUploadToR2 } from '@/lib/services/r2-upload'
import { renderToBuffer } from '@react-pdf/renderer'
import { EbookDocument } from '@/lib/ebook/pdf-builder'
import React from 'react'
import type { EbookOutline, EbookTemplate, GenerationStep } from '@/lib/ebook/types'

export const maxDuration = 300 // 5 minutes

// ============================================
// SYSTEM PROMPT — Chapter Content Generation
// ============================================
// Language-aware system prompts for chapter content
const CHAPTER_PROMPTS: Record<string, string> = {
  es: `Eres un escritor profesional de ebooks educativos en español para audiencia LATAM.

REGLAS:
- Escribe contenido PROFESIONAL, educativo y atractivo
- Todo en español neutro latinoamericano
- Usa párrafos bien desarrollados (3-5 oraciones cada uno)
- Incluye datos relevantes, ejemplos prácticos y consejos accionables
- El tono debe ser cercano pero experto, como un profesor que sabe mucho del tema
- NO uses markdown, headers ni bullets — solo texto en párrafos fluidos
- NO uses emojis
- Separa párrafos con doble salto de línea
- Cada capítulo debe tener entre 400 y 600 palabras (3-4 párrafos concisos pero sustanciosos)
- El contenido debe ser ÚNICO y ÚTIL — no relleno genérico
- Sé DIRECTO y CONCISO — cada oración debe aportar valor, nada de relleno
- Relaciona siempre el contenido con el uso práctico del producto
- Incluye al menos un consejo práctico "pro tip" por capítulo

Responde SOLO con el texto del capítulo. Sin títulos, sin headers, solo el contenido.`,
  en: `You are a professional educational ebook writer in English.

RULES:
- Write PROFESSIONAL, educational and engaging content
- All in clear, modern English
- Use well-developed paragraphs (3-5 sentences each)
- Include relevant data, practical examples and actionable tips
- Tone should be approachable yet expert, like a knowledgeable teacher
- DO NOT use markdown, headers or bullets — only flowing paragraphs
- DO NOT use emojis
- Separate paragraphs with double line breaks
- Each chapter should be 400-600 words (3-4 concise but substantial paragraphs)
- Content must be UNIQUE and USEFUL — not generic filler
- Be DIRECT and CONCISE — every sentence should add value
- Always relate content to practical use of the product
- Include at least one practical "pro tip" per chapter

Respond ONLY with the chapter text. No titles, no headers, just the content.`,
  fr: `Vous êtes un rédacteur professionnel d'ebooks éducatifs en français.

RÈGLES:
- Rédigez du contenu PROFESSIONNEL, éducatif et engageant
- Tout en français clair et moderne
- Utilisez des paragraphes bien développés (3-5 phrases chacun)
- Incluez des données pertinentes, des exemples pratiques et des conseils actionnables
- Le ton doit être accessible mais expert
- N'utilisez PAS de markdown, titres ou listes — uniquement des paragraphes fluides
- N'utilisez PAS d'emojis
- Séparez les paragraphes par un double saut de ligne
- Chaque chapitre doit contenir 400-600 mots
- Le contenu doit être UNIQUE et UTILE
- Soyez DIRECT et CONCIS
- Reliez toujours le contenu à l'utilisation pratique du produit
- Incluez au moins un conseil pratique par chapitre

Répondez UNIQUEMENT avec le texte du chapitre. Sans titres, sans en-têtes, juste le contenu.`,
  it: `Sei uno scrittore professionista di ebook educativi in italiano.

REGOLE:
- Scrivi contenuto PROFESSIONALE, educativo e coinvolgente
- Tutto in italiano chiaro e moderno
- Usa paragrafi ben sviluppati (3-5 frasi ciascuno)
- Includi dati rilevanti, esempi pratici e consigli attuabili
- Il tono deve essere accessibile ma esperto
- NON usare markdown, titoli o elenchi — solo paragrafi fluidi
- NON usare emoji
- Separa i paragrafi con doppio a capo
- Ogni capitolo deve avere 400-600 parole
- Il contenuto deve essere UNICO e UTILE
- Sii DIRETTO e CONCISO
- Relaziona sempre il contenuto all'uso pratico del prodotto
- Includi almeno un consiglio pratico per capitolo

Rispondi SOLO con il testo del capitolo. Senza titoli, senza intestazioni, solo il contenuto.`,
  pt: `Você é um escritor profissional de ebooks educacionais em português.

REGRAS:
- Escreva conteúdo PROFISSIONAL, educativo e envolvente
- Tudo em português claro e moderno
- Use parágrafos bem desenvolvidos (3-5 frases cada)
- Inclua dados relevantes, exemplos práticos e dicas acionáveis
- O tom deve ser acessível mas especializado
- NÃO use markdown, títulos ou listas — apenas parágrafos fluidos
- NÃO use emojis
- Separe parágrafos com quebra de linha dupla
- Cada capítulo deve ter 400-600 palavras
- O conteúdo deve ser ÚNICO e ÚTIL
- Seja DIRETO e CONCISO
- Relacione sempre o conteúdo ao uso prático do produto
- Inclua pelo menos uma dica prática por capítulo

Responda APENAS com o texto do capítulo. Sem títulos, sem cabeçalhos, apenas o conteúdo.`,
  de: `Sie sind ein professioneller Autor von Bildungs-Ebooks auf Deutsch.

REGELN:
- Schreiben Sie PROFESSIONELLEN, lehrreichen und ansprechenden Inhalt
- Alles in klarem, modernem Deutsch
- Verwenden Sie gut entwickelte Absätze (3-5 Sätze pro Absatz)
- Fügen Sie relevante Daten, praktische Beispiele und umsetzbare Tipps ein
- Der Ton sollte zugänglich aber fachkundig sein
- Verwenden Sie KEIN Markdown, keine Überschriften oder Aufzählungen — nur fließende Absätze
- Verwenden Sie KEINE Emojis
- Trennen Sie Absätze mit doppeltem Zeilenumbruch
- Jedes Kapitel sollte 400-600 Wörter umfassen
- Der Inhalt muss EINZIGARTIG und NÜTZLICH sein
- Seien Sie DIREKT und PRÄZISE
- Beziehen Sie den Inhalt immer auf die praktische Nutzung des Produkts
- Fügen Sie mindestens einen praktischen Tipp pro Kapitel ein

Antworten Sie NUR mit dem Kapiteltext. Keine Titel, keine Überschriften, nur der Inhalt.`,
}

function getChapterPrompt(language?: string): string {
  return CHAPTER_PROMPTS[language || 'es'] || CHAPTER_PROMPTS.en
}

// ============================================
// Helper: Generate a single illustration via internal HTTP
// ============================================
async function generateIllustration(
  keyword: string,
  ebookTitle: string,
  userId: string,
  baseUrl: string,
  modelId: ImageModelId = 'nano-banana-2',
  timeoutMs: number = 50000
): Promise<string | null> {
  try {
    const prompt = `Professional high-quality stock photography for an ebook about "${ebookTitle}": ${keyword}. Photorealistic, real people if appropriate, natural lighting, editorial magazine quality. Crisp detail, vibrant colors, modern lifestyle feel. No text overlay, no watermarks, no AI artifacts, no logos.`

    console.log(`[Ebook:Image] START keyword="${keyword.substring(0, 50)}" via ${baseUrl}/api/studio/generate-image`)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(`${baseUrl}/api/studio/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'X-Internal-User-Id': userId,
      },
      body: JSON.stringify({ modelId, prompt, aspectRatio: '16:9' }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      console.warn(`[Ebook:Image] HTTP ${res.status} for "${keyword.substring(0, 30)}"`)
      return null
    }

    const result = await res.json()
    console.log(`[Ebook:Image] RESULT success=${result.success} hasBase64=${!!result.imageBase64} provider=${result.provider || '?'}`)

    if (result.success && result.imageBase64) {
      return `data:image/png;base64,${result.imageBase64}`
    }

    return null
  } catch (err: any) {
    console.error(`[Ebook:Image] EXCEPTION for "${keyword.substring(0, 30)}":`, err?.message || err)
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

    // Extract base URL from request for internal HTTP calls
    const reqUrl = new URL(request.url)
    const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`
    console.log(`[Ebook] baseUrl for internal calls: ${baseUrl}`)

    const body = await request.json()
    const {
      outline,
      template,
      logoUrl,
      productName,
      language,
    } = body as {
      outline: EbookOutline
      template: EbookTemplate
      logoUrl?: string
      productName: string
      language?: string
    }

    const ebookMessages: Record<string, Record<string, string>> = {
      es: { cover: 'Creando portada profesional...', writing: 'Escribiendo e ilustrando capitulo', writingFast: 'Escribiendo capitulo', fastMode: '(modo rapido)', compiling: 'Compilando PDF profesional...', done: 'Ebook generado exitosamente' },
      en: { cover: 'Creating professional cover...', writing: 'Writing and illustrating chapter', writingFast: 'Writing chapter', fastMode: '(fast mode)', compiling: 'Compiling professional PDF...', done: 'Ebook generated successfully' },
      fr: { cover: 'Création de la couverture...', writing: 'Écriture et illustration du chapitre', writingFast: 'Écriture du chapitre', fastMode: '(mode rapide)', compiling: 'Compilation du PDF...', done: 'Ebook généré avec succès' },
      it: { cover: 'Creazione copertina professionale...', writing: 'Scrittura e illustrazione capitolo', writingFast: 'Scrittura capitolo', fastMode: '(modalità rapida)', compiling: 'Compilazione PDF professionale...', done: 'Ebook generato con successo' },
      pt: { cover: 'Criando capa profissional...', writing: 'Escrevendo e ilustrando capítulo', writingFast: 'Escrevendo capítulo', fastMode: '(modo rápido)', compiling: 'Compilando PDF profissional...', done: 'Ebook gerado com sucesso' },
      de: { cover: 'Erstelle professionelles Cover...', writing: 'Schreibe und illustriere Kapitel', writingFast: 'Schreibe Kapitel', fastMode: '(Schnellmodus)', compiling: 'Kompiliere professionelles PDF...', done: 'Ebook erfolgreich generiert' },
    }
    const msg = ebookMessages[language || 'es'] || ebookMessages.es

    if (!outline || !template || !outline.chapters?.length) {
      return NextResponse.json({ error: 'Outline y template son requeridos' }, { status: 400 })
    }

    // Get AI keys for text
    const textKeys = await getAIKeys(supabase, user.id)
    requireAIKeys(textKeys)

    // Image model for illustrations (cascade handles provider selection via internal HTTP)
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
            message: msg.cover,
            progress: Math.round((currentStep / totalSteps) * 100),
          })

          // Start cover generation in background — don't wait
          const coverPromise = generateIllustration(
            `Dramatic cinematic cover photo for premium digital guide about "${productName}". Photorealistic, stunning composition, professional editorial photography. Hero shot with dramatic lighting, rich colors, emotional impact. Magazine cover quality. No text, no watermarks.`,
            outline.title,
            user.id,
            baseUrl,
            imageModel,
            60000
          ).catch((err: any) => {
            console.error('[Ebook] Cover image failed:', err?.message || err)
            return null
          })

          // ---- STEP 2: Generate ALL chapter text + images in parallel per chapter ----
          const chaptersWithContent = [...outline.chapters]

          for (let i = 0; i < chaptersWithContent.length; i++) {
            const chapter = chaptersWithContent[i]

            // Check time budget — leave 40s for PDF compilation + upload
            const elapsed = Date.now() - startTime
            const remainingMs = (maxDuration * 1000) - elapsed - 40000
            const skipImages = remainingMs < 30000

            if (skipImages) {
              console.warn(`[Ebook] Time budget tight at chapter ${i + 1} (${Math.round(remainingMs / 1000)}s left), text-only mode`)
            }

            currentStep++
            sendProgress({
              type: 'chapter-text',
              chapter: i + 1,
              totalChapters: chaptersWithContent.length,
              message: skipImages
                ? `${msg.writingFast} ${i + 1}: ${chapter.title} ${msg.fastMode}...`
                : `${msg.writing} ${i + 1}: ${chapter.title}...`,
              progress: Math.round((currentStep / totalSteps) * 100),
            })

            // Run text + image IN PARALLEL for each chapter
            // Language-aware user messages
            const langInstructions: Record<string, { write: string; context: string; product: string; first: string; last: string }> = {
              es: { write: 'Escribe el capítulo', context: 'Contexto del capítulo', product: 'Producto relacionado', first: 'Este es el primer capítulo — introduce los conceptos de forma accesible.', last: 'Este es el último capítulo — cierra con consejos finales y motivación.' },
              en: { write: 'Write the chapter', context: 'Chapter context', product: 'Related product', first: 'This is the first chapter — introduce concepts in an accessible way.', last: 'This is the last chapter — close with final tips and motivation.' },
              fr: { write: 'Écrivez le chapitre', context: 'Contexte du chapitre', product: 'Produit associé', first: 'C\'est le premier chapitre — introduisez les concepts de manière accessible.', last: 'C\'est le dernier chapitre — concluez avec des conseils finaux et de la motivation.' },
              it: { write: 'Scrivi il capitolo', context: 'Contesto del capitolo', product: 'Prodotto correlato', first: 'Questo è il primo capitolo — introduci i concetti in modo accessibile.', last: 'Questo è l\'ultimo capitolo — chiudi con consigli finali e motivazione.' },
              pt: { write: 'Escreva o capítulo', context: 'Contexto do capítulo', product: 'Produto relacionado', first: 'Este é o primeiro capítulo — introduza os conceitos de forma acessível.', last: 'Este é o último capítulo — feche com dicas finais e motivação.' },
              de: { write: 'Schreiben Sie das Kapitel', context: 'Kapitelkontext', product: 'Verwandtes Produkt', first: 'Dies ist das erste Kapitel — führen Sie die Konzepte verständlich ein.', last: 'Dies ist das letzte Kapitel — schließen Sie mit abschließenden Tipps und Motivation.' },
            }
            const li = langInstructions[language || 'es'] || langInstructions.en

            const textPromise = generateAIText(textKeys, {
              systemPrompt: getChapterPrompt(language),
              userMessage: `${li.write} "${chapter.title}" para el ebook "${outline.title}".
${li.context}: ${chapter.summary}
${li.product}: ${productName}
${i === 0 ? li.first : ''}
${i === chaptersWithContent.length - 1 ? li.last : ''}`,
              temperature: 0.7,
              googleFirst: true,
              googleModel: 'gemini-3.1-pro-preview',
            })

            // Dynamic timeout: at least 30s, up to 45s, based on remaining time
            const imgTimeout = Math.max(30000, Math.min(45000, remainingMs - 20000))

            const imagePromise = skipImages
              ? Promise.resolve(null)
              : generateIllustration(
                  chapter.imageKeyword,
                  outline.title,
                  user.id,
                  baseUrl,
                  imageModel,
                  Math.max(50000, imgTimeout)
                ).catch((err: any) => {
                  console.error(`[Ebook] Chapter ${i + 1} image failed:`, err?.message || err)
                  return null
                })

            const [chapterContent, imgUrl] = await Promise.all([textPromise, imagePromise])

            chaptersWithContent[i] = {
              ...chaptersWithContent[i],
              content: chapterContent,
              ...(imgUrl ? { imageUrl: imgUrl } : {}),
            }
          }

          // Log image stats
          const chaptersWithImages = chaptersWithContent.filter(c => c.imageUrl).length
          console.log(`[Ebook] Chapters done: ${chaptersWithContent.length} total, ${chaptersWithImages} with images, elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`)

          // Wait for cover image
          const coverImageUrl = await coverPromise
          console.log(`[Ebook] Cover image: ${coverImageUrl ? 'OK' : 'FAILED'}`)

          // ---- STEP 3: Compile PDF ----
          currentStep++
          sendProgress({
            type: 'compiling',
            message: msg.compiling,
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
              language: language || 'en',
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

          // Upload cover image to Storage for gallery thumbnail
          let coverStoragePath: string | null = null
          if (coverImageUrl && coverImageUrl.startsWith('data:')) {
            try {
              const base64Match = coverImageUrl.match(/^data:[^;]+;base64,(.+)$/)
              if (base64Match) {
                const coverBuffer = Buffer.from(base64Match[1], 'base64')
                const coverFileName = `ebooks/${user.id}/cover-${Date.now()}.png`
                await supabase.storage.from('landing-images').upload(coverFileName, coverBuffer, {
                  contentType: 'image/png', upsert: true,
                })
                const { data: coverUrlData } = supabase.storage.from('landing-images').getPublicUrl(coverFileName)
                coverStoragePath = coverUrlData?.publicUrl || null
                console.log(`[Ebook] Cover saved to Storage: ${coverStoragePath?.substring(0, 80)}`)
              }
            } catch (e: any) {
              console.warn('[Ebook] Cover upload failed:', e.message)
            }
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
                pages: Math.min(20, chaptersWithContent.length * 3 + 5),
                coverImageUrl: coverStoragePath || null,
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
            message: msg.done,
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
            pagesEstimate: Math.min(20, chaptersWithContent.length * 3 + 5),
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
