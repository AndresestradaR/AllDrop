import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { run_id, action, caption } = body as {
      run_id: string
      action: 'approve' | 'reject'
      caption?: string
    }

    if (!run_id || !action) {
      return NextResponse.json({ error: 'run_id y action son requeridos' }, { status: 400 })
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
      // Publish via Publer
      const accountIds = flow.account_ids || []
      if (accountIds.length === 0) {
        throw new Error('No hay cuentas configuradas en el flujo')
      }

      if (!run.video_url) {
        throw new Error('No hay video para publicar')
      }

      const publishRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/publer/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds,
          text: finalCaption,
          contentType: 'video',
          mediaUrl: run.video_url,
        }),
      })

      const publishData = await publishRes.json()

      if (!publishRes.ok || publishData.success === false) {
        throw new Error(publishData.error || 'Error publicando')
      }

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
