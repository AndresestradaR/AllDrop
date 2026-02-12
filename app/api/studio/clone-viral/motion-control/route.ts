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

    const taskResponse = await fetch('https://api.kie.ai/api/v1/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': kieApiKey,
      },
      body: JSON.stringify({
        model: 'kling-2.6/motion-control',
        input: {
          prompt: motionPrompt,
          input_urls: [pose_image_url],
          video_urls: [motion_video_url],
          duration: String(duration),
          aspect_ratio: '9:16',
          mode: 'pro',
        },
      }),
    })

    const taskData = await taskResponse.json()

    if (!taskData.data?.taskId) {
      console.error('[CloneViral/MotionControl] Task creation failed:', taskData)
      return NextResponse.json({ error: 'Error al crear tarea de motion control' }, { status: 500 })
    }

    console.log(`[CloneViral/MotionControl] User: ${user.id.substring(0, 8)}..., TaskId: ${taskData.data.taskId}`)

    return NextResponse.json({
      success: true,
      taskId: taskData.data.taskId,
      status: 'processing',
    })

  } catch (error: any) {
    console.error('[CloneViral/MotionControl] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error en motion control' }, { status: 500 })
  }
}
