import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractYouTubeId } from '@/lib/utils/youtube'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

// POST - Create lesson (admin only)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const body = await request.json()
    const { course_id, title, description, youtube_url, sort_order } = body

    if (!course_id || !title?.trim() || !youtube_url?.trim()) {
      return NextResponse.json({ error: 'Curso, titulo y URL de YouTube requeridos' }, { status: 400 })
    }

    const youtube_video_id = extractYouTubeId(youtube_url.trim())
    if (!youtube_video_id) {
      return NextResponse.json({ error: 'URL de YouTube invalida' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { data: lesson, error } = await serviceClient
      .from('academia_lessons')
      .insert({
        course_id,
        title: title.trim(),
        description: description?.trim() || null,
        youtube_url: youtube_url.trim(),
        youtube_video_id,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating lesson:', error)
      return NextResponse.json({ error: 'Error al crear leccion' }, { status: 500 })
    }

    return NextResponse.json({ lesson })
  } catch (error) {
    console.error('Academia lessons API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH - Update lesson (admin only)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const body = await request.json()
    const { id, title, description, youtube_url, sort_order } = body

    if (!id) {
      return NextResponse.json({ error: 'ID de leccion requerido' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (youtube_url !== undefined) {
      const videoId = extractYouTubeId(youtube_url.trim())
      if (!videoId) {
        return NextResponse.json({ error: 'URL de YouTube invalida' }, { status: 400 })
      }
      updates.youtube_url = youtube_url.trim()
      updates.youtube_video_id = videoId
    }
    if (sort_order !== undefined) updates.sort_order = sort_order

    const serviceClient = await createServiceClient()
    const { data: lesson, error } = await serviceClient
      .from('academia_lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating lesson:', error)
      return NextResponse.json({ error: 'Error al actualizar leccion' }, { status: 500 })
    }

    return NextResponse.json({ lesson })
  } catch (error) {
    console.error('Academia lessons API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Delete lesson (admin only)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID de leccion requerido' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { error } = await serviceClient
      .from('academia_lessons')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting lesson:', error)
      return NextResponse.json({ error: 'Error al eliminar leccion' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Academia lessons API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
