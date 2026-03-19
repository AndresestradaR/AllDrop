// lib/meta-ads/landing-pipeline.ts
// Deterministic pipeline for landing creation — no Claude calls needed
// Executes: create product → generate ALL banners (parallel) → import to DropPage

import { createClient } from '@supabase/supabase-js'
import { EstrategasToolsHandler } from './estrategas-tools'
import type { SSEEvent } from './types'

function createDirectServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Polling interval for checking banner completion
const POLL_INTERVAL_MS = 20_000  // Check DB every 20s
// Total time to wait for banners to complete
const MAX_WAIT_MS = 240_000  // 240s max wait, leaves 60s for import + DropPage

export interface LandingPipelineInput {
  product_name: string
  product_description: string
  sections: Array<{
    type: string           // 'hero', 'oferta', 'beneficios', etc.
    template_id: string
    template_url: string
  }>
  product_details: string
  sales_angle?: string
  target_avatar?: string
  additional_instructions?: string
  price_after?: number
  price_before?: number
  currency_symbol?: string
  target_country?: string
  color_palette?: string  // Legacy: string like "verdes y dorados"
  // Structured fields — same as manual Banner Generator UI
  colorPalette?: { primary: string; secondary: string; accent: string; extra?: string }
  productContext?: { description?: string; benefits?: string; problems?: string; ingredients?: string; differentiator?: string }
  typography?: { headings?: string; subheadings?: string; body?: string }
  // All generated angles (for persistence to saved_angles table)
  angles?: Array<{ name: string; hook: string; description?: string; avatarSuggestion?: string; tone?: string; salesAngle?: string }>
  existing_product_id?: string
}

interface SectionResult {
  type: string
  section_id: string
  image_url: string
  success: boolean
  error?: string
}

export interface LandingPipelineResult {
  success: boolean
  product_id?: string
  sections_generated: SectionResult[]
  bundle_id?: string
  landing_url?: string
  errors: string[]
}

