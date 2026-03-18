// lib/meta-ads/droppage-pipeline.ts
// Deterministic pipeline for DropPage setup — no Claude calls needed
// Executes: create product → quantity offers → upsell → downsell → checkout → associate

import { createClient } from '@supabase/supabase-js'
import { DropPageClient } from './droppage-client'
import type { SSEEvent } from './types'

function createDirectServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface DropPagePipelineInput {
  // Product
  product_name: string
  product_description?: string
  short_description?: string
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
  // Product images (URLs from user uploads in chat)
  product_image_urls?: string[]
  // Banner/section images (from landing pipeline) — optional: if empty, auto-fetched from DB
  section_image_urls?: string[]
  // EstrategasIA product ID — used to auto-fetch banner URLs from landing_sections table
  estrategas_product_id?: string
  // User ID — needed for DB queries
  user_id?: string
  // Page design
  page_title: string
  domain_id?: string
  // CTA button text
  cta_button_text?: string
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
    description: input.short_description || (input.product_description || '').substring(0, 200),
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

  // Step 1.5: Upload product images to DropPage multimedia
  if (input.product_image_urls?.length) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Subiendo ${input.product_image_urls.length} foto(s) del producto...` } } })
    for (const imgUrl of input.product_image_urls) {
      try {
        const imgResult = await dropPageClient.uploadProductImageFromUrl(productId, imgUrl, input.product_name)
        if (!imgResult.success) {
          errors.push(`Foto producto: ${imgResult.error}`)
        }
      } catch (e: any) {
        errors.push(`Foto producto: ${e.message}`)
      }
    }
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Fotos del producto subidas ✓' } } })
  }

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

  // Step 3: Associate product to design + populate with banner images
  if (designId) {
    const assocResult = await dropPageClient.associateProductToDesign(designId, productId)
    if (!assocResult.success) {
      errors.push(`Asociar producto a landing: ${assocResult.error}`)
    }

    // Auto-fetch section images from DB if not provided (solves truncation problem)
    let sectionImageUrls = input.section_image_urls || []
    if (sectionImageUrls.length === 0 && input.estrategas_product_id && input.user_id) {
      try {
        const serviceClient = createDirectServiceClient()
        const { data: sections } = await serviceClient
          .from('landing_sections')
          .select('generated_image_url')
          .eq('product_id', input.estrategas_product_id)
          .eq('user_id', input.user_id)
          .eq('status', 'completed')
          .order('sort_order', { ascending: true })

        if (sections?.length) {
          sectionImageUrls = sections
            .map((s: any) => s.generated_image_url)
            .filter((url: string) => url && url.startsWith('http'))
          console.log(`[DropPagePipeline] Auto-fetched ${sectionImageUrls.length} banner URLs from landing_sections`)
        }
      } catch (e: any) {
        console.warn('[DropPagePipeline] Failed to auto-fetch sections:', e.message)
      }
    }

    // Populate page design with banner section images using GrapesJS format
    // This is the same format the DropPage constructor uses when importing via "Enviar a mi editor"
    if (sectionImageUrls.length > 0) {
      sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Armando landing con banners...' } } })

      // Build GrapesJS components — same structure as PageDesigner.jsx import effect
      const imageComponents = sectionImageUrls.map((url, i) => ({
        type: 'image',
        tagName: 'img',
        attributes: {
          src: url,
          alt: `Seccion ${i + 1} - ${input.product_name}`,
        },
        style: {
          width: '100%',
          'max-width': '100%',
          display: 'block',
          margin: '0 auto',
        },
      }))

      const grapesjs_data = {
        pages: [{
          component: {
            type: 'wrapper',
            components: imageComponents,
          },
        }],
      }

      const updateResult = await dropPageClient.updatePageDesign(designId, {
        grapesjs_data,
        html_content: sectionImageUrls
          .map(url => `<img src="${url}" alt="${input.product_name}" style="width:100%;max-width:100%;display:block;margin:0 auto;" />`)
          .join('\n'),
        css_content: 'body{margin:0;padding:0;} img{max-width:100%;}',
        is_published: true,
        product_metadata: {
          product_name: input.product_name,
          cta_text: input.cta_button_text || '¡COMPRAR AHORA!',
          section_count: sectionImageUrls.length,
          generated_by: 'matias_pipeline',
        },
      })

      if (updateResult.success) {
        sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Landing armada con ${sectionImageUrls.length} banners y publicada ✓` } } })
      } else {
        errors.push(`Armar landing: ${updateResult.error}`)
      }
    }
  }

  // Step 4: Quantity offers
  let offerId = ''
  if (input.quantity_offers?.tiers?.length) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Configurando ofertas por cantidad...' } } })

    // Auto-calculate discount from total_price if provided
    const processedTiers = input.quantity_offers.tiers.map((tier: any) => {
      const { total_price, ...tierWithoutTotalPrice } = tier

      if (total_price != null && tier.quantity > 0 && input.price > 0) {
        // Calculate fixed discount per unit from total price
        // Example: base=$104,900, 2x total=$129,900 → per_unit=$64,950 → discount=$39,950/unit
        const pricePerUnit = total_price / tier.quantity
        const discountPerUnit = Math.max(0, input.price - pricePerUnit)
        if (discountPerUnit === 0) {
          return { ...tierWithoutTotalPrice, discount_type: 'none', discount_value: 0 }
        }
        return {
          ...tierWithoutTotalPrice,
          discount_type: 'fixed',
          discount_value: Math.ceil(discountPerUnit),
        }
      }

      return tierWithoutTotalPrice
    })

    const offerResult = await dropPageClient.createQuantityOffer({
      name: `Ofertas ${input.product_name}`,
      is_active: true,
      product_ids: [productId],
      tiers: processedTiers,
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
