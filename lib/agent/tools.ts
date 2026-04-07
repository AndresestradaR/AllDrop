// Agent tool definitions and handlers for AllDrop AI Agent
// Tools use OpenAI function calling format (for OpenRouter compatibility)
// Handlers call internal API routes or Supabase directly

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    // Ensure www. prefix to avoid 307 redirect that loses POST body
    if (appUrl.includes('alldrop') && !appUrl.includes('www.')) {
      return appUrl
    }
    return appUrl
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function createDirectServiceClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ---- OpenAI function calling tool definitions ----

export const agentToolDefinitions = [
  // ==================== EXISTING TOOLS (kept) ====================
  {
    type: 'function' as const,
    function: {
      name: 'generate_sales_angles',
      description: 'Genera 6 ángulos de venta diversos para un producto. Cada ángulo incluye hook, descripción, avatar sugerido y tono.',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string', description: 'Nombre del producto' },
          productDescription: { type: 'string', description: 'Descripción del producto, beneficios y características' },
          targetCountry: { type: 'string', description: 'Código de país objetivo (ej: CO, MX, CL, PE)' },
          outputLanguage: { type: 'string', description: 'Idioma del output (ej: es, en, pt)' },
        },
        required: ['productName', 'productDescription'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_landing_copy',
      description: 'Genera copy para landing page por secciones. Devuelve texto listo para usar en cada sección solicitada.',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string', description: 'Nombre del producto' },
          salesAngle: { type: 'string', description: 'Ángulo de venta o hook base' },
          targetLanguage: { type: 'string', description: 'Idioma del copy (ej: es, en, pt)' },
          sections: {
            type: 'array',
            items: { type: 'string' },
            description: 'Secciones a generar (ej: hero, benefits, faq, testimonials, guarantee, cta)',
          },
        },
        required: ['productName', 'salesAngle', 'sections'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_costs',
      description: 'Calcula márgenes, ROI, punto de equilibrio y métricas financieras para un producto dropshipping.',
      parameters: {
        type: 'object',
        properties: {
          productCost: { type: 'number', description: 'Costo del producto del proveedor (en moneda local)' },
          shippingCost: { type: 'number', description: 'Costo de envío por unidad' },
          sellingPrice: { type: 'number', description: 'Precio de venta al cliente' },
          cpaEstimate: { type: 'number', description: 'CPA estimado (gasto en ads por venta)' },
        },
        required: ['productCost', 'shippingCost', 'sellingPrice', 'cpaEstimate'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description: 'Busca productos en el catálogo de inteligencia de producto. Devuelve datos de ventas, precios e info del proveedor.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Consulta de búsqueda (nombre, palabra clave o nicho)' },
          category: { type: 'string', description: 'Filtro por categoría (opcional)' },
          country: { type: 'string', description: 'Código de país para filtrar (ej: CO, MX)' },
          minSales: { type: 'number', description: 'Número mínimo de ventas para filtrar' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_ad_copy',
      description: 'Escribe 3 variaciones de copy publicitario para Meta (Facebook/Instagram) o TikTok. Cada variación incluye título, texto y CTA.',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string', description: 'Nombre del producto' },
          salesAngle: { type: 'string', description: 'Ángulo de venta o hook' },
          platform: { type: 'string', enum: ['meta', 'tiktok'], description: 'Plataforma (meta para Facebook/Instagram, tiktok para TikTok)' },
          language: { type: 'string', description: 'Idioma del copy (ej: es, en, pt)' },
        },
        required: ['productName', 'salesAngle', 'platform'],
      },
    },
  },

  // ==================== LANDING TOOLS (from estrategasia) ====================
  {
    type: 'function' as const,
    function: {
      name: 'get_my_products',
      description: 'Lista los productos del usuario en AllDrop (Landing Generator). Devuelve nombre, descripción, imagen y URL de landing.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_templates',
      description: 'Lista las plantillas de banner disponibles, agrupadas por categoría (hero, oferta, antes-despues, beneficios, testimonios, etc.). Usa esto para escoger la mejor plantilla por categoría.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_landing_sections',
      description: 'Lista las secciones de landing (banners) generadas para un producto. Cada sección es un banner con su categoría.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'ID del producto' },
        },
        required: ['product_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'execute_landing_pipeline',
      description: 'Creates a product and generates landing page banners. Call this when the user wants to create a landing. Templates are auto-selected. Banners generate in background (1-3 min each).',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'Product name' },
          product_description: { type: 'string', description: 'Product description' },
          section_types: { type: 'string', description: 'Comma-separated section types to generate. Default: hero,beneficios,faq. Options: hero, oferta, beneficios, testimonios, antes_despues, ingredientes, faq, modo_uso' },
          sales_angle: { type: 'string', description: 'Sales angle/hook for the banners' },
          target_avatar: { type: 'string', description: 'Target audience description' },
          price_after: { type: 'number', description: 'Precio de venta' },
          price_before: { type: 'number', description: 'Precio anterior (tachado)' },
          currency_symbol: { type: 'string', description: 'Símbolo moneda ($)' },
          target_country: { type: 'string', description: 'País (CO, MX, CL, etc.)' },
          colorPalette: {
            type: 'object',
            properties: {
              primary: { type: 'string', description: 'Color primario hex (ej: "#0F172A")' },
              secondary: { type: 'string', description: 'Color secundario hex (ej: "#3B82F6")' },
              accent: { type: 'string', description: 'Color acento hex (ej: "#10B981")' },
            },
            description: 'OBLIGATORIO: Paleta de colores con hex codes para consistencia visual.',
          },
          productContext: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Descripción vendedora (2-3 párrafos)' },
              benefits: { type: 'string', description: 'Beneficios principales (5-7)' },
              problems: { type: 'string', description: 'Problemas que resuelve (3-5)' },
              ingredients: { type: 'string', description: 'Ingredientes/materiales (si aplica)' },
              differentiator: { type: 'string', description: 'Diferenciador vs competencia' },
            },
            description: 'OBLIGATORIO: Contexto detallado del producto para los banners.',
          },
          typography: {
            type: 'object',
            properties: {
              headings: { type: 'string', description: 'Fuente para títulos. Default: "Montserrat"' },
              subheadings: { type: 'string', description: 'Fuente para subtítulos. Default: "Open Sans"' },
              body: { type: 'string', description: 'Fuente para texto. Default: "Open Sans"' },
            },
            description: 'Tipografía (opcional, tiene defaults).',
          },
          product_image_urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'OBLIGATORIO: URLs de las fotos del producto. Sin fotos la IA inventa un producto ficticio.',
          },
          existing_product_id: { type: 'string', description: 'ID producto existente (omitir para crear nuevo)' },
        },
        required: ['product_name', 'product_description', 'sections', 'product_details', 'colorPalette', 'productContext', 'product_image_urls'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_banner_status',
      description: 'Consulta el progreso de los banners en generación. Esperar 30-60 segundos entre consultas.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'ID del producto (de execute_landing_pipeline)' },
          total_expected: { type: 'number', description: 'Número total de banners disparados' },
          existing_before: { type: 'number', description: 'Secciones que existían antes del pipeline' },
        },
        required: ['product_id', 'total_expected', 'existing_before'],
      },
    },
  },

  // ==================== DROPPAGE / SHOP TOOLS ====================
  {
    type: 'function' as const,
    function: {
      name: 'get_droppage_stores',
      description: 'Lista los productos de la tienda DropPage/AllDrop Shop del usuario.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar producto por nombre' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'execute_droppage_setup',
      description: 'Ejecuta el setup COMPLETO de la tienda: crea producto, sube fotos, arma landing con banners, ofertas por cantidad, upsell, downsell, y configura checkout. Llama esto UNA SOLA VEZ con toda la info.',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'Nombre del producto' },
          product_description: { type: 'string', description: 'Descripción CORTA (1-2 oraciones)' },
          price: { type: 'number', description: 'Precio de venta (ej: 89900 para COP)' },
          compare_at_price: { type: 'number', description: 'Precio anterior (tachado)' },
          country: { type: 'string', description: 'País (CO, MX, CL, etc.)' },
          dropi_product_id: { type: 'string', description: 'ID producto Dropi' },
          variants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                variant_type: { type: 'string' },
                variant_value: { type: 'string' },
                price_override: { type: 'number' },
                dropi_variation_id: { type: 'string' },
              },
            },
            description: 'Variantes del producto',
          },
          product_image_urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs de las fotos del producto',
          },
          productContext: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              benefits: { type: 'string' },
              problems: { type: 'string' },
              ingredients: { type: 'string' },
              differentiator: { type: 'string' },
            },
            description: 'Contexto del producto (ficha creativa)',
          },
          estrategas_product_id: { type: 'string', description: 'ID del producto en AllDrop (de execute_landing_pipeline). Se usa para buscar banners automáticamente.' },
          page_title: { type: 'string', description: 'Título de la landing page' },
          domain_id: { type: 'string', description: 'ID del dominio' },
          cta_button_text: { type: 'string', description: 'Texto del botón CTA flotante. Default: "¡COMPRAR AHORA!"' },
          quantity_offers: {
            type: 'object',
            properties: {
              tiers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    quantity: { type: 'number' },
                    position: { type: 'number' },
                    is_preselected: { type: 'boolean' },
                    discount_type: { type: 'string', enum: ['percentage', 'fixed', 'none'] },
                    discount_value: { type: 'number' },
                    label_text: { type: 'string' },
                    total_price: { type: 'number', description: 'Precio total del tier. El pipeline calcula el descuento automáticamente.' },
                  },
                },
              },
            },
            description: 'Ofertas 1x, 2x, 3x',
          },
          upsell: {
            type: 'object',
            properties: {
              product_name: { type: 'string' },
              product_price: { type: 'number' },
              discount_type: { type: 'string' },
              discount_value: { type: 'number' },
              title: { type: 'string' },
            },
            description: 'Configuración upsell (omitir si no quiere)',
          },
          downsell: {
            type: 'object',
            properties: {
              discount_type: { type: 'string' },
              discount_value: { type: 'number' },
              title: { type: 'string' },
              subtitle: { type: 'string' },
            },
            description: 'Configuración downsell (omitir si no quiere)',
          },
          checkout_country: { type: 'string', description: 'País del checkout' },
          excluded_departments: { type: 'array', items: { type: 'string' }, description: 'Departamentos excluidos' },
          meta_pixel_id: { type: 'string', description: 'ID del pixel de Meta' },
          confirma_enabled: { type: 'boolean', description: 'Activar Confirma IA' },
          reorder_enabled: { type: 'boolean', description: 'Activar recompra automática' },
          reorder_days: { type: 'number', description: 'Días para recompra (ej: 28, 30)' },
        },
        required: ['product_name', 'price', 'page_title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_droppage_domains',
      description: 'Lista los dominios configurados en la tienda.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_droppage_store_config',
      description: 'Obtiene la configuración general de la tienda (nombre, colores, pixel, WhatsApp, moneda, etc.).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_droppage_page_designs',
      description: 'Lista los diseños de página (landings) existentes.',
      parameters: {
        type: 'object',
        properties: {
          page_type: { type: 'string', enum: ['home', 'product', 'custom'], description: 'Filtrar por tipo de página' },
        },
        required: [],
      },
    },
  },
]

