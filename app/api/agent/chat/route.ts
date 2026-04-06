import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { streamAgentResponse, type AgentMessage, type ToolCallResult } from '@/lib/agent/openrouter'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { agentToolDefinitions, executeToolCall } from '@/lib/agent/tools'

export const maxDuration = 60

const ALLOWED_PLANS = ['pro', 'business', 'enterprise']
const ADMIN_EMAIL = 'infoalldrop@gmail.com'
const MAX_TOOL_ITERATIONS = 5

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const { conversation_id, message, locale } = body as {
      conversation_id?: string
      message: string
      locale?: string
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
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
                  // Save assistant message
                  await serviceClient
                    .from('agent_messages')
                    .insert({
                      conversation_id: convId,
                      role: 'assistant',
                      content: fullText,
                      model_used: model,
                    })

                  // Update conversation updated_at
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
                  const result = await executeToolCall(tc.name, tc.arguments, requestHeaders)
                  currentMessages.push({
                    role: 'tool',
                    content: result,
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
