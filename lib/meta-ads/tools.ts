// Meta Ads AI Manager — Tool definitions for Anthropic API

// Phase-based tool pruning — only send relevant tools per conversation phase
export type AgentPhase = 'initial' | 'landing_creation' | 'droppage_setup' | 'meta_ads'

// Tools needed per phase (names only — matched against META_ADS_TOOLS)
const PHASE_TOOLS: Record<AgentPhase, string[]> = {
  // Initial: basic discovery + landing start
  initial: [
    'get_ad_accounts', 'get_my_products', 'get_pages',
    'create_estrategas_product', 'upload_product_image', 'get_templates',
    'generate_landing_banner', 'get_landing_sections', 'import_sections_to_droppage',
    'execute_landing_pipeline', 'execute_droppage_setup',
    'get_droppage_domains', 'get_droppage_products',
  ],
  // Landing creation: banner generation + import
  landing_creation: [
    'get_my_products', 'create_estrategas_product', 'upload_product_image',
    'get_templates', 'generate_landing_banner', 'get_landing_sections',
    'import_sections_to_droppage',
    'execute_landing_pipeline',
    'get_droppage_domains', 'get_droppage_products', 'get_droppage_page_designs',
    'create_droppage_product', 'create_droppage_page_design',
    'associate_droppage_product_design',
  ],
  // DropPage setup: product, checkout, offers
  droppage_setup: [
    'get_droppage_products', 'get_droppage_page_designs', 'get_droppage_checkout_config',
    'get_droppage_quantity_offers', 'get_droppage_upsells', 'get_droppage_downsells',
    'get_droppage_domains', 'get_droppage_store_config',
    'create_droppage_product', 'create_droppage_page_design',
    'associate_droppage_product_design', 'update_droppage_checkout_config',
    'create_droppage_quantity_offer', 'create_droppage_upsell',
    'update_droppage_upsell_config', 'create_droppage_downsell',
    'update_droppage_store_config',
    'execute_droppage_setup',
    'get_ad_accounts', 'get_pages', 'get_pixels',
  ],
  // Meta Ads: campaign creation + optimization
  meta_ads: [
    'get_ad_accounts', 'get_campaigns', 'get_adsets', 'get_ads',
    'get_insights', 'get_ad_creative', 'search_targeting',
    'get_pages', 'get_instagram_accounts', 'get_phone_numbers', 'get_pixels',
    'create_campaign', 'create_adset', 'create_ad',
    'update_budget', 'toggle_status', 'update_targeting',
    'get_my_products', 'get_droppage_store_config',
  ],
}

export function getToolsForPhase(phase: AgentPhase) {
  const allowedNames = PHASE_TOOLS[phase]
  return META_ADS_TOOLS.filter(t => allowedNames.includes(t.name))
}

