import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublerCredentials, getAccounts, uploadMediaFromUrl, pollJobUntilComplete } from '@/lib/services/publer'

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
      mediaUrl,
      mediaBase64,
      mediaContentType,
      scheduledAt,
    } = body as {
      accountIds: string[]
      text: string
      contentType?: 'photo' | 'video' | 'status'
      mediaUrl?: string
      mediaBase64?: string
      mediaContentType?: string
      scheduledAt?: string
    }

    if (!accountIds || accountIds.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una cuenta' }, { status: 400 })
    }

    if (!text && !mediaUrl && !mediaBase64) {
      return NextResponse.json({ error: 'Agrega texto o media al post' }, { status: 400 })
    }

    const creds = await getPublerCredentials(user.id)
    if (!creds) {
      return NextResponse.json({ error: 'Configura Publer en Settings' }, { status: 400 })
    }

    // ========================================
    // Step 1: Resolve media URL
    // ========================================
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

    // ========================================
    // Step 2: Upload media to Publer (if applicable)
    // ========================================
    let publerMedia: { id: string; path: string; type: string } | null = null

    if (finalMediaUrl && contentType !== 'status') {
      console.log(`[Publer/Publish] Uploading media to Publer: ${finalMediaUrl}`)

      const { jobId } = await uploadMediaFromUrl(creds, finalMediaUrl)
      console.log(`[Publer/Publish] Media upload job: ${jobId}`)

      const jobResult = await pollJobUntilComplete(creds, jobId, 30, 2000)

      console.log('[Publer/Publish] Media job result:', JSON.stringify(jobResult).slice(0, 1000))

      if (jobResult.status !== 'complete') {
        return NextResponse.json({
          error: jobResult.error || 'Error subiendo media a Publer',
        }, { status: 500 })
      }

      // Extract media info from job result
      // Publer returns: { id, path, thumbnail, type, name, ... }
      const result = jobResult.result
      if (result?.id && result?.path) {
        publerMedia = { id: result.id, path: result.path, type: result.type || 'video' }
      } else if (result?.payload?.media) {
        const m = Array.isArray(result.payload.media) ? result.payload.media[0] : result.payload.media
        if (m?.id && m?.path) {
          publerMedia = { id: m.id, path: m.path, type: m.type || 'video' }
        }
      } else if (Array.isArray(result) && result[0]?.id) {
        publerMedia = { id: result[0].id, path: result[0].path, type: result[0].type || 'video' }
      }

      if (!publerMedia) {
        console.error('[Publer/Publish] Could not extract media from result:', JSON.stringify(result ?? null).slice(0, 500))
        return NextResponse.json({
          error: 'Media subida pero no se pudo extraer ID. Raw: ' + JSON.stringify(result ?? null).slice(0, 200),
        }, { status: 500 })
      }

      console.log(`[Publer/Publish] Media ready: id=${publerMedia.id}, type=${publerMedia.type}`)
    }

    // ========================================
    // Step 3: Determine provider for each account
    // ========================================
    let accounts
    try {
      accounts = await getAccounts(creds)
    } catch {
      accounts = []
    }

    // Map provider names for each selected account
    // Publer provider types -> network keys
    const PROVIDER_TO_NETWORK: Record<string, string> = {
      facebook: 'facebook',
      ig_business: 'instagram',
      ig_personal: 'instagram',
      instagram: 'instagram',
      twitter: 'twitter',
      linkedin: 'linkedin',
      tiktok: 'tiktok',
      youtube: 'youtube',
      pinterest: 'pinterest',
      threads: 'threads',
      telegram: 'telegram',
      google: 'google',
      mastodon: 'mastodon',
      bluesky: 'bluesky',
    }

    // Build networks object with provider-specific entries
    const selectedAccounts = accounts.filter((a: any) => accountIds.includes(a.id))
    const providerSet = new Set<string>()

    for (const acc of selectedAccounts) {
      const provider = acc.type || acc.provider || 'instagram'
      const networkKey = PROVIDER_TO_NETWORK[provider] || provider
      providerSet.add(networkKey)
    }

    // If we couldn't determine providers, fallback to instagram
    if (providerSet.size === 0) {
      providerSet.add('instagram')
    }

    // Build the network content for each provider
    const networks: Record<string, any> = {}
    for (const networkKey of providerSet) {
      const networkContent: Record<string, any> = {
        type: contentType === 'status' ? 'status' : contentType,
        text: text || '',
      }

      if (publerMedia) {
        networkContent.media = [{
          id: publerMedia.id,
          path: publerMedia.path,
          type: publerMedia.type,
        }]

        // For Instagram videos, publish as reel
        if (networkKey === 'instagram' && contentType === 'video') {
          networkContent.details = { type: 'reel' }
        }
      }

      networks[networkKey] = networkContent
    }

    // ========================================
    // Step 4: Create the post
    // ========================================
    const postAccounts = accountIds.map(id => {
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
          networks,
          accounts: postAccounts,
        }],
      },
    }

    const endpoint = scheduledAt ? '/posts/schedule' : '/posts/schedule/publish'
    const PUBLER_API_BASE = 'https://app.publer.com/api/v1'

    console.log(`[Publer/Publish] Sending to ${endpoint}:`, JSON.stringify(payload).slice(0, 800))

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
    console.log('[Publer/Publish] Response:', JSON.stringify(data).slice(0, 500))

    const jobId = data.id || data.job_id
    if (!jobId) {
      // Some endpoints return result directly
      return NextResponse.json({ success: true, result: data })
    }

    // ========================================
    // Step 5: Poll for publish completion
    // ========================================
    const publishResult = await pollJobUntilComplete(creds, jobId, 15, 2000)

    console.log('[Publer/Publish] Job result:', JSON.stringify(publishResult).slice(0, 500))

    // Check for failures in the result
    const failures = publishResult.result?.payload?.failures || []
    if (Array.isArray(failures) && failures.length > 0) {
      const failMsg = failures.map((f: any) => f.message || f.error || JSON.stringify(f)).join('; ')
      console.error('[Publer/Publish] Publish failures:', failMsg)
      return NextResponse.json({
        success: false,
        error: `Error de Publer: ${failMsg}`,
      }, { status: 200 })
    }

    if (publishResult.status === 'error') {
      return NextResponse.json({
        success: false,
        error: publishResult.error || 'Error al publicar',
      }, { status: 200 })
    }

    console.log('[Publer/Publish] Post published successfully!')

    return NextResponse.json({
      success: true,
      status: publishResult.status,
      result: publishResult.result,
    })
  } catch (error: any) {
    console.error('[Publer/Publish] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
