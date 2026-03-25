export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 39,
    currency: 'EUR',
    drops: 2000,
    dropsPerEuro: 51,
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    currency: 'EUR',
    drops: 5000,
    dropsPerEuro: 63,
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 149,
    currency: 'EUR',
    drops: 13000,
    dropsPerEuro: 87,
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    currency: 'EUR',
    drops: 32000,
    dropsPerEuro: 107,
    popular: false,
  },
] as const

export const TOPUPS = [
  { id: 'mini', name: 'Mini', price: 15, currency: 'EUR', drops: 500 },
  { id: 'pack', name: 'Pack', price: 29, currency: 'EUR', drops: 1200 },
  { id: 'mega', name: 'Mega', price: 49, currency: 'EUR', drops: 2500 },
  { id: 'ultra', name: 'Ultra', price: 99, currency: 'EUR', drops: 6000 },
] as const

export const DROP_COSTS = {
  banner: 9,
  image: 18,
  video: 250,
} as const

export type PlanId = typeof PLANS[number]['id']
export type TopupId = typeof TOPUPS[number]['id']
