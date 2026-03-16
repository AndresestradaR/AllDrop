# Phase 2: Matías Agentic System — Landing + Campaign Creation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Matías from a Meta Ads-only agent into a full-stack dropshipping assistant that creates landing pages in EstrategasIA, sets up the DropPage store (product, checkout, offers, upsells, downsells), and mounts Meta campaigns pointing to the final URL — all in one conversation.

**Architecture:** New internal tools (callable by Claude via tool_use) that proxy authenticated requests to EstrategasIA and DropPage APIs. The executor routes tool calls to the correct backend. SSO bridge handles DropPage auth transparently. System prompt updated with the complete flow.

**Tech Stack:** Next.js API routes (proxy layer), Supabase Auth, DropPage FastAPI (existing endpoints), Anthropic tool_use loop (existing executor), `/api/generate-landing` (banner generation with AI)

---

## Overview of Changes

```
lib/meta-ads/
  tools.ts              — Add ~20 new tool definitions (estrategas + droppage + banner gen)
  types.ts              — Add new tools to READ_ONLY_TOOLS and WRITE_TOOLS
  claude-executor.ts    — Route new tools to internal handlers (not Meta API)
  system-prompt.ts      — Complete rewrite of flow (landing creation → droppage → meta)
  droppage-client.ts    — NEW: DropPage API client (SSO auth + CRUD)
  estrategas-tools.ts   — NEW: Handler for EstrategasIA internal tools (product, banners, images)

app/api/meta-ads/chat/route.ts — Pass new callbacks to executor

components/meta-ads/MetaAdsChat.tsx — Support image upload in chat (product photos)
```

## Key Design Decisions

### 1. Banner Generation is FULLY AUTOMATIC
Matías selects templates based on product context (category, type) and generates banners by calling `/api/generate-landing` directly. The user does NOT need to go to the dashboard. Matías picks the best template per section type (hero, oferta, testimonios, etc.) and generates 5-7 banners automatically.

### 2. Landing Assembly is FULLY AUTOMATIC
After generating banners, Matías imports them to DropPage via `import_sections_to_droppage` which creates a bundle. DropPage constructor loads the bundle automatically. No manual drag-and-drop needed.

### 3. Product Images via Chat
User sends product photos directly in the chat. The frontend uploads them to Supabase Storage and passes the URLs to the executor. Matías uses these URLs for banner generation AND for Meta ad creatives.

### 4. Domain Selection is Interactive
Matías calls `get_droppage_domains` to list the user's configured domains, shows them, and asks which one to use for the landing. DNS setup remains manual (outside of Matías).

## Architecture Decision: Proxy vs Direct

**Decision: Proxy through Next.js API routes (NOT direct from Claude executor)**

Why: DropPage requires JWT auth. The SSO flow (Supabase token → DropPage JWT) must happen server-side. EstrategasIA APIs require the user's Supabase session. Both are already available in the chat route handler.

```
User message → Claude executor → tool_use "create_droppage_product"
  → executor calls droppage-client.ts
    → SSO verify (cached JWT) → POST /api/admin/products
    → returns result to Claude
  → Claude continues with next tool
```

---

## Task 1: DropPage API Client with SSO

**Files:**
- Create: `lib/meta-ads/droppage-client.ts`
- Modify: `lib/meta-ads/types.ts` (add DROPPAGE_BASE_URL constant)

### Step 1: Write the DropPage client