export const META_ADS_TOOLS = [
  // ==================== READ-ONLY TOOLS ====================
  {
    name: 'get_ad_accounts',
    description: 'Lista las cuentas publicitarias de Meta del usuario. Usa esto primero para saber qué cuentas tiene.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_campaigns',
    description: 'Lista las campañas de una cuenta publicitaria. Puedes filtrar por estado (ACTIVE, PAUSED, o ALL).',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria (ej: act_123456)' },
        status_filter: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'ALL'], description: 'Filtrar por estado. Default: ALL' },
        limit: { type: 'number', description: 'Número máximo de resultados. Default: 25' },
      },
      required: ['ad_account_id'],
    },
  },
  {
    name: 'get_adsets',
    description: 'Lista los conjuntos de anuncios (adsets). Puedes buscar por campaña o por cuenta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'ID de la campaña para filtrar sus adsets' },
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria para listar todos los adsets' },
        status_filter: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'ALL'], description: 'Filtrar por estado' },
      },
      required: [],
    },
  },
  {
    name: 'get_ads',
    description: 'Lista los anuncios individuales. Puedes buscar por adset, campaña o cuenta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        adset_id: { type: 'string', description: 'ID del adset para filtrar sus anuncios' },
        campaign_id: { type: 'string', description: 'ID de la campaña' },
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria' },
        status_filter: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'ALL'], description: 'Filtrar por estado' },
      },
      required: [],
    },
  },
  {
    name: 'get_insights',
    description: 'Obtiene métricas de rendimiento (CPA, ROAS, CTR, gasto, impresiones, etc.) de una cuenta, campaña, adset o anuncio. Esta es la herramienta más importante para análisis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_id: { type: 'string', description: 'ID del objeto (cuenta, campaña, adset o ad)' },
        object_type: { type: 'string', enum: ['account', 'campaign', 'adset', 'ad'], description: 'Tipo de objeto' },
        date_preset: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_month', 'last_month', 'last_7d', 'last_14d', 'last_30d', 'last_90d'],
          description: 'Periodo predefinido. No usar junto con time_range.',
        },
        time_range: {
          type: 'object',
          properties: {
            since: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
            until: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
          },
          description: 'Rango de fechas personalizado. No usar junto con date_preset.',
        },
        breakdowns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Desglosar por: country, age, gender, placement, device_platform, etc.',
        },
        level: {
          type: 'string',
          enum: ['account', 'campaign', 'adset', 'ad'],
          description: 'Nivel de agregación cuando consultas una cuenta. Ej: level=campaign para ver métricas por campaña.',
        },
      },
      required: ['object_id', 'object_type'],
    },
  },
  {
    name: 'get_ad_creative',
    description: 'Obtiene los detalles de un creativo específico (texto, imagen, CTA, URL).',
    input_schema: {
      type: 'object' as const,
      properties: {
        creative_id: { type: 'string', description: 'ID del creativo' },
      },
      required: ['creative_id'],
    },
  },
  {
    name: 'search_targeting',
    description: 'Busca opciones de targeting (intereses, comportamientos, demografía) para usar en adsets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Término de búsqueda (ej: "fitness", "dropshipping", "belleza")' },
        type: {
          type: 'string',
          enum: ['adinterest', 'adTargetingCategory', 'adgeolocation'],
          description: 'Tipo de targeting a buscar',
        },
      },
      required: ['query'],
    },
  },

  // ==================== META ACCOUNT TOOLS ====================
  {
    name: 'get_pages',
    description: 'Lista las páginas de Facebook del usuario. Necesario para saber qué página asociar a campañas y anuncios.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_instagram_accounts',
    description: 'Lista las cuentas de Instagram conectadas a las páginas de Facebook del usuario.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: { type: 'string', description: 'ID de la página de Facebook para buscar su Instagram conectado' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'get_phone_numbers',
    description: 'Lista los números de teléfono de WhatsApp Business asociados a la cuenta del usuario. Útil para campañas de WhatsApp.',
    input_schema: {
      type: 'object' as const,
      properties: {
        business_id: { type: 'string', description: 'ID del negocio (Business Manager). Si no se proporciona, se buscan en las cuentas de WhatsApp Business del usuario.' },
      },
      required: [],
    },
  },

  {
    name: 'get_pixels',
    description: 'Lista los píxeles de Facebook (AdsPixels) de una cuenta publicitaria. Necesario para campañas de OUTCOME_SALES y OUTCOME_LEADS que requieren promoted_object con pixel_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria (ej: act_123456)' },
      },
      required: ['ad_account_id'],
    },
  },

  // ==================== INTERNAL TOOLS (EstrategasIA ecosystem) ====================
  {
    name: 'get_my_products',
    description: 'Lista los productos del usuario en EstrategasIA (Landing Generator). Devuelve nombre, descripción, imagen y URL de landing. Úsalo para conocer qué productos tiene el usuario y así crear campañas con esa info.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  // ==================== WRITE TOOLS (require confirmation) ====================
  {
    name: 'create_campaign',
    description: 'Crea una nueva campaña en Meta Ads. REQUIERE CONFIRMACIÓN del usuario antes de ejecutarse.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria' },
        name: { type: 'string', description: 'Nombre de la campaña' },
        objective: {
          type: 'string',
          enum: ['OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_APP_PROMOTION'],
          description: 'Objetivo de la campaña',
        },
        daily_budget: { type: 'number', description: 'Presupuesto diario en centavos de la moneda de la cuenta' },
        lifetime_budget: { type: 'number', description: 'Presupuesto total en centavos (alternativa a daily_budget)' },
        status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Estado inicial. Default: PAUSED' },
        special_ad_categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Categorías especiales si aplican (HOUSING, CREDIT, EMPLOYMENT, etc.)',
        },
      },
      required: ['ad_account_id', 'name', 'objective'],
    },
  },
  {
    name: 'create_adset',
    description: 'Crea un nuevo conjunto de anuncios dentro de una campaña. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria' },
        campaign_id: { type: 'string', description: 'ID de la campaña padre' },
        name: { type: 'string', description: 'Nombre del adset' },
        daily_budget: { type: 'number', description: 'Presupuesto diario en la unidad mínima de la moneda. COP/CLP: valor directo (ej: 15000). USD/MXN: multiplicar por 100 (ej: $50 USD = 5000).' },
        optimization_goal: {
          type: 'string',
          enum: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS', 'REACH', 'OFFSITE_CONVERSIONS', 'VALUE', 'LEAD_GENERATION', 'CONVERSATIONS'],
          description: 'Objetivo de optimización. OFFSITE_CONVERSIONS para ventas web, LINK_CLICKS para WhatsApp.',
        },
        billing_event: { type: 'string', enum: ['IMPRESSIONS', 'LINK_CLICKS'], description: 'Evento de facturación' },
        targeting: {
          type: 'object',
          description: 'Configuración de targeting: geo_locations (OBLIGATORIO, ej: {"countries":["CO"]}), age_min, age_max, genders, etc.',
        },
        promoted_object: {
          type: 'object',
          description: 'Para ventas web: {"pixel_id":"123","custom_event_type":"PURCHASE"}. Para WhatsApp: {"page_id":"123"}. Usa get_pixels para obtener el pixel_id.',
        },
        destination_type: {
          type: 'string',
          enum: ['UNDEFINED', 'WEBSITE', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT'],
          description: 'Tipo de destino. WHATSAPP para campañas de WhatsApp. Omitir para web.',
        },
        start_time: { type: 'string', description: 'Fecha/hora inicio ISO 8601' },
        end_time: { type: 'string', description: 'Fecha/hora fin ISO 8601' },
        status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Estado inicial. Default: PAUSED' },
      },
      required: ['ad_account_id', 'campaign_id', 'name', 'optimization_goal', 'billing_event', 'targeting'],
    },
  },
  {
    name: 'create_ad',
    description: 'Crea un nuevo anuncio dentro de un adset. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_account_id: { type: 'string', description: 'ID de la cuenta publicitaria' },
        adset_id: { type: 'string', description: 'ID del adset padre' },
        name: { type: 'string', description: 'Nombre del anuncio' },
        page_id: { type: 'string', description: 'ID de la página de Facebook que publica el anuncio. OBLIGATORIO — usa get_pages para obtenerlo.' },
        creative: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Título del anuncio' },
            body: { type: 'string', description: 'Texto principal del anuncio' },
            link_url: { type: 'string', description: 'URL de destino' },
            image_hash: { type: 'string', description: 'Hash de imagen subida a Meta' },
            image_url: { type: 'string', description: 'URL de imagen (alternativa a hash)' },
            call_to_action_type: {
              type: 'string',
              enum: ['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'CONTACT_US', 'GET_OFFER', 'ORDER_NOW', 'WHATSAPP_MESSAGE', 'SEND_WHATSAPP_MESSAGE'],
              description: 'Tipo de CTA',
            },
            call_to_action_value: {
              type: 'object',
              description: 'Valor del CTA. Para WhatsApp: { "whatsapp_number": "+57..." }',
            },
          },
          description: 'Configuración del creativo',
        },
        status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Estado inicial. Default: PAUSED' },
      },
      required: ['ad_account_id', 'adset_id', 'name', 'page_id', 'creative'],
    },
  },
  {
    name: 'update_budget',
    description: 'Cambia el presupuesto de una campaña o adset. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_id: { type: 'string', description: 'ID de la campaña o adset' },
        object_type: { type: 'string', enum: ['campaign', 'adset'], description: 'Tipo de objeto' },
        daily_budget: { type: 'number', description: 'Nuevo presupuesto diario en centavos' },
        lifetime_budget: { type: 'number', description: 'Nuevo presupuesto total en centavos' },
      },
      required: ['object_id', 'object_type'],
    },
  },
  {
    name: 'toggle_status',
    description: 'Activa o pausa una campaña, adset o anuncio. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_id: { type: 'string', description: 'ID del objeto' },
        object_type: { type: 'string', enum: ['campaign', 'adset', 'ad'], description: 'Tipo de objeto' },
        new_status: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'Nuevo estado' },
      },
      required: ['object_id', 'object_type', 'new_status'],
    },
  },
  {
    name: 'update_targeting',
    description: 'Modifica el targeting de un adset existente. REQUIERE CONFIRMACIÓN.',
    input_schema: {
      type: 'object' as const,
      properties: {
        adset_id: { type: 'string', description: 'ID del adset' },
        targeting: {
          type: 'object',
          description: 'Nueva configuración de targeting completa (reemplaza la anterior)',
        },
      },
      required: ['adset_id', 'targeting'],
    },
  },

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

  // ==================== PIPELINE TOOLS (execute entire flows directly — $0 Claude cost) ====================
  {
    name: 'execute_landing_pipeline',
    description: 'Ejecuta el pipeline COMPLETO de creación de landing: crea producto en EstrategasIA, genera TODOS los banners de una vez, y los importa a DropPage. Llama esto UNA SOLA VEZ con toda la info. REQUIERE que el usuario haya confirmado secciones y plantillas. Cada banner se genera secuencialmente y el progreso se muestra en el chat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_name: { type: 'string', description: 'Nombre del producto' },
        product_description: { type: 'string', description: 'Descripción del producto' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Tipo de sección: hero, oferta, beneficios, testimonios, logistica, antes_despues, ingredientes, faq, modo_uso, etc.' },
              template_id: { type: 'string', description: 'ID de la plantilla (de get_templates)' },
              template_url: { type: 'string', description: 'URL de la plantilla (de get_templates)' },
            },
            required: ['type', 'template_id', 'template_url'],
          },
          description: 'Secciones a generar con su plantilla seleccionada',
        },
        product_details: { type: 'string', description: 'Detalles/beneficios/diferenciador del producto (max 500 chars)' },
        sales_angle: { type: 'string', description: 'Ángulo de venta principal' },
        target_avatar: { type: 'string', description: 'Público objetivo' },
        additional_instructions: { type: 'string', description: 'Instrucciones adicionales para la IA' },
        price_after: { type: 'number', description: 'Precio de venta' },
        price_before: { type: 'number', description: 'Precio anterior (tachado)' },
        currency_symbol: { type: 'string', description: 'Símbolo moneda ($)' },
        target_country: { type: 'string', description: 'País (CO, MX, CL, etc.)' },
        color_palette: { type: 'string', description: 'Paleta de colores' },
        existing_product_id: { type: 'string', description: 'ID producto existente (omitir para crear nuevo)' },
      },
      required: ['product_name', 'product_description', 'sections', 'product_details'],
    },
  },
  {
    name: 'execute_droppage_setup',
    description: 'Ejecuta el setup COMPLETO de DropPage de una vez: crea producto, landing, ofertas por cantidad, upsell, downsell, y configura checkout. Llama esto UNA SOLA VEZ con toda la info recopilada del usuario.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_name: { type: 'string', description: 'Nombre del producto' },
        product_description: { type: 'string', description: 'Descripción' },
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
        page_title: { type: 'string', description: 'Título de la landing page' },
        domain_id: { type: 'string', description: 'ID del dominio (de get_droppage_domains)' },
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
      },
      required: ['product_name', 'price', 'page_title'],
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
]
