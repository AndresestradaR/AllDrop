import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface BalanceResult {
  kie: { credits: number } | null
  elevenlabs: { characterCount: number; characterLimit: number; tier: string } | null
  bfl: { credits: number } | null
  errors: Record<string, string>
}

async function fetchKieBalance(apiKey: string): Promise<{ credits: number } | null> {
  const res = await fetch('https://api.kie.ai/api/v1/chat/credit', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (data.code !== 200) return null
  return { credits: data.data }
}

async function fetchElevenLabsBalance(apiKey: string): Promise<{ characterCount: number; characterLimit: number; tier: string } | null> {
  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    method: 'GET',
    headers: { 'xi-api-key': apiKey },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    characterCount: data.character_count,
    characterLimit: data.character_limit,
    tier: data.tier,
  }
}

async function fetchBflBalance(apiKey: string): Promise<{ credits: number } | null> {
  const res = await fetch('https://api.bfl.ai/v1/credits', {
    method: 'GET',
    headers: { 'x-key': apiKey },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { credits: data.credits }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('kie_api_key, elevenlabs_api_key, bfl_api_key')
      .eq('id', user.id)
      .single()

    const result: BalanceResult = { kie: null, elevenlabs: null, bfl: null, errors: {} }

    const safeDecrypt = (key: string | null): string | null => {
      try { return key ? decrypt(key) : null } catch { return null }
    }

    const kieKey = safeDecrypt(profile?.kie_api_key)
    const elevenKey = safeDecrypt(profile?.elevenlabs_api_key)
    const bflKey = safeDecrypt(profile?.bfl_api_key)

    // Fetch all balances in parallel
    const [kieResult, elevenResult, bflResult] = await Promise.allSettled([
      kieKey ? fetchKieBalance(kieKey) : Promise.resolve(null),
      elevenKey ? fetchElevenLabsBalance(elevenKey) : Promise.resolve(null),
      bflKey ? fetchBflBalance(bflKey) : Promise.resolve(null),
    ])

    if (kieResult.status === 'fulfilled') result.kie = kieResult.value
    else result.errors.kie = 'Error al consultar'

    if (elevenResult.status === 'fulfilled') result.elevenlabs = elevenResult.value
    else result.errors.elevenlabs = 'Error al consultar'

    if (bflResult.status === 'fulfilled') result.bfl = bflResult.value
    else result.errors.bfl = 'Error al consultar'

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
