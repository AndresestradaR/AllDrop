// Meta Ads Chat — SSE streaming endpoint
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { executeChat } from '@/lib/meta-ads/claude-executor'
import type { SSEEvent } from '@/lib/meta-ads/types'
import type Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    }

    const body = await request.json()
    const { conversation_id, message } = body

    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: 'conversation_id y message son requeridos' }), { status: 400 })
    }

    // Verify conversation ownership
    const { data: conv } = await supabase
      .from('meta_ads_conversations')
      .select('id, meta_ad_account_id')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (!conv) {
      return new Response(JSON.stringify({ error: 'Conversación no encontrada' }), { status: 404 })
    }

    // Get encrypted keys from profiles
    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('meta_access_token, anthropic_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.meta_access_token || !profile?.anthropic_api_key) {
      return new Response(JSON.stringify({
        error: 'Configura tu token de Meta y tu API key de Anthropic en Settings',
      }), { status: 400 })
    }

    let metaAccessToken: string
    let anthropicApiKey: string
    try {
      metaAccessToken = decrypt(profile.meta_access_token)
      anthropicApiKey = decrypt(profile.anthropic_api_key)
    } catch {
      return new Response(JSON.stringify({ error: 'Error descifrando credenciales. Reconfigura en Settings.' }), { status: 400 })
    }

    // Save user message
    await serviceClient
      .from('meta_ads_messages')
      .insert({
        conversation_id,
        role: 'user',
        content: message,
      })

    // Load conversation history for context
    const { data: history } = await supabase
      .from('meta_ads_messages')
      .select('role, content, tool_name, tool_input, tool_result, tool_use_id')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })

    // Convert DB messages to Anthropic format
    const anthropicMessages = buildAnthropicMessages(history || [])

    // Update conversation title if first message
    if (anthropicMessages.length <= 1) {
      const shortTitle = message.length > 60 ? message.substring(0, 57) + '...' : message
      await supabase
        .from('meta_ads_conversations')
        .update({ title: shortTitle, updated_at: new Date().toISOString() })
        .eq('id', conversation_id)
    } else {
      await supabase
        .from('meta_ads_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversation_id)
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: SSEEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {
            // Stream closed
          }
        }

        try {
          await executeChat(
            {
              anthropicApiKey,
              metaAccessToken,
              conversationId: conversation_id,
              userId: user.id,
              messages: anthropicMessages,
              onGetProducts: async () => {
                const { data: products } = await supabase
                  .from('products')
                  .select('id, name, description, image_url, created_at')
                  .eq('user_id', user!.id)
                  .order('created_at', { ascending: false })
                return (products || []).map(p => ({
                  id: p.id,
                  nombre: p.name,
                  descripcion: p.description,
                  imagen: p.image_url,
                  landing_url: `https://www.estrategasia.com/dashboard/landing/${p.id}`,
                }))
              },
              onSaveMessage: async (msg) => {
                const { data } = await serviceClient
                  .from('meta_ads_messages')
                  .insert({
                    conversation_id,
                    role: msg.role,
                    content: msg.content || null,
                    tool_name: msg.tool_name || null,
                    tool_input: msg.tool_input || null,
                    tool_result: msg.tool_result || null,
                    tool_use_id: msg.tool_use_id || null,
                    requires_confirmation: msg.requires_confirmation || false,
                  })
                  .select('id')
                  .single()
                return data?.id
              },
              onCreatePendingAction: async (action) => {
                const { data } = await serviceClient
                  .from('meta_ads_pending_actions')
                  .insert({
                    conversation_id,
                    action_type: action.action_type,
                    action_payload: action.action_payload,
                    description: action.description,
                    status: 'pending',
                  })
                  .select('id')
                  .single()
                return data?.id || ''
              },
            },
            sendEvent
          )
        } catch (err: any) {
          sendEvent({
            type: 'error',
            data: { message: err.message || 'Error interno' },
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}

// Convert DB messages to Anthropic API format
function buildAnthropicMessages(
  dbMessages: Array<{
    role: string
    content: string | null
    tool_name: string | null
    tool_input: Record<string, any> | null
    tool_result: Record<string, any> | null
    tool_use_id: string | null
  }>
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  for (const msg of dbMessages) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content || '' })
    } else if (msg.role === 'assistant') {
      // Merge consecutive assistant blocks
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
        if (msg.content) {
          (lastMsg.content as any[]).push({ type: 'text', text: msg.content })
        }
      } else {
        const content: any[] = []
        if (msg.content) content.push({ type: 'text', text: msg.content })
        if (content.length > 0) {
          messages.push({ role: 'assistant', content })
        }
      }
    } else if (msg.role === 'tool_call') {
      // Add tool_use block to assistant message
      const lastMsg = messages[messages.length - 1]
      const toolBlock = {
        type: 'tool_use',
        id: msg.tool_use_id || `tool_${Date.now()}`,
        name: msg.tool_name || '',
        input: msg.tool_input || {},
      }
      if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
        (lastMsg.content as any[]).push(toolBlock)
      } else {
        messages.push({ role: 'assistant', content: [toolBlock] as any })
      }
    } else if (msg.role === 'tool_result') {
      // Add tool_result as user message
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_use_id || '',
          content: JSON.stringify(msg.tool_result || {}),
        }] as any,
      })
    }
  }

  return messages
}