```typescript
// lib/meta-ads/droppage-client.ts
// DropPage API client with SSO auth for Matías agent

const DROPPAGE_API_BASE = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://shopiestrategas-production.up.railway.app'

interface DropPageClientOptions {
  supabaseAccessToken: string  // From the user's Supabase session
}

export class DropPageClient {
  private supabaseToken: string
  private jwt: string | null = null
  private jwtExpiry: number = 0

  constructor(opts: DropPageClientOptions) {
    this.supabaseToken = opts.supabaseAccessToken
  }

  // SSO: exchange Supabase token for DropPage JWT
  private async ensureAuth(): Promise<string> {
    // Cache JWT for 50 minutes (tokens last 60min)
    if (this.jwt && Date.now() < this.jwtExpiry) {
      return this.jwt
    }

    const res = await fetch(`${DROPPAGE_API_BASE}/api/auth/sso/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: this.supabaseToken }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`SSO failed: ${err.detail || res.statusText}`)
    }

    const data = await res.json()
    this.jwt = data.access_token
    this.jwtExpiry = Date.now() + 50 * 60 * 1000  // 50 min cache
    return this.jwt!
  }

  // Generic request helper
  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const token = await this.ensureAuth()
      const res = await fetch(`${DROPPAGE_API_BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { success: false, error: err.detail || err.error || `HTTP ${res.status}` }
      }

      // 204 No Content
      if (res.status === 204) {
        return { success: true }
      }

      const data = await res.json()
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // ==================== PRODUCTS ====================

  async getProducts(search?: string) {
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    return this.request('GET', `/api/admin/products${params}`)
  }

  async createProduct(input: {
    name: string
    description?: string
    short_description?: string
    price: number
    compare_at_price?: number
    cost_price?: number
    dropi_product_id?: string
    sku?: string
    is_active?: boolean
    country?: string
    variants?: Array<{
      name: string
      variant_type?: string
      variant_value?: string
      price_override?: number
      dropi_variation_id?: string
      stock?: number
    }>
  }) {
    return this.request('POST', '/api/admin/products', input)
  }

  // ==================== PAGE DESIGNS ====================

  async getPageDesigns(pageType?: string) {
    const params = pageType ? `?page_type=${pageType}` : ''
    return this.request('GET', `/api/admin/page-designs${params}`)
  }

  async createPageDesign(input: {
    page_type: string
    title: string
    slug?: string
    product_id?: string
    domain_id?: string
    product_metadata?: Record<string, any>
  }) {
    return this.request('POST', '/api/admin/page-designs', input)
  }

  async associateProductToDesign(designId: string, productId: string | null) {
    return this.request('PUT', `/api/admin/page-designs/${designId}/associate-product`, {
      product_id: productId,
    })
  }

  // ==================== CHECKOUT ====================

  async getCheckoutConfig(country?: string) {
    const params = country ? `?country=${country}` : ''
    return this.request('GET', `/api/admin/checkout-config${params}`)
  }

  async updateCheckoutConfig(input: {
    country?: string
    excluded_departments?: string[]
    cta_text?: string
    form_blocks?: any[]
  }) {
    return this.request('PUT', '/api/admin/checkout-config', input)
  }

  // ==================== QUANTITY OFFERS ====================

  async getQuantityOffers() {
    return this.request('GET', '/api/admin/checkout/offers')
  }

  async createQuantityOffer(input: {
    name: string
    is_active?: boolean
    product_ids?: string[]
    tiers: Array<{
      title: string
      quantity: number
      position: number
      is_preselected?: boolean
      discount_type: string
      discount_value: number
      label_text?: string
    }>
  }) {
    return this.request('POST', '/api/admin/checkout/offers', input)
  }

  // ==================== UPSELLS ====================

  async getUpsells() {
    return this.request('GET', '/api/admin/upsells')
  }

  async createUpsell(input: {
    name: string
    is_active?: boolean
    trigger_type?: string
    trigger_product_ids?: string[]
    upsell_product_id?: string
    discount_type?: string
    discount_value?: number
    title?: string
    add_button_text?: string
    decline_button_text?: string
  }) {
    return this.request('POST', '/api/admin/upsells', input)
  }

  async updateUpsellConfig(input: {
    upsell_type?: string
    max_upsells_per_order?: number
    is_active?: boolean
  }) {
    return this.request('PUT', '/api/admin/upsells/config', input)
  }

  // ==================== DOWNSELLS ====================

  async getDownsells() {
    return this.request('GET', '/api/admin/downsells')
  }

  async createDownsell(input: {
    name: string
    is_active?: boolean
    trigger_type?: string
    trigger_product_ids?: string[]
    discount_type?: string
    discount_value?: number
    title?: string
    subtitle?: string
    badge_text?: string
    complete_button_text?: string
    decline_button_text?: string
  }) {
    return this.request('POST', '/api/admin/downsells', input)
  }

  // ==================== DOMAINS ====================

  async getDomains() {
    return this.request('GET', '/api/admin/domains')
  }

  // ==================== STORE CONFIG ====================

  async getStoreConfig() {
    return this.request('GET', '/api/admin/config')
  }

  async updateStoreConfig(input: Record<string, any>) {
    return this.request('PUT', '/api/admin/config', input)
  }

  // ==================== TOOL DISPATCHER ====================

  async executeTool(
    toolName: string,
    toolInput: Record<string, any>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    switch (toolName) {
      // Read tools
      case 'get_droppage_products':
        return this.getProducts(toolInput.search)
      case 'get_droppage_page_designs':
        return this.getPageDesigns(toolInput.page_type)
      case 'get_droppage_checkout_config':
        return this.getCheckoutConfig(toolInput.country)
      case 'get_droppage_quantity_offers':
        return this.getQuantityOffers()
      case 'get_droppage_upsells':
        return this.getUpsells()
      case 'get_droppage_downsells':
        return this.getDownsells()
      case 'get_droppage_domains':
        return this.getDomains()
      case 'get_droppage_store_config':
        return this.getStoreConfig()

      // Write tools
      case 'create_droppage_product':
        return this.createProduct(toolInput as any)
      case 'create_droppage_page_design':
        return this.createPageDesign(toolInput as any)
      case 'associate_droppage_product_design':
        return this.associateProductToDesign(toolInput.design_id, toolInput.product_id)
      case 'update_droppage_checkout_config':
        return this.updateCheckoutConfig(toolInput as any)
      case 'create_droppage_quantity_offer':
        return this.createQuantityOffer(toolInput as any)
      case 'create_droppage_upsell':
        return this.createUpsell(toolInput as any)
      case 'update_droppage_upsell_config':
        return this.updateUpsellConfig(toolInput as any)
      case 'create_droppage_downsell':
        return this.createDownsell(toolInput as any)
      case 'update_droppage_store_config':
        return this.updateStoreConfig(toolInput)

      default:
        return { success: false, error: `Unknown DropPage tool: ${toolName}` }
    }
  }
}
```

### Step 2: Commit

```bash
git add lib/meta-ads/droppage-client.ts
git commit -m "feat(meta-ads): add DropPage API client with SSO auth"
```

---

## Task 2: EstrategasIA Internal Tools Handler (with Banner Generation)

**Files:**
- Create: `lib/meta-ads/estrategas-tools.ts`

### Step 1: Write the handler

This handler wraps calls to EstrategasIA's own APIs. KEY FEATURE: `generate_landing_banner` calls `/api/generate-landing` to generate banners with AI — Matías picks template + section type based on product context. No manual interaction needed.

```typescript
// lib/meta-ads/estrategas-tools.ts
// Handles EstrategasIA internal tool calls for Matías agent

import { createServiceClient } from '@/lib/supabase/server'

interface EstrategasToolsOptions {
  userId: string
  supabaseAccessToken: string
  // Product images uploaded by user in chat (stored in Supabase Storage)
  productImageUrls?: string[]
}

export class EstrategasToolsHandler {
  private userId: string
  private token: string
  private productImageUrls: string[]

  constructor(opts: EstrategasToolsOptions) {
    this.userId = opts.userId
    this.token = opts.supabaseAccessToken
    this.productImageUrls = opts.productImageUrls || []
  }

  // Update product images (called when user uploads new images in chat)
  setProductImageUrls(urls: string[]) {
    this.productImageUrls = urls
  }

  // Get user's products from EstrategasIA
  async getProducts(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const serviceClient = await createServiceClient()
      const { data: products, error } = await serviceClient
        .from('products')
        .select('id, name, description, image_url, created_at')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        data: (products || []).map(p => ({
          id: p.id,
          nombre: p.name,
          descripcion: p.description,
          imagen: p.image_url,
          landing_url: `https://www.estrategasia.com/dashboard/landing/${p.id}`,
        })),
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Create a new product in EstrategasIA
  async createProduct(input: {
    name: string
    description?: string
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const serviceClient = await createServiceClient()
      const { data: product, error } = await serviceClient
        .from('products')
        .insert({
          user_id: this.userId,
          name: input.name,
          description: input.description || null,
        })
        .select('id, name, description, image_url, created_at')
        .single()

      if (error) return { success: false, error: error.message }

      return {
        success: true,
        data: {
          id: product.id,
          nombre: product.name,
          descripcion: product.description,
          landing_url: `https://www.estrategasia.com/dashboard/landing/${product.id}`,
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Get landing sections for a product
  async getLandingSections(productId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const serviceClient = await createServiceClient()
      const { data: sections, error } = await serviceClient
        .from('landing_sections')
        .select('id, category, image_url, template_id, created_at, sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      if (error) return { success: false, error: error.message }

      return { success: true, data: sections || [] }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Get available templates (for banner generation)
  async getTemplates(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const serviceClient = await createServiceClient()
      const { data: templates, error } = await serviceClient
        .from('templates')
        .select('id, name, category, image_url, description')
        .eq('is_active', true)
        .order('category', { ascending: true })

      if (error) return { success: false, error: error.message }

      // Group by category for easier selection
      const grouped: Record<string, any[]> = {}
      for (const t of templates || []) {
        if (!grouped[t.category]) grouped[t.category] = []
        grouped[t.category].push(t)
      }

      return { success: true, data: { templates: templates || [], by_category: grouped } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // =====================================================
  // GENERATE LANDING BANNER — calls /api/generate-landing
  // Matías picks template + section type, AI generates banner
  // =====================================================
  async generateLandingBanner(input: {
    product_id: string
    product_name: string
    template_id: string
    template_url: string
    section_type: string  // 'hero', 'oferta', 'testimonios', etc.
    product_details?: string
    sales_angle?: string
    target_avatar?: string
    additional_instructions?: string
    currency_symbol?: string
    price_after?: number
    price_before?: number
    target_country?: string
    color_palette?: string
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Use product images uploaded by user in chat, or fallback to product image_url
      let productPhotos = [...this.productImageUrls]

      if (productPhotos.length === 0) {
        // Try to get product image from DB
        const serviceClient = await createServiceClient()
        const { data: product } = await serviceClient
          .from('products')
          .select('image_url')
          .eq('id', input.product_id)
          .single()
        if (product?.image_url) {
          productPhotos = [product.image_url]
        }
      }

      if (productPhotos.length === 0) {
        return { success: false, error: 'No hay fotos del producto. Pide al usuario que envíe al menos una foto por el chat.' }
      }

      // Call /api/generate-landing internally via fetch to our own server
      // We need to use the Supabase token for auth
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

      const res = await fetch(`${baseUrl}/api/generate-landing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sb-access-token=${this.token}`,
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          productId: input.product_id,
          productName: input.product_name,
          templateId: input.template_id,
          templateUrl: input.template_url,
          productPhotos,
          outputSize: '1080x1920',
          creativeControls: {
            sectionType: input.section_type,
            productDetails: input.product_details || '',
            salesAngle: input.sales_angle || '',
            targetAvatar: input.target_avatar || '',
            additionalInstructions: input.additional_instructions || '',
            currencySymbol: input.currency_symbol || '$',
            priceAfter: input.price_after,
            priceBefore: input.price_before,
            targetCountry: input.target_country,
            colorPalette: input.color_palette,
          },
        }),
      })

      const data = await res.json()

      if (!data.success) {
        return { success: false, error: data.error || 'Error generando banner' }
      }

      return {
        success: true,
        data: {
          section_id: data.sectionId,
          image_url: data.imageUrl,
          section_type: input.section_type,
          provider: data.usedProvider,
          message: `Banner ${input.section_type} generado exitosamente`,
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Import sections to DropPage (create bundle) — AUTOMATIC, no manual constructor
  async importSectionsToDropPage(input: {
    section_ids: Array<{ id: string; order: number }>
    metadata?: Record<string, any>
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const serviceClient = await createServiceClient()

      // Create import bundle
      const { data: bundle, error: bundleError } = await serviceClient
        .from('import_bundles')
        .insert({
          user_id: this.userId,
          section_ids: input.section_ids,
          metadata: {
            ...input.metadata,
            product_photos: this.productImageUrls,
            auto_import: true,  // Flag for DropPage to auto-import without user interaction
          },
          status: 'pending',
        })
        .select('id')
        .single()

      if (bundleError) return { success: false, error: bundleError.message }

      return {
        success: true,
        data: {
          bundle_id: bundle.id,
          redirect_url: `/constructor/import-sections?bundle=${bundle.id}`,
          message: 'Secciones importadas a DropPage. La landing se armó automáticamente con los banners generados.',
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Upload product image from chat to Supabase Storage
  async uploadProductImage(input: {
    image_data: string  // base64 data URL or public URL
    filename?: string
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const serviceClient = await createServiceClient()

      // If it's already a public URL, just store it
      if (input.image_data.startsWith('http')) {
        this.productImageUrls.push(input.image_data)
        return { success: true, data: { url: input.image_data, total_images: this.productImageUrls.length } }
      }

      // Upload base64 to Supabase Storage
      const timestamp = Date.now()
      const fileName = `meta-ads/${this.userId}/${timestamp}-product.webp`

      // Extract base64 data
      const base64Match = input.image_data.match(/^data:image\/\w+;base64,(.+)$/)
      if (!base64Match) {
        return { success: false, error: 'Formato de imagen no válido' }
      }

      const buffer = Buffer.from(base64Match[1], 'base64')
      const { error: uploadError } = await serviceClient.storage
        .from('landing-images')
        .upload(fileName, buffer, { contentType: 'image/webp', upsert: true })

      if (uploadError) return { success: false, error: uploadError.message }

      const { data: urlData } = serviceClient.storage
        .from('landing-images')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl
      this.productImageUrls.push(publicUrl)

      return {
        success: true,
        data: {
          url: publicUrl,
          total_images: this.productImageUrls.length,
          message: `Imagen subida. Tienes ${this.productImageUrls.length} foto(s) del producto.`,
        },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  // Dispatcher
  async executeTool(
    toolName: string,
    toolInput: Record<string, any>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    switch (toolName) {
      case 'get_my_products':
        return this.getProducts()
      case 'create_estrategas_product':
        return this.createProduct(toolInput as any)
      case 'get_landing_sections':
        return this.getLandingSections(toolInput.product_id)
      case 'get_templates':
        return this.getTemplates()
      case 'generate_landing_banner':
        return this.generateLandingBanner(toolInput as any)
      case 'import_sections_to_droppage':
        return this.importSectionsToDropPage(toolInput as any)
      case 'upload_product_image':
        return this.uploadProductImage(toolInput as any)
      default:
        return { success: false, error: `Unknown EstrategasIA tool: ${toolName}` }
    }
  }
}
```

### Step 2: Commit

```bash
git add lib/meta-ads/estrategas-tools.ts
git commit -m "feat(meta-ads): add EstrategasIA tools handler for product/landing management"
```

---

## Task 3: Add New Tool Definitions

**Files:**
- Modify: `lib/meta-ads/tools.ts`
- Modify: `lib/meta-ads/types.ts`

### Step 1: Add tool definitions to `tools.ts`

Append these after the existing tools in `META_ADS_TOOLS`:

```typescript
  // ==================== ESTRATEGAS IA TOOLS ====================
  {
    name: 'create_estrategas_product',
    description: 'Crea un nuevo producto en EstrategasIA (Landing Generator). Esto crea el registro del producto para después generar banners y landing page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto' },
        description: { type: 'string', description: 'Descripción del producto' },
      },
      required: ['name'],
    },
  },
  {
    name: 'upload_product_image',
    description: 'Registra una imagen del producto enviada por el usuario en el chat. Necesaria antes de generar banners. El usuario envía la imagen por el chat y esta herramienta la almacena.',
    input_schema: {
      type: 'object' as const,
      properties: {
        image_data: { type: 'string', description: 'URL pública de la imagen o data URL base64' },
        filename: { type: 'string', description: 'Nombre del archivo (opcional)' },
      },
      required: ['image_data'],
    },
  },
  {
    name: 'get_landing_sections',
    description: 'Lista las secciones de landing (banners) generadas para un producto en EstrategasIA. Cada sección es un banner con su categoría (hero, oferta, testimonios, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'ID del producto en EstrategasIA' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'get_templates',
    description: 'Lista las plantillas de banner disponibles en EstrategasIA, agrupadas por categoría (hero, oferta, antes-despues, beneficios, testimonios, etc.). Usa esto para escoger la mejor plantilla por categoría según el producto.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'generate_landing_banner',
    description: 'Genera un banner/sección de landing con IA. Selecciona una plantilla y tipo de sección, y la IA genera el banner usando las fotos del producto. Llama MÚLTIPLES VECES para generar diferentes secciones (hero, oferta, testimonios, beneficios, etc.). Necesita al menos 1 foto del producto (upload_product_image).',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: { type: 'string', description: 'ID del producto en EstrategasIA' },
        product_name: { type: 'string', description: 'Nombre del producto' },
        template_id: { type: 'string', description: 'ID de la plantilla a usar (de get_templates)' },
        template_url: { type: 'string', description: 'URL de la imagen de la plantilla (de get_templates)' },
        section_type: {
          type: 'string',
          enum: ['hero', 'oferta', 'antes_despues', 'beneficios', 'tabla_comparativa', 'autoridad', 'testimonios', 'modo_uso', 'logistica', 'faq', 'casos_uso', 'caracteristicas', 'ingredientes', 'comunidad'],
          description: 'Tipo de sección a generar',
        },
        product_details: { type: 'string', description: 'Detalles del producto para el copy del banner (max 500 chars)' },
        sales_angle: { type: 'string', description: 'Ángulo de venta para el banner (max 150 chars)' },
        target_avatar: { type: 'string', description: 'Avatar/público objetivo (max 150 chars)' },
        additional_instructions: { type: 'string', description: 'Instrucciones adicionales para la IA (max 200 chars)' },
        currency_symbol: { type: 'string', description: 'Símbolo de moneda (default: $)' },
        price_after: { type: 'number', description: 'Precio de venta (para secciones de oferta)' },
        price_before: { type: 'number', description: 'Precio anterior tachado (para secciones de oferta)' },
        target_country: { type: 'string', description: 'País objetivo (CO, MX, CL, etc.)' },
        color_palette: { type: 'string', description: 'Paleta de colores deseada (ej: "morado y dorado", "verde natural")' },
      },
      required: ['product_id', 'product_name', 'template_id', 'template_url', 'section_type'],
    },
  },
  {
    name: 'import_sections_to_droppage',
    description: 'Importa los banners generados a DropPage para armar la landing automáticamente. Pasa los section_ids obtenidos de generate_landing_banner. La landing se ensambla automáticamente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        section_ids: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID de la sección (de generate_landing_banner)' },
              order: { type: 'number', description: 'Orden de la sección (0=hero, 1=oferta, 2=beneficios...)' },
            },
          },
          description: 'Secciones a importar en orden',
        },
        metadata: {
          type: 'object',
          description: 'Metadata: { product_name, product_photos }',
        },
      },
      required: ['section_ids'],
    },
  },

  // ==================== DROPPAGE TOOLS (Read) ====================
  {
    name: 'get_droppage_products',
    description: 'Lista los productos en la tienda DropPage del usuario. Incluye precio, variantes, imágenes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Buscar producto por nombre' },
      },
      required: [],
    },
  },
  {
    name: 'get_droppage_page_designs',
    description: 'Lista los diseños de página (landings) en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_type: { type: 'string', enum: ['home', 'product', 'custom'], description: 'Filtrar por tipo de página' },
      },
      required: [],
    },
  },
  {
    name: 'get_droppage_checkout_config',
    description: 'Obtiene la configuración del checkout (formulario, campos, departamentos excluidos) de DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        country: { type: 'string', description: 'Código de país (CO, MX, CL, PE, etc.)' },
      },
      required: [],
    },
  },
  {
    name: 'get_droppage_quantity_offers',
    description: 'Lista las ofertas de cantidad (2x, 3x) configuradas en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_droppage_upsells',
    description: 'Lista los upsells configurados en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_droppage_downsells',
    description: 'Lista los downsells configurados en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_droppage_domains',
    description: 'Lista los dominios configurados en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_droppage_store_config',
    description: 'Obtiene la configuración general de la tienda DropPage (nombre, colores, pixel, WhatsApp, moneda, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  // ==================== DROPPAGE TOOLS (Write) ====================
  {
    name: 'create_droppage_product',
    description: 'Crea un producto en la tienda DropPage con precio, variantes y código Dropi. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto' },
        description: { type: 'string', description: 'Descripción larga' },
        short_description: { type: 'string', description: 'Descripción corta' },
        price: { type: 'number', description: 'Precio de venta (ej: 89900 para COP)' },
        compare_at_price: { type: 'number', description: 'Precio anterior (tachado)' },
        cost_price: { type: 'number', description: 'Costo real del producto' },
        dropi_product_id: { type: 'string', description: 'ID del producto en Dropi (para sincronización de órdenes)' },
        country: { type: 'string', description: 'País (CO, MX, CL, etc.)' },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Nombre de la variante (ej: "Rojo - Talla M")' },
              variant_type: { type: 'string', description: 'Tipo (Color, Talla, etc.)' },
              variant_value: { type: 'string', description: 'Valor (Rojo, M, etc.)' },
              price_override: { type: 'number', description: 'Precio diferente para esta variante (opcional)' },
              dropi_variation_id: { type: 'string', description: 'ID de la variación en Dropi' },
            },
          },
          description: 'Variantes del producto',
        },
      },
      required: ['name', 'price'],
    },
  },
  {
    name: 'create_droppage_page_design',
    description: 'Crea un diseño de página (landing) en DropPage. Después se importan las secciones desde EstrategasIA.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_type: { type: 'string', enum: ['home', 'product', 'custom'], description: 'Tipo de página' },
        title: { type: 'string', description: 'Título de la página' },
        slug: { type: 'string', description: 'Slug para la URL (auto-generado si se omite)' },
        product_id: { type: 'string', description: 'ID del producto en DropPage (para tipo "product")' },
        domain_id: { type: 'string', description: 'ID del dominio a asociar' },
      },
      required: ['page_type', 'title'],
    },
  },
  {
    name: 'associate_droppage_product_design',
    description: 'Asocia un producto con un diseño de página en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        design_id: { type: 'string', description: 'ID del diseño de página' },
        product_id: { type: 'string', description: 'ID del producto (null para desasociar)' },
      },
      required: ['design_id', 'product_id'],
    },
  },
  {
    name: 'update_droppage_checkout_config',
    description: 'Actualiza la configuración del checkout en DropPage (departamentos excluidos, textos, colores).',
    input_schema: {
      type: 'object' as const,
      properties: {
        country: { type: 'string', description: 'País del checkout' },
        excluded_departments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Departamentos/regiones a excluir del envío',
        },
        cta_text: { type: 'string', description: 'Texto del botón CTA (usa {order_total} para precio)' },
      },
      required: [],
    },
  },
  {
    name: 'create_droppage_quantity_offer',
    description: 'Crea una oferta de cantidad (2x, 3x) en DropPage. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre de la oferta' },
        is_active: { type: 'boolean', description: 'Activar inmediatamente' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Productos a los que aplica (null = todos)' },
        tiers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título del tier (ej: "1x", "2x Ahorra 10%")' },
              quantity: { type: 'number', description: 'Cantidad de unidades' },
              position: { type: 'number', description: 'Posición visual (0, 1, 2...)' },
              is_preselected: { type: 'boolean', description: 'Si este tier viene seleccionado por defecto' },
              discount_type: { type: 'string', enum: ['percentage', 'fixed', 'none'], description: 'Tipo de descuento' },
              discount_value: { type: 'number', description: 'Valor del descuento (ej: 10 para 10%)' },
              label_text: { type: 'string', description: 'Etiqueta visual (ej: "MÁS VENDIDO", "MEJOR OFERTA")' },
            },
          },
          description: 'Tiers de la oferta (1x, 2x, 3x)',
        },
      },
      required: ['name', 'tiers'],
    },
  },
  {
    name: 'create_droppage_upsell',
    description: 'Crea un upsell en DropPage (producto complementario después del checkout). REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del upsell' },
        is_active: { type: 'boolean', description: 'Activar inmediatamente' },
        upsell_product_id: { type: 'string', description: 'ID del producto upsell' },
        trigger_type: { type: 'string', enum: ['all', 'specific'], description: 'Cuándo mostrar: "all" o "specific" productos' },
        trigger_product_ids: { type: 'array', items: { type: 'string' }, description: 'IDs de productos que activan el upsell' },
        discount_type: { type: 'string', enum: ['none', 'percentage', 'fixed'], description: 'Tipo de descuento' },
        discount_value: { type: 'number', description: 'Valor del descuento' },
        title: { type: 'string', description: 'Título del modal upsell' },
        add_button_text: { type: 'string', description: 'Texto del botón de agregar' },
        decline_button_text: { type: 'string', description: 'Texto del botón de rechazar' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_droppage_upsell_config',
    description: 'Actualiza la configuración global de upsells en DropPage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        is_active: { type: 'boolean', description: 'Activar/desactivar upsells globalmente' },
        max_upsells_per_order: { type: 'number', description: 'Máximo de upsells por orden' },
      },
      required: [],
    },
  },
  {
    name: 'create_droppage_downsell',
    description: 'Crea un downsell en DropPage (oferta de salida cuando el usuario intenta abandonar). REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del downsell' },
        is_active: { type: 'boolean', description: 'Activar inmediatamente' },
        discount_type: { type: 'string', enum: ['none', 'percentage', 'fixed'], description: 'Tipo de descuento' },
        discount_value: { type: 'number', description: 'Valor del descuento (ej: 10 para 10%)' },
        title: { type: 'string', description: 'Título principal (ej: "Espera!")' },
        subtitle: { type: 'string', description: 'Subtítulo (ej: "Tenemos una oferta para ti!")' },
        badge_text: { type: 'string', description: 'Texto del badge de descuento' },
        complete_button_text: { type: 'string', description: 'Texto del botón de completar (usa {discount} para el valor)' },
        decline_button_text: { type: 'string', description: 'Texto del botón de rechazar' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_droppage_store_config',
    description: 'Actualiza la configuración general de la tienda DropPage (nombre, colores, pixel, WhatsApp, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        store_name: { type: 'string', description: 'Nombre de la tienda' },
        primary_color: { type: 'string', description: 'Color primario (hex)' },
        accent_color: { type: 'string', description: 'Color de acento (hex)' },
        meta_pixel_id: { type: 'string', description: 'ID del pixel de Meta para tracking' },
        whatsapp_number: { type: 'string', description: 'Número de WhatsApp para soporte' },
        currency_symbol: { type: 'string', description: 'Símbolo de moneda ($)' },
        currency_code: { type: 'string', description: 'Código de moneda (COP, MXN, etc.)' },
      },
      required: [],
    },
  },
