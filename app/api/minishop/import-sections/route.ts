import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import sharp from 'sharp'

async function optimizeAndUpload(
  serviceClient: any,
  imageUrl: string,
  userId: string,
  index: number
): Promise<string> {
  try {
    let imageBuffer: Buffer

    if (imageUrl.startsWith('data:')) {
      const base64Data = imageUrl.split(',')[1]
      imageBuffer = Buffer.from(base64Data, 'base64')
    } else if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl)
      if (!response.ok) return imageUrl
      const arrayBuffer = await response.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    } else {
      return imageUrl
    }

    const optimized = await sharp(imageBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const fileName = `imports/${userId}/${Date.now()}-${index}-optimized.webp`
    const { error } = await serviceClient.storage
      .from('landing-images')
      .upload(fileName, optimized, { contentType: 'image/webp', upsert: true })

    if (error) {
      console.error('[import-sections] Upload optimized error:', error.message)
      return imageUrl
    }

    const { data: urlData } = serviceClient.storage
      .from('landing-images')
      .getPublicUrl(fileName)

    const originalKB = Math.round(imageBuffer.length / 1024)
    const optimizedKB = Math.round(optimized.length / 1024)
    console.log(`[import-sections] Optimized image ${index}: ${originalKB}KB → ${optimizedKB}KB`)

    return urlData.publicUrl
  } catch (e: any) {
    console.error('[import-sections] Optimize exception:', e.message)
    return imageUrl
  }
}

export async function POST(request: Request) {
  try {
    // Support both cookie-based auth and internal service key auth (for Matías pipeline)
    let user: any = null
    let serviceClient: any = null

    const internalKey = request.headers.get('X-Internal-Key')
    const internalUserId = request.headers.get('X-Internal-User-Id')
    if (internalKey && internalUserId && internalKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Trusted internal call from pipeline (SSE context where cookies() is unavailable)
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      serviceClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      user = { id: internalUserId }
    } else {
      const supabase = await createClient()
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      user = authUser
      serviceClient = await createServiceClient()
    }

    const body = await request.json()
    const { section_ids, sections, metadata } = body

    let validSections: { url: string; category: string; order: number }[] = []

    if (section_ids && Array.isArray(section_ids) && section_ids.length > 0) {
      // New flow: receive IDs, look up from DB
      let dbSections: any[] | null = null
      let fetchError: any = null

      // Try with section_type column first
      const res1 = await serviceClient
        .from('landing_sections')
        .select('id, generated_image_url, template_id, section_type')
        .in('id', section_ids.map((s: any) => s.id))
        .eq('user_id', user.id)

      if (res1.error) {
        // section_type column doesn't exist yet, query without it
        const res2 = await serviceClient
          .from('landing_sections')
          .select('id, generated_image_url, template_id')
          .in('id', section_ids.map((s: any) => s.id))
          .eq('user_id', user.id)
        dbSections = res2.data
        fetchError = res2.error
      } else {
        dbSections = res1.data
        fetchError = res1.error
      }

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
          templateMap = Object.fromEntries(templates.map((t: any) => [t.id, t.category]))
        }
      }

      // Build sections with storage URLs
      // Use section_type first (direct category), then template category as fallback
      const idOrderMap = new Map(section_ids.map((s: any) => [s.id, s.order]))
      validSections = await Promise.all(
        dbSections.map(async (s, i) => ({
          url: await optimizeAndUpload(serviceClient, s.generated_image_url, user.id, i),
          category: s.section_type || templateMap[s.template_id] || 'sin categoria',
          order: idOrderMap.get(s.id) ?? i + 1,
        }))
      )
    } else if (sections && Array.isArray(sections) && sections.length > 0) {
      // Legacy flow: receive full sections (backward compatible)
      validSections = await Promise.all(
        sections.map(async (s: any, i: number) => ({
          url: await optimizeAndUpload(serviceClient, s.url, user.id, i),
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

    // Upload base64 product_photos to Supabase storage so MiniShop gets public URLs
    if (metadata?.product_photos && Array.isArray(metadata.product_photos)) {
      const uploadedPhotos: string[] = []
      for (let i = 0; i < metadata.product_photos.length; i++) {
        const photo = metadata.product_photos[i]
        if (!photo) continue
        if (typeof photo === 'string' && photo.startsWith('http')) {
          uploadedPhotos.push(photo)
        } else if (typeof photo === 'string' && photo.startsWith('data:')) {
          try {
            const base64Data = photo.split(',')[1]
            const buffer = Buffer.from(base64Data, 'base64')
            const fileName = `product-photos/${user.id}/${Date.now()}-${i}.webp`
            const optimized = await sharp(buffer)
              .resize({ width: 800, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()
            const { error: upErr } = await serviceClient.storage
              .from('landing-images')
              .upload(fileName, optimized, { contentType: 'image/webp', upsert: true })
            if (!upErr) {
              const { data: urlData } = serviceClient.storage
                .from('landing-images')
                .getPublicUrl(fileName)
              uploadedPhotos.push(urlData.publicUrl)
            }
          } catch (e: any) {
            console.warn('[import-sections] Photo upload error:', e.message)
          }
        }
      }
      metadata.product_photos = uploadedPhotos
    }

    // Try inserting with metadata; fall back to without if column doesn't exist yet
    let bundle: { id: string } | null = null
    let insertError: any = null

    if (metadata && typeof metadata === 'object') {
      const res = await serviceClient
        .from('import_bundles')
        .insert({ user_id: user.id, sections: validSections, metadata })
        .select('id')
        .single()
      bundle = res.data
      insertError = res.error

      // If metadata column doesn't exist, retry without it
      if (insertError) {
        console.warn('[import-sections] metadata column not found, retrying without it')
        const retry = await serviceClient
          .from('import_bundles')
          .insert({ user_id: user.id, sections: validSections })
          .select('id')
          .single()
        bundle = retry.data
        insertError = retry.error
      }
    } else {
      const res = await serviceClient
        .from('import_bundles')
        .insert({ user_id: user.id, sections: validSections })
        .select('id')
        .single()
      bundle = res.data
      insertError = res.error
    }

    if (insertError || !bundle) {
      console.error('Error creating import bundle:', insertError)
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