// ---- Tool handler functions ----

export type ToolHandler = (args: any, headers: Record<string, string>, context: ToolContext) => Promise<string>

export interface ToolContext {
  userId: string
  supabaseAccessToken?: string
  conversationId?: string
  productImages?: string[]  // base64 images from chat
}

function buildInternalHeaders(headers: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (headers['cookie']) h['cookie'] = headers['cookie']
  if (headers['authorization']) h['authorization'] = headers['authorization']
  return h
}

function buildInternalAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Key': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
}

// ---- Existing tool handlers (kept as-is) ----

async function handleGenerateSalesAngles(args: any): Promise<string> {
  return JSON.stringify({
    instruction: `Generate exactly 6 diverse sales angles for "${args.productName}".`,
    productDescription: args.productDescription,
    targetCountry: args.targetCountry || 'ES',
    outputLanguage: args.outputLanguage || 'es',
    format: {
      angle: { name: 'short name', hook: 'max 80 chars', description: '1-2 sentences', avatarSuggestion: 'specific buyer profile', tone: 'one word' },
    },
    types: ['Transformation', 'Pain/Problem', 'Authority/Science', 'Urgency', 'Comparison', 'Social Proof'],
  })
}

async function handleGenerateLandingCopy(args: any): Promise<string> {
  const sections = args.sections || ['hero', 'benefits', 'faq']
  const language = args.targetLanguage || 'es'
  const result: Record<string, any> = {}
  for (const section of sections) {
    result[section] = generateCopyForSection(section, args.productName, args.salesAngle, language)
  }
  return JSON.stringify({
    productName: args.productName,
    salesAngle: args.salesAngle,
    language,
    sections: result,
  })
}

