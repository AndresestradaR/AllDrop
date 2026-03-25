import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Use service role to bypass RLS — webhook has no auth context
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  let event

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
    } else {
      // Fallback: parse without signature verification (for initial setup)
      event = JSON.parse(body)
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceClient()

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { type, planId, topupId, userId, drops } = session.metadata || {}

      if (!userId || !drops) {
        console.error('[Stripe Webhook] Missing metadata:', session.metadata)
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      const dropsAmount = parseInt(drops, 10)

      if (type === 'plan') {
        // Set plan + add drops
        await supabase.from('profiles').update({
          plan: planId,
          drops: dropsAmount,
        }).eq('id', userId)

        // Log transaction
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          amount: dropsAmount,
          type: 'purchase',
          stripe_session_id: session.id,
        })

        console.log(`[Stripe] Plan ${planId} activated for ${userId}, +${dropsAmount} drops`)

      } else if (type === 'topup') {
        // Add drops to existing balance
        const { data: profile } = await supabase.from('profiles').select('drops').eq('id', userId).single()
        const currentDrops = profile?.drops || 0

        await supabase.from('profiles').update({
          drops: currentDrops + dropsAmount,
        }).eq('id', userId)

        await supabase.from('credit_transactions').insert({
          user_id: userId,
          amount: dropsAmount,
          type: 'topup',
          stripe_session_id: session.id,
        })

        console.log(`[Stripe] Top-up for ${userId}, +${dropsAmount} drops (total: ${currentDrops + dropsAmount})`)
      }
    }

    // Handle subscription renewal (monthly drops refresh)
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object
      // Only handle renewal invoices, not the first one (which is handled by checkout.session.completed)
      if (invoice.billing_reason === 'subscription_cycle') {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const { userId, drops, planId } = subscription.metadata || {}

        if (userId && drops) {
          const dropsAmount = parseInt(drops, 10)

          await supabase.from('profiles').update({
            drops: dropsAmount, // Reset to plan amount each month
          }).eq('id', userId)

          await supabase.from('credit_transactions').insert({
            user_id: userId,
            amount: dropsAmount,
            type: 'renewal',
            stripe_session_id: invoice.id,
          })

          console.log(`[Stripe] Renewal for ${userId}, plan ${planId}, reset to ${dropsAmount} drops`)
        }
      }
    }

    // Handle subscription canceled
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const { userId } = subscription.metadata || {}

      if (userId) {
        await supabase.from('profiles').update({
          plan: 'free',
          // Keep remaining drops — they paid for them
        }).eq('id', userId)

        console.log(`[Stripe] Subscription canceled for ${userId}, set plan to free`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Stripe Webhook] Processing error:', error)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }
}
