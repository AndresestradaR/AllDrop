import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DROPPAGE_API_BASE = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://shopiestrategas-production.up.railway.app'

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

  const data = await reportRes.json()
  return NextResponse.json(data)
}
