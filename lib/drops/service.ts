import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/admin'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Check if user has enough drops. Admins always return true.
 */
export async function hasEnoughDrops(
  userId: string,
  email: string | null | undefined,
  cost: number
): Promise<{ enough: boolean; current: number }> {
  if (isAdmin(email)) return { enough: true, current: 999999 }

  const supabase = getServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('drops')
    .eq('id', userId)
    .single()

  const current = data?.drops || 0
  return { enough: current >= cost, current }
}

/**
 * Deduct drops after successful generation. Admins skip deduction.
 * Returns new balance.
 */
export async function consumeDrops(
  userId: string,
  email: string | null | undefined,
  amount: number,
  type: 'image' | 'video' | 'tool'
): Promise<number> {
  if (isAdmin(email)) return 999999

  const supabase = getServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('drops')
    .eq('id', userId)
    .single()

  const current = profile?.drops || 0
  const newBalance = Math.max(0, current - amount)

  await supabase
    .from('profiles')
    .update({ drops: newBalance })
    .eq('id', userId)

  await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      amount: -amount,
      type: `consume_${type}`,
    })

  return newBalance
}
