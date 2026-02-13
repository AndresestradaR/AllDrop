import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPublerCredentials, getAccounts } from '@/lib/services/publer'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const creds = await getPublerCredentials(user.id)
    if (!creds) {
      return NextResponse.json({ error: 'Configura Publer en Settings' }, { status: 400 })
    }

    const accounts = await getAccounts(creds)

    return NextResponse.json({ accounts })
  } catch (error: any) {
    console.error('[Publer/Accounts] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
