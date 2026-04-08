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
  const { data: rawGenerations } = await supabase
    .from('generations')
    .select('id, product_name, generated_image_url, status')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })
    .limit(4)

  // Resolve storage: URLs to signed URLs
  const generations = await Promise.all(
    (rawGenerations || []).map(async (gen) => {
      let url = gen.generated_image_url
      if (url?.startsWith('storage:')) {
        const path = url.replace('storage:', '')
        const { data: signed } = await supabase.storage
          .from('landing-images')
          .createSignedUrl(path, 86400)
        url = signed?.signedUrl || null
      } else if (url && url.includes('supabase') && url.includes('/landing-images/')) {
        const path = url.split('/landing-images/').pop()
        if (path) {
          const { data: signed } = await supabase.storage
            .from('landing-images')
            .createSignedUrl(path, 86400)
          if (signed?.signedUrl) url = signed.signedUrl
        }
      }
      return { ...gen, generated_image_url: url }
    })
  )

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
