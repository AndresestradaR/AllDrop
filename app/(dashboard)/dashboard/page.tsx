import { createClient } from '@/lib/supabase/server'
import DashboardHome from '@/components/dashboard/DashboardHome'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, full_name, drops')
    .eq('id', user?.id)
    .single()

  // Get recent generations
  const { data: generations } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })
    .limit(4)

  // Derive display name: full_name first word, or email username, or empty
  const displayName = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : user?.email
      ? user.email.split('@')[0]
      : ''

  return (
    <DashboardHome
      displayName={displayName}
      plan={profile?.plan || 'Free'}
      drops={profile?.drops ?? 0}
      generations={generations || []}
    />
  )
}
