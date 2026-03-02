import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 120

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
      console.warn(`[CloneViral/LipSync] KIE ${label} error: ${data.msg || data.message}`)
      return null
    }
    const taskId = data.data?.taskId || data.taskId
    if (taskId) {
      console.log(`[CloneViral/LipSync] KIE ${label} OK: ${taskId}`)
      return taskId
    }
    console.warn(`[CloneViral/LipSync] KIE ${label} no taskId`)
    return null
  } catch (e: any) {
    console.warn(`[CloneViral/LipSync] KIE ${label} error:`, e.message)
    return null
  }
}

/**
 * Generate lip-synced video using Kling AI Avatar via KIE.ai.
 * Takes influencer image + audio URL → produces talking video with lip sync.
 *
 * Model: kling/ai-avatar-pro (1080p) or kling/ai-avatar-standard (720p)
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

    const userKieKey = profile?.kie_api_key ? decrypt(profile.kie_api_key) : null
    const platformKieKey = process.env.KIE_API_KEY || null

    if (!userKieKey && !platformKieKey) {
      return NextResponse.json({ error: 'Configura tu API key de KIE.ai en Settings' }, { status: 400 })
    }

    const model = quality === 'pro' ? 'kling/ai-avatar-pro' : 'kling/ai-avatar-standard'
    const input = { image_url, audio_url, prompt }

    console.log(`[CloneViral/LipSync] Model: ${model}, Image: ${image_url.substring(0, 80)}..., Audio: ${audio_url.substring(0, 80)}...`)

    // Cascade: user key → platform key
    let taskId: string | null = null

    if (userKieKey) {
      taskId = await tryKie(model, input, userKieKey, 'user')
    }
    if (!taskId && platformKieKey && platformKieKey !== userKieKey) {
      console.log('[CloneViral/LipSync] Trying platform KIE key...')
      taskId = await tryKie(model, input, platformKieKey, 'platform')
    }

    if (!taskId) {
      return NextResponse.json({ error: 'Error en lip sync. Intenta de nuevo.' }, { status: 500 })
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