```

### Step 2: Update `types.ts` — add new tools to the arrays

```typescript
export const READ_ONLY_TOOLS = [
  // ... existing
  'get_landing_sections',
  'get_templates',
  'upload_product_image',
  'get_droppage_products',
  'get_droppage_page_designs',
  'get_droppage_checkout_config',
  'get_droppage_quantity_offers',
  'get_droppage_upsells',
  'get_droppage_downsells',
  'get_droppage_domains',
  'get_droppage_store_config',
] as const

export const WRITE_TOOLS = [
  // ... existing
  'create_estrategas_product',
  'generate_landing_banner',
  'import_sections_to_droppage',
  'create_droppage_product',
  'create_droppage_page_design',
  'associate_droppage_product_design',
  'update_droppage_checkout_config',
  'create_droppage_quantity_offer',
  'create_droppage_upsell',
  'update_droppage_upsell_config',
  'create_droppage_downsell',
  'update_droppage_store_config',
] as const
```

### Step 3: Commit

```bash
git add lib/meta-ads/tools.ts lib/meta-ads/types.ts
git commit -m "feat(meta-ads): add 19 new tool definitions for EstrategasIA + DropPage"
```

---

## Task 4: Update Executor to Route New Tools

**Files:**
- Modify: `lib/meta-ads/claude-executor.ts`
- Modify: `app/api/meta-ads/chat/route.ts`

### Step 1: Update ExecutorOptions to accept new clients

Add to `ExecutorOptions` interface in `claude-executor.ts`:

```typescript
// New callbacks for Phase 2 tools
onExecuteEstrategasTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
onExecuteDropPageTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
```

### Step 2: Update tool execution logic in executor

In the `executeChat` function, in the read-only tool execution section (after the `get_my_products` check), add routing for new tools:

```typescript
// Handle EstrategasIA tools
if (['create_estrategas_product', 'get_landing_sections', 'get_templates', 'generate_landing_banner', 'import_sections_to_droppage', 'upload_product_image'].includes(toolName)) {
  if (opts.onExecuteEstrategasTool) {
    result = await opts.onExecuteEstrategasTool(toolName, toolInput)
  } else {
    result = { success: false, error: 'EstrategasIA tools not configured' }
  }
}
// Handle DropPage tools
else if (toolName.startsWith('get_droppage_') || toolName.startsWith('create_droppage_') || toolName.startsWith('update_droppage_') || toolName === 'associate_droppage_product_design') {
  if (opts.onExecuteDropPageTool) {
    result = await opts.onExecuteDropPageTool(toolName, toolInput)
  } else {
    result = { success: false, error: 'DropPage tools not configured' }
  }
}
// Handle internal tools (not Meta API)
else if (toolName === 'get_my_products' && opts.onGetProducts) {
  // ... existing code
}
```

**IMPORTANT:** The `isWriteTool()` check already handles confirmation/auto-execute for write tools. Since we added the new write tools to `WRITE_TOOLS` in types.ts, they'll automatically get confirmation flow or auto-execute behavior.

### Step 3: Update chat route to instantiate clients

In `app/api/meta-ads/chat/route.ts`, add:

```typescript
import { DropPageClient } from '@/lib/meta-ads/droppage-client'
import { EstrategasToolsHandler } from '@/lib/meta-ads/estrategas-tools'
```

Inside the POST handler, after getting the user session, get the Supabase access token:

```typescript
// Get access token for SSO/internal tools
const { data: { session } } = await supabase.auth.getSession()
const supabaseAccessToken = session?.access_token || ''
```

Create the clients and pass to executeChat:

```typescript
const dropPageClient = new DropPageClient({ supabaseAccessToken })
const estrategasTools = new EstrategasToolsHandler({ userId: user.id, supabaseAccessToken })

