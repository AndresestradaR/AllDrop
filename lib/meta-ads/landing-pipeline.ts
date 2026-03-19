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

// Max concurrent banner generations — 1 to maximize success rate
// (2 caused KIE rate limiting; manual UI does 1 at a time and works perfectly)
const MAX_CONCURRENT = 1
// Max time per individual banner generation (seconds)
const BANNER_TIMEOUT_MS = 120_000  // 120s per banner (same as generate-landing maxDuration)
// Total pipeline timeout — must fit within Vercel function timeout (300s)
const PIPELINE_TIMEOUT_MS = 250_000  // 250s, leaves 50s for Claude response

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

  // Step 2: Generate banners with timeout protection
  const pipelineStart = Date.now()
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Generando ${input.sections.length} banners (${MAX_CONCURRENT} en paralelo, timeout ${BANNER_TIMEOUT_MS / 1000}s por banner)...` } } })

  let completed = 0

  async function generateBanner(index: number) {
    // Check total pipeline timeout
    if (Date.now() - pipelineStart > PIPELINE_TIMEOUT_MS) {
      sectionsGenerated[index] = { type: input.sections[index].type, section_id: '', image_url: '', success: false, error: 'Pipeline timeout' }
      return
    }

    const section = input.sections[index]
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Banner ${index + 1}/${input.sections.length}: ${section.type}...` } } })

    // Wrap each banner in individual timeout
    let bannerResult: any
    try {
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: banner ${section.type} tardó más de ${BANNER_TIMEOUT_MS / 1000}s`)), BANNER_TIMEOUT_MS)
      )
      const generatePromise = estrategasTools.executeTool('generate_landing_banner', {
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
      })
      bannerResult = await Promise.race([generatePromise, timeoutPromise])
    } catch (e: any) {
      bannerResult = { success: false, error: e.message }
    }

    completed++

    if (bannerResult.success) {
      sectionsGenerated[index] = {
        type: section.type,
        section_id: bannerResult.data.section_id,
        image_url: bannerResult.data.image_url,
        success: true,
      }
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Banner ${section.type} ✓ (${completed}/${input.sections.length})` } } })
    } else {
      sectionsGenerated[index] = {
        type: section.type,
        section_id: '',
        image_url: '',
        success: false,
        error: bannerResult.error,
      }
      errors.push(`Banner ${section.type}: ${bannerResult.error}`)
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Banner ${section.type} ✗ (${completed}/${input.sections.length})` } } })
    }
  }

  // Process in batches of MAX_CONCURRENT
  for (let batchStart = 0; batchStart < input.sections.length; batchStart += MAX_CONCURRENT) {
    if (Date.now() - pipelineStart > PIPELINE_TIMEOUT_MS) {
      console.log(`[LandingPipeline] Pipeline timeout reached at batch ${batchStart}, stopping`)
      break
    }
    const batchEnd = Math.min(batchStart + MAX_CONCURRENT, input.sections.length)
    const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i)
    await Promise.all(batchIndices.map(i => generateBanner(i)))
  }

  // Step 2.5: Retry failed banners ONE MORE TIME (only if we have time)
  const failedIndices = sectionsGenerated
    .map((s, i) => (s && !s.success ? i : -1))
    .filter(i => i >= 0)

  const timeLeft = PIPELINE_TIMEOUT_MS - (Date.now() - pipelineStart)
  if (failedIndices.length > 0 && failedIndices.length < input.sections.length && timeLeft > 30_000) {
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Reintentando ${failedIndices.length} banner(s) fallidos (${Math.round(timeLeft / 1000)}s restantes)...` } } })
    for (const idx of failedIndices) {
      if (Date.now() - pipelineStart > PIPELINE_TIMEOUT_MS) break
      // Remove the error from the errors array
      const section = input.sections[idx]
      const errIdx = errors.findIndex(e => e.includes(section.type))
      if (errIdx >= 0) errors.splice(errIdx, 1)
      // Retry sequentially (1 at a time)
      await generateBanner(idx)
    }
  }

  // Summary after generation + retry
  const successfulSections = sectionsGenerated.filter(s => s && s.success)
  const failedFinal = sectionsGenerated.filter(s => s && !s.success)
  const elapsed = Math.round((Date.now() - pipelineStart) / 1000)
  console.log(`[LandingPipeline] Generation complete: ${successfulSections.length}/${input.sections.length} OK, ${failedFinal.length} failed, ${elapsed}s elapsed`)

  if (successfulSections.length > 0 && failedFinal.length > 0) {
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `${successfulSections.length} de ${input.sections.length} banners generados. Fallaron: ${failedFinal.map(s => s.type).join(', ')}. Continuando con los que tenemos.` } } })
  }

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
