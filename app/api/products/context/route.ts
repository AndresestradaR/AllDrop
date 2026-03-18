import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * GET /api/products/context?productId=xxx
 * Load persisted product context for Banner Generator / Video Viral.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const productName = searchParams.get('productName')
    const listAll = searchParams.get('list')

    // List all products (with or without context) — use service role to bypass RLS
    if (listAll === 'true') {
      const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: products } = await adminClient
        .from('products')
        .select('id, name, product_context')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      return NextResponse.json({
        products: (products || []).map(p => ({
          id: p.id,
          name: p.name,
          context: p.product_context || null,
        })),
      })
    }

    if (!productId && !productName) {
      return NextResponse.json({ error: 'productId o productName requerido' }, { status: 400 })
    }

    let query = supabase
      .from('products')
      .select('id, name, product_context, color_palette, typography, pricing, target_country, product_photos')
      .eq('user_id', user.id)

    if (productId) {
      query = query.eq('id', productId)
    } else {
      query = query.eq('name', productName!)
    }

    const { data: product } = await query.single()

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      productId: product.id,
      context: product.product_context || null,
      colorPalette: product.color_palette || null,
      typography: product.typography || null,
      pricing: product.pricing || null,
      targetCountry: product.target_country || null,
      productPhotos: product.product_photos || null,
    })
  } catch (error: any) {
    console.error('[ProductContext GET] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT /api/products/context
 * Persist product context and settings (auto-saved from Banner Generator + Matías).
 * Body: { productId, context?, colorPalette?, typography?, pricing?, targetCountry?, productPhotos? }
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { productId } = body
    if (!productId) {
      return NextResponse.json({ error: 'productId requerido' }, { status: 400 })
    }

    // Build update object with only the fields that were sent
    const updateData: Record<string, any> = {}
    if (body.context !== undefined) updateData.product_context = body.context
    if (body.colorPalette !== undefined) updateData.color_palette = body.colorPalette
    if (body.typography !== undefined) updateData.typography = body.typography
    if (body.pricing !== undefined) updateData.pricing = body.pricing
    if (body.targetCountry !== undefined) updateData.target_country = body.targetCountry
    if (body.productPhotos !== undefined) updateData.product_photos = body.productPhotos

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, rowsUpdated: 0 })
    }

    // Use service role to bypass RLS
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: updated, error } = await adminClient
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('user_id', user.id)
      .select('id')

    if (error) {
      console.error('[ProductContext PUT] Supabase error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[ProductContext PUT] Updated ${updated?.length || 0} rows for product ${productId}, fields: ${Object.keys(updateData).join(', ')}`)

    return NextResponse.json({ success: true, rowsUpdated: updated?.length || 0 })
  } catch (error: any) {
    console.error('[ProductContext PUT] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