export async function executeLandingPipeline(
  input: LandingPipelineInput,
  estrategasTools: EstrategasToolsHandler,
  sendEvent: (event: SSEEvent) => void,
): Promise<LandingPipelineResult> {
  const errors: string[] = []
  // Pre-allocate array to preserve original order
  const sectionsGenerated: SectionResult[] = new Array(input.sections.length)

  // Step 1: Create product (or use existing)
  let productId = input.existing_product_id || ''

  if (!productId) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Creando producto en EstrategasIA...' } } })

    const productResult = await estrategasTools.executeTool('create_estrategas_product', {
      name: input.product_name,
      description: input.product_description,
    })

    if (!productResult.success) {
      return { success: false, sections_generated: [], errors: [`Error creando producto: ${productResult.error}`] }
    }

    productId = productResult.data.id
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Producto creado ✓' } } })
  }

  // Step 1.5: Persist productContext, colorPalette, pricing, country, photos to the product
  try {
    const updateData: Record<string, any> = {}
    if (input.productContext) updateData.product_context = input.productContext
    if (input.colorPalette) updateData.color_palette = input.colorPalette
    if (input.target_country) updateData.target_country = input.target_country
    if (input.price_after || input.price_before) {
      updateData.pricing = {
        priceAfter: input.price_after,
        priceBefore: input.price_before,
        currencySymbol: input.currency_symbol || '$',
      }
    }
    // Persist product photos from chat (Supabase Storage URLs)
    const photoUrls = estrategasTools['productImageUrls'] as string[]
    if (photoUrls?.length > 0) {
      updateData.product_photos = photoUrls
    }

    if (Object.keys(updateData).length > 0) {
      const serviceClient = createDirectServiceClient()
      await serviceClient
        .from('products')
        .update(updateData)
        .eq('id', productId)
      console.log(`[LandingPipeline] Persisted settings to product ${productId}: ${Object.keys(updateData).join(', ')}`)
    }
  } catch (e: any) {
    console.warn('[LandingPipeline] Failed to persist settings:', e.message)
    // Non-fatal — continue with banner generation
  }

  // Step 1.6: Persist angles to saved_angles table (if provided)
  if (input.angles?.length && input.product_name) {
    try {
      const serviceClient = createDirectServiceClient()
      // Delete existing angles for this product name + user
      const userId = estrategasTools['userId'] // Access private field
      await serviceClient
        .from('saved_angles')
        .delete()
        .eq('user_id', userId)
        .eq('product_name', input.product_name)

      const rows = input.angles.map(angle => ({
        user_id: userId,
        product_name: input.product_name,
        angle_data: angle,
      }))
      await serviceClient.from('saved_angles').insert(rows)
      console.log(`[LandingPipeline] Saved ${rows.length} angles for "${input.product_name}"`)
    } catch (e: any) {
      console.warn('[LandingPipeline] Failed to save angles:', e.message)
    }
  }

  // Step 2: Fire ALL banners as fire-and-forget, then poll DB for results
  // Each fetch() to /api/generate-landing creates its own serverless function (300s).
  // We DON'T await responses — we check the DB for completed sections.
  // This is exactly how the manual UI works: fire request → banner saves to DB when done.
  const pipelineStart = Date.now()
  const totalBanners = input.sections.length
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Disparando ${totalBanners} banners (cada uno se genera independientemente)...` } } })

  // Count existing completed sections BEFORE firing
  const serviceClientForPoll = createDirectServiceClient()
  const { data: existingBefore } = await serviceClientForPoll
    .from('landing_sections')
    .select('id')
    .eq('product_id', productId)
    .eq('status', 'completed')
  const existingCount = existingBefore?.length || 0

  // Fire each banner with a 2s stagger to avoid KIE rate limiting
  // DON'T await — just fire and let each run in its own function
  for (let i = 0; i < input.sections.length; i++) {
    const section = input.sections[i]
    console.log(`[LandingPipeline] Firing banner ${i + 1}/${totalBanners}: ${section.type}`)

    // Fire WITHOUT await — the promise runs in background
    estrategasTools.executeTool('generate_landing_banner', {
      product_id: productId,
      product_name: input.product_name,
      template_id: section.template_id,
      template_url: section.template_url,
      section_type: section.type,
      product_details: input.product_details,
      sales_angle: input.sales_angle,
      target_avatar: input.target_avatar,
      additional_instructions: input.additional_instructions,
      price_after: input.price_after,
      price_before: input.price_before,
      currency_symbol: input.currency_symbol,
      target_country: input.target_country,
      color_palette: input.color_palette,
      colorPalette: input.colorPalette,
      productContext: input.productContext,
      typography: input.typography,
    }).catch(e => console.error(`[LandingPipeline] Banner ${section.type} error:`, e.message))

    // 2s stagger between fires to avoid rate limiting
    if (i < input.sections.length - 1) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `${totalBanners} banners disparados. Consultando progreso cada 20s...` } } })

  // Poll DB every 20s to check how many completed
  let lastCount = 0
  const targetCount = existingCount + totalBanners

  for (let poll = 0; poll < 12; poll++) {  // Max 12 polls × 20s = 240s
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    if (Date.now() - pipelineStart > MAX_WAIT_MS) {
      console.log(`[LandingPipeline] Max wait reached after ${Math.round((Date.now() - pipelineStart) / 1000)}s`)
      break
    }

    const { data: currentSections } = await serviceClientForPoll
      .from('landing_sections')
      .select('id, section_type')
      .eq('product_id', productId)
      .eq('status', 'completed')

    const currentCount = currentSections?.length || 0
    const newBanners = currentCount - existingCount

    if (newBanners !== lastCount) {
      lastCount = newBanners
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `${newBanners} de ${totalBanners} banners listos...` } } })
      console.log(`[LandingPipeline] Poll ${poll + 1}: ${newBanners}/${totalBanners} completed`)
    }

    if (currentCount >= targetCount) {
      console.log(`[LandingPipeline] All ${totalBanners} banners completed!`)
      break
    }
  }

  // Final count
  const { data: finalSections } = await serviceClientForPoll
    .from('landing_sections')
    .select('id, section_type, generated_image_url')
    .eq('product_id', productId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  const newCompletedCount = (finalSections?.length || 0) - existingCount
  const elapsed = Math.round((Date.now() - pipelineStart) / 1000)

  // Populate sectionsGenerated from DB results
  const newSections = finalSections?.slice(existingCount) || []
  for (let i = 0; i < newSections.length && i < input.sections.length; i++) {
    sectionsGenerated[i] = {
      type: newSections[i].section_type || input.sections[i]?.type || 'unknown',
      section_id: newSections[i].id,
      image_url: newSections[i].generated_image_url || '',
      success: true,
    }
  }

  const successfulSections = sectionsGenerated.filter(s => s && s.success)
  const failedCount = totalBanners - newCompletedCount
  console.log(`[LandingPipeline] Final: ${newCompletedCount}/${totalBanners} OK in ${elapsed}s`)

  sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `${newCompletedCount} de ${totalBanners} banners generados en ${elapsed}s.${failedCount > 0 ? ` ${failedCount} fallaron.` : ' Todos generados ✓'}` } } })

  // Step 3: Import successful sections to DropPage (in original order)
  if (successfulSections.length === 0) {
    return { success: false, product_id: productId, sections_generated: sectionsGenerated.filter(Boolean), errors: errors.length > 0 ? errors : ['No se generó ningún banner exitosamente'] }
  }

  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Importando ${successfulSections.length} banners a DropPage...` } } })

  const importResult = await estrategasTools.executeTool('import_sections_to_droppage', {
    section_ids: successfulSections.map((s, i) => ({ id: s.section_id, order: i })),
    metadata: { product_name: input.product_name },
  })

  let bundleId = ''
  let landingUrl = ''

  if (importResult.success) {
    bundleId = importResult.data.bundle_id
    landingUrl = importResult.data.redirect_url
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Banners importados a DropPage ✓' } } })
  } else {
    errors.push(`Import a DropPage: ${importResult.error}`)
  }

  return {
    success: successfulSections.length > 0,
    product_id: productId,
    sections_generated: sectionsGenerated.filter(Boolean),
    bundle_id: bundleId,
    landing_url: landingUrl,
    errors,
  }
}
