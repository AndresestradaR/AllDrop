// AI Provider Monitoring — fire-and-forget logging + health queries
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

export interface AILogParams {
  service: 'text' | 'image' | 'video' | 'audio'
  provider: string
  status: 'success' | 'error'
  error_message?: string
  response_ms?: number
  model?: string
  was_fallback?: boolean
  user_id?: string
}

/**
 * Fire-and-forget: logs an AI provider call. Never awaited, never blocks.
 */
export function logAI(params: AILogParams): void {
  getSupabase()
    .from('ai_provider_logs')
    .insert({
      service: params.service,
      provider: params.provider,
      status: params.status,
      error_message: params.error_message?.substring(0, 500),
      response_ms: params.response_ms,
      model: params.model,
      was_fallback: params.was_fallback ?? false,
      user_id: params.user_id,
    })
    .then(({ error }) => {
      if (error) console.error('[AI Monitor] Log insert failed:', error.message)
    })
}

export interface ProviderHealth {
  provider: string
  total_1h: number
  success_1h: number
  error_1h: number
  success_rate_1h: number
  total_24h: number
  success_24h: number
  error_24h: number
  success_rate_24h: number
  avg_response_ms_1h: number | null
  avg_response_ms_24h: number | null
  last_error: string | null
  last_error_at: string | null
}

/**
 * Get aggregated health stats per provider (last 1h + last 24h).
 */
export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Get all logs from last 24h
  const { data: logs, error } = await getSupabase()
    .from('ai_provider_logs')
    .select('provider, status, error_message, response_ms, created_at')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error || !logs) return []

  // Aggregate by provider
  const providers = new Map<string, {
    total_1h: number; success_1h: number; error_1h: number; response_ms_1h: number[]
    total_24h: number; success_24h: number; error_24h: number; response_ms_24h: number[]
    last_error: string | null; last_error_at: string | null
  }>()

  const knownProviders = ['kie', 'openai', 'google', 'fal', 'elevenlabs', 'google-tts', 'bfl']
  for (const p of knownProviders) {
    providers.set(p, {
      total_1h: 0, success_1h: 0, error_1h: 0, response_ms_1h: [],
      total_24h: 0, success_24h: 0, error_24h: 0, response_ms_24h: [],
      last_error: null, last_error_at: null,
    })
  }

  for (const log of logs) {
    let stats = providers.get(log.provider)
    if (!stats) {
      stats = {
        total_1h: 0, success_1h: 0, error_1h: 0, response_ms_1h: [],
        total_24h: 0, success_24h: 0, error_24h: 0, response_ms_24h: [],
        last_error: null, last_error_at: null,
      }
      providers.set(log.provider, stats)
    }

    const isRecent = log.created_at >= oneHourAgo

    // 24h stats
    stats.total_24h++
    if (log.status === 'success') stats.success_24h++
    else stats.error_24h++
    if (log.response_ms) stats.response_ms_24h.push(log.response_ms)

    // 1h stats
    if (isRecent) {
      stats.total_1h++
      if (log.status === 'success') stats.success_1h++
      else stats.error_1h++
      if (log.response_ms) stats.response_ms_1h.push(log.response_ms)
    }

    // Track last error
    if (log.status === 'error' && !stats.last_error) {
      stats.last_error = log.error_message
      stats.last_error_at = log.created_at
    }
  }

  const result: ProviderHealth[] = []
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  providers.forEach((stats, provider) => {
    result.push({
      provider,
      total_1h: stats.total_1h,
      success_1h: stats.success_1h,
      error_1h: stats.error_1h,
      success_rate_1h: stats.total_1h > 0 ? Math.round((stats.success_1h / stats.total_1h) * 100) : 100,
      total_24h: stats.total_24h,
      success_24h: stats.success_24h,
      error_24h: stats.error_24h,
      success_rate_24h: stats.total_24h > 0 ? Math.round((stats.success_24h / stats.total_24h) * 100) : 100,
      avg_response_ms_1h: avg(stats.response_ms_1h),
      avg_response_ms_24h: avg(stats.response_ms_24h),
      last_error: stats.last_error,
      last_error_at: stats.last_error_at,
    })
  })

  return result
}

/**
 * Get recent errors (last 20).
 */
export async function getRecentErrors(limit = 20) {
  const { data, error } = await getSupabase()
    .from('ai_provider_logs')
    .select('*')
    .eq('status', 'error')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data
}

/**
 * Delete logs older than 7 days.
 */
export async function cleanOldLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await getSupabase()
    .from('ai_provider_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) {
    console.error('[AI Monitor] Cleanup failed:', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Get the worst success rate across all providers (for sidebar indicator).
 */
export async function getOverallHealth(): Promise<'green' | 'yellow' | 'red'> {
  const health = await getProviderHealth()
  const activeProviders = health.filter(p => p.total_1h > 0)

  if (activeProviders.length === 0) return 'green' // No calls = no problems

  const worstRate = Math.min(...activeProviders.map(p => p.success_rate_1h))

  if (worstRate >= 95) return 'green'
  if (worstRate >= 80) return 'yellow'
  return 'red'
}
