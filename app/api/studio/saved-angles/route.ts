import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

interface AngleData {
  id: string
  name: string
  hook: string
  description: string
  avatarSuggestion: string
  tone: string
  salesAngle: string
}

interface AngleGroup {
  productName: string
  angles: AngleData[]
  createdAt: string
}

// GET — List saved angles, optionally filtered by productName
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productName = searchParams.get('productName')

    let query = supabase
      .from('saved_angles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (productName) {
      query = query.eq('product_name', productName)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by product_name
    const groupMap = new Map<string, AngleGroup>()
    for (const row of data || []) {
      const key = row.product_name
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          productName: key,
          angles: [],
          createdAt: row.created_at,
        })
      }
      groupMap.get(key)!.angles.push(row.angle_data as AngleData)
    }

    return NextResponse.json({
      success: true,
      groups: Array.from(groupMap.values()),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener angulos' }, { status: 500 })
  }
}

// POST — Save batch of angles for a product (upsert: delete existing + insert new)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { productName, angles } = body as { productName: string; angles: AngleData[] }

    if (!productName || !angles || !Array.isArray(angles) || angles.length === 0) {
      return NextResponse.json({ error: 'Nombre de producto y angulos son requeridos' }, { status: 400 })
    }

    // Use service client to bypass RLS for delete+insert (upsert pattern)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete existing angles for this user+product
    await serviceClient
      .from('saved_angles')
      .delete()
      .eq('user_id', user.id)
      .eq('product_name', productName)

    // Insert new angles
    const rows = angles.map(angle => ({
      user_id: user.id,
      product_name: productName,
      angle_data: angle,
    }))

    const { error: insertError } = await serviceClient
      .from('saved_angles')
      .insert(rows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: angles.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al guardar angulos' }, { status: 500 })
  }
}

// DELETE — Delete all angles for a product
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productName = searchParams.get('productName')

    if (!productName) {
      return NextResponse.json({ error: 'productName es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('saved_angles')
      .delete()
      .eq('user_id', user.id)
      .eq('product_name', productName)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar angulos' }, { status: 500 })
  }
}
