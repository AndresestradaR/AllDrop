import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { decrypt } from '@/lib/services/encryption'
import { tryUploadUrlToR2 } from '@/lib/services/r2-upload'

const KIE_API_BASE = 'https://api.kie.ai/api/v1'

/**
 * Check video status - uses different endpoints for Veo vs other models
 * Veo: /veo/record-info
 * Others: /jobs/recordInfo
 */
async function checkStatus(taskId: string, apiKey: string) {
  // Try jobs endpoint FIRST (handles ElevenLabs, Kling, and most models)
  const jobsResponse = await fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (jobsResponse.ok) {
    const data = await jobsResponse.json()
    const taskData = data.data || data
    const state = (taskData.state || taskData.status || taskData.taskStatus || '').toLowerCase()

    console.log('[VideoStatus] Jobs response:', JSON.stringify(data).substring(0, 500))

    // Processing states
    if (!state || ['waiting', 'queuing', 'generating', 'processing', 'running', 'pending'].includes(state)) {
      return { status: 'processing', taskState: state || 'initializing' }
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

          console.log('[VideoStatus] Parsed resultJson keys:', Object.keys(result))
          console.log('[VideoStatus] resultJson preview:', JSON.stringify(result).substring(0, 800))

          videoUrl = result.videoUrl ||
                     result.video_url ||
                     result.resultUrls?.[0] ||
                     result.videos?.[0] ||
                     result.url ||
                     result.output?.url

          // Kling format: works[0].resource.resource
          if (!videoUrl && result.works && Array.isArray(result.works) && result.works.length > 0) {
            videoUrl = result.works[0]?.resource?.resource ||
                       result.works[0]?.resource?.url ||
                       result.works[0]?.url ||
                       result.works[0]?.video_url
            console.log('[VideoStatus] Found Kling works URL:', videoUrl?.substring(0, 100))
          }

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

      // Log the full taskData so we can debug what field the URL is in
      console.error('[VideoStatus] SUCCESS state but no URL found. Full taskData:', JSON.stringify(taskData).substring(0, 1500))
      return { status: 'failed', error: 'Task completed but URL not found' }
    }

    // Any other state - keep polling
    return { status: 'processing', taskState: state }
  }

  // Jobs endpoint failed (HTTP error) — try Veo endpoint as fallback
  console.log('[VideoStatus] Jobs endpoint failed, trying Veo...')
  const veoResponse = await fetch(`${KIE_API_BASE}/veo/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (veoResponse.ok) {
    const veoData = await veoResponse.json()
    console.log('[VideoStatus] Veo response:', JSON.stringify(veoData).substring(0, 300))

    if (veoData.code === 200 && veoData.data) {
      const vData = veoData.data

      if (vData.successFlag === 1 && vData.response?.resultUrls?.length > 0) {
        return { status: 'completed', videoUrl: vData.response.resultUrls[0] }
      }

      if (vData.errorCode || vData.errorMessage) {
        return { status: 'failed', error: vData.errorMessage || vData.errorCode || 'Unknown error' }
      }

      return { status: 'processing', taskState: 'veo-processing' }
    }
  }

  return { status: 'processing', taskState: 'unknown' }
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { userId, supabase } = auth

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'taskId es requerido' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key')
      .eq('id', userId)
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
        taskState: result.taskState,
      })
    }

    if (result.status === 'completed' && (result.videoUrl || result.audioUrl)) {
      let r2Url: string | null | undefined

      // Try R2 upload for video (optional, non-blocking)
      if (result.videoUrl) {
        r2Url = await tryUploadUrlToR2(
          userId,
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
