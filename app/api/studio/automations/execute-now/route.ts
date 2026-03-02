import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import {
  generateVideo,
  VIDEO_MODELS,
  type VideoModelId,
} from '@/lib/video-providers'
import { generateAIText, getAIKeys } from '@/lib/services/ai-text'

import sharp from 'sharp'

export const maxDuration = 120

const VOICE_INSTRUCTIONS: Record<string, string> = {
  paisa: 'Habla en español colombiano con acento paisa de Medellín, usa expresiones como "pues", "ve", "parcero". Tono cálido y cercano.',
  latina: 'Habla en español latino neutro, natural y cercano. Sin acento marcado específico.',
  rola: 'Habla en español colombiano con acento bogotano/rolo. Tono urbano, moderno.',
  costena: 'Habla en español colombiano con acento costeño del Caribe. Alegre, expresivo, con sabor.',
  personalizada: '',
}

function getModelIdFromPreset(preset: string): VideoModelId {
  switch (preset) {
    case 'producto': return 'sora-2' as VideoModelId
    case 'rapido': return 'veo-3.1-fast' as VideoModelId
    case 'premium': return 'kling-3.0' as VideoModelId
    default: return 'veo-3.1-fast' as VideoModelId
  }
}

function getDurationFromPreset(preset: string): number {
  switch (preset) {
    case 'producto': return 10
    case 'rapido': return 8
    case 'premium': return 15
    default: return 8
  }
}

/**
 * Resolve image hosting page URLs (ibb.co, imgur, etc.) to direct image URLs.
 * Many users paste the page URL instead of the direct image link.
 * This fetches the HTML page and extracts og:image meta tag.
 */
async function resolveImageUrl(url: string): Promise<string> {
  // Already a direct image URL
  if (/\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(url)) {
    return url
  }

  // Already a known direct image host
  if (url.includes('i.ibb.co/') || url.includes('i.imgur.com/') || url.includes('supabase.co/storage/')) {
    return url
  }

  // ibb.co page URL → fetch HTML and extract og:image
  // imgur.com page URL → same pattern
  const needsResolve = url.includes('ibb.co/') || url.includes('imgur.com/')
  if (!needsResolve) {
    return url
  }

  try {
    console.log(`[ResolveImage] Resolving page URL: ${url}`)
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(tid)

    if (!res.ok) {
      console.warn(`[ResolveImage] Page returned ${res.status}`)
      return url
    }

    const contentType = res.headers.get('content-type') || ''

    // If response is already an image, the URL was direct after all
    if (contentType.startsWith('image/')) {
      console.log(`[ResolveImage] URL is already direct image (${contentType})`)
      return url
    }

    // Parse HTML to find og:image
    const html = await res.text()

    // Try og:image first (most reliable)
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i)
    if (ogMatch?.[1]) {
      console.log(`[ResolveImage] Found og:image: ${ogMatch[1]}`)
      return ogMatch[1]
    }

    // Try image-url meta (imgbb specific)
    const imgbbMatch = html.match(/<link\s+rel="image_src"\s+href="([^"]+)"/i)
    if (imgbbMatch?.[1]) {
      console.log(`[ResolveImage] Found image_src: ${imgbbMatch[1]}`)
      return imgbbMatch[1]
    }

    // Try Twitter card image
    const twMatch = html.match(/<meta\s+(?:property|name)="twitter:image"\s+content="([^"]+)"/i)
      || html.match(/content="([^"]+)"\s+(?:property|name)="twitter:image"/i)
    if (twMatch?.[1]) {
      console.log(`[ResolveImage] Found twitter:image: ${twMatch[1]}`)
      return twMatch[1]
    }

    console.warn(`[ResolveImage] Could not extract direct image URL from page`)
    return url
  } catch (err: any) {
    console.warn(`[ResolveImage] Failed: ${err.message}`)
    return url
  }
}

/**
 * Download an image from any URL and re-upload to Supabase as JPEG.
 * Kling 3.0 only accepts jpeg/jpg/png - external URLs (ibb.co, etc.)
 * often serve webp which Kling rejects.
 */
async function ensureJpegUrl(
  url: string,
  supabase: any,
  userId: string,
  label: string
): Promise<string> {
  // Supabase storage URLs with .jpg/.jpeg/.png extension are already OK
  if (url.includes('supabase.co/storage/') && /\.(jpg|jpeg|png)(\?.*)?$/i.test(url)) {
    return url
  }

  try {
    console.log(`[EnsureJpeg] Converting: ${url.substring(0, 80)}...`)
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(tid)

    if (!res.ok) {
      console.warn(`[EnsureJpeg] Download failed: ${res.status}`)
      return url // fallback to original
    }

    const arrayBuffer = await res.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Convert to JPEG using sharp (handles png, webp, avif, etc.)
    const jpegBuffer = await sharp(inputBuffer)
      .jpeg({ quality: 90 })
      .toBuffer()

    const filename = `studio/video/${userId}/auto-${label}-${Date.now()}.jpg`
    const { error: uploadErr } = await supabase.storage
      .from('landing-images')
      .upload(filename, jpegBuffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadErr) {
      console.warn(`[EnsureJpeg] Upload failed: ${uploadErr.message}`)
      return url
    }

    const { data: urlData } = supabase.storage
      .from('landing-images')
      .getPublicUrl(filename)

    console.log(`[EnsureJpeg] OK: ${urlData.publicUrl}`)
    return urlData.publicUrl
  } catch (err: any) {
    console.warn(`[EnsureJpeg] Failed: ${err.message}`)
    return url // fallback
  }
}

