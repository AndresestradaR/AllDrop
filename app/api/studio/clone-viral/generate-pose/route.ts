import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

const KIE_MODEL = 'kling-2.6/image'

/** Try KIE createTask, return taskId or null */
async function tryKie(model: string, input: any, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input }),
    })
    const text = await res.text()
    const data = JSON.parse(text)
    const taskId = data.data?.taskId || data.taskId
    if (taskId) {
      console.log(`[CloneViral/GeneratePose] KIE OK: ${taskId}`)
      return taskId
    }
    console.warn(`[CloneViral/GeneratePose] KIE no taskId:`, text.substring(0, 300))
    return null
  } catch (e: any) {
    console.warn(`[CloneViral/GeneratePose] KIE error:`, e.message)
    return null
  }
}

/**
 * Generate influencer pose matching the viral video frame.
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
    const { frame_url, influencer_image_url, prompt_descriptor } = body as {
      frame_url: string
      influencer_image_url: string
      prompt_descriptor: string
    }

    if (!frame_url || !influencer_image_url) {
      return NextResponse.json({ error: 'Se requiere frame e imagen del influencer' }, { status: 400 })
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

    const prompt = prompt_descriptor
      ? `${prompt_descriptor}, same pose and angle as reference, professional photo`
      : 'Person in the same pose and angle as the reference image, professional photo'

    const input = {
      prompt,
      image_urls: [influencer_image_url, frame_url],
      aspect_ratio: '9:16',
    }

    // Cascade: user key → platform key
    let taskId: string | null = null

    if (userKieKey) {
      taskId = await tryKie(KIE_MODEL, input, userKieKey)
    }
    if (!taskId && platformKieKey && platformKieKey !== userKieKey) {
      console.log('[CloneViral/GeneratePose] Trying platform KIE key...')
      taskId = await tryKie(KIE_MODEL, input, platformKieKey)
    }

    if (!taskId) {
      return NextResponse.json({ error: 'Error al generar pose. Intenta de nuevo.' }, { status: 500 })
    }

    console.log(`[CloneViral/GeneratePose] User: ${user.id.substring(0, 8)}..., TaskId: ${taskId}`)

    return NextResponse.json({
      success: true,
      taskId,
      status: 'processing',
    })

  } catch (error: any) {
    console.error('[CloneViral/GeneratePose] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al generar pose' }, { status: 500 })
  }
}
