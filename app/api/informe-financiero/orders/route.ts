import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DROPPAGE_API_BASE = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://alldrop-shop-production.up.railway.app'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'date_from y date_to son requeridos' }, { status: 400 })
  }

  // Get session token for SSO
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return NextResponse.json({ error: 'No hay sesion activa' }, { status: 401 })
  }

  // SSO: exchange Supabase token for DropPage JWT
  const ssoRes = await fetch(`${DROPPAGE_API_BASE}/api/auth/sso/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: session.access_token }),
  })

  if (!ssoRes.ok) {
    return NextResponse.json({ error: 'No se pudo conectar con DropPage' }, { status: 502 })
  }

  const { access_token: dpToken } = await ssoRes.json()

  // Call DropPage financial report
  const reportRes = await fetch(
    `${DROPPAGE_API_BASE}/api/admin/financial-report?date_from=${dateFrom}&date_to=${dateTo}`,
    { headers: { 'Authorization': `Bearer ${dpToken}` } }
  )

  if (!reportRes.ok) {
    const err = await reportRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: err.detail || 'Error al obtener datos del informe' },
      { status: reportRes.status }
    )
  }

  const raw = await reportRes.json()

  // Map backend structure to frontend-expected flat structure
  const cancelled_count = (raw.summary?.total_orders || 0) - (raw.summary?.confirmed_orders || 0)
  const total = raw.summary?.total_orders || 0

  const mapped = {
    total_orders: raw.summary?.total_orders || 0,
    confirmed_count: raw.summary?.confirmed_orders || 0,
    confirmed_pct: raw.summary?.confirmed_pct || 0,
    cancelled_count,
    cancelled_pct: total > 0 ? Math.round((cancelled_count / total) * 10000) / 100 : 0,
    status_breakdown: (raw.by_status || []).map((s: any) => ({
      status: s.status,
      count: s.count || 0,
      percentage: s.pct || 0,
      amount: s.amount || 0,
    })),
    revenue: raw.financials?.revenue || 0,
    cost_merchandise: raw.financials?.cost_merchandise || 0,
    cost_shipping: raw.financials?.shipping_cost || 0,
    cost_return_shipping: raw.financials?.estimated_return_shipping || 0,
    by_product: raw.by_product || [],
    daily_orders: raw.daily_orders || [],
    // Wallet data from Dropi
    wallet: raw.wallet ? {
      available: raw.wallet.available || false,
      error: raw.wallet.error || null,
      transaction_count: raw.wallet.transaction_count || 0,
      summary: raw.wallet.summary || [],
      revenue: raw.wallet.revenue || 0,
      costs: raw.wallet.costs || 0,
      other_entries: raw.wallet.other_entries || 0,
      other_exits: raw.wallet.other_exits || 0,
      omitted: raw.wallet.omitted || [],
    } : null,
  }

  return NextResponse.json(mapped)
}
