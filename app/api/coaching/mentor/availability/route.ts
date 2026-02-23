import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
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
      .select('id')
      .eq('email', user.email)
      .single()

    if (mentorError || !mentor) {
      return NextResponse.json({ error: 'No eres mentor' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart requerido' }, { status: 400 })
    }

    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const weekEnd = end.toISOString().split('T')[0]

    const { data: slots, error } = await serviceClient
      .from('coaching_availability')
      .select('id, slot_date, slot_hour, is_booked')
      .eq('mentor_id', mentor.id)
      .gte('slot_date', weekStart)
      .lte('slot_date', weekEnd)
      .order('slot_date', { ascending: true })
      .order('slot_hour', { ascending: true })

    if (error) {
      console.error('[Coaching] Mentor availability fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(slots || [])
  } catch (error: any) {
    console.error('[Coaching] GET mentor/availability error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()

    const { data: mentor, error: mentorError } = await serviceClient
      .from('coaching_mentors')
      .select('id')
      .eq('email', user.email)
      .single()

    if (mentorError || !mentor) {
      return NextResponse.json({ error: 'No eres mentor' }, { status: 403 })
    }

    const body = await request.json()
    const { slots } = body // Array of { slot_date: string, slot_hour: number }

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: 'slots requeridos' }, { status: 400 })
    }

    const records = slots.map((s: { slot_date: string; slot_hour: number }) => ({
      mentor_id: mentor.id,
      slot_date: s.slot_date,
      slot_hour: s.slot_hour,
      is_booked: false,
    }))

    // Upsert to avoid duplicates
    const { data, error } = await serviceClient
      .from('coaching_availability')
      .upsert(records, { onConflict: 'mentor_id,slot_date,slot_hour', ignoreDuplicates: true })
      .select()

    if (error) {
      console.error('[Coaching] Slot creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ created: data?.length || 0 })
  } catch (error: any) {
    console.error('[Coaching] POST mentor/availability error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()

    const { data: mentor, error: mentorError } = await serviceClient
      .from('coaching_mentors')
      .select('id')
      .eq('email', user.email)
      .single()

    if (mentorError || !mentor) {
      return NextResponse.json({ error: 'No eres mentor' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const slotId = searchParams.get('slotId')

    if (!slotId) {
      return NextResponse.json({ error: 'slotId requerido' }, { status: 400 })
    }

    // Only delete if not booked and belongs to this mentor
    const { error } = await serviceClient
      .from('coaching_availability')
      .delete()
      .eq('id', slotId)
      .eq('mentor_id', mentor.id)
      .eq('is_booked', false)

    if (error) {
      console.error('[Coaching] Slot delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Coaching] DELETE mentor/availability error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
