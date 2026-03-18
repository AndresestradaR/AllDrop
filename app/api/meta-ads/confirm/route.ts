// Meta Ads Confirm — Execute or reject a pending write action
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { executeConfirmedAction } from '@/lib/meta-ads/claude-executor'
import { EstrategasToolsHandler } from '@/lib/meta-ads/estrategas-tools'
import { DropPageClient } from '@/lib/meta-ads/droppage-client'

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

    // Get Supabase session for Phase 2 clients
    const { data: { session } } = await supabase.auth.getSession()
    const supabaseAccessToken = session?.access_token || ''

    // Recover product image URLs from conversation history
    const { data: convHistory } = await serviceClient
      .from('meta_ads_messages')
      .select('tool_name, tool_result, role, content')
      .eq('conversation_id', action.conversation_id)
      .order('created_at', { ascending: true })

    const productImageUrls: string[] = []
    let lastLandingProductId: string | undefined
    for (const msg of convHistory || []) {
      if (msg.tool_name === 'upload_product_image' && msg.tool_result) {
        try {
          const r = typeof msg.tool_result === 'string' ? JSON.parse(msg.tool_result) : msg.tool_result
          if (r.url) productImageUrls.push(r.url)
        } catch {}
      }
      if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.includes('[product_photos:')) {
        const match = msg.content.match(/\[product_photos:([^\]]+)\]/)
        if (match) {
          const urls = match[1].split(',').map((u: string) => u.trim()).filter((u: string) => u.startsWith('http'))
          productImageUrls.push(...urls)
        }
      }
      if (msg.tool_name === 'execute_landing_pipeline' && msg.tool_result) {
        try {
          const r = typeof msg.tool_result === 'string' ? JSON.parse(msg.tool_result) : msg.tool_result
          if (r.product_id) lastLandingProductId = r.product_id
        } catch {}
      }
    }

    const estrategasTools = new EstrategasToolsHandler({
      userId: user.id,
      supabaseAccessToken,
      productImageUrls,
    })
    const dropPageClient = new DropPageClient({ supabaseAccessToken })

    // Log sendEvent for pipeline progress (confirm endpoint doesn't stream SSE but we log)
    const sendEvent = (event: any) => {
      console.log(`[Matias:Confirm:SSE] ${event.type} | ${JSON.stringify(event.data || {}).substring(0, 200)}`)
    }

    console.log(`[Matias:Confirm] Executing ${action.action_type} | userId: ${user.id} | lastLandingProductId: ${lastLandingProductId} | productImages: ${productImageUrls.length}`)

    const result = await executeConfirmedAction(
      metaAccessToken,
      action.action_type,
      action.action_payload,
      {
        userId: user.id,
        lastLandingProductId,
        onExecuteEstrategasTool: (tn, ti) => estrategasTools.executeTool(tn, ti),
        onExecuteDropPageTool: (tn, ti) => dropPageClient.executeTool(tn, ti),
        estrategasTools,
        dropPageClient,
        sendEvent,
      }
    )

    // Find the original tool_call message to get the tool_use_id
    const { data: toolCallMsg } = await serviceClient
      .from('meta_ads_messages')
      .select('tool_use_id')
      .eq('conversation_id', action.conversation_id)
      .eq('role', 'tool_call')
      .eq('tool_name', action.action_type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const toolUseId = toolCallMsg?.tool_use_id || null

    if (result.success) {
      await serviceClient
        .from('meta_ads_pending_actions')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', action_id)

      // Save proper tool_result so Claude can see the result in conversation history
      await serviceClient
        .from('meta_ads_messages')
        .insert({
          conversation_id: action.conversation_id,
          role: 'tool_result',
          tool_name: action.action_type,
          tool_result: result.data || { success: true },
          tool_use_id: toolUseId,
        })

      // Save confirmation message for UI display
      await serviceClient
        .from('meta_ads_messages')
        .insert({
          conversation_id: action.conversation_id,
          role: 'confirmation',
          content: `✅ Acción ejecutada: ${action.description}`,
        })

      return NextResponse.json({
        success: true,
        status: 'executed',
        data: result.data,
        conversation_id: action.conversation_id,
      })
    } else {
      await serviceClient
        .from('meta_ads_pending_actions')
        .update({ status: 'failed', error_message: result.error })
        .eq('id', action_id)

      // Save tool_result with error so Claude knows it failed
      await serviceClient
        .from('meta_ads_messages')
        .insert({
          conversation_id: action.conversation_id,
          role: 'tool_result',
          tool_name: action.action_type,
          tool_result: { success: false, error: result.error },
          tool_use_id: toolUseId,
        })

      // Save error message for UI display
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
