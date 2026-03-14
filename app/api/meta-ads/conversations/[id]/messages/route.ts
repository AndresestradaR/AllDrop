// Meta Ads Messages — list messages for a conversation
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verify conversation belongs to user
  const { data: conv } = await supabase
    .from('meta_ads_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('meta_ads_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