// In executeChat call, add:
onExecuteEstrategasTool: async (toolName, toolInput) => {
  return estrategasTools.executeTool(toolName, toolInput)
},
onExecuteDropPageTool: async (toolName, toolInput) => {
  return dropPageClient.executeTool(toolName, toolInput)
},
```

### Step 4: Commit

```bash
git add lib/meta-ads/claude-executor.ts app/api/meta-ads/chat/route.ts
git commit -m "feat(meta-ads): route new tools to EstrategasIA + DropPage handlers"
```

---

## Task 5: Update System Prompt — Complete Agentic Flow

**Files:**
- Modify: `lib/meta-ads/system-prompt.ts`

### Step 1: Add the new Phase 2 flow to the system prompt

The system prompt needs a new section between "Paso 0" and the current "Paso 1". When the user chooses "Testear producto nuevo", Matías now asks about the landing FIRST:

**Add after Paso 0, before current Paso 1:**

```
### FLUJO DE LANDING PAGE (antes de crear campaña) — AUTOMÁTICO

Cuando el usuario quiere testear un producto nuevo y el destino es web, Matías crea TODO automáticamente.

#### Paso L1: ¿Tiene landing?
Pregunta: ¿Ya tienes una landing page para este producto?
- **Sí, ya tengo URL** → Pide la URL, guárdala, salta al Paso 1 (campaña)
- **Tengo landing en EstrategasIA** → Usa get_my_products + get_landing_sections para verificar que tiene banners. Si los tiene, importa directo a DropPage.
- **No tengo landing** → Continúa al Paso L2

