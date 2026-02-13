import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — List user's influencers
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: influencers, error } = await supabase
      .from('influencers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Influencer/List] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ influencers: influencers || [] })

  } catch (error: any) {
    console.error('[Influencer/List] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — Create new influencer
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, image_url, character_profile, voice_id, voice_name } = body as {
      name: string
      description?: string
      image_url?: string
      character_profile?: any
      voice_id?: string
      voice_name?: string
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const { data: influencer, error } = await supabase
      .from('influencers')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        image_url: image_url || null,
        character_profile: character_profile || {},
        voice_id: voice_id || null,
        voice_name: voice_name || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[Influencer/Create] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Influencer/Create] User: ${user.id.substring(0, 8)}..., Name: ${name}`)

    return NextResponse.json({ influencer })

  } catch (error: any) {
    console.error('[Influencer/Create] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH — Update influencer (partial updates during wizard)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body as { id: string; [key: string]: any }

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID' }, { status: 400 })
    }

    // Only allow safe fields to be updated
    const allowedFields = [
      'name', 'description', 'image_url', 'character_profile',
      'gender', 'age_range', 'skin_tone', 'hair_color', 'hair_style',
      'eye_color', 'build', 'style_vibe', 'accessories', 'custom_details',
      'base_image_url', 'base_prompt', 'realistic_image_url', 'angles_grid_url',
      'visual_dna', 'prompt_descriptor', 'current_step',
      'voice_id', 'voice_name',
    ]

    const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in updates) {
        safeUpdates[key] = updates[key]
      }
    }

    const { data: influencer, error } = await supabase
      .from('influencers')
      .update(safeUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[Influencer/Update] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ influencer })

  } catch (error: any) {
    console.error('[Influencer/Update] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — Delete an influencer
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
      return NextResponse.json(
        { error: 'Se requiere el ID' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('influencers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[Influencer/Delete] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Influencer/Delete] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
