import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublerCredentials, publishPost, pollJobUntilComplete } from '@/lib/services/publer'

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
      scheduledAt,
    } = body as {
      accountIds: string[]
      text: string
      contentType?: 'photo' | 'video' | 'status'
      mediaIds?: string[]
      mediaType?: 'image' | 'video'
      scheduledAt?: string
    }

    if (!accountIds || accountIds.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos una cuenta' }, { status: 400 })
    }

    if (!text && (!mediaIds || mediaIds.length === 0)) {
      return NextResponse.json({ error: 'Agrega texto o media al post' }, { status: 400 })
    }

    const creds = await getPublerCredentials(user.id)
    if (!creds) {
      return NextResponse.json({ error: 'Configura Publer en Settings' }, { status: 400 })
    }

    console.log(`[Publer/Publish] Publishing to ${accountIds.length} accounts, type: ${contentType}`)

    const { jobId } = await publishPost(creds, {
      accountIds,
      text: text || '',
      contentType,
      mediaIds,
      mediaType,
      scheduledAt,
    })

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