#### Paso L2: Info del producto
Pide esta info (UNA pregunta a la vez):
1. Nombre del producto
2. Descripción — para quién es, qué problema resuelve, diferenciador
3. **Fotos del producto** — "Envíame 1-3 fotos del producto por este chat. Las necesito para generar los banners."
   - El usuario envía imágenes directamente en el chat
   - Usa upload_product_image para almacenar cada imagen
   - Necesitas MÍNIMO 1 foto para generar banners
4. Precio de venta y precio anterior (para banners de oferta)
5. País (para moneda y textos)
6. Colores/estilo (opcional) — "¿Tienes algún color de marca o preferencia? Si no, yo elijo."

#### Paso L3: Crear producto y generar banners AUTOMÁTICAMENTE
1. Usa create_estrategas_product para crear el registro
2. Usa get_templates para obtener las plantillas disponibles por categoría
3. SELECCIONA AUTOMÁTICAMENTE la mejor plantilla por categoría basándote en:
   - Tipo de producto (suplemento → salud, skincare → belleza, gadget → tech)
   - Estilo visual que mejor encaje con las fotos del producto
   - Diversidad: NO repetir la misma plantilla
4. Genera 5-7 banners llamando generate_landing_banner MÚLTIPLES VECES:
   - **OBLIGATORIOS** (siempre generar):
     - hero: banner principal con nombre y hook de venta
     - oferta: precios, descuento, llamado a acción
     - beneficios: 3-5 beneficios principales del producto
     - testimonios: reseñas sociales (generadas por IA)
     - logistica: envío gratis, contraentrega, garantía
   - **OPCIONALES** (según el producto):
     - antes_despues: si el producto tiene transformación visible
     - ingredientes: si es suplemento/cosmético
     - faq: preguntas frecuentes
     - modo_uso: instrucciones de uso
   - Para cada banner, escribe copies ÚNICOS basados en el producto
   - Usa diferentes ángulos de venta por banner
