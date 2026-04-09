'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Activity, RefreshCw, Trash2, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { isAdmin as isAdminEmail } from '@/lib/admin'

interface ProviderHealth {
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

interface ErrorLog {
  id: number
  created_at: string
  service: string
  provider: string
  error_message: string
  response_ms: number | null
  model: string | null
  was_fallback: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  kie: 'KIE.ai',
  openai: 'OpenAI',
  google: 'Google Gemini',
  fal: 'fal.ai',
  elevenlabs: 'ElevenLabs',
  'google-tts': 'Google TTS',
  bfl: 'BFL / FLUX',
}

function getStatusColor(rate: number, total: number): 'green' | 'yellow' | 'red' | 'gray' {
  if (total === 0) return 'gray'
  if (rate >= 95) return 'green'
  if (rate >= 80) return 'yellow'
  return 'red'
}

const STATUS_STYLES = {
  green: 'border-emerald-500/30 bg-emerald-500/5',
  yellow: 'border-amber-500/30 bg-amber-500/5',
  red: 'border-red-500/30 bg-red-500/5',
  gray: 'border-border bg-surface',
}

const DOT_STYLES = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function MonitoringPage() {
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderHealth[]>([])
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [authorized, setAuthorized] = useState(false)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (isAdminEmail(data.user?.email)) {
        setAuthorized(true)
      } else {
        router.push('/dashboard')
      }
    })
  }, [router])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/monitoring')
      if (!res.ok) return
      const data = await res.json()
      setProviders(data.providers || [])
      setErrors(data.recentErrors || [])
    } catch (err) {
      console.error('[Monitoring] Fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    fetchData()
    const interval = setInterval(fetchData, 30000) // Auto-refresh 30s
    return () => clearInterval(interval)
  }, [authorized, fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handleCleanup = async () => {
    if (!confirm('Eliminar logs de mas de 7 dias?')) return
    const res = await fetch('/api/admin/monitoring', { method: 'POST' })
    const data = await res.json()
    alert(`Logs eliminados: ${data.deleted}`)
    fetchData()
  }

  if (!authorized) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    )
  }

  // Sort: providers with activity first, then alphabetical
  const sortedProviders = [...providers].sort((a, b) => {
    if (a.total_24h > 0 && b.total_24h === 0) return -1
    if (a.total_24h === 0 && b.total_24h > 0) return 1
    return a.provider.localeCompare(b.provider)
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-text-primary">Monitoreo de Providers IA</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanup}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-error border border-border rounded-lg hover:border-error/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar +7d
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-accent border border-border rounded-lg hover:border-accent/30 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      <p className="text-sm text-text-secondary">
        Auto-refresh cada 30s. Los datos se retienen por 7 dias.
      </p>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProviders.map((p) => {
          const color1h = getStatusColor(p.success_rate_1h, p.total_1h)
          const color24h = getStatusColor(p.success_rate_24h, p.total_24h)
          // Use the worse of the two for card border
          const cardColor = color1h === 'red' || color24h === 'red' ? 'red'
            : color1h === 'yellow' || color24h === 'yellow' ? 'yellow'
            : color1h === 'gray' && color24h === 'gray' ? 'gray'
            : 'green'

          return (
            <div
              key={p.provider}
              className={`border rounded-xl p-4 space-y-3 transition-colors ${STATUS_STYLES[cardColor]}`}
            >
              {/* Provider name + status dot */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${DOT_STYLES[cardColor]} ${cardColor !== 'gray' ? 'animate-pulse' : ''}`} />
                  <h3 className="font-semibold text-text-primary">
                    {PROVIDER_LABELS[p.provider] || p.provider}
                  </h3>
                </div>
                {p.total_24h > 0 && (
                  <span className="text-xs text-text-secondary">{p.total_24h} calls/24h</span>
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Last 1h */}
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">Ultima hora</p>
                  <div className="flex items-center gap-1.5">
                    {p.total_1h > 0 ? (
                      <>
                        <span className={`font-bold ${
                          color1h === 'green' ? 'text-emerald-500' :
                          color1h === 'yellow' ? 'text-amber-500' :
                          'text-red-500'
                        }`}>
                          {p.success_rate_1h}%
                        </span>
                        <span className="text-text-secondary">
                          ({p.success_1h}/{p.total_1h})
                        </span>
                      </>
                    ) : (
                      <span className="text-text-secondary">Sin llamadas</span>
                    )}
                  </div>
                </div>

                {/* Last 24h */}
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary font-medium">24 horas</p>
                  <div className="flex items-center gap-1.5">
                    {p.total_24h > 0 ? (
                      <>
                        <span className={`font-bold ${
                          color24h === 'green' ? 'text-emerald-500' :
                          color24h === 'yellow' ? 'text-amber-500' :
                          'text-red-500'
                        }`}>
                          {p.success_rate_24h}%
                        </span>
                        <span className="text-text-secondary">
                          ({p.success_24h}/{p.total_24h})
                        </span>
                      </>
                    ) : (
                      <span className="text-text-secondary">Sin llamadas</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Response time */}
              {(p.avg_response_ms_1h || p.avg_response_ms_24h) && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Clock className="w-3.5 h-3.5" />
                  {p.avg_response_ms_1h ? (
                    <span>{(p.avg_response_ms_1h / 1000).toFixed(1)}s avg (1h)</span>
                  ) : (
                    <span>{(p.avg_response_ms_24h! / 1000).toFixed(1)}s avg (24h)</span>
                  )}
                </div>
              )}

              {/* Last error */}
              {p.last_error && (
                <div className="flex items-start gap-1.5 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 line-clamp-2">
                    {p.last_error_at && <span className="text-text-secondary mr-1">{timeAgo(p.last_error_at)}</span>}
                    {p.last_error}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Recent Errors Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400" />
          Errores recientes
        </h2>

        {errors.length === 0 ? (
          <div className="flex items-center gap-2 p-4 border border-border rounded-lg text-sm text-text-secondary">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Sin errores recientes
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border text-text-secondary text-left">
                    <th className="px-4 py-2.5 font-medium">Tiempo</th>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Servicio</th>
                    <th className="px-4 py-2.5 font-medium">Modelo</th>
                    <th className="px-4 py-2.5 font-medium">Error</th>
                    <th className="px-4 py-2.5 font-medium">Fallback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {errors.map((err) => (
                    <tr key={err.id} className="hover:bg-surface/50">
                      <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                        {timeAgo(err.created_at)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">
                        {PROVIDER_LABELS[err.provider] || err.provider}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary capitalize">
                        {err.service}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {err.model || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-red-400 max-w-xs truncate">
                        {err.error_message}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {err.was_fallback && (
                          <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
                            fallback
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
