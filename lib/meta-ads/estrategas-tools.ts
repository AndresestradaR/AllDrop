// lib/meta-ads/estrategas-tools.ts
// Handles EstrategasIA internal tool calls for Matías agent
// NOTE: Cannot use createServiceClient() from server.ts because it depends on
// cookies() which is unavailable inside the ReadableStream SSE context.
// Instead we create a direct Supabase client with the service role key.

import { createClient } from '@supabase/supabase-js'

function createDirectServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

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
      const serviceClient = createDirectServiceClient()
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
      const serviceClient = createDirectServiceClient()
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
      const serviceClient = createDirectServiceClient()
      const { data: sections, error } = await serviceClient
        .from('landing_sections')
        .select('*')
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
      const serviceClient = createDirectServiceClient()
      const { data: templates, error } = await serviceClient
        .from('templates')
        .select('id, name, category, image_url')
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
        const serviceClient = createDirectServiceClient()
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000'

      const res = await fetch(`${baseUrl}/api/generate-landing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'X-Internal-User-Id': this.userId,
        },
        body: JSON.stringify({
          productId: input.product_id,
          productName: input.product_name,
          templateId: input.template_id,
          templateUrl: input.template_url,
          productPhotos,
          modelId: 'nano-banana-2',  // Default model with full cascade (KIE → fal → Gemini)
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

      const responseText = await res.text()
      console.log(`[EstrategasTools] generate-landing response: status=${res.status}, body=${responseText.substring(0, 500)}`)

      let data: any
      try {
        data = JSON.parse(responseText)
      } catch {
        return { success: false, error: `Invalid response from generate-landing: ${responseText.substring(0, 200)}` }
      }

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
      const serviceClient = createDirectServiceClient()

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
      const serviceClient = createDirectServiceClient()

      // If it's already a public URL, just store it
      if (input.image_data.startsWith('http')) {
        this.productImageUrls.push(input.image_data)
        return { success: true, data: { url: input.image_data, total_images: this.productImageUrls.length } }
      }

      // Upload base64 to Supabase Storage
      const timestamp = Date.now()
      const fileName = `meta-ads/${this.userId}/${timestamp}-product.webp`

      // Extract base64 data
      const base64Match = input.image_data.match(/^data:[^;]+;base64,(.+)$/)
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
