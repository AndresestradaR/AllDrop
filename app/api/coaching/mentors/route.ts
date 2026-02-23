import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: mentors, error } = await supabase
      .from('coaching_mentors')
      .select('id, name, email, photo_url, bio, topics, price_usd, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Coaching] Mentors fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(mentors || [])
  } catch (error: any) {
    console.error('[Coaching] GET /mentors error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
