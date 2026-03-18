// lib/meta-ads/droppage-pipeline.ts
// Deterministic pipeline for DropPage setup — no Claude calls needed
// Executes: create product → quantity offers → upsell → downsell → checkout → associate

import { DropPageClient } from './droppage-client'
import type { SSEEvent } from './types'

export interface DropPagePipelineInput {
  // Product
  product_name: string
  product_description?: string
  price: number
  compare_at_price?: number
  country?: string
  dropi_product_id?: string
  variants?: Array<{
    name: string
    variant_type?: string
    variant_value?: string
    price_override?: number
    dropi_variation_id?: string
  }>
  // Page design
  page_title: string
  domain_id?: string
  // Quantity offers (optional)
  quantity_offers?: {
    tiers: Array<{
      title: string
      quantity: number
      position: number
      is_preselected?: boolean
      discount_type: string
      discount_value: number
      label_text?: string
    }>
  }
  // Upsell (optional)
  upsell?: {
    product_name: string
    product_price: number
    discount_type: string
    discount_value: number
    title: string
  }
  // Downsell (optional)
  downsell?: {
    discount_type: string
    discount_value: number
    title: string
    subtitle: string
  }
  // Checkout
  checkout_country?: string
  excluded_departments?: string[]
  // Store config
  meta_pixel_id?: string
}

export interface DropPagePipelineResult {
  success: boolean
  product_id?: string
  design_id?: string
  offer_id?: string
  upsell_id?: string
  downsell_id?: string
  errors: string[]
}

export async function executeDropPagePipeline(
  input: DropPagePipelineInput,
  dropPageClient: DropPageClient,
  sendEvent: (event: SSEEvent) => void,
): Promise<DropPagePipelineResult> {
  const errors: string[] = []

  // Step 1: Create product
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Creando producto en DropPage...' } } })

  const productResult = await dropPageClient.createProduct({
    name: input.product_name,
    description: input.product_description,
    price: input.price,
    compare_at_price: input.compare_at_price,
    country: input.country,
    dropi_product_id: input.dropi_product_id,
    variants: input.variants,
  })

  if (!productResult.success) {
    return { success: false, errors: [`Error creando producto: ${productResult.error}`] }
  }

  const productId = productResult.data?.id
  sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Producto creado ✓` } } })

  // Step 2: Create page design
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Creando landing page...' } } })

  const designResult = await dropPageClient.createPageDesign({
    page_type: 'product',
    title: input.page_title,
    product_id: productId,
    domain_id: input.domain_id,
  })

  let designId = ''
  if (designResult.success) {
    designId = designResult.data?.id
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Landing creada ✓' } } })
  } else {
    errors.push(`Landing: ${designResult.error}`)
  }

  // Step 3: Associate product to design
  if (designId) {
    await dropPageClient.associateProductToDesign(designId, productId)
  }

  // Step 4: Quantity offers
  let offerId = ''
  if (input.quantity_offers?.tiers?.length) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Configurando ofertas por cantidad...' } } })

    const offerResult = await dropPageClient.createQuantityOffer({
      name: `Ofertas ${input.product_name}`,
      is_active: true,
      product_ids: [productId],
      tiers: input.quantity_offers.tiers,
    })

    if (offerResult.success) {
      offerId = offerResult.data?.id
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Ofertas por cantidad ✓' } } })
    } else {
      errors.push(`Ofertas: ${offerResult.error}`)
    }
  }

  // Step 5: Upsell
  let upsellId = ''
  if (input.upsell) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Configurando upsell...' } } })

    const upsellResult = await dropPageClient.createUpsell({
      name: `Upsell ${input.upsell.product_name}`,
      is_active: true,
      discount_type: input.upsell.discount_type,
      discount_value: input.upsell.discount_value,
      title: input.upsell.title,
    })

    if (upsellResult.success) {
      upsellId = upsellResult.data?.id
      await dropPageClient.updateUpsellConfig({ is_active: true, max_upsells_per_order: 1 })
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Upsell ✓' } } })
    } else {
      errors.push(`Upsell: ${upsellResult.error}`)
    }
  }

  // Step 6: Downsell
  let downsellId = ''
  if (input.downsell) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Configurando downsell...' } } })

    const downsellResult = await dropPageClient.createDownsell({
      name: `Downsell ${input.product_name}`,
      is_active: true,
      discount_type: input.downsell.discount_type,
      discount_value: input.downsell.discount_value,
      title: input.downsell.title,
      subtitle: input.downsell.subtitle,
    })

    if (downsellResult.success) {
      downsellId = downsellResult.data?.id
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Downsell ✓' } } })
    } else {
      errors.push(`Downsell: ${downsellResult.error}`)
    }
  }

  // Step 7: Checkout config
  if (input.checkout_country) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Configurando checkout...' } } })

    const checkoutResult = await dropPageClient.updateCheckoutConfig({
      country: input.checkout_country,
      excluded_departments: input.excluded_departments,
    })

    if (checkoutResult.success) {
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Checkout ✓' } } })
    } else {
      errors.push(`Checkout: ${checkoutResult.error}`)
    }
  }

  // Step 8: Store config (pixel)
  if (input.meta_pixel_id) {
    await dropPageClient.updateStoreConfig({ meta_pixel_id: input.meta_pixel_id })
  }

  return {
    success: errors.length === 0,
    product_id: productId,
    design_id: designId,
    offer_id: offerId,
    upsell_id: upsellId,
    downsell_id: downsellId,
    errors,
  }
}