const OPTIMIZE_PROMPT_SYSTEM = `You are an expert video prompt optimizer for AI video generation models. Your job is to take a character description and a user's video idea, and produce a highly detailed, model-optimized prompt.

RULES:
1. Output ONLY the optimized prompt text - no explanations, no markdown.
2. Keep the character description intact but enhance the scene details.
3. Add camera movements, lighting, and mood descriptions.
4. Keep the prompt under 500 characters for Kling models, under 1000 for others.
5. For UGC/dropshipping content: natural, iPhone-style, candid feel.
6. Always include "speaks in Spanish with a feminine voice" when the character is female.
7. Always include "speaks in Spanish with a masculine voice" when the character is male.
8. The character must match the descriptor exactly - preserve gender, ethnicity, age.`

/**
 * POST — Execute a flow immediately (manual trigger)
 * Calls APIs directly — no internal HTTP sub-requests.
 */
export async function POST(request: Request) {
  const t0 = Date.now()
  const timing = (label: string) => console.log(`[ExecuteNow] ${label} [+${Date.now() - t0}ms]`)

  try {
    timing('Start')

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    timing('Auth OK')

    const body = await request.json()
    const { flowId } = body as { flowId: string }

    if (!flowId) {
      return NextResponse.json({ error: 'flowId es requerido' }, { status: 400 })
    }

    // Fetch flow with influencer
    const { data: flow, error: flowError } = await supabase
      .from('automation_flows')
      .select(`
        *,
        influencer:influencers(id, name, image_url, realistic_image_url, prompt_descriptor)
      `)
      .eq('id', flowId)
      .eq('user_id', user.id)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
    }
    timing('Flow fetched')

    const influencer = flow.influencer
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer no encontrado' }, { status: 400 })
    }

    // Get API keys
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key, kie_api_key, fal_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.kie_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de KIE.ai en Settings' }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)
    const falApiKey = profile?.fal_api_key ? decrypt(profile.fal_api_key) : undefined

    // Get AI text keys for prompt optimization cascade (KIE→OAI→Google)
    const aiKeys = await getAIKeys(supabase, user.id)

    console.log(`[ExecuteNow] KIE key: ${kieApiKey.substring(0, 6)}...${kieApiKey.substring(kieApiKey.length - 4)} (${kieApiKey.length} chars)`)
    timing('Keys decrypted')

    // 1. Pick random scenario
    const scenarios = flow.scenarios || []
    const scenario = scenarios.length > 0
      ? scenarios[Math.floor(Math.random() * scenarios.length)]
      : 'Mostrando el producto a cámara y hablando natural'

    // 2. Create run record
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert({
        flow_id: flow.id,
        user_id: user.id,
        scenario_used: scenario,
        status: 'generating_prompt',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (runError) {
      return NextResponse.json({ error: `Error creando run: ${runError.message}` }, { status: 500 })
    }
    timing('Run created')

    // 3. Generate optimized prompt (with strict timeouts)
    const voiceInstruction = flow.voice_style === 'personalizada'
      ? flow.voice_custom_instruction
      : VOICE_INSTRUCTIONS[flow.voice_style] || VOICE_INSTRUCTIONS.latina

    const userIdea = `${scenario}. Producto: ${flow.product_name}. ${flow.product_benefits ? `Beneficios: ${flow.product_benefits}.` : ''} ${voiceInstruction}`

    const modelId = getModelIdFromPreset(flow.video_preset)
    let finalPrompt = userIdea

    // Optimize prompt via ai-text cascade (KIE→OpenAI→Google Gemini)
    try {
      const optimizeMessage = `CHARACTER DESCRIPTOR: ${influencer.prompt_descriptor || ''}
VIDEO IDEA: ${userIdea}
TARGET MODEL: ${modelId}
PRESET: ${flow.video_preset}

Generate an optimized video prompt.`

      const optimized = await generateAIText(aiKeys, {
        systemPrompt: OPTIMIZE_PROMPT_SYSTEM,
        userMessage: optimizeMessage,
        temperature: 0.7,
      })
      if (optimized?.trim()) {
        if (flow.video_preset === 'producto') {
          finalPrompt = `${influencer.prompt_descriptor || ''}\n\n${optimized.trim()}`
        } else {
          finalPrompt = optimized.trim()
          if (!finalPrompt.toLowerCase().includes('español')) {
            finalPrompt += `. ${voiceInstruction}`
          }
        }
        console.log(`[ExecuteNow] Prompt optimized (${finalPrompt.length} chars)`)
      }
    } catch (err: any) {
      console.warn('[ExecuteNow] Prompt optimization failed, using raw:', err.message)
    }
    timing('Prompt ready')

    // Update run with prompt
    await supabase
      .from('automation_runs')
      .update({
        prompt_generated: finalPrompt,
        status: 'generating_video',
        video_model: modelId,
      })
      .eq('id', run.id)

    // 4. Generate video directly via lib (no HTTP sub-request)
    const modelConfig = VIDEO_MODELS[modelId]
    const imageUrls: string[] = []

    // Resolve product image URL (ibb.co page → direct image URL)
    let resolvedProductUrl: string | null = null
    if (flow.product_image_url) {
      resolvedProductUrl = await resolveImageUrl(flow.product_image_url)
      console.log(`[ExecuteNow] Product image: ${flow.product_image_url} → ${resolvedProductUrl}`)
    }

    // Kling 3.0 only accepts jpeg/jpg/png - convert images via sharp
    const isKling = flow.video_preset === 'premium'

    // Build image list for video generation
    if (flow.video_preset !== 'producto') {
      const influencerImgUrl = influencer.realistic_image_url || influencer.image_url
      if (influencerImgUrl && modelConfig?.supportsStartEndFrames) {
        const url = isKling
          ? await ensureJpegUrl(influencerImgUrl, supabase, user.id, 'influencer')
          : influencerImgUrl
        imageUrls.push(url)
      }
      if (resolvedProductUrl) {
        const url = isKling
          ? await ensureJpegUrl(resolvedProductUrl, supabase, user.id, 'product')
          : resolvedProductUrl
        imageUrls.push(url)
      }
    } else if (resolvedProductUrl && modelConfig?.supportsStartEndFrames) {
      const url = isKling
        ? await ensureJpegUrl(resolvedProductUrl, supabase, user.id, 'product')
        : resolvedProductUrl
      imageUrls.push(url)
    }

    // For Veo, set generation type
    let veoGenerationType: 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO' | undefined
    if (flow.video_preset === 'rapido') {
      if (imageUrls.length >= 2) {
        // Both influencer + product → REFERENCE mode so Veo sees both
        veoGenerationType = 'REFERENCE_2_VIDEO'
      } else if (imageUrls.length === 1) {
        veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
      } else {
        veoGenerationType = 'TEXT_2_VIDEO'
      }
    }

    // Read model-specific options from flow
    const videoOpts = flow.video_options || {}

    const generationParams: Parameters<typeof generateVideo>[0] = {
      modelId,
      prompt: finalPrompt,
      duration: getDurationFromPreset(flow.video_preset),
      aspectRatio: '9:16',
      resolution: modelConfig?.defaultResolution,
      enableAudio: flow.video_preset !== 'producto',
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      veoGenerationType,
    }

    // Kling 3.0 specific options from flow config
    if (flow.video_preset === 'premium') {
      generationParams.enableAudio = videoOpts.sound !== false // default ON
      generationParams.klingMode = videoOpts.kling_mode || 'pro'
    }

    console.log(`[ExecuteNow] === CALLING KIE API ===`)
    console.log(`[ExecuteNow] Model: ${modelId}, Preset: ${flow.video_preset}`)
    console.log(`[ExecuteNow] VeoType: ${veoGenerationType}, Images: ${imageUrls.length}`)
    console.log(`[ExecuteNow] Params:`, JSON.stringify({ ...generationParams, prompt: generationParams.prompt?.substring(0, 80) + '...' }))
    timing('Calling generateVideo')

    const result = await generateVideo(generationParams, kieApiKey, falApiKey)

    timing('generateVideo returned')
    console.log(`[ExecuteNow] Result:`, JSON.stringify(result))

    if (!result.success || !result.taskId) {
      const errorMsg = result.error || 'Error generating video'
      console.error(`[ExecuteNow] FAILED: ${errorMsg}`)
      await supabase
        .from('automation_runs')
        .update({ status: 'failed', error_message: errorMsg, completed_at: new Date().toISOString() })
        .eq('id', run.id)
      return NextResponse.json({ error: errorMsg }, { status: 500 })
    }

    // Save task ID
    await supabase
      .from('automation_runs')
      .update({
        video_task_id: result.taskId,
        status: 'generating_video',
      })
      .eq('id', run.id)

    timing('DONE - task saved')
    console.log(`[ExecuteNow] ✓ Task: ${result.taskId} (${result.provider})`)

    return NextResponse.json({
      success: true,
      runId: run.id,
      taskId: result.taskId,
      scenario,
      status: 'generating_video',
      provider: result.provider,
      message: 'Video en generación. Se actualizará automáticamente.',
    })

  } catch (error: any) {
    const elapsed = Date.now() - t0
    console.error(`[ExecuteNow] EXCEPTION at +${elapsed}ms:`, error.message, error.stack?.substring(0, 300))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
