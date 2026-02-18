import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — List user's automation flows (with influencer name)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: flows, error } = await supabase
      .from('automation_flows')
      .select(`
        *,
        influencer:influencers(id, name, image_url, realistic_image_url, prompt_descriptor)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Automations/List] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flows: flows || [] })
  } catch (error: any) {
    console.error('[Automations/List] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — Create new automation flow
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      influencer_id,
      video_preset,
      product_name,
      product_image_url,
      product_benefits,
      system_prompt,
      scenarios,
      voice_style,
      voice_custom_instruction,
      schedule_times,
      account_ids,
      mode,
      video_options,
    } = body

    if (!influencer_id || !product_name?.trim()) {
      return NextResponse.json(
        { error: 'Influencer y nombre de producto son requeridos' },
        { status: 400 }
      )
    }

    // Verify influencer belongs to user
    const { data: influencer } = await supabase
      .from('influencers')
      .select('id')
      .eq('id', influencer_id)
      .eq('user_id', user.id)
      .single()

    if (!influencer) {
      return NextResponse.json({ error: 'Influencer no encontrado' }, { status: 404 })
    }

    const insertData: Record<string, any> = {
        user_id: user.id,
        name: name?.trim() || `Auto - ${product_name}`,
        influencer_id,
        video_preset: video_preset || 'rapido',
        product_name: product_name.trim(),
        product_image_url: product_image_url || null,
        product_benefits: product_benefits?.trim() || '',
        system_prompt: system_prompt?.trim() || undefined,
        scenarios: scenarios || undefined,
        voice_style: voice_style || 'paisa',
        voice_custom_instruction: voice_custom_instruction?.trim() || '',
        schedule_times: schedule_times || ['08:00', '20:00'],
        account_ids: account_ids || [],
        mode: mode || 'semi',
        is_active: false,
        next_run_at: new Date().toISOString(),
    }
    if (video_options && Object.keys(video_options).length > 0) {
      insertData.video_options = video_options
    }

    let { data: flow, error } = await supabase
      .from('automation_flows')
      .insert(insertData)
      .select()
      .single()

    // If video_options column doesn't exist yet, retry without it
    if (error?.message?.includes('video_options') && insertData.video_options !== undefined) {
      console.warn('[Automations/Create] video_options column not found, retrying without it')
      delete insertData.video_options
      const retry = await supabase
        .from('automation_flows')
        .insert(insertData)
        .select()
        .single()
      flow = retry.data
      error = retry.error
    }

    if (error) {
      console.error('[Automations/Create] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flow })
  } catch (error: any) {
    console.error('[Automations/Create] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — Update automation flow
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID' }, { status: 400 })
    }

    const allowedFields = [
      'name', 'influencer_id', 'video_preset',
      'product_name', 'product_image_url', 'product_benefits',
      'system_prompt', 'scenarios',
      'voice_style', 'voice_custom_instruction',
      'schedule_times', 'account_ids', 'mode', 'is_active',
      'video_options',
    ]

    const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in updates) {
        safeUpdates[key] = updates[key]
      }
    }

    // Si se activa, calcular next_run_at basado en schedule_times
    if (safeUpdates.is_active === true) {
      // Fetch current flow to get schedule_times
      const { data: currentFlow } = await supabase
        .from('automation_flows')
        .select('schedule_times')
        .eq('id', id)
        .single()
      const times = safeUpdates.schedule_times || currentFlow?.schedule_times || ['08:00', '20:00']
      safeUpdates.next_run_at = calculateNextRunAt(times)
    }

    let { data: flow, error } = await supabase
      .from('automation_flows')
      .update(safeUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    // If video_options column doesn't exist yet, retry without it
    if (error?.message?.includes('video_options') && safeUpdates.video_options !== undefined) {
      console.warn('[Automations/Update] video_options column not found, retrying without it')
      delete safeUpdates.video_options
      const retry = await supabase
        .from('automation_flows')
        .update(safeUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      flow = retry.data
      error = retry.error
    }

    if (error) {
      console.error('[Automations/Update] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flow })
  } catch (error: any) {
    console.error('[Automations/Update] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — Delete automation flow
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('automation_flows')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Automations/Delete] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Automations/Delete] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Calculate next run time based on schedule_times (Colombia UTC-5)
function calculateNextRunAt(scheduleTimes: string[]): string {
  if (!scheduleTimes || scheduleTimes.length === 0) {
    return new Date().toISOString()
  }

  // Colombia timezone offset (UTC-5)
  const now = new Date()
  const colombiaOffset = -5 * 60 // minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const colombiaMinutes = utcMinutes + colombiaOffset
  const colombiaHour = Math.floor(((colombiaMinutes % 1440) + 1440) % 1440 / 60)
  const colombiaMin = ((colombiaMinutes % 1440) + 1440) % 1440 % 60

  // Parse and sort schedule times
  const times = scheduleTimes
    .map(t => {
      const [h, m] = t.split(':').map(Number)
      return { h, m, total: h * 60 + m }
    })
    .sort((a, b) => a.total - b.total)

  const currentTotal = colombiaHour * 60 + colombiaMin

  // Find next time after now
  let nextTime = times.find(t => t.total > currentTotal)
  let daysToAdd = 0

  if (!nextTime) {
    // No more times today, use first time tomorrow
    nextTime = times[0]
    daysToAdd = 1
  }

  // Build UTC date for the next run
  const nextDate = new Date(now)
  nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd)
  // Convert Colombia time back to UTC
  const nextUtcHour = nextTime.h + 5 // Colombia is UTC-5
  nextDate.setUTCHours(nextUtcHour % 24, nextTime.m, 0, 0)
  if (nextUtcHour >= 24) {
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  }

  return nextDate.toISOString()
}
