// Agent tool definitions and handlers for AllDrop AI Agent
// Tools use internal fetch() calls to the same app's API routes

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// ---- OpenAI function calling tool definitions ----

export const agentToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'generate_sales_angles',
      description: 'Generate 6 diverse sales angles for a product. Each angle includes a hook, description, avatar suggestion, and tone.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Name of the product',
          },
          productDescription: {
            type: 'string',
            description: 'Description of the product, its benefits and features',
          },
          targetCountry: {
            type: 'string',
            description: 'Target country code (e.g. CO, MX, CL, PE)',
          },
          outputLanguage: {
            type: 'string',
            description: 'Language for the output (e.g. es, en, pt)',
          },
        },
        required: ['productName', 'productDescription'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_landing_copy',
      description: 'Generate landing page copy for specific sections. Returns ready-to-use text for each requested section.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Name of the product',
          },
          salesAngle: {
            type: 'string',
            description: 'The sales angle or hook to base the copy on',
          },
          targetLanguage: {
            type: 'string',
            description: 'Language for the copy (e.g. es, en, pt)',
          },
          sections: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sections to generate copy for (e.g. hero, benefits, faq, testimonials, guarantee, cta)',
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
      description: 'Calculate profit margins, ROI, break-even and other financial metrics for a dropshipping product.',
      parameters: {
        type: 'object',
        properties: {
          productCost: {
            type: 'number',
            description: 'Cost of the product from supplier (in local currency)',
          },
          shippingCost: {
            type: 'number',
            description: 'Shipping cost per unit',
          },
          sellingPrice: {
            type: 'number',
            description: 'Selling price to the customer',
          },
          cpaEstimate: {
            type: 'number',
            description: 'Estimated cost per acquisition (ad spend per sale)',
          },
        },
        required: ['productCost', 'shippingCost', 'sellingPrice', 'cpaEstimate'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description: 'Search for products in the product intelligence catalog. Returns product data including sales estimates, prices, and supplier info.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (product name, keyword, or niche)',
          },
          category: {
            type: 'string',
            description: 'Product category filter (optional)',
          },
          country: {
            type: 'string',
            description: 'Country code to filter by (e.g. CO, MX)',
          },
          minSales: {
            type: 'number',
            description: 'Minimum number of sales to filter by',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_ad_copy',
      description: 'Write 3 variations of ad copy for Meta (Facebook/Instagram) or TikTok ads. Each variation includes headline, body text, and CTA.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Name of the product',
          },
          salesAngle: {
            type: 'string',
            description: 'The sales angle or hook to use',
          },
          platform: {
            type: 'string',
            enum: ['meta', 'tiktok'],
            description: 'Advertising platform (meta for Facebook/Instagram, tiktok for TikTok)',
          },
          language: {
            type: 'string',
            description: 'Language for the ad copy (e.g. es, en, pt)',
          },
        },
        required: ['productName', 'salesAngle', 'platform'],
      },
    },
  },
]

// ---- Tool handler functions ----

export type ToolHandler = (args: any, headers: Record<string, string>) => Promise<string>

function buildInternalHeaders(headers: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // Forward auth cookies
  if (headers['cookie']) {
    h['cookie'] = headers['cookie']
  }
  if (headers['authorization']) {
    h['authorization'] = headers['authorization']
  }
  return h
}

async function handleGenerateSalesAngles(args: any): Promise<string> {
  // Return structured context — the LLM itself generates the angles based on this
  return JSON.stringify({
    instruction: `Generate exactly 6 diverse sales angles for "${args.productName}".`,
    productDescription: args.productDescription,
    targetCountry: args.targetCountry || 'ES',
    outputLanguage: args.outputLanguage || 'es',
    format: {
      angle: { name: 'short name', hook: 'max 80 chars, no accents', description: '1-2 sentences', avatarSuggestion: 'specific buyer profile', tone: 'one word' },
    },
    types: ['Transformation', 'Pain/Problem', 'Authority/Science', 'Urgency', 'Comparison', 'Social Proof'],
  })
}

async function handleGenerateLandingCopy(args: any, headers: Record<string, string>): Promise<string> {
  try {
    // Use AI text generation via internal logic since there's no dedicated landing copy endpoint
    // Build a structured prompt and return the result
    const sections = args.sections || ['hero', 'benefits', 'faq']
    const language = args.targetLanguage || 'es'
    const result: Record<string, any> = {}

    for (const section of sections) {
      result[section] = generateCopyForSection(
        section,
        args.productName,
        args.salesAngle,
        language,
      )
    }

    return JSON.stringify({
      productName: args.productName,
      salesAngle: args.salesAngle,
      language,
      sections: result,
    })
  } catch (err: any) {
    return JSON.stringify({ error: `generate_landing_copy failed: ${err.message}` })
  }
}

