'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { PLANS, TOPUPS, DROP_COSTS } from '@/lib/drops/constants'
import { Card } from '@/components/ui'
import { Check, Sparkles, Zap, Star, Crown, ShoppingCart } from 'lucide-react'
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
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-500/5 rounded-lg">
                <img src="/images/drops.png" alt="Drops" className="w-5 h-5" />
                <span className="font-bold text-blue-400">{plan.drops.toLocaleString()}</span>
                <span className="text-text-secondary text-sm">{t.pricing.drops}</span>
              </div>

              {/* What you can do */}
              <div className="space-y-2 mb-6 flex-1">
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">{t.pricing.whatCanYouDo}</p>
                <div className="text-sm text-text-secondary space-y-1">
                  <p>~{bannersCount} {t.pricing.banners}</p>
                  <p>~{imagesCount} {t.pricing.images}</p>
                  <p>~{videosCount} {t.pricing.videos}</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {[t.pricing.feature1, t.pricing.feature2, t.pricing.feature3, t.pricing.feature4,
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

      {/* Top-ups Section */}
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary">{t.pricing.topups}</h2>
          <p className="text-text-secondary mt-1">
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
                {t.pricing.buy}
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