5. Muestra al usuario: "Generé X banners para tu landing: hero, oferta, beneficios, testimonios, logística. ¿Quieres que continúe o quieres ajustar algo?"

#### Paso L4: Armar landing en DropPage AUTOMÁTICAMENTE
1. Usa import_sections_to_droppage con TODOS los section_ids generados, en orden:
   hero (0) → oferta (1) → beneficios (2) → testimonios (3) → antes_despues (4) → ingredientes (5) → logistica (6) → faq (7)
2. La landing se ensambla automáticamente en DropPage

#### Paso L5: Dominio
1. Usa get_droppage_domains para listar los dominios del usuario
2. Muestra las opciones: "Tienes estos dominios configurados: [lista]. ¿Cuál quieres usar para esta landing?"
3. Si no tiene dominios: "No tienes dominios configurados. Puedes agregar uno en Ajustes de DropPage, o usamos el subdominio por defecto."
4. Crea el page design: create_droppage_page_design con el domain_id seleccionado

#### Paso L6: Producto en DropPage
1. Usa create_droppage_product para crear el producto con:
   - Precio de venta y precio anterior (tachado)
   - Código Dropi si usa Dropi para fulfillment (pregunta: "¿Tienes código de Dropi para este producto?")
   - Variantes si aplica (pregunta: "¿Tiene variantes como colores o tallas?")
