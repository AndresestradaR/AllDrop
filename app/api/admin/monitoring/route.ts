import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderHealth, getRecentErrors, cleanOldLogs, getOverallHealth } from '@/lib/services/ai-monitor'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    // Health-only (lightweight, for sidebar indicator)
    if (action === 'health') {
      const health = await getOverallHealth()
      return NextResponse.json({ health })
    }

    // Full dashboard data
    const [providers, recentErrors] = await Promise.all([
      getProviderHealth(),
      getRecentErrors(20),
    ])

    return NextResponse.json({ providers, recentErrors })
  } catch (error: any) {
    console.error('[Monitoring] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const deleted = await cleanOldLogs()
    return NextResponse.json({ deleted })
  } catch (error: any) {
    console.error('[Monitoring] Cleanup error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
