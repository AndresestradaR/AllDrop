import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { streamAgentResponse, type AgentMessage, type ToolCallResult } from '@/lib/agent/openrouter'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { agentToolDefinitions, executeToolCall, type ToolContext } from '@/lib/agent/tools'

export const maxDuration = 120

const ALLOWED_PLANS = ['pro', 'business', 'enterprise']
const ADMIN_EMAIL = 'infoalldrop@gmail.com'
const MAX_TOOL_ITERATIONS = 10

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the Supabase access token for SSO bridge to DropPage
    const { data: { session } } = await supabase.auth.getSession()
    const supabaseAccessToken = session?.access_token || ''

    // Plan gate (skip for admin)
    const serviceClient = await createServiceClient()
    let userName = ''

    if (user.email !== ADMIN_EMAIL) {
      const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('plan, full_name')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      if (!ALLOWED_PLANS.includes(profile.plan)) {
        return NextResponse.json(
          { error: 'This feature requires a Pro, Business, or Enterprise plan' },
          { status: 403 }
        )
      }
      userName = profile.full_name || ''
    }

    // Parse body
    const body = await request.json()
    const { conversation_id, message, locale, product_images } = body as {
      conversation_id?: string
      message: string
      locale?: string
      product_images?: string[]
    }

    const hasImages = product_images && product_images.length > 0
    if ((!message || typeof message !== 'string' || message.trim().length === 0) && !hasImages) {
      return NextResponse.json({ error: 'Message or images required' }, { status: 400 })
    }

    // Extract request headers for internal API calls
    const requestHeaders: Record<string, string> = {}
    const cookie = request.headers.get('cookie')
    if (cookie) requestHeaders['cookie'] = cookie
    const auth = request.headers.get('authorization')
    if (auth) requestHeaders['authorization'] = auth

    // Resolve or create conversation
    let convId = conversation_id

    if (!convId) {
      const title = message.trim().slice(0, 80)
      const { data: newConv, error: convError } = await serviceClient
        .from('agent_conversations')
        .insert({ user_id: user.id, title })
        .select('id')
        .single()

      if (convError || !newConv) {
        console.error('[Agent] Failed to create conversation:', convError)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      convId = newConv.id
    }

    // Save user message
    const { error: msgError } = await serviceClient
      .from('agent_messages')
      .insert({
        conversation_id: convId,
        role: 'user',
        content: message.trim(),
      })

    if (msgError) {
      console.error('[Agent] Failed to save user message:', msgError)
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    // Upload images to Storage immediately and save URLs
    let uploadedImageUrls: string[] = []
    if (hasImages) {
      console.log(`[Agent] Uploading ${product_images!.length} images to Storage...`)
      for (let i = 0; i < product_images!.length; i++) {
        try {
          const base64 = product_images![i]
          const match = base64.match(/^data:([^;]+);base64,(.+)$/)
          if (!match) continue
          const mimeType = match[1]
          const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
          const buffer = Buffer.from(match[2], 'base64')
          const filePath = `agent/${user.id}/${convId}/${Date.now()}-${i}.${ext}`

          const { error: uploadErr } = await serviceClient.storage
            .from('landing-images')
            .upload(filePath, buffer, { contentType: mimeType })

          if (uploadErr) {
            console.error(`[Agent] Upload error:`, uploadErr.message)
            continue
          }

          // Try public URL first, fallback to signed URL (1h expiry)
          const { data: urlData } = serviceClient.storage
            .from('landing-images')
            .getPublicUrl(filePath)

          if (urlData?.publicUrl) {
            // Verify it works by also creating a signed URL as backup
            const { data: signedData } = await serviceClient.storage
              .from('landing-images')
              .createSignedUrl(filePath, 3600) // 1 hour

            const finalUrl = signedData?.signedUrl || urlData.publicUrl
            uploadedImageUrls.push(finalUrl)
            console.log(`[Agent] Uploaded image: ${finalUrl}`)
          }
        } catch (e: any) {
          console.error(`[Agent] Image upload failed:`, e.message)
        }
      }

      // Save URLs to conversation (not base64 — just small URL strings)
      if (uploadedImageUrls.length > 0) {
        try {
          // Merge with existing images
          const { data: existing } = await serviceClient
            .from('agent_conversations')
            .select('product_images')
            .eq('id', convId)
            .single()
          const allUrls = [...(existing?.product_images || []), ...uploadedImageUrls]
          await serviceClient
            .from('agent_conversations')
            .update({ product_images: allUrls })
            .eq('id', convId)
        } catch {
          // column may not exist
        }
      }
    }

    // Load ALL product image URLs from conversation (includes previous uploads)
    let allProductImageUrls = [...uploadedImageUrls]
    if (allProductImageUrls.length === 0) {
      try {
        const { data: convData } = await serviceClient
          .from('agent_conversations')
          .select('product_images')
          .eq('id', convId)
          .single()
        if (convData?.product_images && Array.isArray(convData.product_images)) {
          allProductImageUrls = convData.product_images
        }
      } catch {
        // column may not exist
      }
    }

    // Build tool context with URLs (not base64)
    const toolContext: ToolContext = {
      userId: user.id,
      supabaseAccessToken,
      conversationId: convId,
      productImages: allProductImageUrls.length > 0 ? allProductImageUrls : undefined,
    }

    // Load last 40 messages for context
    const { data: history, error: historyError } = await serviceClient
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(40)

    if (historyError) {
      console.error('[Agent] Failed to load history:', historyError)
      return NextResponse.json({ error: 'Failed to load conversation history' }, { status: 500 })
    }

    // Load agent config for personalization
    const { data: agentConfig } = await serviceClient
      .from('agent_config')
      .select('agent_name, personality, custom_instructions')
      .eq('user_id', user.id)
      .single()

    // Build messages array
    const systemPrompt = buildSystemPrompt(userName, locale, {
      agentName: agentConfig?.agent_name || undefined,
      personality: agentConfig?.personality || undefined,
      customInstructions: agentConfig?.custom_instructions || undefined,
    })
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as AgentMessage['role'],
        content: m.content,
      })),
    ]

    // If user sent images, store them in conversation context and enrich the last message
    if (hasImages) {
      // Store image data in conversation metadata for tools to use later
      try {
        await serviceClient
          .from('agent_conversations')
          .update({ product_images: product_images })
          .eq('id', convId)
      } catch {
        // ignore — column may not exist yet
      }

      // Append image context to the user message so the agent knows photos were received
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        const imgNote = uploadedImageUrls.length > 0
          ? `[El usuario adjuntó ${uploadedImageUrls.length} foto(s) del producto, ya subidas a Storage. URLs: ${uploadedImageUrls.join(', ')}. Las fotos están disponibles automáticamente para execute_landing_pipeline. NO pidas más fotos, ya las tienes.]`
          : `[El usuario adjuntó foto(s) del producto. Ya están guardadas en la conversación. NO pidas más fotos.]`
        lastMsg.content = `${lastMsg.content || ''}\n\n${imgNote}`.trim()
      }
    }

    // SSE stream with tool use loop
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Send conversation_id first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversation_id: convId })}\n\n`)
        )

        let currentMessages = [...messages]
        let iteration = 0

        async function runAgentLoop(): Promise<void> {
          if (iteration >= MAX_TOOL_ITERATIONS) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Too many tool iterations' })}\n\n`)
            )
            controller.close()
            return
          }

          iteration++

          return new Promise<void>((resolve, reject) => {
            const pendingToolCalls: ToolCallResult[] = []
            let hasToolCalls = false

            streamAgentResponse(
              currentMessages,
              {
                onDelta(text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
                  )
                },
                onError(error) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'error', error })}\n\n`)
                  )
                  controller.close()
                  resolve()
                },
                async onDone(fullText, model) {
                  // No tool calls — final text response
                  await serviceClient
                    .from('agent_messages')
                    .insert({
                      conversation_id: convId,
                      role: 'assistant',
                      content: fullText,
                      model_used: model,
                    })

                  await serviceClient
                    .from('agent_conversations')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', convId)

                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'done', model })}\n\n`)
                  )
                  controller.close()
                  resolve()
                },
                onToolCall(toolCall) {
                  console.log(`[Agent] TOOL CALL: ${toolCall.name} (id=${toolCall.id})`)
                  hasToolCalls = true
                  pendingToolCalls.push(toolCall)
                },
              },
              { tools: agentToolDefinitions },
            ).then(async () => {
              // After stream ends, if there were tool calls, execute them
              if (hasToolCalls && pendingToolCalls.length > 0) {
                // Notify client that tools are being executed
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'tool_status', status: 'executing', tools: pendingToolCalls.map(tc => tc.name) })}\n\n`)
                )

                // Add assistant message with tool_calls to conversation
                currentMessages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: pendingToolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.name,
                      arguments: tc.arguments,
                    },
                  })),
                })

                // Execute each tool and add results
                for (const tc of pendingToolCalls) {
                  const result = await executeToolCall(tc.name, tc.arguments, requestHeaders, toolContext)

                  // Truncate large results to avoid token explosion
                  const truncatedResult = result.length > 4000
                    ? result.substring(0, 4000) + '... [truncated]'
                    : result

                  currentMessages.push({
                    role: 'tool',
                    content: truncatedResult,
                    tool_call_id: tc.id,
                    name: tc.name,
                  })
                }

                // Run the loop again with tool results
                try {
                  await runAgentLoop()
                  resolve()
                } catch (err) {
                  reject(err)
                }
              }
              // If no tool calls and onDone wasn't called (edge case), resolve
            }).catch((err) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err?.message || 'Stream error' })}\n\n`)
              )
              controller.close()
              resolve()
            })
          })
        }

        try {
          await runAgentLoop()
        } catch (err: any) {
          console.error('[Agent] Tool loop error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: err?.message || 'Agent loop error' })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('[Agent] POST /chat error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
