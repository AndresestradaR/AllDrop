import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublerCredentials, uploadMediaFromUrl, pollJobUntilComplete } from '@/lib/services/publer'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { mediaUrl, name } = await request.json()

    if (!mediaUrl) {
      return NextResponse.json({ error: 'mediaUrl es requerido' }, { status: 400 })
    }

    const creds = await getPublerCredentials(user.id)
    if (!creds) {
      return NextResponse.json({ error: 'Configura Publer en Settings' }, { status: 400 })
    }

    console.log(`[Publer/Upload] Starting media upload from: ${mediaUrl}`)

    // Upload media from URL
    const { jobId } = await uploadMediaFromUrl(creds, mediaUrl, name)
    console.log(`[Publer/Upload] Job created: ${jobId}`)

    // Poll until complete
    const jobResult = await pollJobUntilComplete(creds, jobId, 25, 2000)

    if (jobResult.status !== 'complete') {
      return NextResponse.json({
        error: jobResult.error || 'Media upload failed',
      }, { status: 500 })
    }

    // Extract media ID from result
    // The result structure varies, try common patterns
    const result = jobResult.result
    let mediaId: string | null = null
    let mediaType: string | null = null

    if (result?.payload?.media) {
      // Array of uploaded media
      const media = Array.isArray(result.payload.media) ? result.payload.media[0] : result.payload.media
      mediaId = media?.id || media?._id
      mediaType = media?.type
    } else if (result?.media) {
      const media = Array.isArray(result.media) ? result.media[0] : result.media
      mediaId = media?.id || media?._id
      mediaType = media?.type
    } else if (result?.id) {
      mediaId = result.id
      mediaType = result.type
    }

    if (!mediaId) {
      console.error('[Publer/Upload] Could not extract media ID from result:', JSON.stringify(result).substring(0, 500))
      return NextResponse.json({
        error: 'Media uploaded but could not extract ID',
        rawResult: result,
      }, { status: 500 })
    }

    console.log(`[Publer/Upload] ✓ Media uploaded: ${mediaId} (${mediaType})`)

    return NextResponse.json({
      success: true,
      mediaId,
      mediaType: mediaType || 'image',
    })
  } catch (error: any) {
    console.error('[Publer/Upload] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
