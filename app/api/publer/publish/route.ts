import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublerCredentials, pollJobUntilComplete } from '@/lib/services/publer'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      accountIds,
      text,
      contentType = 'photo',
      mediaIds,
      mediaType,
      mediaUrl,
      mediaBase64,
      mediaContentType,
      scheduledAt,
    } = body as {
      accountIds: string[]
      text: string
      contentType?: 'photo' | 'video' | 'status'
      mediaIds?: string[]
      mediaType?: 'image' | 'video'
      mediaUrl?: string
      mediaBase64?: string
      mediaContentType?: string
      scheduledAt?: string
    }

    if (!accountIds || accountIds.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una cuenta' }, { status: 400 })
    }

    if (!text && !mediaIds?.length && !mediaUrl && !mediaBase64) {
      return NextResponse.json({ error: 'Agrega texto o media al post' }, { status: 400 })
    }

    const creds = await getPublerCredentials(user.id)
    if (!creds) {
      return NextResponse.json({ error: 'Configura Publer en Settings' }, { status: 400 })
    }

    // Resolve media URL (if base64, upload to Supabase first)
    let finalMediaUrl = mediaUrl || ''
    if (!finalMediaUrl && mediaBase64) {
      console.log('[Publer/Publish] Converting base64 to Supabase URL...')
      const buffer = Buffer.from(mediaBase64, 'base64')
      const ext = mediaContentType?.includes('png') ? 'png' :
                  mediaContentType?.includes('webp') ? 'webp' :
                  mediaContentType?.includes('mp4') ? 'mp4' : 'jpg'
      const filename = `studio/publer/${user.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('landing-images')
        .upload(filename, buffer, {
          contentType: mediaContentType || 'image/png',
          upsert: true,
        })

      if (uploadError) {
        console.error('[Publer/Publish] Supabase upload error:', uploadError)
        return NextResponse.json({ error: 'Error subiendo media a storage' }, { status: 500 })
      }

      const { data: urlData } = supabase.storage
        .from('landing-images')
        .getPublicUrl(filename)

      finalMediaUrl = urlData.publicUrl
    }

    console.log(`[Publer/Publish] Publishing to ${accountIds.length} accounts, type: ${contentType}`)

    // Build the Publer post payload
    // Use media URL directly instead of requiring a media ID upload
    const resolvedMediaType = mediaType || 
      (contentType === 'video' ? 'video' : 'image')

    const defaultNetwork: Record<string, any> = {
      type: (finalMediaUrl || mediaIds?.length) ? contentType : 'status',
      text: text || '',
    }

    // Add media - prefer URL-based if available, fallback to media IDs
    if (finalMediaUrl) {
      defaultNetwork.media = [{
        url: finalMediaUrl,
        type: resolvedMediaType,
      }]
    } else if (mediaIds && mediaIds.length > 0) {
      defaultNetwork.media = mediaIds.map(id => ({
        id,
        type: resolvedMediaType,
      }))
    }

    const accounts = accountIds.map(id => {
      const account: Record<string, any> = { id }
      if (scheduledAt) {
        account.scheduled_at = scheduledAt
      }
      return account
    })

    const payload = {
      bulk: {
        state: 'scheduled',
        posts: [{
          networks: { default: defaultNetwork },
          accounts,
        }],
      },
    }

    // Use /publish for immediate, /schedule for scheduled
    const endpoint = scheduledAt ? '/posts/schedule' : '/posts/schedule/publish'
    const PUBLER_API_BASE = 'https://app.publer.com/api/v1'

    console.log(`[Publer/Publish] Sending to ${endpoint}`, JSON.stringify(payload).slice(0, 500))

    const response = await fetch(`${PUBLER_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer-API ${creds.apiKey}`,
        'Publer-Workspace-Id': creds.workspaceId,
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Publer/Publish] API error ${response.status}:`, errorText)
      return NextResponse.json({
        success: false,
        error: `Publer error: ${response.status} - ${errorText}`,
      }, { status: 200 })
    }

    const data = await response.json()
    const jobId = data.id || data.job_id

    if (!jobId) {
      console.log('[Publer/Publish] No job ID, response:', JSON.stringify(data).slice(0, 500))
      // Some endpoints return the result directly
      return NextResponse.json({
        success: true,
        result: data,
      })
    }

    console.log(`[Publer/Publish] Job created: ${jobId}`)

    // Poll for completion
    const jobResult = await pollJobUntilComplete(creds, jobId, 15, 2000)

    if (jobResult.status === 'error') {
      return NextResponse.json({
        success: false,
        error: jobResult.error || 'Error al publicar',
      }, { status: 200 })
    }

    console.log(`[Publer/Publish] ✓ Post published successfully`)

    return NextResponse.json({
      success: true,
      status: jobResult.status,
      result: jobResult.result,
    })
  } catch (error: any) {
    console.error('[Publer/Publish] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
