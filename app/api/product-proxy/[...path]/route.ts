import { NextRequest, NextResponse } from 'next/server'

const UPSTREAM = 'https://product-intelligence-dropi-production.up.railway.app'

export async function GET(request: NextRequest) {
  // The client calls /api/product-proxy/api/productos?limit=20
  // We need to extract everything after /api/product-proxy
  const url = new URL(request.url)
  const fullPath = url.pathname.replace('/api/product-proxy', '') || '/'
  const targetUrl = `${UPSTREAM}${fullPath}${url.search}`

  try {
    const res = await fetch(targetUrl, {
      headers: { 'Accept': 'application/json' },
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch from product API' }, { status: 502 })
  }
}
