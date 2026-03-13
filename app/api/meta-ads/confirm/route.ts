// Meta Ads Confirm — Execute or reject a pending write action
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { executeConfirmedAction } from '@/lib/meta-ads/claude-executor'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action_id, confirmed } = body

    if (!action_id || confirmed === undefined) {
      return NextResponse.json({ error: 'action_id y confirmed son requeridos' }, { status: 400 })
    }

    // Get the pending action and verify ownership
    const { data: action } = await supabase
      .from('meta_ads_pending_actions')
      .select('*, meta_ads_conversations!inner(user_id)')
      .eq('id', action_id)
      .single()

    if (!action || (action as any).meta_ads_conversations?.user_id !== user.id) {
      return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    }

    if (action.status !== 'pending') {
      return NextResponse.json({ error: 'Esta acción ya fue procesada' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    if (!confirmed) {
      // User rejected
      await serviceClient
        .from('meta_ads_pending_actions')
        .update({ status: 'rejected' })
        .eq('id', action_id)

      // Save rejection message
      await serviceClient
        .from('meta_ads_messages')
        .insert({
          conversation_id: action.conversation_id,
          role: 'confirmation',
          content: `❌ Acción rechazada: ${action.description}`,
        })

      return NextResponse.json({ success: true, status: 'rejected' })
    }

    // User confirmed — execute the action
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('meta_access_token')
      .eq('id', user.id)
      .single()

    if (!profile?.meta_access_token) {
      return NextResponse.json({ error: 'Token de Meta no configurado' }, { status: 400 })
    }

    let metaAccessToken: string
    try {
      metaAccessToken = decrypt(profile.meta_access_token)
    } catch {
      return NextResponse.json({ error: 'Error descifrando token de Meta' }, { status: 400 })
    }

    const result = await executeConfirmedAction(
      metaAccessToken,
      action.action_type,
      action.action_payload
    )

    if (result.success) {
      await serviceClient
        .from('meta_ads_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', action_id)

      // Save success message
      await serviceClient
        .from('meta_ads_messages')
        .insert({
          conversation_id: action.conversation_id,
          role: 'confirmation',
          content: `✅ Acción ejecutada: ${action.description}`,
          tool_result: result.data,
        })

      return NextResponse.json({ success: true, status: 'executed', data: result.data })
    } else {
      await serviceClient
        .from('meta_ads_pending_actions')
        .update({ status: 'failed', error_message: result.error })
        .eq('id', action_id)

      // Save error message
      await serviceClient
        .from('meta_ads_messages')
        .insert({
          conversation_id: action.conversation_id,
          role: 'confirmation',
          content: `⚠️ Error al ejecutar: ${result.error}`,
        })

      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