function generateCopyForSection(
  section: string, productName: string, salesAngle: string, language: string,
): Record<string, string> {
  const langLabel = language === 'es' ? 'Spanish' : language === 'pt' ? 'Portuguese' : 'English'
  const base = {
    section, productName, salesAngle, language: langLabel,
    instruction: `Generate compelling ${section} copy for "${productName}" using the angle: "${salesAngle}". Write in ${langLabel}.`,
  }
  switch (section) {
    case 'hero': return { ...base, fields: 'headline, subheadline, cta_button_text' }
    case 'benefits': return { ...base, fields: '5-7 key benefits with icons and short descriptions' }
    case 'faq': return { ...base, fields: '5-6 frequently asked questions with answers' }
    case 'testimonials': return { ...base, fields: '3-4 customer testimonial templates' }
    case 'guarantee': return { ...base, fields: 'guarantee headline, guarantee description, trust badges' }
    case 'cta': return { ...base, fields: 'final call to action headline, urgency text, button text' }
    default: return { ...base, fields: `content for ${section} section` }
  }
}

async function handleCalculateCosts(args: any): Promise<string> {
  const { productCost, shippingCost, sellingPrice, cpaEstimate } = args
  const totalCost = productCost + shippingCost + cpaEstimate
  const profitPerUnit = sellingPrice - totalCost
  const marginPercent = (profitPerUnit / sellingPrice) * 100
  const roi = (profitPerUnit / totalCost) * 100
  const breakEvenUnits = cpaEstimate > 0 && profitPerUnit > 0 ? Math.ceil(cpaEstimate / profitPerUnit) : 0
  const breakEvenRevenue = breakEvenUnits * sellingPrice

  return JSON.stringify({
    input: { productCost, shippingCost, sellingPrice, cpaEstimate },
    results: {
      totalCostPerUnit: Math.round(totalCost * 100) / 100,
      profitPerUnit: Math.round(profitPerUnit * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      breakEvenUnits: breakEvenUnits > 0 ? breakEvenUnits : 'N/A (negative margin)',
      breakEvenRevenue: breakEvenUnits > 0 ? Math.round(breakEvenRevenue * 100) / 100 : 'N/A',
      verdict:
        profitPerUnit <= 0 ? 'NOT PROFITABLE - costs exceed selling price'
          : marginPercent < 20 ? 'LOW MARGIN - consider increasing price or reducing costs'
            : marginPercent < 40 ? 'ACCEPTABLE MARGIN - viable product'
              : 'GOOD MARGIN - strong profitability',
    },
  })
}

async function handleSearchProducts(args: any, headers: Record<string, string>): Promise<string> {
  try {
    const params = new URLSearchParams()
    if (args.query) params.set('q', args.query)
    if (args.category) params.set('category', args.category)
    if (args.country) params.set('country', args.country)
    if (args.minSales) params.set('minSales', String(args.minSales))

    const res = await fetch(`${getBaseUrl()}/api/productos/search?${params.toString()}`, {
      method: 'GET',
      headers: buildInternalHeaders(headers),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return JSON.stringify({ error: `Product search failed (${res.status}): ${errText}` })
    }

    const data = await res.json()
    const products = Array.isArray(data) ? data.slice(0, 10) : data.products?.slice(0, 10) || data
    return JSON.stringify({ products, total: Array.isArray(data) ? data.length : data.total || 0 })
  } catch (err: any) {
    return JSON.stringify({ error: `search_products failed: ${err.message}` })
  }
}

async function handleWriteAdCopy(args: any): Promise<string> {
  const { productName, salesAngle, platform, language } = args
  const lang = language || 'es'
  const plat = platform || 'meta'

  return JSON.stringify({
    productName, salesAngle, platform: plat, language: lang,
    instruction: `Generate 3 ad copy variations for "${productName}" on ${plat === 'meta' ? 'Facebook/Instagram' : 'TikTok'} using the angle: "${salesAngle}". Language: ${lang}.`,
    format: {
      variation: {
        headline: 'short attention-grabbing headline',
        body: plat === 'meta' ? 'persuasive body text (100-150 words)' : 'short punchy text (under 80 words)',
        cta: 'call to action button text',
      },
      count: 3,
    },
    platformTips: plat === 'meta'
      ? 'Use emotional triggers, social proof, and urgency.'
      : 'Short, punchy, trending-style copy. Hook in first line.',
  })
}

// ---- NEW Landing tool handlers ----

async function handleGetMyProducts(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  try {
    const serviceClient = createDirectServiceClient()
    const { data: products, error } = await serviceClient
      .from('products')
      .select('id, name, description, image_url, created_at')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })

    if (error) return JSON.stringify({ success: false, error: error.message })

    return JSON.stringify({
      success: true,
      data: (products || []).map((p: any) => ({
        id: p.id,
        nombre: p.name,
        descripcion: p.description,
        imagen: p.image_url,
      })),
    })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

async function handleGetTemplates(): Promise<string> {
  try {
    const serviceClient = createDirectServiceClient()
    const { data: templates, error } = await serviceClient
      .from('templates')
      .select('id, name, category, image_url')
      .eq('is_active', true)
      .order('category', { ascending: true })

    if (error) return JSON.stringify({ success: false, error: error.message })

    const grouped: Record<string, any[]> = {}
    for (const t of templates || []) {
      if (!grouped[t.category]) grouped[t.category] = []
      grouped[t.category].push(t)
    }

    return JSON.stringify({ success: true, data: { templates: templates || [], by_category: grouped } })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

async function handleGetLandingSections(args: any): Promise<string> {
  try {
    const serviceClient = createDirectServiceClient()
    const { data: sections, error } = await serviceClient
      .from('landing_sections')
      .select('*')
      .eq('product_id', args.product_id)
      .order('created_at', { ascending: true })

    if (error) return JSON.stringify({ success: false, error: error.message })
    return JSON.stringify({ success: true, data: sections || [] })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

async function handleExecuteLandingPipeline(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  // This tool creates the product and fires banner generation via /api/generate-landing
  // It returns immediately — banners generate in background
  try {
    const serviceClient = createDirectServiceClient()

    // Step 0: Get product image URLs — already uploaded to Storage by chat endpoint
    let productImageUrls: string[] = args.product_image_urls || []
    if (productImageUrls.length === 0 && context.productImages && context.productImages.length > 0) {
      // context.productImages contains URLs (uploaded by chat endpoint), not base64
      productImageUrls = context.productImages.filter((url: string) => url.startsWith('http'))
      console.log(`[AgentPipeline] Using ${productImageUrls.length} image URLs from conversation`)
    }

    // Step 1: Create or use existing product
    let productId = args.existing_product_id || ''
    if (!productId) {
      const imageUrl = productImageUrls.length > 0 ? productImageUrls[0] : null
      const { data: product, error } = await serviceClient
        .from('products')
        .insert({
          user_id: context.userId,
          name: args.product_name,
          description: args.product_description || null,
          image_url: imageUrl,
        })
        .select('id, name')
        .single()

      if (error) return JSON.stringify({ success: false, error: `Error creando producto: ${error.message}` })
      productId = product.id
    }

    // Step 1.5: Persist productContext, colorPalette, pricing to product
    try {
      const updateData: Record<string, any> = {}
      if (args.productContext) updateData.product_context = args.productContext
      if (args.colorPalette) updateData.color_palette = args.colorPalette
      if (args.target_country) updateData.target_country = args.target_country
      if (args.price_after || args.price_before) {
        updateData.pricing = {
          priceAfter: args.price_after,
          priceBefore: args.price_before,
          currencySymbol: args.currency_symbol || '$',
        }
      }
      if (args.product_image_urls?.length > 0) {
        updateData.product_photos = args.product_image_urls
      }
      if (Object.keys(updateData).length > 0) {
        await serviceClient.from('products').update(updateData).eq('id', productId)
      }
    } catch (e: any) {
      console.warn('[LandingPipeline] Failed to persist settings:', e.message)
    }

    // Step 1.8: Parse section types from simple string
    let defaultTemplateId = ''
    let defaultTemplateUrl = ''
    const sectionTypesStr = args.section_types || 'hero,beneficios,faq'
    const sections = sectionTypesStr.split(',').map((s: string) => ({
      type: s.trim(),
      template_id: '',
      template_url: '',
    }))
    const needsTemplate = sections.some((s: any) => !s.template_url)
    if (needsTemplate) {
      const { data: templates } = await serviceClient
        .from('templates')
        .select('id, image_url')
        .eq('is_active', true)
        .limit(1)
      if (templates && templates.length > 0) {
        defaultTemplateId = templates[0].id
        defaultTemplateUrl = templates[0].image_url
        console.log(`[AgentPipeline] Auto-selected template: ${defaultTemplateId}`)
      }
    }

    // Fill in missing template URLs
    for (const section of sections) {
      if (!section.template_url && defaultTemplateUrl) {
        section.template_url = defaultTemplateUrl
        section.template_id = defaultTemplateId
      }
    }

    // Step 2: Count existing sections BEFORE firing
    const { data: existingBefore } = await serviceClient
      .from('landing_sections')
      .select('id')
      .eq('product_id', productId)
      .eq('status', 'completed')
    const existingCount = existingBefore?.length || 0

    // Step 3: Fire ALL banners in batches (fire-and-forget)
    const baseUrl = getBaseUrl()
    const BATCH_SIZE = 4
    const STAGGER_WITHIN_BATCH_MS = 5000

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      console.log(`[AgentPipeline] Firing banner ${i + 1}/${sections.length}: ${section.type}`)

      // Fire WITHOUT await
      fetch(`${baseUrl}/api/generate-landing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'X-Internal-User-Id': context.userId,
        },
        body: JSON.stringify({
          productId: productId,
          productName: args.product_name,
          templateId: section.template_id,
          templateUrl: section.template_url,
          productPhotos: productImageUrls,
          modelId: 'nano-banana-2',
          outputSize: '1080x1920',
          ...(args.colorPalette && { colorPalette: args.colorPalette }),
          ...(args.productContext && { productContext: args.productContext }),
          ...(args.typography && { typography: args.typography }),
          creativeControls: {
            sectionType: section.type,
            productDetails: args.product_details || '',
            salesAngle: args.sales_angle || '',
            targetAvatar: args.target_avatar || '',
            additionalInstructions: args.additional_instructions || '',
            currencySymbol: args.currency_symbol || '$',
            priceAfter: args.price_after,
            priceBefore: args.price_before,
            targetCountry: args.target_country,
          },
        }),
      }).catch(e => console.error(`[AgentPipeline] Banner ${section.type} fire error:`, e.message))

      // Stagger within batch
      if (i < sections.length - 1 && (i % BATCH_SIZE) < BATCH_SIZE - 1) {
        await new Promise(resolve => setTimeout(resolve, STAGGER_WITHIN_BATCH_MS))
      } else if (i < sections.length - 1) {
        // Longer pause between batches
        await new Promise(resolve => setTimeout(resolve, 15000))
      }
    }

    return JSON.stringify({
      success: true,
      product_id: productId,
      total_banners: sections.length,
      existing_before: existingCount,
      message: `Producto creado. ${sections.length} banners disparados en segundo plano. Usa check_banner_status para consultar progreso.`,
    })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

async function handleCheckBannerStatus(args: any): Promise<string> {
  try {
    const serviceClient = createDirectServiceClient()
    const { data: sections, error } = await serviceClient
      .from('landing_sections')
      .select('id, status, section_type, generated_image_url')
      .eq('product_id', args.product_id)
      .order('created_at', { ascending: true })

    if (error) return JSON.stringify({ success: false, error: error.message })

    const allSections = sections || []
    // Only count sections created AFTER the pipeline started
    const newSections = allSections.slice(args.existing_before || 0)
    const completed = newSections.filter((s: any) => s.status === 'completed')
    const failed = newSections.filter((s: any) => s.status === 'failed')
    const processing = newSections.filter((s: any) => s.status === 'processing' || s.status === 'pending')

    const totalExpected = args.total_expected || 0
    const allDone = completed.length + failed.length >= totalExpected

    return JSON.stringify({
      success: true,
      data: {
        total_expected: totalExpected,
        completed: completed.length,
        failed: failed.length,
        processing: processing.length,
        all_done: allDone,
        completed_sections: completed.map((s: any) => ({
          id: s.id,
          type: s.section_type,
          image_url: s.generated_image_url,
        })),
        message: allDone
          ? `¡Todos los banners listos! ${completed.length} completados, ${failed.length} fallidos.`
          : `${completed.length}/${totalExpected} banners completados. ${processing.length} en proceso. Espera 30-60 segundos y vuelve a consultar.`,
      },
    })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

// ---- DropPage tool handlers ----

async function handleGetDroppageStores(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  // DropPage is at a separate domain — we need SSO auth
  // For now, return a message explaining the user needs to use the constructor directly
  // TODO: implement SSO bridge when DropPage API is directly callable
  try {
    const DROPPAGE_API = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://alldrop-shop-production.up.railway.app'

    // Try SSO auth if we have an access token
    if (!context.supabaseAccessToken) {
      return JSON.stringify({
        success: false,
        error: 'No se pudo autenticar con la tienda. Asegúrate de estar logueado.',
      })
    }

    // SSO: exchange Supabase token for DropPage JWT
    const ssoRes = await fetch(`${DROPPAGE_API}/api/auth/sso/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: context.supabaseAccessToken }),
    })

    if (!ssoRes.ok) {
      return JSON.stringify({ success: false, error: 'SSO authentication failed with shop API' })
    }

    const ssoData = await ssoRes.json()
    const shopToken = ssoData.access_token

    // Now fetch products
    const search = args.search ? `?search=${encodeURIComponent(args.search)}` : ''
    const productsRes = await fetch(`${DROPPAGE_API}/api/admin/products${search}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${shopToken}`,
      },
    })

    if (!productsRes.ok) {
      return JSON.stringify({ success: false, error: `Shop API error: ${productsRes.status}` })
    }

    const products = await productsRes.json()
    return JSON.stringify({ success: true, data: products })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

async function handleExecuteDroppageSetup(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  // This calls the DropPage pipeline via SSO
  try {
    const DROPPAGE_API = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://alldrop-shop-production.up.railway.app'

    if (!context.supabaseAccessToken) {
      return JSON.stringify({ success: false, error: 'No se pudo autenticar con la tienda.' })
    }

    // SSO auth
    const ssoRes = await fetch(`${DROPPAGE_API}/api/auth/sso/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: context.supabaseAccessToken }),
    })

    if (!ssoRes.ok) {
      return JSON.stringify({ success: false, error: 'SSO authentication failed' })
    }

    const ssoData = await ssoRes.json()
    const shopToken = ssoData.access_token
    const authHeader = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${shopToken}` }

    const errors: string[] = []

    // Fix types — LLM sometimes sends strings instead of numbers
    if (typeof args.price === 'string') args.price = Number(args.price) || 0
    if (typeof args.compare_at_price === 'string') args.compare_at_price = Number(args.compare_at_price) || undefined

    // Step 1: Create product
    const productRes = await fetch(`${DROPPAGE_API}/api/admin/products`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: args.product_name,
        description: args.product_description || '',
        price: args.price,
        compare_at_price: args.compare_at_price,
        country: args.country,
        dropi_product_id: args.dropi_product_id,
        variants: args.variants,
        domain_id: args.domain_id,
        confirma_enabled: args.confirma_enabled,
        reorder_enabled: args.reorder_enabled,
        reorder_days: args.reorder_days,
      }),
    })

    if (!productRes.ok) {
      const err = await productRes.json().catch(() => ({}))
      return JSON.stringify({ success: false, error: `Error creando producto: ${err.detail || productRes.statusText}` })
    }

    const productData = await productRes.json()
    const productId = productData.id

    // Step 1.5: Upload product images
    if (args.product_image_urls?.length) {
      for (const imgUrl of args.product_image_urls) {
        try {
          await fetch(`${DROPPAGE_API}/api/admin/products/${productId}/images/from-url`, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ image_url: imgUrl, alt_text: args.product_name }),
          })
        } catch (e: any) {
          errors.push(`Foto: ${e.message}`)
        }
      }
    }

    // Step 2: Create page design
    let designId = ''
    let designSlug = ''
    const designRes = await fetch(`${DROPPAGE_API}/api/admin/page-designs`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        page_type: 'product',
        title: args.page_title,
        product_id: productId,
        domain_id: args.domain_id,
      }),
    })

    if (designRes.ok) {
      const designData = await designRes.json()
      designId = designData.id
      designSlug = designData.slug || ''
    } else {
      errors.push(`Landing: ${designRes.statusText}`)
    }

    // Step 2.5: Auto-fetch section images from DB and populate landing
    if (designId) {
      // Associate product
      await fetch(`${DROPPAGE_API}/api/admin/page-designs/${designId}/associate-product`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ product_id: productId }),
      })

      // Get banner images
      let sectionImageUrls = args.section_image_urls || []
      if (sectionImageUrls.length === 0 && args.estrategas_product_id) {
        try {
          const serviceClient = createDirectServiceClient()
          const { data: sections } = await serviceClient
            .from('landing_sections')
            .select('generated_image_url')
            .eq('product_id', args.estrategas_product_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: true })

          if (sections?.length) {
            sectionImageUrls = sections
              .map((s: any) => s.generated_image_url)
              .filter((url: any) => url && url.startsWith('http'))
          }
        } catch (e: any) {
          console.warn('[AgentDropPage] Failed to auto-fetch sections:', e.message)
        }
      }

      // Build GrapesJS data and update design
      if (sectionImageUrls.length > 0) {
        const ctaText = args.cta_button_text || '¡COMPRAR AHORA!'
        const imageComponents = sectionImageUrls.map((url: string, i: number) => ({
          type: 'image', tagName: 'img',
          attributes: { src: url, alt: `Seccion ${i + 1} - ${args.product_name}` },
          style: { width: '100%', 'max-width': '100%', display: 'block', margin: '0 auto' },
        }))

        const ctaComponent = {
          type: 'default', tagName: 'div',
          attributes: { 'data-cta-floating': 'true' },
          style: { background: '#111', padding: '12px 16px', 'font-family': 'Inter, sans-serif' },
          components: [{
            type: 'link', tagName: 'a',
            attributes: { href: '#checkout' },
            classes: ['anim-shake'],
            components: [{ type: 'textnode', content: ctaText }],
            style: {
              display: 'block', background: '#4DBEA4', color: '#fff', padding: '16px',
              'border-radius': '10px', 'font-size': '18px', 'font-weight': '700',
              'text-decoration': 'none', 'text-align': 'center',
              'box-shadow': '0 4px 15px rgba(77,190,164,0.4)', 'animation-duration': '1.5s',
            },
          }],
        }

        const grapesjs_data = {
          pages: [{ id: 'page-1', frames: [{ id: 'frame-1', component: { type: 'wrapper', components: [...imageComponents, ctaComponent] } }] }],
          assets: sectionImageUrls.map((url: string) => ({ src: url, type: 'image' })),
          styles: [],
        }

        await fetch(`${DROPPAGE_API}/api/admin/page-designs/${designId}`, {
          method: 'PUT',
          headers: authHeader,
          body: JSON.stringify({
            grapesjs_data,
            html_content: [
              ...sectionImageUrls.map((url: string) => `<img src="${url}" alt="${args.product_name}" style="width:100%;max-width:100%;display:block;margin:0 auto;" />`),
              `<div data-cta-floating style="background:#111;padding:12px 16px;"><a href="#checkout" class="anim-shake" style="display:block;background:#4DBEA4;color:#fff;padding:16px;border-radius:10px;font-size:18px;font-weight:700;text-decoration:none;text-align:center;">${ctaText}</a></div>`,
            ].join('\n'),
            css_content: 'body{margin:0;padding:0;} img{max-width:100%;} @keyframes cta-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}30%{transform:translateX(6px)}45%{transform:translateX(-4px)}60%{transform:translateX(3px)}} .anim-shake{animation:cta-shake 1.5s ease-in-out infinite;}',
            is_published: true,
            product_metadata: {
              product_name: args.product_name,
              product_photos: args.product_image_urls || [],
              product_context: args.productContext || {},
              country: args.country || 'CO',
              cta_text: ctaText,
              section_count: sectionImageUrls.length,
              generated_by: 'agent_pipeline',
            },
          }),
        })
      }
    }

    // Step 3: Quantity offers
    let offerId = ''
    if (args.quantity_offers?.tiers?.length) {
      const tiers = (Array.isArray(args.quantity_offers) ? args.quantity_offers : args.quantity_offers.tiers) as any[]
      const processedTiers = tiers.map((tier: any) => {
        const { total_price, ...rest } = tier
        if (total_price != null && tier.quantity > 0 && args.price > 0) {
          const pricePerUnit = total_price / tier.quantity
          const discountPerUnit = Math.max(0, args.price - pricePerUnit)
          if (discountPerUnit === 0) return { ...rest, discount_type: 'none', discount_value: 0 }
          return { ...rest, discount_type: 'fixed', discount_value: Math.ceil(discountPerUnit) }
        }
        return rest
      })

      const offerRes = await fetch(`${DROPPAGE_API}/api/admin/checkout/offers`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          name: `Ofertas ${args.product_name}`,
          is_active: true,
          product_ids: [productId],
          tiers: processedTiers,
        }),
      })

      if (offerRes.ok) {
        const offerData = await offerRes.json()
        offerId = offerData.id
      } else {
        errors.push(`Ofertas: ${offerRes.statusText}`)
      }
    }

    // Step 4: Upsell
    if (args.upsell) {
      const upsellRes = await fetch(`${DROPPAGE_API}/api/admin/upsells`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          name: `Upsell ${args.upsell.product_name}`,
          is_active: true,
          discount_type: args.upsell.discount_type,
          discount_value: args.upsell.discount_value,
          title: args.upsell.title,
        }),
      })
      if (!upsellRes.ok) errors.push(`Upsell: ${upsellRes.statusText}`)
    }

    // Step 5: Downsell
    if (args.downsell) {
      const downsellRes = await fetch(`${DROPPAGE_API}/api/admin/downsells`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          name: `Downsell ${args.product_name}`,
          is_active: true,
          discount_type: args.downsell.discount_type,
          discount_value: args.downsell.discount_value,
          title: args.downsell.title,
          subtitle: args.downsell.subtitle,
        }),
      })
      if (!downsellRes.ok) errors.push(`Downsell: ${downsellRes.statusText}`)
    }

    // Step 6: Checkout config
    if (args.checkout_country) {
      await fetch(`${DROPPAGE_API}/api/admin/checkout-config`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({
          country: args.checkout_country,
          excluded_departments: args.excluded_departments,
        }),
      })
    }

    // Step 7: Store config (pixel)
    if (args.meta_pixel_id) {
      await fetch(`${DROPPAGE_API}/api/admin/config`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ meta_pixel_id: args.meta_pixel_id }),
      })
    }

    // Build landing URL
    let landingUrl = ''
    if (designSlug) {
      if (args.domain_id) {
        try {
          const domainsRes = await fetch(`${DROPPAGE_API}/api/admin/domains`, { headers: authHeader })
          if (domainsRes.ok) {
            const domains = await domainsRes.json()
            const items = domains.items || domains || []
            const match = items.find((d: any) => d.id === args.domain_id)
            if (match) landingUrl = `https://${match.domain || match.hostname}/landing/${designSlug}`
          }
        } catch { /* ignore */ }
      }
      if (!landingUrl) landingUrl = `/landing/${designSlug}`
    }

    return JSON.stringify({
      success: errors.length === 0,
      product_id: productId,
      design_id: designId,
      design_slug: designSlug,
      landing_url: landingUrl,
      offer_id: offerId,
      errors,
      message: errors.length === 0
        ? `Tienda configurada exitosamente. Landing: ${landingUrl}`
        : `Tienda configurada con ${errors.length} error(es): ${errors.join(', ')}`,
    })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

