import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getPublerCredentials,
  getAccounts,
  uploadMediaDirect,
  downloadFileAsBuffer,
  pollJobUntilComplete,
  type PublerMediaObject,
} from '@/lib/services/publer'

// GET — List runs for a flow (or all pending approvals)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const flowId = searchParams.get('flowId')
    const status = searchParams.get('status') // filter by status
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabase
      .from('automation_runs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (flowId) {
      query = query.eq('flow_id', flowId)
    }

    if (status) {
      // Support comma-separated statuses
      const statuses = status.split(',')
      query = query.in('status', statuses)
    }

    const { data: runs, error } = await query

    if (error) {
      console.error('[AutomationRuns/List] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ runs: runs || [] })
  } catch (error: any) {
    console.error('[AutomationRuns/List] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — Approve or reject a run
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { run_id, action, caption, video_url } = body as {
      run_id: string
      action: 'approve' | 'reject' | 'complete' | 'delete'
      caption?: string
      video_url?: string
    }

    if (!run_id || !action) {
      return NextResponse.json({ error: 'run_id y action son requeridos' }, { status: 400 })
    }

    // Handle delete — no need to fetch the full run
    if (action === 'delete') {
      const { error: delError } = await supabase
        .from('automation_runs')
        .delete()
        .eq('id', run_id)
        .eq('user_id', user.id)
      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, status: 'deleted' })
    }

    // Fetch run
    const { data: run, error: fetchError } = await supabase
      .from('automation_runs')
      .select('*, flow:automation_flows(*)')
      .eq('id', run_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !run) {
      return NextResponse.json({ error: 'Run no encontrado' }, { status: 404 })
    }

    // Handle 'complete' action — client detected video is ready via polling
    if (action === 'complete') {
      if (run.status !== 'generating_video') {
        return NextResponse.json({ error: 'Run no está en estado generating_video' }, { status: 400 })
      }
      if (!video_url) {
        return NextResponse.json({ error: 'video_url requerida' }, { status: 400 })
      }

      const flow = run.flow
      const defaultCaption = `${flow?.product_name || 'Producto'} ✨ #dropshipping #colombia`

      await supabase
        .from('automation_runs')
        .update({
          status: 'awaiting_approval',
          video_url,
          caption: defaultCaption,
        })
        .eq('id', run_id)

      return NextResponse.json({ success: true, status: 'awaiting_approval', video_url })
    }

    if (!['awaiting_approval', 'video_ready'].includes(run.status)) {
      return NextResponse.json(
        { error: `No se puede ${action === 'approve' ? 'aprobar' : 'rechazar'} un run en estado "${run.status}"` },
        { status: 400 }
      )
    }

    if (action === 'reject') {
      await supabase
        .from('automation_runs')
        .update({
          status: 'rejected',
          completed_at: new Date().toISOString(),
        })
        .eq('id', run_id)

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // Approve -> publish
    const flow = run.flow
    if (!flow) {
      return NextResponse.json({ error: 'Flow no encontrado' }, { status: 404 })
    }

    // Update caption if provided
    const finalCaption = caption?.trim() || run.caption || ''

    await supabase
      .from('automation_runs')
      .update({ status: 'publishing', caption: finalCaption })
      .eq('id', run_id)

    try {
      // Publish via Publer (direct service call, no HTTP round-trip)
      const accountIds = flow.account_ids || []
      if (accountIds.length === 0) {
        throw new Error('No hay cuentas configuradas en el flujo')
      }

      if (!run.video_url) {
        throw new Error('No hay video para publicar')
      }

      // Get Publer credentials
      const creds = await getPublerCredentials(user.id, supabase)
      if (!creds) {
        throw new Error('Configura Publer en Settings')
      }

      // Download and upload video to Publer
      console.log(`[AutomationRuns/Publish] Downloading video: ${run.video_url}`)
      const downloaded = await downloadFileAsBuffer(run.video_url)
      const ext = downloaded.contentType.includes('mp4') ? 'mp4' : 'mp4'
      const filename = `estrategas-auto-${Date.now()}.${ext}`

      console.log(`[AutomationRuns/Publish] Uploading ${downloaded.buffer.length} bytes to Publer`)
      const publerMedia = await uploadMediaDirect(creds, downloaded.buffer, filename, downloaded.contentType)

      // Get accounts to determine networks
      let allAccounts = await getAccounts(creds)
      const selectedAccounts = allAccounts.filter((a) => accountIds.includes(a.id))

      const PROVIDER_TO_NETWORK: Record<string, string> = {
        facebook: 'facebook', ig_business: 'instagram', ig_personal: 'instagram',
        instagram: 'instagram', twitter: 'twitter', linkedin: 'linkedin',
        tiktok: 'tiktok', youtube: 'youtube', pinterest: 'pinterest', threads: 'threads',
      }

      const providerList: string[] = []
      for (const acc of selectedAccounts) {
        const provider = acc.type || acc.provider || 'instagram'
        const networkKey = PROVIDER_TO_NETWORK[provider] || provider
        if (!providerList.includes(networkKey)) providerList.push(networkKey)
      }
      if (providerList.length === 0) providerList.push('instagram')

      // Build network content
      const networks: Record<string, any> = {}
      for (const networkKey of providerList) {
        const networkContent: Record<string, any> = {
          type: 'video',
          text: finalCaption,
          media: [{ id: publerMedia.id, path: publerMedia.path, type: publerMedia.type }],
        }
        if (networkKey === 'instagram') {
          networkContent.details = { type: 'reel' }
        }
        networks[networkKey] = networkContent
      }

      // Create and publish
      const PUBLER_API_BASE = 'https://app.publer.com/api/v1'
      const payload = {
        bulk: {
          state: 'scheduled',
          posts: [{ networks, accounts: accountIds.map((id: string) => ({ id })) }],
        },
      }

      console.log(`[AutomationRuns/Publish] Sending to Publer...`)
      const response = await fetch(`${PUBLER_API_BASE}/posts/schedule/publish`, {
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
        throw new Error(`Publer error: ${response.status} - ${errorText}`)
      }

      const pubData = await response.json()
      const jobId = pubData.id || pubData.job_id
      if (jobId) {
        await pollJobUntilComplete(creds, jobId, 15, 2000)
      }

      console.log(`[AutomationRuns/Publish] Published successfully`)

      await supabase
        .from('automation_runs')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', run_id)

      return NextResponse.json({ success: true, status: 'published' })

    } catch (pubError: any) {
      console.error('[AutomationRuns/Publish] Error:', pubError.message)
      await supabase
        .from('automation_runs')
        .update({
          status: 'failed',
          error_message: pubError.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run_id)

      return NextResponse.json({ error: pubError.message }, { status: 500 })
    }

  } catch (error: any) {
    console.error('[AutomationRuns/Action] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