function generateCopyForSection(
  section: string,
  productName: string,
  salesAngle: string,
  language: string,
): Record<string, string> {
  // Return structured placeholders that the AI model will use as context
  // The actual copy is generated by the LLM based on these tool results
  const langLabel = language === 'es' ? 'Spanish' : language === 'pt' ? 'Portuguese' : 'English'
  const base = {
    section,
    productName,
    salesAngle,
    language: langLabel,
    instruction: `Generate compelling ${section} copy for "${productName}" using the angle: "${salesAngle}". Write in ${langLabel}.`,
  }

  switch (section) {
    case 'hero':
      return { ...base, fields: 'headline, subheadline, cta_button_text' }
    case 'benefits':
      return { ...base, fields: '5-7 key benefits with icons and short descriptions' }
    case 'faq':
      return { ...base, fields: '5-6 frequently asked questions with answers' }
    case 'testimonials':
      return { ...base, fields: '3-4 customer testimonial templates' }
    case 'guarantee':
      return { ...base, fields: 'guarantee headline, guarantee description, trust badges' }
    case 'cta':
      return { ...base, fields: 'final call to action headline, urgency text, button text' }
    default:
      return { ...base, fields: `content for ${section} section` }
  }
}

async function handleCalculateCosts(args: any): Promise<string> {
  const { productCost, shippingCost, sellingPrice, cpaEstimate } = args

  const totalCost = productCost + shippingCost + cpaEstimate
  const profitPerUnit = sellingPrice - totalCost
  const marginPercent = (profitPerUnit / sellingPrice) * 100
  const roi = (profitPerUnit / totalCost) * 100
  const breakEvenUnits = cpaEstimate > 0 ? Math.ceil(cpaEstimate / profitPerUnit) : 0
  const breakEvenRevenue = breakEvenUnits * sellingPrice

  return JSON.stringify({
    input: {
      productCost,
      shippingCost,
      sellingPrice,
      cpaEstimate,
    },
    results: {
      totalCostPerUnit: Math.round(totalCost * 100) / 100,
      profitPerUnit: Math.round(profitPerUnit * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      breakEvenUnits: breakEvenUnits > 0 ? breakEvenUnits : 'N/A (negative margin)',
      breakEvenRevenue: breakEvenUnits > 0 ? Math.round(breakEvenRevenue * 100) / 100 : 'N/A',
      verdict:
        profitPerUnit <= 0
          ? 'NOT PROFITABLE - costs exceed selling price'
          : marginPercent < 20
            ? 'LOW MARGIN - consider increasing price or reducing costs'
            : marginPercent < 40
              ? 'ACCEPTABLE MARGIN - viable product'
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
    // Limit results to avoid token explosion
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

  // Return a structured prompt context for the LLM to generate actual copy
  // The model will use this as tool output and compose the final ad copy
  return JSON.stringify({
    productName,
    salesAngle,
    platform: plat,
    language: lang,
    instruction: `Generate 3 ad copy variations for "${productName}" on ${plat === 'meta' ? 'Facebook/Instagram' : 'TikTok'} using the angle: "${salesAngle}". Language: ${lang}.`,
    format: {
      variation: {
        headline: 'short attention-grabbing headline',
        body: plat === 'meta' ? 'persuasive body text (100-150 words)' : 'short punchy text (under 80 words)',
        cta: 'call to action button text',
      },
      count: 3,
    },
    platformTips:
      plat === 'meta'
        ? 'Use emotional triggers, social proof, and urgency. Primary text + headline + description format.'
        : 'Short, punchy, trending-style copy. Hook in first line. Use emojis sparingly. Under 80 words.',
  })
}

// ---- Tool executor ----

export const toolHandlers: Record<string, ToolHandler> = {
  generate_sales_angles: (args) => handleGenerateSalesAngles(args),
  generate_landing_copy: handleGenerateLandingCopy,
  calculate_costs: (args) => handleCalculateCosts(args),
  search_products: handleSearchProducts,
  write_ad_copy: (args) => handleWriteAdCopy(args),
}

export async function executeToolCall(
  toolName: string,
  argsJson: string,
  requestHeaders: Record<string, string>,
): Promise<string> {
  const handler = toolHandlers[toolName]
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  try {
    const args = JSON.parse(argsJson)
    return await handler(args, requestHeaders)
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to execute ${toolName}: ${err.message}` })
  }
}
