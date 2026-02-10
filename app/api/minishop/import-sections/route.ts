import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { sections } = body

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json(
        { error: 'Debes seleccionar al menos una seccion' },
        { status: 400 }
      )
    }

    // Validate section structure
    const validSections = sections.map((s: any, i: number) => ({
      url: s.url,
      category: s.category || 'sin categoria',
      order: s.order ?? i + 1,
    }))

    const serviceClient = await createServiceClient()

    const { data: bundle, error } = await serviceClient
      .from('import_bundles')
      .insert({
        user_id: user.id,
        sections: validSections,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating import bundle:', error)
      return NextResponse.json(
        { error: 'Error al crear el paquete de importacion' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      bundle_id: bundle.id,
      redirect_url: `/constructor/import-sections?bundle=${bundle.id}`,
    })
  } catch (error: any) {
    console.error('Import sections API error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
