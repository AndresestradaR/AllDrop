'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { PLANS, TOPUPS, CALL_TOPUPS, DROP_COSTS } from '@/lib/drops/constants'
import { Card } from '@/components/ui'
import { Check, Sparkles, Zap, Star, Crown, ShoppingCart, Phone, Calculator, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}

function PricingContent() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userPlan, setUserPlan] = useState<string>('free')
  const [userDrops, setUserDrops] = useState(0)

  // Calculator state
  const [calcBanners, setCalcBanners] = useState(10)
  const [calcImages, setCalcImages] = useState(5)
  const [calcVideos, setCalcVideos] = useState(1)

  const calcTotal = calcBanners * DROP_COSTS.banner + calcImages * DROP_COSTS.image + calcVideos * DROP_COSTS.video
  const calcRemaining = userDrops - calcTotal

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('plan, drops').eq('id', data.user.id).single()
          .then(({ data: profile }) => {
            if (profile) {
              setUserPlan(profile.plan || 'free')
              setUserDrops(profile.drops || 0)
            }
          })
      }
    })
  }, [])

  // Handle Stripe redirect results
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Payment successful! Your drops have been added.')
      window.history.replaceState({}, '', '/dashboard/pricing')
    }
    if (searchParams.get('canceled') === 'true') {
      toast('Payment canceled', { icon: '\u26A0\uFE0F' })
      window.history.replaceState({}, '', '/dashboard/pricing')
    }
  }, [searchParams])

  const hasPlan = userPlan !== 'free'

  const planIcons = [Zap, Sparkles, Star, Crown]

  const handleChoosePlan = async (planId: string) => {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'plan', id: planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Error creating checkout')
      }
    } catch (error) {
      toast.error('Error connecting to payment')
    }
  }

  const handleBuyTopup = async (topupId: string) => {
    if (!hasPlan) {
      toast.error(t.pricing.topupsRequirePlan)
      return
    }
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'topup', id: topupId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Error creating checkout')
      }
    } catch (error) {
      toast.error('Error connecting to payment')
    }
  }

  const handleBuyCallTopup = async (topupId: string) => {
    if (!hasPlan) {
      toast.error(t.pricing.callTopupsRequirePlan)
      return
    }
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'call-topup', id: topupId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Error creating checkout')
      }
    } catch (error) {
      toast.error('Error connecting to payment')
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">{t.pricing.title}</h1>
        <p className="text-text-secondary mt-2">{t.pricing.subtitle}</p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan, i) => {
          const Icon = planIcons[i]
          const isCurrent = userPlan === plan.id
          const bannersCount = Math.floor(plan.drops / DROP_COSTS.banner)
          const imagesCount = Math.floor(plan.drops / DROP_COSTS.image)
          const videosCount = Math.floor(plan.drops / DROP_COSTS.video)

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative p-6 flex flex-col transition-all hover:scale-[1.02]',
                plan.popular && 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20',
                isCurrent && 'ring-2 ring-accent'
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {t.pricing.popular}
                </span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  i === 0 && 'bg-emerald-500/10 text-emerald-500',
                  i === 1 && 'bg-blue-500/10 text-blue-500',
                  i === 2 && 'bg-purple-500/10 text-purple-500',
                  i === 3 && 'bg-amber-500/10 text-amber-500',
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
              </div>

              {/* Price */}
              <div className="mb-4">
                <span className="text-3xl font-bold text-text-primary">{'\u20AC'}{plan.price}</span>
                <span className="text-text-secondary text-sm">{t.pricing.perMonth}</span>
              </div>

              {/* Drops */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-500/5 rounded-lg">
                <img src="/images/drops.png" alt="Drops" className="w-5 h-5" />
                <span className="font-bold text-blue-400">{plan.drops.toLocaleString()}</span>
                <span className="text-text-secondary text-sm">{t.pricing.drops}</span>
              </div>

              {/* Call minutes */}
              {plan.callMinutes > 0 && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/5 rounded-lg">
                  <Phone className="w-4 h-4 text-green-400" />
                  <span className="font-bold text-green-400">{plan.callMinutes}</span>
                  <span className="text-text-primary/70 text-sm">{t.pricing.callMinutes}</span>
                </div>
              )}

              {/* What you can do */}
              <div className="space-y-2 mb-6 flex-1">
                <p className="text-xs text-text-primary/60 font-medium uppercase tracking-wider">{t.pricing.whatCanYouDo}</p>
                <div className="text-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/80">{t.pricing.banners}</span>
                    <span className="font-semibold text-text-primary">{bannersCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/80">{t.pricing.images}</span>
                    <span className="font-semibold text-text-primary">{imagesCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary/80">{t.pricing.videos}</span>
                    <span className="font-semibold text-text-primary">{videosCount}</span>
                  </div>
                  <p className="text-xs text-text-primary/40 pt-1">* {t.pricing.dropsShared}</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {[t.pricing.feature1, t.pricing.feature2, t.pricing.feature3, t.pricing.feature4,
                  ...(plan.callMinutes > 0 ? [t.pricing.callConfirmation] : []),
                  ...(i >= 2 ? [t.pricing.feature5] : []),
                  ...(i >= 3 ? [t.pricing.feature6] : []),
                ].map((feature, fi) => (
                  <div key={fi} className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleChoosePlan(plan.id)}
                className={cn(
                  'w-full py-3 rounded-xl font-medium text-sm transition-all',
                  isCurrent
                    ? 'bg-accent/10 text-accent cursor-default'
                    : plan.popular
                      ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                      : 'bg-surface border border-border text-text-primary hover:bg-border'
                )}
                disabled={isCurrent}
              >
                {isCurrent ? t.pricing.currentPlan : t.pricing.choosePlan}
              </button>
            </Card>
          )
        })}
      </div>

      {/* Drops Calculator */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
            <Calculator className="w-6 h-6 text-accent" />
            {t.pricing.dropsCalculator}
          </h2>
          <p className="text-text-primary/60 mt-1">
            {t.pricing.dropsCalculatorDesc}
          </p>
        </div>

        <Card className="max-w-2xl mx-auto p-6">
          <div className="space-y-5">
            {/* Banners */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">{t.pricing.banners}</p>
                <p className="text-xs text-text-primary/50">{DROP_COSTS.banner} {t.pricing.perUnit}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCalcBanners(Math.max(0, calcBanners - 5))}
                  className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Minus className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-lg font-bold text-text-primary w-12 text-center">{calcBanners}</span>
                <button
                  onClick={() => setCalcBanners(calcBanners + 5)}
                  className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Plus className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-sm text-text-secondary w-20 text-right">{(calcBanners * DROP_COSTS.banner).toLocaleString()} drops</span>
              </div>
            </div>

            {/* Images */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">{t.pricing.images}</p>
                <p className="text-xs text-text-primary/50">{DROP_COSTS.image} {t.pricing.perUnit}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCalcImages(Math.max(0, calcImages - 5))}
                  className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Minus className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-lg font-bold text-text-primary w-12 text-center">{calcImages}</span>
                <button
                  onClick={() => setCalcImages(calcImages + 5)}
                  className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Plus className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-sm text-text-secondary w-20 text-right">{(calcImages * DROP_COSTS.image).toLocaleString()} drops</span>
              </div>
            </div>

            {/* Videos */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">{t.pricing.videos}</p>
                <p className="text-xs text-text-primary/50">{DROP_COSTS.video} {t.pricing.perUnit}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCalcVideos(Math.max(0, calcVideos - 1))}
                  className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Minus className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-lg font-bold text-text-primary w-12 text-center">{calcVideos}</span>
                <button
                  onClick={() => setCalcVideos(calcVideos + 1)}
                  className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center hover:bg-border transition-colors"
                >
                  <Plus className="w-4 h-4 text-text-secondary" />
                </button>
                <span className="text-sm text-text-secondary w-20 text-right">{(calcVideos * DROP_COSTS.video).toLocaleString()} drops</span>
              </div>
            </div>

            {/* Divider + Total */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary/70">{t.pricing.totalNeeded}</span>
                <span className="text-lg font-bold text-blue-400">{calcTotal.toLocaleString()} drops</span>
              </div>
              {userDrops > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary/70">{t.pricing.yourBalance}</span>
                  <span className="text-sm font-medium text-text-primary">{userDrops.toLocaleString()} drops</span>
                </div>
              )}
              {userDrops > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary/70">{t.pricing.afterCreating}</span>
                  <span className={cn(
                    'text-sm font-bold',
                    calcRemaining >= 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {calcRemaining >= 0 ? calcRemaining.toLocaleString() : calcRemaining.toLocaleString()} drops
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Drops Top-ups */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary">{t.pricing.topups}</h2>
          <p className="text-text-primary/60 mt-1">
            {hasPlan ? t.pricing.topupsSubtitle : t.pricing.topupsRequirePlan}
          </p>
        </div>

        <div className={cn(
          'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
          !hasPlan && 'opacity-50 pointer-events-none'
        )}>
          {TOPUPS.map((topup) => (
            <Card key={topup.id} className="p-5 flex flex-col items-center text-center hover:border-blue-500/50 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <img src="/images/drops.png" alt="Drops" className="w-5 h-5" />
                <span className="font-bold text-blue-400 text-lg">{topup.drops.toLocaleString()}</span>
              </div>
              <p className="text-2xl font-bold text-text-primary mb-4">{'\u20AC'}{topup.price}</p>
              <button
                onClick={() => handleBuyTopup(topup.id)}
                className="w-full py-2.5 rounded-xl bg-surface border border-border text-text-primary hover:bg-border text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                {t.pricing.buy || 'Comprar'}
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Call Minutes Top-ups */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
            <Phone className="w-6 h-6 text-green-400" />
            {t.pricing.callTopups}
          </h2>
          <p className="text-text-primary/60 mt-1">
            {hasPlan ? t.pricing.callTopupsSubtitle : t.pricing.callTopupsRequirePlan}
          </p>
        </div>

        <div className={cn(
          'grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto',
          !hasPlan && 'opacity-50 pointer-events-none'
        )}>
          {CALL_TOPUPS.map((topup) => (
            <Card key={topup.id} className="p-5 flex flex-col items-center text-center hover:border-green-500/50 transition-all">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-5 h-5 text-green-400" />
                <span className="font-bold text-green-400 text-lg">{topup.minutes}</span>
                <span className="text-text-primary/60 text-sm">{t.pricing.minutes}</span>
              </div>
              <p className="text-2xl font-bold text-text-primary mb-4">{'\u20AC'}{topup.price}</p>
              <button
                onClick={() => handleBuyCallTopup(topup.id)}
                className="w-full py-2.5 rounded-xl bg-surface border border-border text-text-primary hover:bg-border text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                {t.pricing.buy || 'Comprar'}
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
