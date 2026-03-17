# Matías Pipeline Optimization — Deterministic Pipelines for Landing + DropPage

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Claude tool_use loop for mechanical tasks (banner generation, DropPage setup) with deterministic pipelines that execute directly in code, reducing cost from ~$16-20 to ~$0.20-0.30 per full flow.

**Architecture:** Two new "pipeline tools" that Claude calls ONCE. Each pipeline executes 5-15 API calls directly in code without returning to Claude. SSE events report progress to the chat UI. Claude only handles creative text (descriptions, copies, recommendations).

**Tech Stack:** TypeScript, existing EstrategasToolsHandler + DropPageClient, SSE streaming

---

## Overview of Changes

```
lib/meta-ads/
  landing-pipeline.ts       — NEW: Deterministic pipeline for landing creation (banners + import)
  droppage-pipeline.ts      — NEW: Deterministic pipeline for DropPage setup (product + offers + checkout)
  tools.ts                  — Add 2 pipeline tool definitions, remove individual tools from phases
  claude-executor.ts        — Route pipeline tools to direct execution (not Claude loop)
  system-prompt.ts          — Update flow to use pipeline tools instead of individual calls
```

## Key Design Decisions

### 1. Pipeline tools are "meta-tools" — Claude calls them ONCE
Instead of Claude calling `generate_landing_banner` 7 times (7 iterations × $0.18 = $1.26), Claude calls `execute_landing_pipeline` ONCE. The pipeline internally calls the banner API 7 times, sends progress via SSE, and returns a summary.

### 2. Pipelines reuse existing code
`landing-pipeline.ts` uses `EstrategasToolsHandler` methods directly.
`droppage-pipeline.ts` uses `DropPageClient` methods directly.
No new APIs needed — just orchestration.

### 3. SSE events for progress
Pipelines emit `tool_start` and `tool_result` events so the user sees each step in the chat (e.g., "Generando banner hero... ✓", "Creando producto en DropPage... ✓").

### 4. Claude's role is reduced to creative work only
- Write product description/benefits/differentiator
- Recommend which angles and sections to use
- Write Meta ad copies
- Everything else is code

---

## Task 1: Landing Pipeline

**Files:**
- Create: `lib/meta-ads/landing-pipeline.ts`

**What it does:** Takes product info + selected sections + templates → creates product → generates ALL banners → imports to DropPage. Returns summary with URLs.

**Step 1: Create the pipeline file**

```typescript
// lib/meta-ads/landing-pipeline.ts
// Deterministic pipeline for landing creation — no Claude calls needed

import { EstrategasToolsHandler } from './estrategas-tools'
import type { SSEEvent } from './types'

interface LandingPipelineInput {
  // Product info (from Claude conversation)
  product_name: string
  product_description: string
  // Sections to generate (user chose these)
  sections: Array<{
    type: string           // 'hero', 'oferta', 'beneficios', etc.
    template_id: string    // from get_templates
    template_url: string   // from get_templates
  }>
  // Creative controls (from Claude conversation)
  product_details: string  // benefits, differentiator
  sales_angle?: string
  target_avatar?: string
  additional_instructions?: string
  // Pricing (user provided)
  price_after?: number
  price_before?: number
  currency_symbol?: string
  target_country?: string
  color_palette?: string
  // Optional: existing product_id (skip create)
  existing_product_id?: string
}

interface PipelineResult {
  success: boolean
  product_id?: string
  sections_generated: Array<{
    type: string
    section_id: string
    image_url: string
    success: boolean
    error?: string
  }>
  bundle_id?: string
  landing_url?: string
  errors: string[]
}

export async function executeLandingPipeline(
  input: LandingPipelineInput,
  estrategasTools: EstrategasToolsHandler,
  sendEvent: (event: SSEEvent) => void,
): Promise<PipelineResult> {
  const errors: string[] = []
  const sectionsGenerated: PipelineResult['sections_generated'] = []

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
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Producto creado ✓', product_id: productId } } })
  }

  // Step 2: Generate ALL banners (sequential to avoid rate limits, but no Claude calls)
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Generando ${input.sections.length} banners...` } } })

  for (let i = 0; i < input.sections.length; i++) {
    const section = input.sections[i]
    sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: `Generando banner ${i + 1}/${input.sections.length}: ${section.type}...` } } })

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
    })

    if (bannerResult.success) {
      sectionsGenerated.push({
        type: section.type,
        section_id: bannerResult.data.section_id,
        image_url: bannerResult.data.image_url,
        success: true,
      })
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Banner ${section.type} generado ✓` } } })
    } else {
      sectionsGenerated.push({
        type: section.type,
        section_id: '',
        image_url: '',
        success: false,
        error: bannerResult.error,
      })
      errors.push(`Banner ${section.type}: ${bannerResult.error}`)
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Banner ${section.type} falló ✗: ${bannerResult.error}` } } })
    }
  }

  // Step 3: Import successful sections to DropPage
  const successfulSections = sectionsGenerated.filter(s => s.success)

  if (successfulSections.length === 0) {
    return { success: false, product_id: productId, sections_generated: sectionsGenerated, errors: ['No se generó ningún banner exitosamente'] }
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
    success: errors.length === 0,
    product_id: productId,
    sections_generated: sectionsGenerated,
    bundle_id: bundleId,
    landing_url: landingUrl,
    errors,
  }
}
```

**Step 2: Commit**
```bash
git add lib/meta-ads/landing-pipeline.ts
git commit -m "feat(meta-ads): add deterministic landing pipeline — no Claude calls for banner generation"
```

---

## Task 2: DropPage Setup Pipeline

**Files:**
- Create: `lib/meta-ads/droppage-pipeline.ts`

**What it does:** Takes product info + pricing + offers config → creates product → quantity offers → upsell → downsell → checkout config → associates product to design. All direct API calls.

**Step 1: Create the pipeline file**

```typescript
// lib/meta-ads/droppage-pipeline.ts
// Deterministic pipeline for DropPage setup — no Claude calls needed

