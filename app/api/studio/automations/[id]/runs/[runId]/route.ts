import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; runId: string }>
}

// PUT: Approve, reject, or publish a run
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, runId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { action, caption } = body // action: 'approve' | 'reject' | 'publish'

    // Verify ownership
    const { data: automation } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!automation) {
      return NextResponse.json({ error: 'Automatización no encontrada' }, { status: 404 })
    }

    const { data: run } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('id', runId)
      .eq('automation_id', id)
      .single()

    if (!run) {
      return NextResponse.json({ error: 'Ejecución no encontrada' }, { status: 404 })
    }

    if (action === 'reject') {
      await supabase
        .from('automation_runs')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId)

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    if (action === 'approve' || action === 'publish') {
      // Update caption if provided
      const finalCaption = caption || run.caption

      if (!run.video_url) {
        return NextResponse.json({ error: 'Video aún no disponible' }, { status: 400 })
      }

      // Publish via Publer
      const accountIds: string[] = automation.publer_account_ids || []
      if (accountIds.length === 0) {
        // Just approve without publishing
        await supabase
          .from('automation_runs')
          .update({
            status: 'published',
            caption: finalCaption,
            approved_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', runId)

        return NextResponse.json({ success: true, status: 'published', note: 'Sin cuentas de Publer configuradas' })
      }

      // Call Publer publish API
      await supabase
        .from('automation_runs')
        .update({
          status: 'publishing',
          caption: finalCaption,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId)

      try {
        const origin = req.headers.get('origin') || req.headers.get('host') || ''
        const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`

        const pubRes = await fetch(`${baseUrl}/api/publer/publish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            accountIds,
            mediaUrl: run.video_url,
            mediaType: 'video',
            text: finalCaption,
          }),
        })

        const pubData = await pubRes.json()

        if (pubRes.ok && pubData.success) {
          await supabase
            .from('automation_runs')
            .update({
              status: 'published',
              publer_post_ids: pubData.postIds || [],
              published_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', runId)

          // Update automation counter
          await supabase
            .from('automations')
            .update({
              total_published: (automation.total_published || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id)

          return NextResponse.json({ success: true, status: 'published' })
        } else {
          await supabase
            .from('automation_runs')
            .update({
              status: 'failed',
              error: pubData.error || 'Error al publicar',
              updated_at: new Date().toISOString(),
            })
            .eq('id', runId)

          return NextResponse.json({
            success: false,
            error: pubData.error || 'Error al publicar',
          })
        }
      } catch (pubErr: any) {
        await supabase
          .from('automation_runs')
          .update({
            status: 'failed',
            error: pubErr.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', runId)

        return NextResponse.json({ success: false, error: pubErr.message })
      }
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (err: any) {
    console.error('[AutoRunAction] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
