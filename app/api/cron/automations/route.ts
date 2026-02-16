import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Vercel Cron: runs every hour
// vercel.json: { "crons": [{ "path": "/api/cron/automations", "schedule": "0 * * * *" }] }

const VOICE_INSTRUCTIONS: Record<string, string> = {
  paisa: 'Habla en español colombiano con acento paisa de Medellín, usa expresiones como "pues", "ve", "parcero". Tono cálido y cercano.',
  latina: 'Habla en español latino neutro, natural y cercano. Sin acento marcado específico.',
  rola: 'Habla en español colombiano con acento bogotano/rolo. Tono urbano, moderno.',
  costena: 'Habla en español colombiano con acento costeño del Caribe. Alegre, expresivo, con sabor.',
  personalizada: '', // uses voice_custom_instruction
}

export async function GET(request: Request) {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Also allow manual trigger in dev
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Use service role for cross-user operations
    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()

    // Fetch active flows where next_run_at <= now
    const { data: flows, error: flowsError } = await supabase
      .from('automation_flows')
      .select(`
        *,
        influencer:influencers(id, name, image_url, realistic_image_url, prompt_descriptor)
      `)
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString())
      .limit(10) // Process max 10 per cron cycle

    if (flowsError) {
      console.error('[Cron/Automations] Error fetching flows:', flowsError.message)
      return NextResponse.json({ error: flowsError.message }, { status: 500 })
    }

    if (!flows || flows.length === 0) {
      return NextResponse.json({ message: 'No flows to execute', processed: 0 })
    }

    console.log(`[Cron/Automations] Processing ${flows.length} flows`)

    const results: any[] = []

    for (const flow of flows) {
      try {
        const result = await executeFlow(supabase, flow)
        results.push({ flowId: flow.id, name: flow.name, ...result })
      } catch (err: any) {
        console.error(`[Cron/Automations] Flow ${flow.id} failed:`, err.message)
        results.push({ flowId: flow.id, name: flow.name, error: err.message })
      }

      // Update next_run_at based on schedule_times
      const scheduleTimes = flow.schedule_times || ['08:00', '20:00']
      const nextRunAt = calculateNextRunAt(scheduleTimes)
      await supabase
        .from('automation_flows')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRunAt,
        })
        .eq('id', flow.id)
    }

    return NextResponse.json({ processed: results.length, results })

  } catch (error: any) {
    console.error('[Cron/Automations] Fatal error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Also check for pending video polls
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check runs that are generating_video and poll their status
    const { data: pendingRuns } = await supabase
      .from('automation_runs')
      .select('*, flow:automation_flows(*)')
      .eq('status', 'generating_video')
      .not('video_task_id', 'is', null)
      .limit(20)

    if (!pendingRuns || pendingRuns.length === 0) {
      return NextResponse.json({ message: 'No pending video polls', checked: 0 })
    }

    console.log(`[Cron/Automations] Polling ${pendingRuns.length} pending videos`)

    let completed = 0
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    for (const run of pendingRuns) {
      try {
        const statusRes = await fetch(`${appUrl}/api/studio/video-status?taskId=${run.video_task_id}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'completed' && statusData.videoUrl) {
          // Video ready!
          const flow = run.flow
          const newStatus = flow?.mode === 'auto' ? 'publishing' : 'awaiting_approval'

          // Generate caption with IA
          let caption = ''
          try {
            caption = await generateCaption(appUrl, flow, run.scenario_used)
          } catch {
            caption = `${flow?.product_name || 'Producto'} ✨ #dropshipping #colombia`
          }

          await supabase
            .from('automation_runs')
            .update({
              status: newStatus,
              video_url: statusData.videoUrl,
              caption,
            })
            .eq('id', run.id)

          // If auto mode, publish immediately
          if (newStatus === 'publishing' && flow) {
            try {
              await publishToSocial(appUrl, flow, statusData.videoUrl, caption)
              await supabase
                .from('automation_runs')
                .update({
                  status: 'published',
                  published_at: new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                })
                .eq('id', run.id)
            } catch (pubErr: any) {
              await supabase
                .from('automation_runs')
                .update({
                  status: 'failed',
                  error_message: `Publish error: ${pubErr.message}`,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', run.id)
            }
          }

          completed++

        } else if (statusData.status === 'failed') {
          await supabase
            .from('automation_runs')
            .update({
              status: 'failed',
              error_message: statusData.error || 'Video generation failed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', run.id)
          completed++

        } else {
          // Check if it's been too long (> 15 min)
          const started = new Date(run.started_at || run.created_at)
          const elapsed = Date.now() - started.getTime()
          if (elapsed > 15 * 60 * 1000) {
            await supabase
              .from('automation_runs')
              .update({
                status: 'failed',
                error_message: 'Video generation timed out (>15 min)',
                completed_at: new Date().toISOString(),
              })
              .eq('id', run.id)
            completed++
          }
        }
      } catch (err: any) {
        console.error(`[Cron/Automations] Poll error for run ${run.id}:`, err.message)
      }
    }

    return NextResponse.json({ checked: pendingRuns.length, completed })

  } catch (error: any) {
    console.error('[Cron/Automations] Poll error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// =============================================
// EXECUTE A SINGLE FLOW
// =============================================
async function executeFlow(supabase: any, flow: any) {
  const influencer = flow.influencer
  if (!influencer) throw new Error('Influencer not found')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
      user_id: flow.user_id,
      scenario_used: scenario,
      status: 'generating_prompt',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (runError) throw new Error(`Failed to create run: ${runError.message}`)

  try {
    // 3. Generate optimized prompt using visual-analysis API
    const voiceInstruction = flow.voice_style === 'personalizada'
      ? flow.voice_custom_instruction
      : VOICE_INSTRUCTIONS[flow.voice_style] || VOICE_INSTRUCTIONS.latina

    const userIdea = `${scenario}. Producto: ${flow.product_name}. ${flow.product_benefits ? `Beneficios: ${flow.product_benefits}.` : ''} ${voiceInstruction}`

    const promptRes = await fetch(`${appUrl}/api/studio/influencer/visual-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    let finalPrompt = ''

    if (promptData.optimized_prompt) {
      if (flow.video_preset === 'producto') {
        // Sora: include descriptor
        finalPrompt = `${influencer.prompt_descriptor || ''}\n\n${promptData.optimized_prompt}`
      } else {
        finalPrompt = promptData.optimized_prompt
        if (!finalPrompt.toLowerCase().includes('español')) {
          finalPrompt += `. ${voiceInstruction}`
        }
      }
    } else {
      finalPrompt = `${userIdea}. ${voiceInstruction}`
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
      enableAudio: flow.video_preset !== 'producto', // Sora no audio
    }

    // For rapido/premium presets, include influencer image
    if (flow.video_preset !== 'producto') {
      const imageUrl = influencer.realistic_image_url || influencer.image_url
      if (imageUrl) {
        // Fetch and convert to base64
        try {
          const imgRes = await fetch(imageUrl)
          if (imgRes.ok) {
            const imgBuffer = await imgRes.arrayBuffer()
            const base64 = Buffer.from(imgBuffer).toString('base64')
            const contentType = imgRes.headers.get('content-type') || 'image/png'
            videoBody.imageBase64 = `data:${contentType};base64,${base64}`
          }
        } catch (imgErr) {
          console.warn(`[Cron] Failed to fetch influencer image: ${imgErr}`)
        }
      }
    }

    // For producto preset with product image
    if (flow.video_preset === 'producto' && flow.product_image_url) {
      try {
        const imgRes = await fetch(flow.product_image_url)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          const base64 = Buffer.from(imgBuffer).toString('base64')
          const contentType = imgRes.headers.get('content-type') || 'image/png'
          videoBody.imageBase64 = `data:${contentType};base64,${base64}`
        }
      } catch (imgErr) {
        console.warn(`[Cron] Failed to fetch product image: ${imgErr}`)
      }
    }

    // For Veo preset
    if (flow.video_preset === 'rapido') {
      videoBody.veoGenerationType = videoBody.imageBase64
        ? 'FIRST_AND_LAST_FRAMES_2_VIDEO'
        : 'TEXT_2_VIDEO'
      if (videoBody.imageBase64) {
        videoBody.veoImages = [videoBody.imageBase64]
        delete videoBody.imageBase64
      }
    }

    const videoRes = await fetch(`${appUrl}/api/studio/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoBody),
    })

    const videoData = await videoRes.json()

    if (!videoRes.ok || (!videoData.success && !videoData.taskId)) {
      throw new Error(videoData.error || 'Error generating video')
    }

    // Save taskId for polling
    await supabase
      .from('automation_runs')
      .update({
        video_task_id: videoData.taskId || null,
        video_url: videoData.videoUrl || null,
        status: videoData.videoUrl ? 'video_ready' : 'generating_video',
      })
      .eq('id', run.id)

    return {
      status: 'started',
      runId: run.id,
      scenario,
      taskId: videoData.taskId,
    }

  } catch (err: any) {
    await supabase
      .from('automation_runs')
      .update({
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    throw err
  }
}

// =============================================
// HELPERS
// =============================================
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

async function generateCaption(appUrl: string, flow: any, scenario: string): Promise<string> {
  const voiceInstruction = flow.voice_style === 'personalizada'
    ? flow.voice_custom_instruction
    : VOICE_INSTRUCTIONS[flow.voice_style] || ''

  // Use the system prompt + product info to generate caption
  const res = await fetch(`${appUrl}/api/studio/influencer/visual-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      influencerId: flow.influencer_id,
      generateCaption: true,
      productName: flow.product_name,
      productBenefits: flow.product_benefits,
      scenario,
      voiceStyle: voiceInstruction,
    }),
  })

  const data = await res.json()
  return data.caption || `${flow.product_name} ✨ #dropshipping #colombia #belleza`
}

async function publishToSocial(appUrl: string, flow: any, videoUrl: string, caption: string) {
  const accountIds = flow.account_ids || []
  if (accountIds.length === 0) throw new Error('No accounts configured')

  const res = await fetch(`${appUrl}/api/publer/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountIds,
      text: caption,
      contentType: 'video',
      mediaUrl: videoUrl,
    }),
  })

  const data = await res.json()
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'Publish failed')
  }
  return data
}

// Calculate next run time based on schedule_times (Colombia UTC-5)
function calculateNextRunAt(scheduleTimes: string[]): string {
  if (!scheduleTimes || scheduleTimes.length === 0) {
    // Default: 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  const now = new Date()
  const colombiaOffset = -5 * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const colombiaMinutes = utcMinutes + colombiaOffset
  const colombiaHour = Math.floor(((colombiaMinutes % 1440) + 1440) % 1440 / 60)
  const colombiaMin = ((colombiaMinutes % 1440) + 1440) % 1440 % 60

  const times = scheduleTimes
    .map(t => {
      const [h, m] = t.split(':').map(Number)
      return { h, m, total: h * 60 + m }
    })
    .sort((a, b) => a.total - b.total)

  const currentTotal = colombiaHour * 60 + colombiaMin

  // Find next time AFTER current (with 30 min buffer to avoid re-triggering)
  let nextTime = times.find(t => t.total > currentTotal + 30)
  let daysToAdd = 0

  if (!nextTime) {
    nextTime = times[0]
    daysToAdd = 1
  }

  const nextDate = new Date(now)
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd)
  const nextUtcHour = nextTime.h + 5
  nextDate.setUTCHours(nextUtcHour % 24, nextTime.m, 0, 0)
  if (nextUtcHour >= 24) {
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  }

  return nextDate.toISOString()
}
