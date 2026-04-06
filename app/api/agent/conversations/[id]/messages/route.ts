import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await serviceClient
      .from('agent_conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error: msgError } = await serviceClient
      .from('agent_messages')
      .select('id, role, content, model_used, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('[Agent] Failed to load messages:', msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    return NextResponse.json(messages || [])
  } catch (error: any) {
    console.error('[Agent] GET /conversations/[id]/messages error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
