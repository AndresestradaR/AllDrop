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