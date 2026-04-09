import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendBookingNotification } from '@/lib/email/send-booking-notification'
import { isAdmin } from '@/lib/admin'

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

    // Admin sees all bookings, normal user sees own
    let query = adminClient
      .from('coaching_bookings')
      .select(`
        id, user_id, topic, slot_date, slot_hour, price_usd, status, notes, created_at, mentor_id,
        coaching_mentors (name, email)
      `)
      .order('slot_date', { ascending: false })

    if (!isAdmin(user.email)) {
      query = query.eq('user_id', user.id)
    }

    const { data: bookings, error } = await query

    if (error) {
      console.error('[Coaching] Bookings fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(bookings || [])
  } catch (error: any) {
    console.error('[Coaching] GET /bookings error:', error)
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

    const body = await request.json()
    const { availabilityId, topic, notes } = body

    if (!availabilityId || !topic) {
      return NextResponse.json({ error: 'availabilityId y topic requeridos' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Get the availability slot
    const { data: slot, error: slotError } = await adminClient
      .from('coaching_availability')
      .select('id, mentor_id, slot_date, slot_hour, is_booked')
      .eq('id', availabilityId)
      .single()

    if (slotError || !slot) {
      return NextResponse.json({ error: 'Slot no encontrado' }, { status: 404 })
    }

    if (slot.is_booked) {
      return NextResponse.json({ error: 'Este horario ya está reservado' }, { status: 409 })
    }

    // Get mentor details
    const { data: mentor, error: mentorError } = await adminClient
      .from('coaching_mentors')
      .select('id, name, email, price_usd')
      .eq('id', slot.mentor_id)
      .single()

    if (mentorError || !mentor) {
      return NextResponse.json({ error: 'Mentor no encontrado' }, { status: 404 })
    }

    // Mark slot as booked
    const { error: updateError } = await adminClient
      .from('coaching_availability')
      .update({ is_booked: true })
      .eq('id', availabilityId)

    if (updateError) {
      console.error('[Coaching] Slot update error:', updateError)
      return NextResponse.json({ error: 'Error al reservar el slot' }, { status: 500 })
    }

    // Create booking
    const { data: booking, error: bookingError } = await adminClient
      .from('coaching_bookings')
      .insert({
        user_id: user.id,
        mentor_id: mentor.id,
        availability_id: availabilityId,
        topic,
        slot_date: slot.slot_date,
        slot_hour: slot.slot_hour,
        price_usd: mentor.price_usd,
        notes: notes || null,
      })
      .select()
      .single()

    if (bookingError) {
      // Rollback slot
      await adminClient
        .from('coaching_availability')
        .update({ is_booked: false })
        .eq('id', availabilityId)

      console.error('[Coaching] Booking insert error:', bookingError)
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }

    // Send email notification (non-blocking)
    try {
      await sendBookingNotification({
        mentorName: mentor.name,
        mentorEmail: mentor.email,
        clientEmail: user.email || 'desconocido',
        topic,
        slotDate: slot.slot_date,
        slotHour: slot.slot_hour,
        priceUsd: Number(mentor.price_usd),
        notes: notes || undefined,
      })
    } catch (emailErr) {
      console.error('[Coaching] Email failed (booking still created):', emailErr)
    }

    return NextResponse.json(booking)
  } catch (error: any) {
    console.error('[Coaching] POST /bookings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
