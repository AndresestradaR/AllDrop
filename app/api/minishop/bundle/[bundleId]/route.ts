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

    const { data: bundle, error } = await serviceClient
      .from('import_bundles')
      .select('id, sections, created_at, expires_at')
      .eq('id', bundleId)
      .single()

    if (error || !bundle) {
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