import { DropPageClient } from './droppage-client'
import type { SSEEvent } from './types'

interface DropPagePipelineInput {
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
  // Quantity offers
  quantity_offers?: {
    tiers: Array<{
      title: string
      quantity: number
      position: number
      is_preselected?: boolean
      discount_type: 'percentage' | 'fixed' | 'none'
      discount_value: number
      label_text?: string
    }>
  }
  // Upsell (optional)
  upsell?: {
    product_name: string
    product_price: number
    discount_type: 'percentage' | 'fixed' | 'none'
    discount_value: number
    title: string
  }
  // Downsell (optional)
  downsell?: {
    discount_type: 'percentage' | 'fixed' | 'none'
    discount_value: number
    title: string
    subtitle: string
  }
  // Checkout
  checkout_country?: string
  excluded_departments?: string[]
  // Store config
  meta_pixel_id?: string
  // Bundle ID from landing pipeline (to link sections)
  bundle_id?: string
}

interface DropPagePipelineResult {
  success: boolean
  product_id?: string
  design_id?: string
  offer_id?: string
  upsell_id?: string
  downsell_id?: string
  store_url?: string
  errors: string[]
}

export async function executeDropPagePipeline(
  input: DropPagePipelineInput,
  dropPageClient: DropPageClient,
  sendEvent: (event: SSEEvent) => void,
): Promise<DropPagePipelineResult> {
  const errors: string[] = []
  let productId = ''
  let designId = ''

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

  if (productResult.success) {
    productId = productResult.data?.id
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Producto creado ✓ (ID: ${productId})` } } })
  } else {
    return { success: false, errors: [`Error creando producto: ${productResult.error}`] }
  }

  // Step 2: Create page design
  sendEvent({ type: 'tool_start', data: { tool_name: 'pipeline_step', tool_input: { step: 'Creando landing page...' } } })

  const designResult = await dropPageClient.createPageDesign({
    page_type: 'product',
    title: input.page_title,
    product_id: productId,
    domain_id: input.domain_id,
  })

  if (designResult.success) {
    designId = designResult.data?.id
    sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: `Landing creada ✓` } } })
  } else {
    errors.push(`Landing: ${designResult.error}`)
  }

  // Step 3: Associate product to design
  if (designId) {
    const assocResult = await dropPageClient.associateProductToDesign(designId, productId)
    if (!assocResult.success) {
      errors.push(`Asociar producto: ${assocResult.error}`)
    }
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
      // Enable upsells globally
      await dropPageClient.updateUpsellConfig({ is_active: true, max_upsells_per_order: 1 })
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Upsell configurado ✓' } } })
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
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Downsell configurado ✓' } } })
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
      sendEvent({ type: 'tool_result', data: { tool_name: 'pipeline_step', result: { step: 'Checkout configurado ✓' } } })
    } else {
      errors.push(`Checkout: ${checkoutResult.error}`)
    }
  }

  // Step 8: Store config (pixel)
  if (input.meta_pixel_id) {
    const configResult = await dropPageClient.updateStoreConfig({
      meta_pixel_id: input.meta_pixel_id,
    })
    if (!configResult.success) {
      errors.push(`Pixel: ${configResult.error}`)
    }
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
```

**Step 2: Commit**
```bash
git add lib/meta-ads/droppage-pipeline.ts
git commit -m "feat(meta-ads): add deterministic DropPage setup pipeline"
```

---

## Task 3: Add Pipeline Tool Definitions + Route in Executor

**Files:**
- Modify: `lib/meta-ads/tools.ts` — add 2 pipeline tool definitions
- Modify: `lib/meta-ads/claude-executor.ts` — route pipeline tools to direct execution
- Modify: `lib/meta-ads/types.ts` — add pipeline tools to WRITE_TOOLS

**Step 1: Add pipeline tool definitions to tools.ts**

Add these 2 tools to `META_ADS_TOOLS` array (after the EstrategasIA tools section):

```typescript
// ==================== PIPELINE TOOLS (execute entire flows directly) ====================
{
  name: 'execute_landing_pipeline',
  description: 'Ejecuta el pipeline COMPLETO de creación de landing: crea producto, genera TODOS los banners, y los importa a DropPage. Llama esto UNA VEZ con toda la info en vez de generar banners uno por uno. REQUIERE que el usuario ya haya confirmado las secciones y plantillas.',
  input_schema: { ... } // Full schema in implementation
},
{
  name: 'execute_droppage_setup',
  description: 'Ejecuta el setup COMPLETO de DropPage: crea producto, ofertas por cantidad, upsell, downsell, configura checkout. Llama esto UNA VEZ con toda la info.',
  input_schema: { ... } // Full schema in implementation
},
```

**Step 2: Add to WRITE_TOOLS in types.ts**

**Step 3: Route pipeline tools in executor**

In `claude-executor.ts`, add pipeline routing in `routeToolExecution`:

```typescript
// Pipeline tools — execute deterministic pipelines directly
if (toolName === 'execute_landing_pipeline') {
  return executeLandingPipeline(toolInput, estrategasTools, sendEvent)
}
if (toolName === 'execute_droppage_setup') {
  return executeDropPagePipeline(toolInput, dropPageClient, sendEvent)
}
```

**Step 4: Add to all relevant phases in PHASE_TOOLS**

**Step 5: Commit**
```bash
git add lib/meta-ads/tools.ts lib/meta-ads/claude-executor.ts lib/meta-ads/types.ts
git commit -m "feat(meta-ads): route pipeline tools in executor + add definitions"
```

---

## Task 4: Update System Prompt

**Files:**
- Modify: `lib/meta-ads/system-prompt.ts`

**Changes:**
1. Replace individual banner generation instructions with `execute_landing_pipeline`
2. Replace individual DropPage setup instructions with `execute_droppage_setup`
3. Clarify Claude's role: creative text only, pipelines handle execution

**Key prompt changes:**
- Paso L3: After user confirms sections → call `execute_landing_pipeline` ONCE
- Pasos L4-L7: After user confirms pricing/offers → call `execute_droppage_setup` ONCE
- Remove "llama generate_landing_banner MULTIPLES VECES"
- Add: "NUNCA llames herramientas individuales de DropPage — usa execute_droppage_setup"

**Step 1: Update system prompt**

**Step 2: Commit**
```bash
git add lib/meta-ads/system-prompt.ts
git commit -m "feat(meta-ads): update system prompt to use pipeline tools"
```

---

## Task 5: TypeScript Build + Push

**Step 1:** Run `npx tsc --noEmit` — expect 0 errors
**Step 2:** `git push origin main`

---

## Cost Comparison

| Flow | Before (Opus) | After Prev Fix (Sonnet) | After Pipelines |
|------|--------------|------------------------|-----------------|
| Generate 7 banners | $5.18 (7 iter) | $1.26 (7 iter) | $0.18 (1 iter) |
| DropPage setup | $4.44 (6 iter) | $1.08 (6 iter) | $0.18 (1 iter) |
| Meta campaign | $3.70 (5 iter) | $0.90 (5 iter) | $0.90 (5 iter) |
| Conversation | $2.22 (3 iter) | $0.54 (3 iter) | $0.36 (2 iter) |
| **TOTAL** | **$15.54** | **$3.78** | **$1.62** |

And with prompt caching on top: **~$0.80-1.00** total.

The conversation + Meta campaign parts still use Claude (they're interactive). But the landing + DropPage parts are now $0.36 total instead of $9.62.
