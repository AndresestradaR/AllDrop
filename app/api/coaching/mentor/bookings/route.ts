import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // Verify user is a mentor
    const { data: mentor, error: mentorError } = await adminClient
      .from('coaching_mentors')
      .select('id, mentor_share_usd')
      .eq('email', user.email)
      .single()

    if (mentorError || !mentor) {
      return NextResponse.json({ error: 'No eres mentor' }, { status: 403 })
    }

    // Get all bookings for this mentor
    const { data: bookings, error } = await adminClient
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
      for (const uid of userIds) {
        const { data: { user: u } } = await adminClient.auth.admin.getUserById(uid)
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
