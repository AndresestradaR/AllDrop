import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { NextResponse } from 'next/server'

const META_API_BASE = 'https://graph.facebook.com/v21.0'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const accountId = searchParams.get('account_id')

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'date_from y date_to son requeridos' }, { status: 400 })
  }

  // Get Meta token from profiles
  const serviceClient = await createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('meta_access_token')
    .eq('id', user.id)
    .single()

  if (!profile?.meta_access_token) {
    return NextResponse.json({
      has_meta: false,
      spend: 0,
      message: 'No hay token de Meta configurado',
    })
  }

  let metaToken: string
  try {
    metaToken = decrypt(profile.meta_access_token)
  } catch {
    return NextResponse.json({ has_meta: false, spend: 0, message: 'Error al descifrar token de Meta' })
  }

  try {
    // Get all ad accounts
    const accountsRes = await fetch(
      `${META_API_BASE}/me/adaccounts?fields=id,name,currency,account_status,amount_spent&access_token=${metaToken}`
    )

    if (!accountsRes.ok) {
      return NextResponse.json({ has_meta: false, spend: 0, message: 'Token de Meta invalido o expirado' })
    }

    const accountsData = await accountsRes.json()
    const accounts = accountsData.data || []

    // Filter to specific account if requested
    const targetAccounts = accountId
      ? accounts.filter((a: any) => a.id === accountId)
      : accounts

    let totalSpend = 0
    let totalImpressions = 0
    let totalClicks = 0
    const accountResults = []

    for (const account of targetAccounts) {
      const insightsRes = await fetch(
        `${META_API_BASE}/${account.id}/insights?fields=spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type&time_range={"since":"${dateFrom}","until":"${dateTo}"}&access_token=${metaToken}`
      )

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json()
        const insights = insightsData.data?.[0] || {}
        const spend = parseFloat(insights.spend || '0')
        totalSpend += spend
        totalImpressions += parseInt(insights.impressions || '0')
        totalClicks += parseInt(insights.clicks || '0')

        accountResults.push({
          account_id: account.id,
          account_name: account.name,
          currency: account.currency,
          spend,
          impressions: parseInt(insights.impressions || '0'),
          clicks: parseInt(insights.clicks || '0'),
          cpc: parseFloat(insights.cpc || '0'),
          ctr: parseFloat(insights.ctr || '0'),
        })
      }
    }

    return NextResponse.json({
      has_meta: true,
      total_spend: totalSpend,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      accounts: accountResults,
    })
  } catch (err: any) {
    return NextResponse.json({ has_meta: false, spend: 0, message: err.message })
  }
}
