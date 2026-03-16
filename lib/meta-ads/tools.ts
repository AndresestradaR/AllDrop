// Meta Ads AI Manager — Tool definitions for Anthropic API

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
        daily_budget: { type: 'number', description: 'Presupuesto diario en centavos' },
        optimization_goal: {
          type: 'string',
          enum: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS', 'REACH', 'OFFSITE_CONVERSIONS', 'VALUE', 'LEAD_GENERATION'],
          description: 'Objetivo de optimización',
        },
        billing_event: { type: 'string', enum: ['IMPRESSIONS', 'LINK_CLICKS'], description: 'Evento de facturación' },
        targeting: {
          type: 'object',
          description: 'Configuración de targeting: geo_locations (OBLIGATORIO, ej: {"countries":["CO"]}), age_min, age_max, genders, etc.',
        },
        promoted_object: {
          type: 'object',
          description: 'OBLIGATORIO para OUTCOME_SALES y OUTCOME_LEADS. Para ventas: {"pixel_id":"123","custom_event_type":"PURCHASE"}. Para leads: {"pixel_id":"123","custom_event_type":"LEAD"}. Usa get_pixels para obtener el pixel_id.',
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
]
