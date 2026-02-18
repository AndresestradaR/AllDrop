import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getPublerCredentials,
  getAccounts,
  uploadMediaDirect,
  downloadFileAsBuffer,
  pollJobUntilComplete,
} from '@/lib/services/publer'

export const maxDuration = 120

const VOICE_INSTRUCTIONS: Record<string, string> = {
  paisa: 'Habla en español colombiano con acento paisa de Medellín, usa expresiones como "pues", "ve", "parcero". Tono cálido y cercano.',
  latina: 'Habla en español latino neutro, natural y cercano. Sin acento marcado específico.',
  rola: 'Habla en español colombiano con acento bogotano/rolo. Tono urbano, moderno.',
  costena: 'Habla en español colombiano con acento costeño del Caribe. Alegre, expresivo, con sabor.',
  personalizada: '',
}

function getModelIdFromPreset(preset: string): string {
  switch (preset) {
    case 'producto': return 'sora-2'
    case 'rapido': return 'veo-3-fast'
    case 'premium': return 'kling-3.0'
    default: return 'veo-3-fast'
  }
}

function getDurationFromPreset(preset: string): number {
  switch (preset) {
    case 'producto': return 10
    case 'rapido': return 8
    case 'premium': return 10
    default: return 8
  }
}

/**
 * POST — Execute a flow immediately (manual trigger)
 * Runs the full pipeline: generate prompt → generate video → poll → publish
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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

    const influencer = flow.influencer
    if (!influencer) {
      return NextResponse.json({ error: 'Influencer no encontrado' }, { status: 400 })
    }

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

    // 3. Generate prompt via visual-analysis
    const voiceInstruction = flow.voice_style === 'personalizada'
      ? flow.voice_custom_instruction
      : VOICE_INSTRUCTIONS[flow.voice_style] || VOICE_INSTRUCTIONS.latina

    const userIdea = `${scenario}. Producto: ${flow.product_name}. ${flow.product_benefits ? `Beneficios: ${flow.product_benefits}.` : ''} ${voiceInstruction}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let finalPrompt = userIdea
    try {
      const promptRes = await fetch(`${appUrl}/api/studio/influencer/visual-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || '',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          influencerId: influencer.id,
          optimizeVideoPrompt: true,
          videoModelId: getModelIdFromPreset(flow.video_preset),
          userIdea,
          promptDescriptor: influencer.prompt_descriptor || '',
          presetId: flow.video_preset,
        }),
      })

      const promptData = await promptRes.json()
      if (promptData.optimized_prompt) {
        if (flow.video_preset === 'producto') {
          finalPrompt = `${influencer.prompt_descriptor || ''}\n\n${promptData.optimized_prompt}`
        } else {
          finalPrompt = promptData.optimized_prompt
          if (!finalPrompt.toLowerCase().includes('español')) {
            finalPrompt += `. ${voiceInstruction}`
          }
        }
      }
    } catch (promptErr: any) {
      console.warn('[ExecuteNow] Prompt optimization failed, using raw:', promptErr.message)
    }

    // Update run with prompt
    await supabase
      .from('automation_runs')
      .update({
        prompt_generated: finalPrompt,
        status: 'generating_video',
        video_model: getModelIdFromPreset(flow.video_preset),
      })
      .eq('id', run.id)

    // 4. Generate video
    const videoBody: any = {
      modelId: getModelIdFromPreset(flow.video_preset),
      prompt: finalPrompt,
      duration: getDurationFromPreset(flow.video_preset),
      aspectRatio: '9:16',
      enableAudio: flow.video_preset !== 'producto',
    }

    // Include influencer image for non-producto presets
    if (flow.video_preset !== 'producto') {
      const imageUrl = influencer.realistic_image_url || influencer.image_url
      if (imageUrl) {
        videoBody.imageUrl = imageUrl // Use direct URL (no base64 round-trip)
      }
    }

    // Product image for producto preset
    if (flow.video_preset === 'producto' && flow.product_image_url) {
      videoBody.imageUrl = flow.product_image_url
    }

    // Veo preset adjustments
    if (flow.video_preset === 'rapido') {
      if (videoBody.imageUrl) {
        // Veo needs veoImages array, download and convert
        try {
          const imgRes = await fetch(videoBody.imageUrl)
          if (imgRes.ok) {
            const imgBuffer = await imgRes.arrayBuffer()
            const base64 = Buffer.from(imgBuffer).toString('base64')
            const contentType = imgRes.headers.get('content-type') || 'image/png'
            videoBody.veoImages = [`data:${contentType};base64,${base64}`]
            videoBody.veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
            delete videoBody.imageUrl
          }
        } catch {
          videoBody.veoGenerationType = 'TEXT_2_VIDEO'
          delete videoBody.imageUrl
        }
      } else {
        videoBody.veoGenerationType = 'TEXT_2_VIDEO'
      }
    }

    const videoRes = await fetch(`${appUrl}/api/studio/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-user-id': user.id,
      },
      body: JSON.stringify(videoBody),
    })

    const videoData = await videoRes.json()

    if (!videoRes.ok || (!videoData.success && !videoData.taskId)) {
      await supabase
        .from('automation_runs')
        .update({ status: 'failed', error_message: videoData.error || 'Error generating video', completed_at: new Date().toISOString() })
        .eq('id', run.id)
      return NextResponse.json({ error: videoData.error || 'Error generando video' }, { status: 500 })
    }

    // Save task ID
    await supabase
      .from('automation_runs')
      .update({
        video_task_id: videoData.taskId || null,
        status: 'generating_video',
      })
      .eq('id', run.id)

    // Return immediately — the cron will poll for completion and publish
    // Or the user can watch from the runs view
    return NextResponse.json({
      success: true,
      runId: run.id,
      taskId: videoData.taskId,
      scenario,
      status: 'generating_video',
      message: 'Ejecucion iniciada. El video se generara y publicara automaticamente.',
    })

  } catch (error: any) {
    console.error('[ExecuteNow] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
