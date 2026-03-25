import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, TOPUPS } from '@/lib/drops/constants'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { type, id } = body // type: 'plan' | 'topup', id: plan/topup id

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[]
    let mode: 'subscription' | 'payment'
    let metadata: Record<string, string>

    if (type === 'plan') {
      const plan = PLANS.find(p => p.id === id)
      if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

      mode = 'subscription'
      metadata = { type: 'plan', planId: plan.id, userId: user.id, drops: String(plan.drops) }
      lineItems = [{
        price_data: {
          currency: 'eur',
          recurring: { interval: 'month' },
          product_data: {
            name: `AllDrop ${plan.name}`,
            description: `${plan.drops.toLocaleString()} Drops/month`,
            images: ['https://alldrop-io.vercel.app/images/drops.png'],
          },
          unit_amount: plan.price * 100, // cents
        },
        quantity: 1,
      }]
    } else if (type === 'topup') {
      // Check user has active plan
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
      if (!profile?.plan || profile.plan === 'free') {
        return NextResponse.json({ error: 'Active plan required for top-ups' }, { status: 400 })
      }

      const topup = TOPUPS.find(t => t.id === id)
      if (!topup) return NextResponse.json({ error: 'Invalid top-up' }, { status: 400 })

      mode = 'payment'
      metadata = { type: 'topup', topupId: topup.id, userId: user.id, drops: String(topup.drops) }
      lineItems = [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `AllDrop ${topup.name} Top-up`,
            description: `${topup.drops.toLocaleString()} Drops`,
            images: ['https://alldrop-io.vercel.app/images/drops.png'],
          },
          unit_amount: topup.price * 100,
        },
        quantity: 1,
      }]
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const session = await getStripe().checkout.sessions.create({
      mode,
      line_items: lineItems,
      metadata,
      customer_email: user.email,
      success_url: `${req.nextUrl.origin}/dashboard/pricing?success=true`,
      cancel_url: `${req.nextUrl.origin}/dashboard/pricing?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
