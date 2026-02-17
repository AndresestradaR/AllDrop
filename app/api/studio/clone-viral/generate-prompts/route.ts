import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are an expert UGC (User-Generated Content) video director specialized in creating multi-shot video narratives for dropshipping and e-commerce products targeting Latin American markets.

Your job: Given an existing viral video TRANSCRIPT, a product name, and an influencer's visual descriptor, ADAPT and restructure the transcript into N multi-shot video sections optimized for Kling 3.0 AI video generation.

ANALYSIS STEPS:
1. Read the transcript carefully to extract: hook/attention grab, pain points mentioned, product benefits, call-to-action
2. Condense and redistribute the content across the requested number of sections
3. Each section = 1 Kling 3.0 multi-shot video (~10-14 seconds)

OUTPUT FORMAT — You MUST respond with valid JSON only, no markdown, no backticks:
{
  "sections": [
    {
      "title": "Section title describing narrative arc",
      "startImagePrompt": "Hyperrealistic photo prompt for opening frame of this section...",
      "scenes": [
        { "prompt": "Video scene description...", "duration": 4 },
        { "prompt": "Video scene description...", "duration": 3 }
      ]
    }
  ]
}

RULES:
1. startImagePrompt: A detailed image generation prompt for the first frame of each section. MUST include "Hyperrealistic photo of" + the influencer's visual descriptor. 200-400 chars. Describe the setting, expression, and pose that matches the narrative moment.
2. scenes: Array of 3-4 scene objects per section. Each scene has:
   - prompt: Video scene description with camera movements, emotions, actions. Max 500 chars. Write in English but include "speaks in Spanish with Latin American accent" when the character is talking/presenting.
   - duration: Integer seconds (2-5). Total of all durations per section MUST be between 10 and 15 seconds.
3. Narrative distribution across sections:
   - 1 section: Hook → Problem → Discovery → CTA (full story)
   - 2 sections: Section 1 = Hook + Problem, Section 2 = Transformation + CTA
   - 3 sections: Section 1 = Hook + Problem, Section 2 = Discovery + Demo, Section 3 = Results + CTA
4. ADAPT the transcript content — don't copy it literally. Transform spoken words into visual scene descriptions that SHOW what the transcript SAYS.
5. Style: UGC aesthetic — natural, candid, iPhone-quality feel. Bathroom/bedroom/kitchen settings.
6. Camera directions: Include "medium shot", "close-up", "handheld feel", "slight zoom in", "POV shot".
7. The character speaks in Spanish in the scenes. Include "speaks in Spanish" in prompts with dialogue.
8. The product name MUST appear naturally in at least one scene per section.
9. Keep each section self-contained with a mini narrative arc, but connected to the overall story.`

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { userId, supabase } = auth

    const body = await request.json()
    const {
      transcript,
      productName,
      sectionCount,
      promptDescriptor,
      influencerName,
    } = body as {
      transcript: string
      productName: string
      sectionCount: number
      promptDescriptor: string
      influencerName: string
    }

    if (!transcript || !sectionCount) {
      return NextResponse.json({ error: 'transcript y sectionCount son requeridos' }, { status: 400 })
    }

    // Get Google API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', userId)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google en Settings' }, { status: 400 })
    }

    const apiKey = decrypt(profile.google_api_key)

    const userMessage = `INFLUENCER VISUAL DESCRIPTOR:
${promptDescriptor || `A person called ${influencerName}`}

INFLUENCER NAME: ${influencerName || 'the influencer'}

PRODUCT NAME: ${productName || 'the product'}

NUMBER OF SECTIONS TO GENERATE: ${sectionCount}

ORIGINAL VIRAL VIDEO TRANSCRIPT TO ADAPT:
---
${transcript}
---

Analyze this transcript and generate ${sectionCount} multi-shot video section(s) as structured JSON. Each section should be ~14 seconds (3-4 scenes). Adapt the spoken content into visual scenes that SHOW what the transcript describes.`

    // Try Gemini 2.5 Pro first, fallback to Flash
    const models = ['gemini-2.5-pro-preview-06-05', 'gemini-2.0-flash']
    let lastError = ''

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        const response = await fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        })

        if (!response.ok) {
          const errBody = await response.text()
          console.error(`[CloneViralPrompts] ${model} failed (${response.status}):`, errBody.substring(0, 300))
          lastError = `${model}: ${response.status}`
          continue
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        if (!text) {
          lastError = `${model}: empty response`
          continue
        }

        // Parse JSON response
        let result: any
        try {
          const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          result = JSON.parse(cleaned)
        } catch (parseErr) {
          console.error(`[CloneViralPrompts] JSON parse error:`, parseErr, 'Raw:', text.substring(0, 200))
          lastError = `${model}: invalid JSON`
          continue
        }

        // Validate structure
        if (!result.sections || !Array.isArray(result.sections) || result.sections.length === 0) {
          lastError = `${model}: invalid structure (no sections)`
          continue
        }

        // Enforce constraints on each section
        result.sections = result.sections.slice(0, sectionCount).map((section: any, idx: number) => {
          const scenes = (section.scenes || []).slice(0, 5).map((s: any) => ({
            prompt: String(s.prompt || '').substring(0, 500),
            duration: Math.max(2, Math.min(5, Math.round(Number(s.duration) || 3))),
          }))

          // Enforce total duration per section: 10-15s
          let totalDuration = scenes.reduce((sum: number, s: any) => sum + s.duration, 0)
          if (totalDuration > 15) {
            const scale = 15 / totalDuration
            scenes.forEach((s: any) => {
              s.duration = Math.max(2, Math.round(s.duration * scale))
            })
          }
          if (totalDuration < 10 && scenes.length > 0) {
            // Distribute remaining time
            const deficit = 10 - totalDuration
            const perScene = Math.ceil(deficit / scenes.length)
            scenes.forEach((s: any) => {
              s.duration = Math.min(5, s.duration + perScene)
            })
          }

          return {
            title: String(section.title || `Seccion ${idx + 1}`),
            startImagePrompt: String(section.startImagePrompt || '').substring(0, 500),
            scenes,
          }
        })

        console.log(`[CloneViralPrompts] Success with ${model}, ${result.sections.length} sections`)

        return NextResponse.json({ success: true, sections: result.sections })

      } catch (modelError: any) {
        console.error(`[CloneViralPrompts] ${model} error:`, modelError.message)
        lastError = modelError.message
        continue
      }
    }

    return NextResponse.json({ error: `Error al generar prompts: ${lastError}` }, { status: 500 })

  } catch (error: any) {
    console.error('[CloneViralPrompts] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar prompts' }, { status: 500 })
  }
}
