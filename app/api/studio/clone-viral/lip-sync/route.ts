import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 120

/**
 * Generate lip-synced video using Kling AI Avatar via KIE.ai.
 * Takes influencer image + audio URL → produces talking video with lip sync.
 *
 * Model: kling/ai-avatar-pro (1080p) or kling/ai-avatar-standard (720p)
 * Docs: https://kie.ai/kling-ai-avatar
 *
 * Input: image_url (JPEG/PNG/WEBP, max 10MB) + audio_url (MP3/WAV/AAC, max 10MB, max 15s)
 * Channel: fal_request
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      image_url,
      audio_url,
      prompt = 'Person speaking naturally with expressive facial expressions, professional lighting',
      quality = 'standard', // 'standard' (720p) or 'pro' (1080p)
    } = body as {
      image_url: string
      audio_url: string
      prompt?: string
      quality?: 'standard' | 'pro'
    }

    if (!image_url || !audio_url) {
      return NextResponse.json({ error: 'Se requiere imagen del influencer y URL del audio' }, { status: 400 })
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

    const model = quality === 'pro' ? 'kling/ai-avatar-pro' : 'kling/ai-avatar-standard'

    console.log(`[CloneViral/LipSync] Model: ${model}, Image: ${image_url.substring(0, 80)}..., Audio: ${audio_url.substring(0, 80)}...`)

    const taskResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        model,
        input: {
          image_url,
          audio_url,
          prompt,
        },
      }),
    })

    const responseText = await taskResponse.text()
    console.log('[CloneViral/LipSync] KIE Response:', taskResponse.status, responseText.substring(0, 500))

    let taskData: any
    try {
      taskData = JSON.parse(responseText)
    } catch (e) {
      console.error('[CloneViral/LipSync] Invalid JSON:', responseText.substring(0, 200))
      return NextResponse.json({ error: 'Respuesta inválida de KIE' }, { status: 500 })
    }

    if (taskData.code && taskData.code !== 200) {
      console.error('[CloneViral/LipSync] KIE error:', taskData.msg || taskData.message)
      return NextResponse.json({
        error: taskData.msg || taskData.message || 'Error en KIE al crear lip sync'
      }, { status: 500 })
    }

    const taskId = taskData.data?.taskId || taskData.taskId
    if (!taskId) {
      console.error('[CloneViral/LipSync] No taskId:', JSON.stringify(taskData))
      return NextResponse.json({
        error: 'No se recibió taskId de KIE'
      }, { status: 500 })
    }

    console.log(`[CloneViral/LipSync] User: ${user.id.substring(0, 8)}..., TaskId: ${taskId}`)

    return NextResponse.json({
      success: true,
      taskId,
      status: 'processing',
    })

  } catch (error: any) {
    console.error('[CloneViral/LipSync] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error en lip sync' }, { status: 500 })
  }
}
