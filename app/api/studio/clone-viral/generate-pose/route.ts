import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

/**
 * Generate influencer pose matching the viral video frame.
 * Uses KIE.ai image generation with the influencer's character profile as reference.
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

    if (!profile?.kie_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de KIE.ai en Settings' }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)

    // Use Kling motion control to generate the influencer in the same pose
    const prompt = prompt_descriptor
      ? `${prompt_descriptor}, same pose and angle as reference, professional photo`
      : 'Person in the same pose and angle as the reference image, professional photo'

    // CORREGIDO: endpoint /jobs/createTask + Authorization Bearer
    const taskResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        model: 'kling-2.6/image',
        input: {
          prompt,
          image_urls: [influencer_image_url, frame_url],
          aspect_ratio: '9:16',
        },
      }),
    })

    const responseText = await taskResponse.text()
    console.log('[CloneViral/GeneratePose] KIE Response:', taskResponse.status, responseText.substring(0, 500))

    let taskData: any
    try {
      taskData = JSON.parse(responseText)
    } catch (e) {
      console.error('[CloneViral/GeneratePose] Invalid JSON:', responseText.substring(0, 200))
      return NextResponse.json({ error: 'Respuesta inválida de KIE' }, { status: 500 })
    }

    const taskId = taskData.data?.taskId || taskData.taskId
    if (!taskId) {
      console.error('[CloneViral/GeneratePose] No taskId:', JSON.stringify(taskData))
      return NextResponse.json({
        error: taskData.msg || taskData.message || 'Error al crear tarea de generacion'
      }, { status: 500 })
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
