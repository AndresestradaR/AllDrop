import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mentorId = searchParams.get('mentorId')
    const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Monday)

    if (!mentorId || !weekStart) {
      return NextResponse.json({ error: 'mentorId y weekStart requeridos' }, { status: 400 })
    }

    // Calculate week end (Sunday)
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const weekEnd = end.toISOString().split('T')[0]

    const { data: slots, error } = await supabase
      .from('coaching_availability')
      .select('id, slot_date, slot_hour, is_booked')
      .eq('mentor_id', mentorId)
      .gte('slot_date', weekStart)
      .lte('slot_date', weekEnd)
      .order('slot_date', { ascending: true })
      .order('slot_hour', { ascending: true })

    if (error) {
      console.error('[Coaching] Availability fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(slots || [])
  } catch (error: any) {
    console.error('[Coaching] GET /availability error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
