import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  const serviceClient = await createServiceClient()
  let query = serviceClient
    .from('financial_expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  const { data, error: dbError } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ expenses: data || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { category, description, amount, type, date } = body

  if (!category || !amount || !type || !date) {
    return NextResponse.json({ error: 'Faltan campos requeridos: category, amount, type, date' }, { status: 400 })
  }

  if (type !== 'expense' && type !== 'income') {
    return NextResponse.json({ error: 'type debe ser "expense" o "income"' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { data, error: dbError } = await serviceClient
    .from('financial_expenses')
    .insert({
      user_id: user.id,
      category,
      description: description || '',
      amount: parseFloat(amount),
      type,
      date,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error: dbError } = await serviceClient
    .from('financial_expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
