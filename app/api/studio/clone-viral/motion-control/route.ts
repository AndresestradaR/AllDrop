import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 120

const KIE_MODEL = 'kling-2.6/motion-control'

/** Try KIE createTask, return taskId or null */
async function tryKie(model: string, input: any, apiKey: string, label: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input }),
    })
    const text = await res.text()
    const data = JSON.parse(text)
    if (data.code && data.code !== 200 && data.code !== 0) {
      console.warn(`[CloneViral/MotionControl] KIE ${label} error: ${data.msg || data.message}`)
      return null
    }
    const taskId = data.data?.taskId || data.taskId
    if (taskId) {
      console.log(`[CloneViral/MotionControl] KIE ${label} OK: ${taskId}`)
      return taskId
    }
    console.warn(`[CloneViral/MotionControl] KIE ${label} no taskId`)
    return null
  } catch (e: any) {
    console.warn(`[CloneViral/MotionControl] KIE ${label} error:`, e.message)
    return null
  }
}

/**
 * Generate video using Kling motion control.
 * Takes the influencer pose image + original viral video as motion source.
 *
 * Cascade: KIE user key → KIE platform key
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { pose_image_url, motion_video_url, prompt, duration = 5 } = body as {
      pose_image_url: string
      motion_video_url: string
      prompt?: string
      duration?: number
    }

    if (!pose_image_url || !motion_video_url) {
      return NextResponse.json({ error: 'Se requiere imagen de pose y video de movimiento' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', user.id)
      .single()

    const userKieKey = profile?.kie_api_key ? decrypt(profile.kie_api_key) : null
    const platformKieKey = process.env.KIE_API_KEY || null

    if (!userKieKey && !platformKieKey) {
      return NextResponse.json({ error: 'Configura tu API key de KIE.ai en Settings' }, { status: 400 })
    }

    const motionPrompt = prompt || 'Person speaking naturally with expressive gestures, professional lighting'

    // KIE.ai Kling 2.6 Motion Control
    // Docs: https://docs.kie.ai/market/kling/motion-control
    // mode: "720p" (standard) | "1080p" (pro)
    // character_orientation: "image" (match photo, max 10s) | "video" (match video, max 30s)
    const input = {
      prompt: motionPrompt,
      input_urls: [pose_image_url],
      video_urls: [motion_video_url],
      mode: '1080p',
      character_orientation: 'video',
    }

    console.log(`[CloneViral/MotionControl] Pose: ${pose_image_url.substring(0, 80)}..., Video: ${motion_video_url.substring(0, 80)}...`)

    // Cascade: user key → platform key
    let taskId: string | null = null

    if (userKieKey) {
      taskId = await tryKie(KIE_MODEL, input, userKieKey, 'user')
    }
    if (!taskId && platformKieKey && platformKieKey !== userKieKey) {
      console.log('[CloneViral/MotionControl] Trying platform KIE key...')
      taskId = await tryKie(KIE_MODEL, input, platformKieKey, 'platform')
    }

    if (!taskId) {
      return NextResponse.json({ error: 'Error en motion control. Intenta de nuevo.' }, { status: 500 })
    }

    console.log(`[CloneViral/MotionControl] User: ${user.id.substring(0, 8)}..., TaskId: ${taskId}`)

    return NextResponse.json({
      success: true,
      taskId,
      status: 'processing',
    })

  } catch (error: any) {
    console.error('[CloneViral/MotionControl] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error en motion control' }, { status: 500 })
  }
}
