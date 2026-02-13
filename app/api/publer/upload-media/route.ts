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

    const { mediaUrl, mediaBase64, mediaContentType, name } = await request.json() as {
      mediaUrl?: string
      mediaBase64?: string
      mediaContentType?: string
      name?: string
    }

    if (!mediaUrl && !mediaBase64) {
      return NextResponse.json({ error: 'mediaUrl o mediaBase64 es requerido' }, { status: 400 })
    }

    let finalMediaUrl = mediaUrl || ''

    // If base64 provided, upload to Supabase first to get a public URL
    if (!finalMediaUrl && mediaBase64) {
      console.log('[Publer/Upload] Converting base64 to Supabase URL...')
      const buffer = Buffer.from(mediaBase64, 'base64')
      const ext = mediaContentType?.includes('png') ? 'png' :
                  mediaContentType?.includes('webp') ? 'webp' :
                  mediaContentType?.includes('mp4') ? 'mp4' :
                  mediaContentType?.includes('mp3') ? 'mp3' :
                  mediaContentType?.includes('wav') ? 'wav' : 'jpg'
      const filename = `studio/publer/${user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('landing-images')
        .upload(filename, buffer, {
          contentType: mediaContentType || 'image/png',
          upsert: true,
        })

      if (uploadError) {
        console.error('[Publer/Upload] Supabase upload error:', uploadError)
        return NextResponse.json({ error: 'Error subiendo media a storage' }, { status: 500 })
      }

      const { data: urlData } = supabase.storage
        .from('landing-images')
        .getPublicUrl(filename)

      finalMediaUrl = urlData.publicUrl
      console.log('[Publer/Upload] Supabase URL:', finalMediaUrl)
    }

    if (!finalMediaUrl) {
      return NextResponse.json({ error: 'No se pudo obtener URL del media' }, { status: 400 })
    }

    const creds = await getPublerCredentials(user.id)
    if (!creds) {
      return NextResponse.json({ error: 'Configura Publer en Settings' }, { status: 400 })
    }

    console.log(`[Publer/Upload] Starting media upload from: ${finalMediaUrl}`)

    // Upload media from URL
    const { jobId } = await uploadMediaFromUrl(creds, finalMediaUrl, name)
    console.log(`[Publer/Upload] Job created: ${jobId}`)

    // Poll until complete
    const jobResult = await pollJobUntilComplete(creds, jobId, 25, 2000)

    if (jobResult.status !== 'complete') {
      return NextResponse.json({
        error: jobResult.error || 'Media upload failed',
      }, { status: 500 })
    }

    // Extract media ID from result
    // Publer job results can have various structures depending on the endpoint
    const result = jobResult.result
    let mediaId: string | null = null
    let mediaType: string | null = null

    console.log('[Publer/Upload] Raw job result:', JSON.stringify(result ?? null).slice(0, 1000))

    if (typeof result === 'string') {
      // Sometimes the result IS the media URL directly
      mediaId = result
      mediaType = finalMediaUrl.includes('.mp4') || mediaContentType?.includes('video') ? 'video' : 'image'
    } else if (Array.isArray(result)) {
      // Sometimes result is an array of media URLs or objects
      const first = result[0]
      if (typeof first === 'string') {
        mediaId = first
      } else if (first?.id || first?._id) {
        mediaId = first.id || first._id
        mediaType = first.type
      } else if (first?.url) {
        mediaId = first.url
      }
    } else if (result?.payload?.media) {
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
    } else if (result?.url) {
      // Result might just have a URL
      mediaId = result.url
    }

    if (!mediaId) {
      console.error('[Publer/Upload] Could not extract media ID from result:', JSON.stringify(result ?? null).slice(0, 500))
      return NextResponse.json({
        error: 'Media uploaded but could not extract ID',
        rawResult: result ?? null,
      }, { status: 500 })
    }

    // Determine media type from URL/content if not set
    if (!mediaType) {
      const isVideo = finalMediaUrl.includes('.mp4') || 
                      finalMediaUrl.includes('.mov') || 
                      mediaContentType?.includes('video')
      mediaType = isVideo ? 'video' : 'image'
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
