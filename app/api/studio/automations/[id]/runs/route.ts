import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: Get run history for an automation
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Verify ownership
    const { data: auto } = await supabase
      .from('automations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!auto) return NextResponse.json({ error: 'Automatización no encontrada' }, { status: 404 })

    const { data: runs, error } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ runs: runs || [] })
  } catch (err: any) {
    console.error('[AutoRuns] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Trigger a manual run
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Load automation with ownership check
    const { data: automation, error: autoError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (autoError || !automation) {
      return NextResponse.json({ error: 'Automatización no encontrada' }, { status: 404 })
    }

    // Load influencer data
    const { data: influencer } = await supabase
      .from('influencers')
      .select('*')
      .eq('id', automation.influencer_id)
      .eq('user_id', user.id)
      .single()

    if (!influencer) {
      return NextResponse.json({ error: 'Influencer no encontrado' }, { status: 404 })
    }

    // Pick random scenario
    const scenarios: string[] = automation.scenarios || []
    const randomScenario = scenarios.length > 0
      ? scenarios[Math.floor(Math.random() * scenarios.length)]
      : 'Mostrando el producto de forma natural y casual'

    // Create the run record
    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert({
        automation_id: id,
        status: 'generating_prompt',
        scenario_used: randomScenario,
      })
      .select()
      .single()

    if (runError) throw runError

    // ===== STEP 1: Generate optimized video prompt via AI =====
    let videoPrompt: string
    let caption: string

    try {
      const systemPrompt = (automation.system_prompt || '')
        .replace('{voice_style}', automation.voice_style || 'latina')
        .replace('{product_name}', automation.product_name)
        .replace('{influencer_name}', influencer.name)
        .replace('{influencer_descriptor}', influencer.prompt_descriptor || influencer.name)
        .replace('{scenarios_instruction}', `ESCENARIO A USAR: "${randomScenario}"`)

      const aiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GOOGLE_AI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: 'application/json',
          },
        }),
      })

      const aiData = await aiRes.json()
      const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

      let parsed: any
      try {
        parsed = JSON.parse(text)
      } catch {
        // Try to extract JSON from text
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      }

      if (parsed?.video_prompt) {
        // For models that use image (rapido/premium), don't include descriptor in prompt
        const preset = automation.preset
        if (preset === 'producto') {
          // Sora: include full descriptor in prompt
          videoPrompt = `${influencer.prompt_descriptor || ''}\n\n${parsed.video_prompt}`
        } else {
          // Image-based: prompt describes action only
          const hasSpanish = parsed.video_prompt.toLowerCase().includes('español') || parsed.video_prompt.toLowerCase().includes('spanish')
          videoPrompt = hasSpanish ? parsed.video_prompt : `${parsed.video_prompt}, habla en español con acento ${automation.voice_style || 'latino'}`
        }
        caption = parsed.caption || ''
      } else {
        // Fallback
        videoPrompt = `${influencer.prompt_descriptor || influencer.name} ${randomScenario}. Habla en español con acento ${automation.voice_style || 'latino'}.`
        caption = `${automation.product_name} ✨ #dropshipping #colombia`
      }
    } catch (aiErr: any) {
      console.error('[AutoRun] AI prompt generation failed:', aiErr)
      videoPrompt = `${influencer.prompt_descriptor || influencer.name} ${randomScenario}. Habla en español con acento ${automation.voice_style || 'latino'}.`
      caption = `${automation.product_name} ✨ #dropshipping`
    }

    // Add hashtags if configured
    if (automation.hashtags) {
      caption = `${caption}\n\n${automation.hashtags}`
    }

    // Update run with generated prompt
    await supabase
      .from('automation_runs')
      .update({
        status: 'generating_video',
        video_prompt: videoPrompt,
        caption,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    // ===== STEP 2: Determine model and trigger video generation =====
    const presetModelMap: Record<string, { modelId: string; videoMode: string }> = {
      producto: { modelId: 'sora-2', videoMode: 'text' },
      rapido: { modelId: 'veo-3-fast', videoMode: 'image' },
      premium: { modelId: 'kling-3.0', videoMode: 'image' },
    }

    const presetConfig = presetModelMap[automation.preset] || presetModelMap.rapido

    // Prepare image if needed
    let imageBase64: string | undefined
    if (presetConfig.videoMode === 'image' && influencer.image_url) {
      try {
        const imgRes = await fetch(influencer.image_url)
        if (imgRes.ok) {
          const blob = await imgRes.arrayBuffer()
          imageBase64 = `data:image/png;base64,${Buffer.from(blob).toString('base64')}`
        }
      } catch (imgErr) {
        console.error('[AutoRun] Failed to load influencer image:', imgErr)
      }
    }

    // For Sora product mode, load product image
    if (automation.preset === 'producto' && automation.product_image_url) {
      try {
        const imgRes = await fetch(automation.product_image_url)
        if (imgRes.ok) {
          const blob = await imgRes.arrayBuffer()
          imageBase64 = `data:image/png;base64,${Buffer.from(blob).toString('base64')}`
        }
      } catch (imgErr) {
        console.error('[AutoRun] Failed to load product image:', imgErr)
      }
    }

    // Call video generation API (internal)
    const origin = req.headers.get('origin') || req.headers.get('host') || ''
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`

    const videoRes = await fetch(`${baseUrl}/api/studio/generate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        modelId: presetConfig.modelId,
        prompt: videoPrompt,
        duration: automation.duration || 10,
        aspectRatio: automation.aspect_ratio || '9:16',
        enableAudio: true,
        imageBase64,
      }),
    })

    const videoData = await videoRes.json()

    if (!videoRes.ok || (!videoData.success && !videoData.taskId)) {
      await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          error: videoData.error || 'Error generando video',
          updated_at: new Date().toISOString(),
        })
        .eq('id', run.id)

      return NextResponse.json({
        success: false,
        error: videoData.error || 'Error generando video',
        run_id: run.id,
      })
    }

    // Update run with task ID
    const newStatus = automation.mode === 'semi' ? 'awaiting_approval' : 'generating_video'
    await supabase
      .from('automation_runs')
      .update({
        status: newStatus,
        video_task_id: videoData.taskId || null,
        video_url: videoData.videoUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    // Update automation tracking
    await supabase
      .from('automations')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + (automation.frequency_hours || 12) * 3600000).toISOString(),
        total_runs: (automation.total_runs || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      run_id: run.id,
      status: newStatus,
      video_task_id: videoData.taskId,
      scenario: randomScenario,
      caption,
    })
  } catch (err: any) {
    console.error('[AutoRuns] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
