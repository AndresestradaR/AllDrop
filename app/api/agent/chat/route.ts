import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { streamAgentResponse, type AgentMessage } from '@/lib/agent/openrouter'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'

export const maxDuration = 60

const ALLOWED_PLANS = ['pro', 'business', 'enterprise']
const ADMIN_EMAIL = 'infoalldrop@gmail.com'

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
    const { conversation_id, message } = body as {
      conversation_id?: string
      message: string
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

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

    // Build messages array
    const systemPrompt = buildSystemPrompt(userName)
    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as AgentMessage['role'],
        content: m.content,
      })),
    ]

    // SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Send conversation_id first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversation_id: convId })}\n\n`)
        )

        await streamAgentResponse(messages, {
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
          },
          async onDone(fullText, model) {
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
          },
        })
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
