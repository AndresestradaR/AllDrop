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

// Pricing: KIE $0.005/credit, BFL $0.01/credit
// ElevenLabs is subscription-based (chars/month), not pay-per-credit
const KIE_USD_PER_CREDIT = 0.005
const BFL_USD_PER_CREDIT = 0.01

function formatUSD(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  if (value >= 100) return `$${value.toFixed(0)}`
  if (value >= 10) return `$${value.toFixed(1)}`
  return `$${value.toFixed(2)}`
}

function formatChars(value: number): string {
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
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-border rounded w-20" />
                  <div className="h-7 bg-border rounded w-24" />
                  <div className="h-2 bg-border rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* KIE.ai */}
            {(data?.kie || data?.errors?.kie) && (
              <Card className="relative overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-text-secondary">KIE.ai</p>
                      {data?.errors?.kie ? (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-xs">{data.errors.kie}</span>
                        </div>
                      ) : data?.kie ? (
                        <>
                          <p className="text-2xl font-bold text-emerald-400">
                            {formatUSD(data.kie.credits * KIE_USD_PER_CREDIT)}
                            <span className="text-sm font-normal text-text-secondary ml-1">USD</span>
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {data.kie.credits.toLocaleString()} créditos · Imágenes y Video IA
                          </p>
                        </>
                      ) : null}
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-violet-500/10 text-violet-500">
                      K
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ElevenLabs */}
            {(data?.elevenlabs || data?.errors?.elevenlabs) && (
              <Card className="relative overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5 flex-1 mr-2">
                      <p className="text-xs font-medium text-text-secondary">ElevenLabs</p>
                      {data?.errors?.elevenlabs ? (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-xs">{data.errors.elevenlabs}</span>
                        </div>
                      ) : data?.elevenlabs ? (() => {
                        const remaining = data.elevenlabs.characterLimit - data.elevenlabs.characterCount
                        const usedPct = data.elevenlabs.characterLimit > 0
                          ? (data.elevenlabs.characterCount / data.elevenlabs.characterLimit) * 100
                          : 0
                        return (
                          <>
                            <p className="text-2xl font-bold text-emerald-400">
                              {formatChars(remaining)}
                              <span className="text-sm font-normal text-text-secondary ml-1">chars</span>
                            </p>
                            <p className="text-[11px] text-text-secondary">
                              de {formatChars(data.elevenlabs.characterLimit)} · Plan {data.elevenlabs.tier} · Audio IA
                            </p>
                            <div className="mt-1.5 h-1.5 bg-border rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                )}
                                style={{ width: `${Math.min(100, usedPct)}%` }}
                              />
                            </div>
                          </>
                        )
                      })() : null}
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-blue-500/10 text-blue-500">
                      E
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* BFL */}
            {(data?.bfl || data?.errors?.bfl) && (
              <Card className="relative overflow-hidden">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-text-secondary">BFL (Flux)</p>
                      {data?.errors?.bfl ? (
                        <div className="flex items-center gap-1 text-amber-500">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-xs">{data.errors.bfl}</span>
                        </div>
                      ) : data?.bfl ? (
                        <>
                          <p className="text-2xl font-bold text-emerald-400">
                            {formatUSD(data.bfl.credits * BFL_USD_PER_CREDIT)}
                            <span className="text-sm font-normal text-text-secondary ml-1">USD</span>
                          </p>
                          <p className="text-[11px] text-text-secondary">
                            {data.bfl.credits.toLocaleString()} créditos · Imágenes Flux
                          </p>
                        </>
                      ) : null}
                    </div>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-amber-500/10 text-amber-500">
                      B
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
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
