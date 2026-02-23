import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()

    // Verify user is a mentor
    const { data: mentor, error: mentorError } = await serviceClient
      .from('coaching_mentors')
      .select('id, mentor_share_usd')
      .eq('email', user.email)
      .single()

    if (mentorError || !mentor) {
      return NextResponse.json({ error: 'No eres mentor' }, { status: 403 })
    }

    // Get all bookings for this mentor
    const { data: bookings, error } = await serviceClient
      .from('coaching_bookings')
      .select('id, user_id, topic, slot_date, slot_hour, price_usd, status, notes, created_at')
      .eq('mentor_id', mentor.id)
      .order('slot_date', { ascending: false })

    if (error) {
      console.error('[Coaching] Mentor bookings fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get user emails for each booking
    const userIds = Array.from(new Set((bookings || []).map(b => b.user_id)))
    let userMap: Record<string, string> = {}

    if (userIds.length > 0) {
      // Fetch emails from auth.users via admin API
      for (const uid of userIds) {
        const { data: { user: u } } = await serviceClient.auth.admin.getUserById(uid)
        if (u?.email) userMap[uid] = u.email
      }
    }

    const enriched = (bookings || []).map(b => ({
      ...b,
      client_email: userMap[b.user_id] || 'desconocido',
      mentor_share: Number(mentor.mentor_share_usd),
    }))

    return NextResponse.json(enriched)
  } catch (error: any) {
    console.error('[Coaching] GET mentor/bookings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