async function handleGetDroppageDomains(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  return handleDroppageGet('/api/admin/domains', context)
}

async function handleGetDroppageStoreConfig(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  return handleDroppageGet('/api/admin/config', context)
}

async function handleGetDroppagePageDesigns(args: any, headers: Record<string, string>, context: ToolContext): Promise<string> {
  const params = args.page_type ? `?page_type=${args.page_type}` : ''
  return handleDroppageGet(`/api/admin/page-designs${params}`, context)
}

// Generic DropPage GET helper with SSO
async function handleDroppageGet(path: string, context: ToolContext): Promise<string> {
  try {
    const DROPPAGE_API = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://alldrop-shop-production.up.railway.app'

    if (!context.supabaseAccessToken) {
      return JSON.stringify({ success: false, error: 'No se pudo autenticar con la tienda.' })
    }

    const ssoRes = await fetch(`${DROPPAGE_API}/api/auth/sso/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: context.supabaseAccessToken }),
    })

    if (!ssoRes.ok) {
      return JSON.stringify({ success: false, error: 'SSO authentication failed' })
    }

    const ssoData = await ssoRes.json()

    const res = await fetch(`${DROPPAGE_API}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ssoData.access_token}`,
      },
    })

    if (!res.ok) {
      return JSON.stringify({ success: false, error: `Shop API error: ${res.status}` })
    }

    const data = await res.json()
    return JSON.stringify({ success: true, data })
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message })
  }
}

// ---- Tool executor ----

export const toolHandlers: Record<string, ToolHandler> = {
  generate_sales_angles: (args) => handleGenerateSalesAngles(args),
  generate_landing_copy: (args, headers) => handleGenerateLandingCopy(args),
  calculate_costs: (args) => handleCalculateCosts(args),
  search_products: (args, headers) => handleSearchProducts(args, headers),
  write_ad_copy: (args) => handleWriteAdCopy(args),
  // Landing tools
  get_my_products: (args, headers, ctx) => handleGetMyProducts(args, headers, ctx),
  get_templates: () => handleGetTemplates(),
  get_landing_sections: (args) => handleGetLandingSections(args),
  execute_landing_pipeline: (args, headers, ctx) => handleExecuteLandingPipeline(args, headers, ctx),
  check_banner_status: (args) => handleCheckBannerStatus(args),
  // DropPage tools
  get_droppage_stores: (args, headers, ctx) => handleGetDroppageStores(args, headers, ctx),
  execute_droppage_setup: (args, headers, ctx) => handleExecuteDroppageSetup(args, headers, ctx),
  get_droppage_domains: (args, headers, ctx) => handleGetDroppageDomains(args, headers, ctx),
  get_droppage_store_config: (args, headers, ctx) => handleGetDroppageStoreConfig(args, headers, ctx),
  get_droppage_page_designs: (args, headers, ctx) => handleGetDroppagePageDesigns(args, headers, ctx),
}

export async function executeToolCall(
  toolName: string,
  argsJson: string,
  requestHeaders: Record<string, string>,
  context: ToolContext,
): Promise<string> {
  const handler = toolHandlers[toolName]
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  try {
    const args = JSON.parse(argsJson)
    return await handler(args, requestHeaders, context)
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to execute ${toolName}: ${err.message}` })
  }
}
