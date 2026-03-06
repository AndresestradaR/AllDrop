import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

// GET - Single course with lessons
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: course, error } = await supabase
      .from('academia_courses')
      .select(`
        *,
        academia_lessons(
          id,
          title,
          description,
          youtube_url,
          youtube_video_id,
          duration_seconds,
          sort_order,
          created_at
        )
      `)
      .eq('id', courseId)
      .single()

    if (error || !course) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 })
    }

    const isAdmin = user.email === ADMIN_EMAIL
    if (!course.is_published && !isAdmin) {
      return NextResponse.json({ error: 'Curso no disponible' }, { status: 404 })
    }

    // Sort lessons by sort_order
    course.academia_lessons?.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

    return NextResponse.json({
      course: {
        ...course,
        lessons: course.academia_lessons || [],
        academia_lessons: undefined,
      }
    })
  } catch (error) {
    console.error('Academia course API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH - Update course (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.thumbnail_url !== undefined) updates.thumbnail_url = body.thumbnail_url?.trim() || null
    if (body.category !== undefined) updates.category = body.category?.trim() || 'general'
    if (body.is_published !== undefined) updates.is_published = body.is_published
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order

    const serviceClient = await createServiceClient()
    const { data: course, error } = await serviceClient
      .from('academia_courses')
      .update(updates)
      .eq('id', courseId)
      .select()
      .single()

    if (error) {
      console.error('Error updating course:', error)
      return NextResponse.json({ error: 'Error al actualizar curso' }, { status: 500 })
    }

    return NextResponse.json({ course })
  } catch (error) {
    console.error('Academia course API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Delete course (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const serviceClient = await createServiceClient()
    const { error } = await serviceClient
      .from('academia_courses')
      .delete()
      .eq('id', courseId)

    if (error) {
      console.error('Error deleting course:', error)
      return NextResponse.json({ error: 'Error al eliminar curso' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Academia course API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
