import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { tryUploadUrlToR2 } from '@/lib/services/r2-upload'

const KIE_API_BASE = 'https://api.kie.ai/api/v1'

/**
 * Check video status - uses different endpoints for Veo vs other models
 * Veo: /veo/record-info
 * Others: /jobs/recordInfo
 */
async function checkStatus(taskId: string, apiKey: string) {
  // Try Veo endpoint first (for veo3_fast, veo3)
  const veoResponse = await fetch(`${KIE_API_BASE}/veo/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (veoResponse.ok) {
    const veoData = await veoResponse.json()
    console.log('[VideoStatus] Veo response:', JSON.stringify(veoData).substring(0, 300))
    
    if (veoData.code === 200 && veoData.data) {
      const data = veoData.data
      
      // Check if completed
      if (data.successFlag === 1 && data.response?.resultUrls?.length > 0) {
        return {
          status: 'completed',
          videoUrl: data.response.resultUrls[0],
        }
      }
      
      // Check for error
      if (data.errorCode || data.errorMessage) {
        return {
          status: 'failed',
          error: data.errorMessage || data.errorCode || 'Unknown error',
        }
      }
      
      // Still processing
      return { status: 'processing' }
    }
  }

  // Fallback to jobs endpoint for other models
  const jobsResponse = await fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!jobsResponse.ok) {
    throw new Error(`Status check failed: ${jobsResponse.status}`)
  }

  const data = await jobsResponse.json()
  const taskData = data.data || data
  const state = taskData.state || ''

  console.log('[VideoStatus] Jobs response:', state, JSON.stringify(taskData).substring(0, 200))

  // Processing states
  if (['waiting', 'queuing', 'generating', 'processing', 'running', 'pending', ''].includes(state)) {
    return { status: 'processing' }
  }

  // Failed states
  if (['fail', 'failed', 'error'].includes(state)) {
    return {
      status: 'failed',
      error: taskData.failMsg || taskData.failCode || 'Video generation failed',
    }
  }

  // Success - extract video/audio URL
  if (state === 'success' || state === 'completed') {
    let videoUrl: string | undefined
    let audioUrl: string | undefined

    if (taskData.resultJson) {
      try {
        const result = typeof taskData.resultJson === 'string'
          ? JSON.parse(taskData.resultJson)
          : taskData.resultJson

        videoUrl = result.videoUrl ||
                   result.video_url ||
                   result.resultUrls?.[0] ||
                   result.videos?.[0] ||
                   result.url ||
                   result.output?.url

        // ElevenLabs and other audio models return audioUrl
        audioUrl = result.audioUrl ||
                   result.audio_url ||
                   result.output?.audio_url
      } catch (e) {
        console.error('[VideoStatus] Failed to parse resultJson:', e)
      }
    }

    if (!videoUrl) {
      videoUrl = taskData.videoUrl || taskData.video_url || taskData.resultUrl
    }
    if (!audioUrl) {
      audioUrl = taskData.audioUrl || taskData.audio_url
    }

    if (videoUrl || audioUrl) {
      return { status: 'completed', videoUrl, audioUrl }
    }

    return { status: 'failed', error: 'Task completed but URL not found' }
  }

  return { status: 'failed', error: `Unknown status: ${state}` }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId es requerido' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.kie_api_key) {
      return NextResponse.json({ error: 'API key no configurada' }, { status: 400 })
    }

    const kieApiKey = decrypt(profile.kie_api_key)
    const result = await checkStatus(taskId, kieApiKey)

    if (result.status === 'processing') {
      return NextResponse.json({
        success: true,
        status: 'processing',
        taskId,
      })
    }

    if (result.status === 'completed' && (result.videoUrl || result.audioUrl)) {
      let r2Url: string | null | undefined

      // Try R2 upload for video (optional, non-blocking)
      if (result.videoUrl) {
        r2Url = await tryUploadUrlToR2(
          user.id,
          result.videoUrl,
          `videos/${Date.now()}-${taskId.substring(0, 8)}.mp4`,
          'video/mp4'
        )
        if (r2Url) console.log(`[VideoStatus] ✓ Video saved to R2: ${r2Url}`)
      }

      return NextResponse.json({
        success: true,
        status: 'completed',
        videoUrl: result.videoUrl,
        audioUrl: result.audioUrl,
        r2Url,
        taskId,
      })
    }

    return NextResponse.json({
      success: false,
      status: 'failed',
      error: result.error || 'Error desconocido',
      taskId,
    })

  } catch (error: any) {
    console.error('[VideoStatus] Error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}
