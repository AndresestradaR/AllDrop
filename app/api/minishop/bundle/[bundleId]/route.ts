import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ bundleId: string }> }
) {
  try {
    const { bundleId } = await context.params

    if (!bundleId) {
      return NextResponse.json({ error: 'Bundle ID requerido' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // Try with metadata column; fall back to without if it doesn't exist yet
    let bundle: any = null
    let fetchErr: any = null

    const res1 = await serviceClient
      .from('import_bundles')
      .select('id, sections, metadata, created_at, expires_at')
      .eq('id', bundleId)
      .single()

    if (res1.error) {
      // metadata column doesn't exist yet — query without it
      const res2 = await serviceClient
        .from('import_bundles')
        .select('id, sections, created_at, expires_at')
        .eq('id', bundleId)
        .single()
      bundle = res2.data
      fetchErr = res2.error
    } else {
      bundle = res1.data
      fetchErr = res1.error
    }

    if (fetchErr || !bundle) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    // Check expiration
    if (new Date(bundle.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Este paquete ha expirado' },
        { status: 410 }
      )
    }

    return NextResponse.json(bundle, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error: any) {
    console.error('Bundle fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
