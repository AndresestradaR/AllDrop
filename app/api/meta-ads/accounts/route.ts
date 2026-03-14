// Meta Ads Accounts — List ad accounts for the user
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { MetaAPIClient } from '@/lib/meta-ads/meta-api'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('meta_access_token')
      .eq('id', user.id)
      .single()

    if (!profile?.meta_access_token) {
      return NextResponse.json({ error: 'Token de Meta no configurado. Ve a Settings.' }, { status: 400 })
    }

    let metaAccessToken: string
    try {
      metaAccessToken = decrypt(profile.meta_access_token)
    } catch {
      return NextResponse.json({ error: 'Error descifrando token de Meta' }, { status: 400 })
    }

    const client = new MetaAPIClient({ accessToken: metaAccessToken })
    const result = await client.getAdAccounts()

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result.data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
