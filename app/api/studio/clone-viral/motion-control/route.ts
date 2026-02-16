import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 120

/**
 * Generate video using Kling motion control.
 * Takes the influencer pose image + original viral video as motion source.
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

    if (!profile?.kie_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de KIE.ai en Settings' }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)

    const motionPrompt = prompt || 'Person speaking naturally with expressive gestures, professional lighting'

    // KIE.ai Kling 2.6 Motion Control
    // Docs: https://docs.kie.ai/market/kling/motion-control
    // mode: "720p" (standard) | "1080p" (pro)
    // character_orientation: "image" (match photo, max 10s) | "video" (match video, max 30s)
    const taskResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        model: 'kling-2.6/motion-control',
        input: {
          prompt: motionPrompt,
          input_urls: [pose_image_url],
          video_urls: [motion_video_url],
          mode: '1080p',
          character_orientation: 'video',
        },
      }),
    })

    const responseText = await taskResponse.text()
    console.log('[CloneViral/MotionControl] KIE Response:', taskResponse.status, responseText.substring(0, 500))

    let taskData: any
    try {
      taskData = JSON.parse(responseText)
    } catch (e) {
      console.error('[CloneViral/MotionControl] Invalid JSON:', responseText.substring(0, 200))
      return NextResponse.json({ error: 'Respuesta inválida de KIE' }, { status: 500 })
    }

    // Check for API error codes (same as working deep-face tool)
    if (taskData.code !== 200 && taskData.code !== 0) {
      console.error('[CloneViral/MotionControl] API error:', JSON.stringify(taskData))
      return NextResponse.json({
        error: taskData.msg || taskData.message || 'Error en KIE API'
      }, { status: 500 })
    }

    const taskId = taskData.data?.taskId || taskData.taskId
    if (!taskId) {
      console.error('[CloneViral/MotionControl] No taskId:', JSON.stringify(taskData))
      return NextResponse.json({
        error: taskData.msg || taskData.message || 'Error al crear tarea de motion control'
      }, { status: 500 })
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
