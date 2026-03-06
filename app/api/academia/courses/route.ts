import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

// GET - List courses (published for all, all for admin)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const isAdmin = user.email === ADMIN_EMAIL

    let query = supabase
      .from('academia_courses')
      .select(`
        id,
        user_id,
        title,
        description,
        thumbnail_url,
        category,
        is_published,
        sort_order,
        created_at,
        updated_at,
        academia_lessons(count)
      `)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      query = query.eq('is_published', true)
    }

    const { data: courses, error } = await query

    if (error) {
      console.error('Error fetching courses:', error)
      return NextResponse.json({ error: 'Error al obtener cursos' }, { status: 500 })
    }

    const transformed = courses?.map(c => ({
      ...c,
      lessons_count: c.academia_lessons?.[0]?.count || 0,
      academia_lessons: undefined,
    })) || []

    return NextResponse.json({ courses: transformed })
  } catch (error) {
    console.error('Academia courses API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Create course (admin only)
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
    const { title, description, thumbnail_url, category } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titulo requerido' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { data: course, error } = await serviceClient
      .from('academia_courses')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        thumbnail_url: thumbnail_url?.trim() || null,
        category: category?.trim() || 'general',
        is_published: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating course:', error)
      return NextResponse.json({ error: 'Error al crear curso' }, { status: 500 })
    }

    return NextResponse.json({ course })
  } catch (error) {
    console.error('Academia courses API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
