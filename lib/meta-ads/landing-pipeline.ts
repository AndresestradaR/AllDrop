// lib/meta-ads/landing-pipeline.ts
// Deterministic pipeline for landing creation — no Claude calls needed
// Executes: create product → generate ALL banners (parallel) → import to DropPage

import { EstrategasToolsHandler } from './estrategas-tools'
import type { SSEEvent } from './types'

// Max concurrent banner generations to avoid rate limits but stay within Vercel timeout
const MAX_CONCURRENT = 3

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

  // Step 2: Generate banners in parallel with semaphore (MAX_CONCURRENT at a time)
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Generando ${input.sections.length} banners (${MAX_CONCURRENT} en paralelo)...` } } })

  let completed = 0

  async function generateBanner(index: number) {
    const section = input.sections[index]
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Banner ${index + 1}/${input.sections.length}: ${section.type}...` } } })

    const bannerResult = await estrategasTools.executeTool('generate_landing_banner', {
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
      // Structured fields — same as manual Banner Generator UI
      colorPalette: input.colorPalette,
      productContext: input.productContext,
      typography: input.typography,
    })

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
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Banner ${section.type} ✗: ${bannerResult.error} (${completed}/${input.sections.length})` } } })
    }
  }

  // Process in batches of MAX_CONCURRENT
  for (let batchStart = 0; batchStart < input.sections.length; batchStart += MAX_CONCURRENT) {
    const batchEnd = Math.min(batchStart + MAX_CONCURRENT, input.sections.length)
    const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i)
    await Promise.all(batchIndices.map(i => generateBanner(i)))
  }

  // Step 3: Import successful sections to DropPage (in original order)
  const successfulSections = sectionsGenerated.filter(s => s && s.success)

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
