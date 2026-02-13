import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getPublerCredentials,
  getAccounts,
  uploadMediaDirect,
  downloadFileAsBuffer,
  pollJobUntilComplete,
  PublerAccount,
  PublerMediaObject,
} from '@/lib/services/publer'

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
    // Step 1: Upload media DIRECTLY to Publer (no polling!)
    // Uses POST /api/v1/media with multipart/form-data
    // Returns media object immediately.
    // ========================================
    let publerMedia: PublerMediaObject | null = null

    if (contentType !== 'status' && (mediaBase64 || mediaUrl)) {
      let fileBuffer: Buffer
      let filename: string
      let fileMimeType: string

      if (mediaBase64) {
        // Already have the file in memory
        console.log('[Publer/Publish] Using base64 media directly')
        fileBuffer = Buffer.from(mediaBase64, 'base64')
        const ext = mediaContentType?.includes('mp4') ? 'mp4' :
                    mediaContentType?.includes('webm') ? 'webm' :
                    mediaContentType?.includes('mov') ? 'mov' :
                    mediaContentType?.includes('png') ? 'png' :
                    mediaContentType?.includes('webp') ? 'webp' : 'jpg'
        filename = `estrategas-${Date.now()}.${ext}`
        fileMimeType = mediaContentType || 'image/png'
      } else {
        // Download the file from URL first
        console.log(`[Publer/Publish] Downloading media from: ${mediaUrl}`)
        const downloaded = await downloadFileAsBuffer(mediaUrl!)
        fileBuffer = downloaded.buffer
        fileMimeType = downloaded.contentType

        // Determine extension from content type or URL
        let ext = 'bin'
        if (fileMimeType.includes('mp4') || mediaUrl!.includes('.mp4')) ext = 'mp4'
        else if (fileMimeType.includes('webm')) ext = 'webm'
        else if (fileMimeType.includes('mov') || mediaUrl!.includes('.mov')) ext = 'mov'
        else if (fileMimeType.includes('png')) ext = 'png'
        else if (fileMimeType.includes('webp')) ext = 'webp'
        else if (fileMimeType.includes('jpeg') || fileMimeType.includes('jpg')) ext = 'jpg'
        else if (fileMimeType.includes('gif')) ext = 'gif'
        filename = `estrategas-${Date.now()}.${ext}`
      }

      console.log(`[Publer/Publish] Uploading ${fileBuffer.length} bytes as ${filename} (${fileMimeType})`)

      // Direct multipart upload - returns immediately!
      publerMedia = await uploadMediaDirect(creds, fileBuffer, filename, fileMimeType)

      console.log(`[Publer/Publish] Media ready: id=${publerMedia.id}, type=${publerMedia.type}, path=${publerMedia.path}`)
    }

    // ========================================
    // Step 2: Determine provider for each account
    // ========================================
    let allAccounts: PublerAccount[] = []
    try {
      allAccounts = await getAccounts(creds)
    } catch {
      allAccounts = []
    }

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

    const selectedAccounts = allAccounts.filter((a) => accountIds.includes(a.id))
    const providerList: string[] = []

    for (let i = 0; i < selectedAccounts.length; i++) {
      const acc = selectedAccounts[i]
      const provider = acc.type || acc.provider || 'instagram'
      const networkKey = PROVIDER_TO_NETWORK[provider] || provider
      if (!providerList.includes(networkKey)) {
        providerList.push(networkKey)
      }
    }

    if (providerList.length === 0) {
      providerList.push('instagram')
    }

    // ========================================
    // Step 3: Build network content
    // ========================================
    const networks: Record<string, any> = {}
    for (let i = 0; i < providerList.length; i++) {
      const networkKey = providerList[i]
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

        // Instagram videos → Reels
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
    // Step 5: Poll for publish completion (this is for the POST job, not media)
    // ========================================
    const publishResult = await pollJobUntilComplete(creds, jobId, 15, 2000)

    console.log('[Publer/Publish] Job result:', JSON.stringify(publishResult).slice(0, 500))

    // Check for failures
    const failures = publishResult.result?.payload?.failures || publishResult.result?.failures || []
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
