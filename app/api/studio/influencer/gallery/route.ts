import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Migration SQL (ejecutar en Supabase SQL Editor):
// ALTER TABLE public.influencer_gallery ADD COLUMN IF NOT EXISTS video_url TEXT;
// ALTER TABLE public.influencer_gallery ADD COLUMN IF NOT EXISTS content_type VARCHAR(10) DEFAULT 'image';
// content_type: 'image' o 'video'

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

// POST — Create gallery item (image or video)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.influencerId) {
      return NextResponse.json({ error: 'influencerId es requerido' }, { status: 400 })
    }

    const insertData: Record<string, any> = {
      influencer_id: body.influencerId,
      user_id: user.id,
      image_url: body.image_url || body.video_url || '', // Fallback para videos: usar video_url como image_url, nunca null
      type: body.type || 'solo',
      product_name: body.product_name || null,
      product_image_url: body.product_image_url || null,
      prompt_used: body.prompt_used || null,
      situation: body.situation || null,
    }

    // Add video fields if provided (columns may not exist yet)
    if (body.video_url) insertData.video_url = body.video_url
    if (body.content_type) insertData.content_type = body.content_type

    const { data, error } = await supabase
      .from('influencer_gallery')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('[Gallery/Create] Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })

  } catch (error: any) {
    console.error('[Gallery/Create] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
