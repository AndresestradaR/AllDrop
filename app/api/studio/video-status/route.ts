import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { tryUploadUrlToR2 } from '@/lib/services/r2-upload'

const KIE_API_BASE = 'https://api.kie.ai/api/v1'

/**
 * Check video status — tries Veo endpoint FIRST for Veo tasks,
 * then falls back to jobs endpoint for standard models.
 *
 * BUG FIX: Previously tried /jobs/recordInfo first, which returns
 * HTTP 200 with {code: 422} for Veo tasks. Because HTTP was 200,
 * the code never fell through to /veo/record-info.
 */
async function checkStatus(taskId: string, apiKey: string) {
  // ========================================
  // Step 1: Try BOTH endpoints in parallel
  // This way we don't waste time on the wrong one
  // ========================================
  const [jobsResult, veoResult] = await Promise.allSettled([
    fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    fetch(`${KIE_API_BASE}/veo/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
  ])

  // ========================================
  // Step 2: Check Veo endpoint (handles Veo 3, Veo 3 Fast)
  // ========================================
  if (veoResult.status === 'fulfilled' && veoResult.value.ok) {
    try {
      const veoData = await veoResult.value.json()
      const vData = veoData.data

      // Log the KEY fields, not the huge paramJson
      console.log(`[VideoStatus] Veo: code=${veoData.code} successFlag=${vData?.successFlag} taskStatus=${vData?.taskStatus} errorCode=${vData?.errorCode} resultUrls=${vData?.response?.resultUrls?.length || 0}`)

      if (veoData.code === 200 && vData) {
        // Success — video is ready
        if (vData.successFlag === 1 && vData.response?.resultUrls?.length > 0) {
          console.log(`[VideoStatus] Veo COMPLETED: ${vData.response.resultUrls[0].substring(0, 100)}`)
          return { status: 'completed' as const, videoUrl: vData.response.resultUrls[0], audioUrl: undefined }
        }

        // Failed
        if (vData.errorCode || vData.errorMessage) {
          console.log(`[VideoStatus] Veo FAILED: ${vData.errorMessage || vData.errorCode}`)
          return { status: 'failed' as const, error: vData.errorMessage || vData.errorCode || 'Veo error' }
        }

        // Still processing
        return { status: 'processing' as const, taskState: `veo-${vData.taskStatus || 'processing'}` }
      }
    } catch (e: any) {
      console.warn('[VideoStatus] Veo parse error:', e.message)
    }
  }

  // ========================================
  // Step 3: Check Jobs endpoint (handles Kling, Sora, Hailuo, etc.)
  // ========================================
  if (jobsResult.status === 'fulfilled' && jobsResult.value.ok) {
    try {
      const data = await jobsResult.value.json()
      console.log('[VideoStatus] Jobs response:', JSON.stringify(data).substring(0, 500))

      // IMPORTANT: Check KIE's code field — 422 means task not found!
      if (data.code === 422 || data.code === 404 || data.msg?.includes('null')) {
        console.log('[VideoStatus] Jobs endpoint: task not found (code:', data.code, ')')
        // Task not in jobs system — if Veo also failed, it's truly not found
        return { status: 'processing' as const, taskState: 'not-found-yet' }
      }

      const taskData = data.data || data
      const state = (taskData.state || taskData.status || taskData.taskStatus || '').toLowerCase()

      // Processing states
      if (!state || ['waiting', 'queuing', 'generating', 'processing', 'running', 'pending'].includes(state)) {
        return { status: 'processing' as const, taskState: state || 'initializing' }
      }

      // Failed states
      if (['fail', 'failed', 'error'].includes(state)) {
        return {
          status: 'failed' as const,
          error: taskData.failMsg || taskData.failCode || 'Video generation failed',
        }
      }

      // Success — extract video/audio URL
      if (state === 'success' || state === 'completed') {
        let videoUrl: string | undefined
        let audioUrl: string | undefined

        if (taskData.resultJson) {
          try {
            const result = typeof taskData.resultJson === 'string'
              ? JSON.parse(taskData.resultJson)
              : taskData.resultJson

            console.log('[VideoStatus] Parsed resultJson keys:', Object.keys(result))

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
          return { status: 'completed' as const, videoUrl, audioUrl }
        }

        console.error('[VideoStatus] SUCCESS but no URL. taskData:', JSON.stringify(taskData).substring(0, 1500))
        return { status: 'failed' as const, error: 'Task completed but URL not found' }
      }

      // Unknown state — keep polling
      return { status: 'processing' as const, taskState: state }
    } catch (e: any) {
      console.warn('[VideoStatus] Jobs parse error:', e.message)
    }
  }

  // Both endpoints failed
  return { status: 'processing' as const, taskState: 'unknown' }
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

      // Save to generations table (non-blocking)
      const modelName = searchParams.get('modelName') || 'Video'
      const prompt = searchParams.get('prompt') || ''
      const videoRef = r2Url || result.videoUrl || null
      if (videoRef) {
        const serviceClient = await createServiceClient()
        serviceClient
          .from('generations')
          .insert({
            user_id: userId,
            product_name: `Video: ${modelName}`,
            original_prompt: prompt,
            enhanced_prompt: prompt,
            status: 'completed',
            generated_image_url: videoRef,
          })
          .then(({ error: dbErr }) => {
            if (dbErr) console.warn('[VideoStatus] DB save failed:', dbErr.message)
            else console.log('[VideoStatus] ✓ Saved to generations table')
          })
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
