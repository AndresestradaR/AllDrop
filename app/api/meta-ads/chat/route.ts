// Meta Ads Chat — SSE streaming endpoint
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { executeChat } from '@/lib/meta-ads/claude-executor'
import { DropPageClient } from '@/lib/meta-ads/droppage-client'
import { EstrategasToolsHandler } from '@/lib/meta-ads/estrategas-tools'
import type { SSEEvent } from '@/lib/meta-ads/types'
import type Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    }

    const { data: { session } } = await supabase.auth.getSession()
    const supabaseAccessToken = session?.access_token || ''

    const body = await request.json()
    const { conversation_id, message, model, auto_execute, product_images } = body

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

    // Upload product images from chat to Supabase Storage
    const newImageUrls: string[] = []  // Only photos from THIS message
    let productImageUrls: string[] = []  // ALL photos (new + historical)
    if (product_images?.length > 0) {
      for (const imageData of product_images) {
        const base64Match = imageData.match(/^data:[^;]+;base64,(.+)$/)
        if (base64Match) {
          const buffer = Buffer.from(base64Match[1], 'base64')
          const fileName = `meta-ads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
          await serviceClient.storage.from('landing-images').upload(fileName, buffer, {
            contentType: 'image/webp',
            upsert: true,
          })
          const { data: urlData } = serviceClient.storage.from('landing-images').getPublicUrl(fileName)
          newImageUrls.push(urlData.publicUrl)
          productImageUrls.push(urlData.publicUrl)
        }
      }
    }

    // Save user message (include photo URLs marker so they persist across requests)
    const messageContent = newImageUrls.length > 0
      ? `${message}\n[product_photos:${newImageUrls.join(',')}]`
      : message
    await serviceClient
      .from('meta_ads_messages')
      .insert({
        conversation_id,
        role: 'user',
        content: messageContent,
      })

    // Load conversation history for context
    const { data: history } = await supabase
      .from('meta_ads_messages')
      .select('role, content, tool_name, tool_input, tool_result, tool_use_id')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })

    // Recover product image URLs from previous messages
    // Sources: 1) upload_product_image tool results, 2) chat-uploaded photos saved as system notes
    if (history) {
      for (const msg of history) {
        // Source 1: explicit tool calls
        if (msg.tool_name === 'upload_product_image' && msg.tool_result) {
          try {
            const result = typeof msg.tool_result === 'string' ? JSON.parse(msg.tool_result) : msg.tool_result
            if (result.url) productImageUrls.push(result.url)
          } catch { /* ignore parse errors */ }
        }
        // Source 2: photos auto-uploaded from chat attachments (saved as system notes)
        if (msg.role === 'user' && typeof msg.content === 'string' && msg.content.includes('[product_photos:')) {
          const match = msg.content.match(/\[product_photos:([^\]]+)\]/)
          if (match) {
            const urls = match[1].split(',').map((u: string) => u.trim()).filter((u: string) => u.startsWith('http'))
            productImageUrls.push(...urls)
          }
        }
      }
    }
    // Deduplicate URLs
    productImageUrls = [...new Set(productImageUrls)]

    // Create Phase 2 clients
    const dropPageClient = new DropPageClient({ supabaseAccessToken })
    const estrategasTools = new EstrategasToolsHandler({
      userId: user.id,
      supabaseAccessToken,
      productImageUrls,
    })

    // Convert DB messages to Anthropic format
    const anthropicMessages = buildAnthropicMessages(history || [])

    // If user uploaded NEW product images in THIS message, inject them into the last user message
    // so Claude can actually SEE the product photos + know they're available for banners
    // Only inject NEW photos — historical ones are already in the EstrategasToolsHandler
    if (newImageUrls.length > 0 && anthropicMessages.length > 0) {
      const lastMsg = anthropicMessages[anthropicMessages.length - 1]
      if (lastMsg.role === 'user') {
        // Convert to array format with image blocks
        const existingContent = typeof lastMsg.content === 'string'
          ? [{ type: 'text' as const, text: lastMsg.content }]
          : Array.isArray(lastMsg.content) ? [...lastMsg.content as any[]] : []

        // Add image blocks so Claude can see the NEW photos
        for (const url of newImageUrls) {
          existingContent.push({
            type: 'image' as const,
            source: { type: 'url' as const, url },
          } as any)
        }

        // Add note about available photos for banner generation
        existingContent.push({
          type: 'text' as const,
          text: `\n\n[Sistema: ${newImageUrls.length} foto(s) nueva(s) subida(s). Total disponible para banners: ${productImageUrls.length} foto(s). URLs: ${productImageUrls.join(', ')}]`,
        })

        lastMsg.content = existingContent as any
      }
    }

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
              model: model || undefined,
              autoExecute: auto_execute === true,
              messages: anthropicMessages,
              onExecuteEstrategasTool: async (toolName, toolInput) => {
                return estrategasTools.executeTool(toolName, toolInput)
              },
              onExecuteDropPageTool: async (toolName, toolInput) => {
                return dropPageClient.executeTool(toolName, toolInput)
              },
              // Pipeline support — direct instances for deterministic execution
              estrategasToolsHandler: estrategasTools,
              dropPageClientInstance: dropPageClient,
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

// Truncate large JSON data to avoid exceeding token limits
// Used for both tool_input and tool_result
function truncateJSON(data: Record<string, any> | null, maxChars = 4000): string {
  const str = JSON.stringify(data || {})
  if (str.length <= maxChars) return str
  // Try to keep the structure but truncate large arrays/strings
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed)) {
      const truncated = parsed.slice(0, 5)
      return JSON.stringify({ items: truncated, _truncated: true, _total: parsed.length })
    }
    if (parsed.data && Array.isArray(parsed.data)) {
      const truncated = { ...parsed, data: parsed.data.slice(0, 5), _truncated: true, _total: parsed.data.length }
      return JSON.stringify(truncated)
    }
    // Truncate individual string values that are too long (e.g. base64 image data)
    const cleaned: Record<string, any> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.length > 500) {
        cleaned[k] = v.substring(0, 200) + `... [truncated, ${v.length} chars]`
      } else {
        cleaned[k] = v
      }
    }
    const cleanedStr = JSON.stringify(cleaned)
    if (cleanedStr.length <= maxChars) return cleanedStr
  } catch { /* ignore */ }
  return str.substring(0, maxChars) + '... [truncated]'
}

// Legacy alias
function truncateToolResult(result: Record<string, any> | null): string {
  return truncateJSON(result)
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

  // Keep only last 60 messages to avoid token overflow
  const recentMessages = dbMessages.length > 60 ? dbMessages.slice(-60) : dbMessages

  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      // Merge consecutive user messages (can happen after confirmation + continuation)
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'user') {
        if (typeof lastMsg.content === 'string') {
          // Convert to array format so we can append
          lastMsg.content = [
            { type: 'text', text: lastMsg.content },
            { type: 'text', text: msg.content || '' },
          ] as any
        } else if (Array.isArray(lastMsg.content)) {
          (lastMsg.content as any[]).push({ type: 'text', text: msg.content || '' })
        }
      } else {
        messages.push({ role: 'user', content: msg.content || '' })
      }
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
      // Truncate tool_input to avoid base64 image data blowing up the prompt
      const lastMsg = messages[messages.length - 1]
      let safeInput = msg.tool_input || {}
      const inputStr = JSON.stringify(safeInput)
      if (inputStr.length > 4000) {
        try {
          safeInput = JSON.parse(truncateJSON(safeInput))
        } catch {
          safeInput = { _truncated: true, _note: 'Input too large' }
        }
      }
      const toolBlock = {
        type: 'tool_use',
        id: msg.tool_use_id || `tool_${Date.now()}`,
        name: msg.tool_name || '',
        input: safeInput,
      }
      if (lastMsg?.role === 'assistant' && Array.isArray(lastMsg.content)) {
        (lastMsg.content as any[]).push(toolBlock)
      } else {
        messages.push({ role: 'assistant', content: [toolBlock] as any })
      }
    } else if (msg.role === 'tool_result') {
      // Add tool_result — merge with existing user message if consecutive
      const lastMsg = messages[messages.length - 1]
      const toolResultBlock = {
        type: 'tool_result',
        tool_use_id: msg.tool_use_id || '',
        content: truncateToolResult(msg.tool_result),
      }
      if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
        (lastMsg.content as any[]).push(toolResultBlock)
      } else {
        messages.push({
          role: 'user',
          content: [toolResultBlock] as any,
        })
      }
    }
    // Skip 'confirmation' role — it's UI-only, not sent to Claude
  }

  return messages
}
