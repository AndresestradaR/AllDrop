import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractYouTubeId } from '@/lib/utils/youtube'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

// GET - List community videos
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: videos, error } = await supabase
      .from('academia_community')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching community videos:', error)
      return NextResponse.json({ error: 'Error al obtener videos' }, { status: 500 })
    }

    return NextResponse.json({ videos: videos || [] })
  } catch (error) {
    console.error('Academia community API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Share a video (any logged-in user)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, youtube_url, user_name } = body

    if (!title?.trim() || !youtube_url?.trim()) {
      return NextResponse.json({ error: 'Titulo y URL de YouTube requeridos' }, { status: 400 })
    }

    const youtube_video_id = extractYouTubeId(youtube_url.trim())
    if (!youtube_video_id) {
      return NextResponse.json({ error: 'URL de YouTube invalida' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { data: video, error } = await serviceClient
      .from('academia_community')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        youtube_url: youtube_url.trim(),
        youtube_video_id,
        user_name: user_name?.trim() || user.email?.split('@')[0] || 'Anonimo',
        is_approved: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating community video:', error)
      return NextResponse.json({ error: 'Error al compartir video' }, { status: 500 })
    }

    return NextResponse.json({ video })
  } catch (error) {
    console.error('Academia community API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Delete own video (or admin can delete any)
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
      return NextResponse.json({ error: 'ID de video requerido' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const isAdmin = user.email === ADMIN_EMAIL

    let query = serviceClient
      .from('academia_community')
      .delete()
      .eq('id', id)

    if (!isAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { error } = await query

    if (error) {
      console.error('Error deleting community video:', error)
      return NextResponse.json({ error: 'Error al eliminar video' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Academia community API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