2. Usa associate_droppage_product_design para vincular producto → landing

#### Paso L7: Checkout y ofertas
1. Configura checkout: update_droppage_checkout_config
   - País y departamentos excluidos (pregunta: "¿Hay departamentos/regiones donde NO envías?")
2. Ofertas de cantidad: create_droppage_quantity_offer
   - Estructura estándar dropshipping COD:
     - 1x: sin descuento
     - 2x: 10% descuento, label "MÁS VENDIDO", preseleccionado
     - 3x: 15% descuento, label "MEJOR OFERTA"
3. Pregunta: "¿Quieres configurar upsell (producto complementario) y downsell (oferta de salida)?"
   - Si sí → pide info del producto upsell, configura ambos
   - Si no → continúa

#### Paso L8: Verificar y continuar
1. Usa get_droppage_store_config para verificar pixel de Meta
2. Si no tiene pixel: pregunta el pixel_id y configura con update_droppage_store_config
3. Confirma la URL final: "Tu landing está lista en [URL]. ¿Quieres que proceda a crear la campaña de Meta Ads apuntando a esta URL?"
4. Continúa al Paso 1 del flujo de campaña de Meta Ads
```

**Also add to HERRAMIENTAS section:**

```
**EstrategasIA (gestión de productos, banners y landings):**
- get_my_products: productos del usuario
- create_estrategas_product: crear producto nuevo
- upload_product_image: registrar imagen del producto enviada por el chat
- get_templates: plantillas disponibles para banners (agrupadas por categoría)
- generate_landing_banner: generar un banner con IA (plantilla + fotos + copy). Llama MÚLTIPLES VECES para diferentes secciones.
- get_landing_sections: ver banners ya generados para un producto
- import_sections_to_droppage: enviar banners a DropPage para armar landing automáticamente

**DropPage — Lectura:**
- get_droppage_products: productos en la tienda
- get_droppage_page_designs: diseños de landing
- get_droppage_checkout_config: configuración del checkout
- get_droppage_quantity_offers: ofertas 2x, 3x
- get_droppage_upsells: upsells configurados
- get_droppage_downsells: downsells configurados
- get_droppage_domains: dominios del usuario (para seleccionar cuál usar)
- get_droppage_store_config: configuración general (pixel, WhatsApp, etc.)

