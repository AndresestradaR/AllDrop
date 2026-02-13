import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testR2Connection } from '@/lib/services/r2-upload'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await testR2Connection(user.id)

    return NextResponse.json({
      success: true,
      objectCount: result.objectCount,
    })
  } catch (error: any) {
    console.error('[R2/Test] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al conectar con R2' }, { status: 500 })
  }
}
