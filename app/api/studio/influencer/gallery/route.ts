import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — List gallery items for an influencer
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const influencerId = searchParams.get('influencerId')

    if (!influencerId) {
      return NextResponse.json({ error: 'influencerId es requerido' }, { status: 400 })
    }

    const { data: items, error } = await supabase
      .from('influencer_gallery')
      .select('*')
      .eq('influencer_id', influencerId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Gallery/List] Error:', error.message)
      // Return empty array gracefully (table may not exist yet)
      return NextResponse.json({ items: [] })
    }

    return NextResponse.json({ items: items || [] })

  } catch (error: any) {
    console.error('[Gallery/List] Error:', error.message)
    return NextResponse.json({ items: [] })
  }
}

// PATCH — Update gallery item (favorite toggle)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { id, is_favorite } = body as { id: string; is_favorite: boolean }

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('influencer_gallery')
      .update({ is_favorite })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE — Delete gallery item
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
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('influencer_gallery')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
