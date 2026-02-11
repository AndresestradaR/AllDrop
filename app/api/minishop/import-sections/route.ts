import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function ensureStorageUrl(
  serviceClient: any,
  url: string,
  userId: string,
  index: number
): Promise<string> {
  // Already an HTTPS URL — use as-is
  if (url.startsWith('http')) return url

  // Base64 data URL — upload to Storage
  if (url.startsWith('data:')) {
    try {
      const [header, base64Data] = url.split(',')
      const mimeType = header.split(':')[1]?.split(';')[0] || 'image/png'
      const ext = mimeType.split('/')[1] || 'png'
      const fileName = `imports/${userId}/${Date.now()}-${index}.${ext}`
      const buffer = Buffer.from(base64Data, 'base64')

      const { error } = await serviceClient.storage
        .from('landing-images')
        .upload(fileName, buffer, { contentType: mimeType, upsert: true })

      if (error) {
        console.error('[import-sections] Storage upload error:', error.message)
        return url
      }

      const { data: urlData } = serviceClient.storage
        .from('landing-images')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (e: any) {
      console.error('[import-sections] Upload exception:', e.message)
      return url
    }
  }

  return url
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { section_ids, sections } = body

    const serviceClient = await createServiceClient()

    let validSections: { url: string; category: string; order: number }[] = []

    if (section_ids && Array.isArray(section_ids) && section_ids.length > 0) {
      // New flow: receive IDs, look up from DB
      const { data: dbSections, error: fetchError } = await serviceClient
        .from('landing_sections')
        .select('id, generated_image_url, template_id')
        .in('id', section_ids.map((s: any) => s.id))
        .eq('user_id', user.id)

      if (fetchError || !dbSections) {
        return NextResponse.json(
          { error: 'Error al buscar secciones' },
          { status: 500 }
        )
      }

      // Get template categories
      const templateIds = dbSections.map(s => s.template_id).filter(Boolean)
      let templateMap: Record<string, string> = {}
      if (templateIds.length > 0) {
        const { data: templates } = await serviceClient
          .from('templates')
          .select('id, category')
          .in('id', templateIds)
        if (templates) {
          templateMap = Object.fromEntries(templates.map(t => [t.id, t.category]))
        }
      }

      // Build sections with storage URLs
      const idOrderMap = new Map(section_ids.map((s: any) => [s.id, s.order]))
      validSections = await Promise.all(
        dbSections.map(async (s, i) => ({
          url: await ensureStorageUrl(serviceClient, s.generated_image_url, user.id, i),
          category: templateMap[s.template_id] || 'sin categoria',
          order: idOrderMap.get(s.id) ?? i + 1,
        }))
      )
    } else if (sections && Array.isArray(sections) && sections.length > 0) {
      // Legacy flow: receive full sections (backward compatible)
      validSections = await Promise.all(
        sections.map(async (s: any, i: number) => ({
          url: await ensureStorageUrl(serviceClient, s.url, user.id, i),
          category: s.category || 'sin categoria',
          order: s.order ?? i + 1,
        }))
      )
    } else {
      return NextResponse.json(
        { error: 'Debes seleccionar al menos una seccion' },
        { status: 400 }
      )
    }

    validSections.sort((a, b) => a.order - b.order)

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