**DropPage — Escritura (requieren confirmación):**
- create_droppage_product: crear producto en tienda
- create_droppage_page_design: crear landing y asociar dominio
- associate_droppage_product_design: vincular producto y landing
- update_droppage_checkout_config: configurar checkout y departamentos excluidos
- create_droppage_quantity_offer: crear oferta de cantidad (1x, 2x, 3x)
- create_droppage_upsell: crear upsell
- update_droppage_upsell_config: configurar upsells global
- create_droppage_downsell: crear downsell
- update_droppage_store_config: configurar tienda (pixel, colores, etc.)
```

### Step 2: Commit

```bash
git add lib/meta-ads/system-prompt.ts
git commit -m "feat(meta-ads): add Phase 2 agentic flow to system prompt (landing + droppage + campaign)"
```

---

## Task 6: Environment Variable Setup

**Files:**
- Verify: `.env.local` has `NEXT_PUBLIC_DROPPAGE_API_URL`

### Step 1: Add env var

The DropPage client needs to know the API URL. Add to `.env.local`:

```
NEXT_PUBLIC_DROPPAGE_API_URL=https://shopiestrategas-production.up.railway.app
```

And to Vercel environment variables for production.

### Step 2: Commit (no code change needed — just env var)

No commit needed since .env.local is gitignored. Just ensure the Vercel env var is set.

---

## Task 7: Test the Complete Flow

### Step 1: Verify TypeScript compiles

```bash
cd C:/Users/Asus/Downloads/estrategas-landing-generator && npm run build
```

Fix any type errors.

### Step 2: Test conversation flow

Simulate a conversation where:
1. User says "Quiero montar una campaña para vender gomitas de resveratrol"
2. Matías asks: ¿Testear, escalar u optimizar? → "Testear"
3. Matías asks: ¿Ya tienes landing? → "No"
4. Matías guides through product creation in EstrategasIA
5. Matías creates DropPage product + checkout + offers
6. Matías creates Meta campaign pointing to the landing URL

### Step 3: Final commit

```bash
git add -A
git commit -m "feat(meta-ads): Phase 2 complete — full agentic flow landing + droppage + meta campaign"
git push origin developers
```

---

## Summary of All New/Modified Files

| File | Type | Purpose |
|------|------|---------|
| `lib/meta-ads/droppage-client.ts` | NEW | DropPage API client with SSO auth |
| `lib/meta-ads/estrategas-tools.ts` | NEW | EstrategasIA tools: products, banner generation, image upload, import |
| `lib/meta-ads/tools.ts` | MODIFIED | +22 new tool definitions (including generate_landing_banner, upload_product_image) |
| `lib/meta-ads/types.ts` | MODIFIED | +22 tools in READ_ONLY_TOOLS/WRITE_TOOLS |
| `lib/meta-ads/claude-executor.ts` | MODIFIED | Route new tools to handlers |
| `lib/meta-ads/system-prompt.ts` | MODIFIED | Full automatic flow: info → banners → landing → DropPage → Meta |
| `app/api/meta-ads/chat/route.ts` | MODIFIED | Image upload, instantiate clients, pass to executor |
| `components/meta-ads/MetaAdsChat.tsx` | MODIFIED | Image attachment UI (clip button, preview strip) |

## What Matías DOES Automatically

1. **Generates banners** — selects templates por categoría, escribe copies, llama a generate_landing_banner
2. **Arma la landing** — importa banners a DropPage en orden, se ensambla automáticamente
3. **Crea producto en DropPage** — con precio, variantes, código Dropi
4. **Configura checkout** — ofertas 2x/3x, upsells, downsells
5. **Configura pixel** — si el usuario da el pixel_id
6. **Selecciona dominio** — lista los disponibles, pregunta cuál usar
7. **Monta campaña Meta** — todo el flujo completo apuntando a la URL final

## What the User MUST Do

1. **Enviar fotos del producto por el chat** — Matías las recibe y las usa
2. **Configurar DNS del dominio** — esto se hace fuera de la plataforma
3. **Configurar Dropi token** — en Ajustes de DropPage (una sola vez)
4. **Revisar y activar la campaña** — siempre se crea en PAUSED

## Task 8: Image Upload Support in Chat UI

**Files:**
- Modify: `components/meta-ads/MetaAdsChat.tsx`

### Step 1: Add image upload to the chat input

The chat textarea needs a button to attach images. When the user sends an image:
1. Upload to Supabase Storage (`landing-images/meta-ads/{userId}/{timestamp}.webp`)
2. Get the public URL
3. Send a message like "[Imagen del producto]" with the URL attached
4. The executor receives the image URL and calls `upload_product_image` internally

```typescript
// Add to MetaAdsChat.tsx state
const [attachedImages, setAttachedImages] = useState<string[]>([])
const fileInputRef = useRef<HTMLInputElement>(null)

// Add image upload handler
async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const files = e.target.files
  if (!files) return

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue

    // Convert to base64 for preview + upload
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setAttachedImages(prev => [...prev, dataUrl])
    }
    reader.readAsDataURL(file)
  }
}

// Modified sendMessage: include image URLs in the message payload
async function sendMessage() {
  const text = input.trim()
  if ((!text && attachedImages.length === 0) || isStreaming) return
  setInput('')

  // Send with images
  const messageText = attachedImages.length > 0
    ? `${text}\n\n[${attachedImages.length} imagen(es) del producto adjunta(s)]`
    : text

  const images = [...attachedImages]
  setAttachedImages([])
  sendChatMessage(messageText, images)
}

// Updated sendChatMessage signature
async function sendChatMessage(text: string, images?: string[]) {
  // Include images in fetch body
  body: JSON.stringify({
    conversation_id: conversationId,
    message: text,
    model: selectedModel,
    auto_execute: autoExecute,
    product_images: images || [],  // NEW: send image data URLs
  }),
}
```

Add UI for image attachment (clip icon button next to textarea) and image preview strip above the input.

### Step 2: Update chat API route to handle images

In `app/api/meta-ads/chat/route.ts`:

```typescript
const { conversation_id, message, model, auto_execute, product_images } = body

// Upload images to Supabase Storage and get public URLs
let imageUrls: string[] = []
if (product_images?.length > 0) {
  for (const imageData of product_images) {
    // Upload base64 to storage
    const base64Match = imageData.match(/^data:image\/\w+;base64,(.+)$/)
    if (base64Match) {
      const buffer = Buffer.from(base64Match[1], 'base64')
      const fileName = `meta-ads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      await serviceClient.storage.from('landing-images').upload(fileName, buffer, {
        contentType: 'image/webp',
        upsert: true,
      })
      const { data } = serviceClient.storage.from('landing-images').getPublicUrl(fileName)
      imageUrls.push(data.publicUrl)
    }
  }
}

// Pass image URLs to the EstrategasIA tools handler
const estrategasTools = new EstrategasToolsHandler({
  userId: user.id,
  supabaseAccessToken,
  productImageUrls: imageUrls,
})
```

### Step 3: Commit

```bash
git add components/meta-ads/MetaAdsChat.tsx app/api/meta-ads/chat/route.ts
git commit -m "feat(meta-ads): add image upload support in chat for product photos"
```

---

## Potential Phase 3 Additions (NOT in this plan)

- Per-user soul/memory system for Matías (recordar preferencias entre conversaciones)
- Dropi product search + auto-import (buscar en catálogo Dropi)
- Landing A/B testing automation
- Audio/voiceover generation for video ads
- Auto-publish from PAUSED to ACTIVE with scheduling
