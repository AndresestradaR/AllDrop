'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui'
import { Wallet, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

interface BalanceData {
  kie: { credits: number } | null
  elevenlabs: { characterCount: number; characterLimit: number; tier: string } | null
  bfl: { credits: number } | null
  errors: Record<string, string>
}

const PROVIDERS = [
  {
    key: 'kie' as const,
    name: 'KIE.ai',
    description: 'Imágenes y Video IA',
    color: 'bg-violet-500/10 text-violet-500',
    ringColor: 'ring-violet-500/20',
  },
  {
    key: 'elevenlabs' as const,
    name: 'ElevenLabs',
    description: 'Audio y Voces IA',
    color: 'bg-blue-500/10 text-blue-500',
    ringColor: 'ring-blue-500/20',
  },
  {
    key: 'bfl' as const,
    name: 'BFL (Flux)',
    description: 'Imágenes Flux',
    color: 'bg-amber-500/10 text-amber-500',
    ringColor: 'ring-amber-500/20',
  },
]

function formatCredits(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toLocaleString()
}

export default function BalanceCards() {
  const [data, setData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBalances = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/keys/balance')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchBalances() }, [])

  // Don't render if no keys configured at all
  const hasAnyData = data && (data.kie || data.elevenlabs || data.bfl)
  if (!loading && !hasAnyData) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Saldo de tus APIs
          </h2>
        </div>
        {data && (
          <button
            onClick={() => fetchBalances(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors disabled:opacity-50"
            title="Actualizar saldos"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading ? (
          // Skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-border rounded w-20" />
                  <div className="h-6 bg-border rounded w-16" />
                  <div className="h-2 bg-border rounded w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          PROVIDERS.map((provider) => {
            const balance = data?.[provider.key]
            const error = data?.errors?.[provider.key]

            // Skip providers without configured key
            if (!balance && !error) return null

            return (
              <Card key={provider.key} className="relative overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-text-secondary">{provider.name}</p>
                      {error ? (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-xs">{error}</span>
                        </div>
                      ) : balance ? (
                        <>
                          {provider.key === 'elevenlabs' && 'characterLimit' in balance ? (
                            <>
                              <p className="text-xl font-bold text-text-primary">
                                {formatCredits(balance.characterLimit - balance.characterCount)}
                              </p>
                              <p className="text-[11px] text-text-secondary">
                                de {formatCredits(balance.characterLimit)} caracteres
                              </p>
                              {/* Progress bar */}
                              <div className="mt-1.5 h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    (balance.characterCount / balance.characterLimit) > 0.9
                                      ? 'bg-red-500'
                                      : (balance.characterCount / balance.characterLimit) > 0.7
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500'
                                  )}
                                  style={{ width: `${Math.min(100, (balance.characterCount / balance.characterLimit) * 100)}%` }}
                                />
                              </div>
                            </>
                          ) : provider.key === 'bfl' && 'credits' in balance ? (
                            <>
                              <p className="text-xl font-bold text-text-primary">
                                {formatCredits(balance.credits)}
                              </p>
                              <p className="text-[11px] text-text-secondary">
                                créditos (~${(balance.credits * 0.01).toFixed(2)} USD)
                              </p>
                            </>
                          ) : provider.key === 'kie' && 'credits' in balance ? (
                            <>
                              <p className="text-xl font-bold text-text-primary">
                                {formatCredits(balance.credits)}
                              </p>
                              <p className="text-[11px] text-text-secondary">créditos restantes</p>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', provider.color)}>
                      {provider.name.charAt(0)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {!loading && hasAnyData && (
        <p className="text-[11px] text-text-secondary/60 mt-2 text-center">
          <Link href="/dashboard/settings" className="hover:text-accent transition-colors">
            Configura tus API keys en Settings
          </Link>
          {' · '}fal.ai, Google y OpenAI no tienen API de saldo
        </p>
      )}
    </div>
  )
}
