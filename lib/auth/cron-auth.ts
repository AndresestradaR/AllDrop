import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Returns auth context for both session-based and cron internal calls.
 * Cron passes x-cron-secret + x-user-id headers to bypass cookie auth.
 */
export async function getAuthContext(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  const cronUserId = request.headers.get('x-user-id')

  if (cronSecret && cronSecret === process.env.CRON_SECRET && cronUserId) {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    return { userId: cronUserId, supabase }
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { userId: user.id, supabase }
}
