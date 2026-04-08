import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET - List all products for user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        image_url,
        product_photos,
        created_at,
        sections:landing_sections(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching products:', error)
      return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
    }

    // Transform to include sections count and resolve product photo
    const transformedProducts = products?.map(p => ({
      ...p,
      // Use first product_photo as image_url if image_url is empty
      image_url: p.image_url || (Array.isArray(p.product_photos) && p.product_photos.length > 0 ? p.product_photos[0] : null),
      product_photos: undefined,
      sections_count: p.sections?.[0]?.count || 0,
      sections: undefined,
    })) || []

    return NextResponse.json({ products: transformedProducts })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Create new product
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()
    const { data: product, error } = await serviceClient
      .from('products')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating product:', error)
      return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
