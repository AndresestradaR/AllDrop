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
      frequency_hours,
      account_ids,
      mode,
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

    const { data: flow, error } = await supabase
      .from('automation_flows')
      .insert({
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
        frequency_hours: frequency_hours || 12,
        account_ids: account_ids || [],
        mode: mode || 'semi',
        is_active: false,
        next_run_at: new Date().toISOString(),
      })
      .select()
      .single()

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
      'frequency_hours', 'account_ids', 'mode', 'is_active',
    ]

    const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in updates) {
        safeUpdates[key] = updates[key]
      }
    }

    // Si se activa, calcular next_run_at
    if (safeUpdates.is_active === true) {
      safeUpdates.next_run_at = new Date().toISOString()
    }

    const { data: flow, error } = await supabase
      .from('automation_flows')
      .update(safeUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

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
