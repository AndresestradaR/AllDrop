import { ImageProvider, GenerateImageRequest, GenerateImageResult, getApiModelId } from './types'
import { buildColorSection, buildTypographySection, buildProductContextSection, buildSectionTypeSection } from './prompt-helpers'

function buildPricingSection(request: GenerateImageRequest): string {
  const { creativeControls } = request
  const currencySymbol = creativeControls?.currencySymbol || '$'
  const priceAfter = creativeControls?.priceAfter
  const priceBefore = creativeControls?.priceBefore
  const priceCombo2 = creativeControls?.priceCombo2
  const priceCombo3 = creativeControls?.priceCombo3

  // Check if any price is provided
  const hasPricing = priceAfter || priceBefore || priceCombo2 || priceCombo3

  if (!hasPricing) {
    return 'DO NOT include prices in this banner - it is for branding/awareness only.'
  }

  const lines: string[] = ['EXACT PRICES (use these values, DO NOT invent):']

  if (priceAfter) {
    lines.push(`- OFFER Price: ${currencySymbol}${priceAfter} (main price, large and prominent)`)
  }
  if (priceBefore) {
    lines.push(`- BEFORE Price: ${currencySymbol}${priceBefore} (crossed out, smaller)`)
  }
  if (priceCombo2) {
    lines.push(`- Price for 2 UNITS: ${currencySymbol}${priceCombo2}`)
  }
  if (priceCombo3) {
    lines.push(`- Price for 3 UNITS: ${currencySymbol}${priceCombo3}`)
  }

  return lines.join('\n')
}

function buildPrompt(request: GenerateImageRequest): string {
  const { productName, creativeControls } = request
  const targetCountry = creativeControls?.targetCountry || 'CO'

  // Map country codes to names
  const countryNames: Record<string, string> = {
    CO: 'Colombia',
    MX: 'Mexico',
    PA: 'Panama',
    EC: 'Ecuador',
    PE: 'Peru',
    CL: 'Chile',
    PY: 'Paraguay',
    AR: 'Argentina',
    GT: 'Guatemala',
    ES: 'Espana',
  }
  const countryName = countryNames[targetCountry] || 'Colombia'

  const pricingSection = buildPricingSection(request)

  return `Create a professional e-commerce banner in SPANISH for the product "${productName}".

${buildProductContextSection(request)}

COMPOSITION:
- Professional marketing banner style
- Clean, modern layout with the product as hero
- Include decorative elements like splashes, gradients, or lifestyle elements
- Professional typography with bold headlines

PRODUCT:
- Feature the product prominently
- Maintain product packaging and branding exactly as provided

EXACT DATA FOR BANNER (USE THESE VALUES, DO NOT INVENT):
- Product: ${productName}
- Target Country: ${countryName}
${pricingSection}
${creativeControls?.productDetails ? `- Details: ${creativeControls.productDetails}` : ''}

TEXT REQUIREMENTS:
- ALL text must be in PERFECT SPANISH
- Use the EXACT prices I gave you - DO NOT invent prices
- Use LARGE, BOLD, HIGHLY READABLE fonts
- Text must be PERFECTLY SPELLED - no random letters, no errors
- Headlines should be impactful and sales-focused

${creativeControls?.salesAngle ? `SALES ANGLE: ${creativeControls.salesAngle}` : ''}
${creativeControls?.targetAvatar ? `TARGET AUDIENCE: ${creativeControls.targetAvatar}` : ''}
${creativeControls?.additionalInstructions ? `SPECIAL INSTRUCTIONS: ${creativeControls.additionalInstructions}` : ''}

${buildSectionTypeSection(request)}
${buildColorSection(request)}

${buildTypographySection(request)}

Create a stunning, professional e-commerce banner ready for social media advertising.`
}

// Map aspect ratio to OpenAI sizes
// Helper to convert base64 to Blob for multipart uploads
function base64ToBlob(base64: string, mimeType: string): Blob {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(cleanBase64, 'base64')
  return new Blob([buffer], { type: mimeType })
}

// Helper to fetch a URL and return as Blob
async function urlToBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mimeType = res.headers.get('content-type') || 'image/png'
    return new Blob([buf], { type: mimeType })
  } catch {
    return null
  }
}

function getOpenAISize(aspectRatio: string): string {
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1536x1024',
    '9:16': '1024x1536',
    '4:3': '1536x1024',
    '3:4': '1024x1536',
    '4:5': '1024x1536',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
  }
  return sizeMap[aspectRatio] || '1024x1024'
}

// Check if model is a GPT Image model (different API parameters)
function isGptImageModel(modelId: string): boolean {
  return modelId.startsWith('gpt-image')
}

/**
 * Generate image via OpenAI /edits endpoint (GPT Image models with reference images).
 * Uses multipart/form-data with image[] array for multiple input images.
 */
async function generateViaEdits(
  request: GenerateImageRequest,
  apiKey: string,
  apiModelId: string,
  prompt: string,
  size: string
): Promise<GenerateImageResult> {
  const formData = new FormData()
  formData.append('model', apiModelId)
  formData.append('prompt', prompt)
  formData.append('size', size)
  formData.append('n', '1')

  // Add template image (base64 or URL)
  if (request.templateBase64) {
    const blob = base64ToBlob(request.templateBase64, request.templateMimeType || 'image/png')
    formData.append('image[]', blob, 'template.png')
  } else if (request.templateUrl?.startsWith('http')) {
    const blob = await urlToBlob(request.templateUrl)
    if (blob) formData.append('image[]', blob, 'template.png')
  }

  // Add product images (base64 or URLs)
  if (request.productImagesBase64?.length) {
    for (let i = 0; i < request.productImagesBase64.length; i++) {
      const photo = request.productImagesBase64[i]
      const blob = base64ToBlob(photo.data, photo.mimeType)
      formData.append('image[]', blob, `product-${i}.png`)
    }
  } else if (request.productImageUrls?.length) {
    for (let i = 0; i < request.productImageUrls.length; i++) {
      const blob = await urlToBlob(request.productImageUrls[i])
      if (blob) formData.append('image[]', blob, `product-${i}.png`)
    }
  }

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `OpenAI Edit API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
    )
  }

  const data = await response.json()

  if (data.data && data.data[0]?.b64_json) {
    return {
      success: true,
      imageBase64: data.data[0].b64_json,
      mimeType: 'image/png',
      provider: 'openai',
    }
  }

  // Fallback: URL response — download and convert to base64
  if (data.data && data.data[0]?.url) {
    const imgRes = await fetch(data.data[0].url)
    if (imgRes.ok) {
      const buf = await imgRes.arrayBuffer()
      return {
        success: true,
        imageBase64: Buffer.from(buf).toString('base64'),
        mimeType: imgRes.headers.get('content-type') || 'image/png',
        provider: 'openai',
      }
    }
  }

  return {
    success: false,
    error: 'No image generated by OpenAI',
    provider: 'openai',
  }
}

export const openaiProvider: ImageProvider = {
  id: 'openai',

  async generate(request: GenerateImageRequest, apiKey: string): Promise<GenerateImageResult> {
    try {
      // Use direct prompt if provided (Studio IA), otherwise build landing prompt
      const prompt = request.prompt && request.prompt.trim()
        ? request.prompt
        : buildPrompt(request)

      // Get the API model ID from the selected model (default to gpt-image-1.5)
      const apiModelId = request.modelId ? getApiModelId(request.modelId) : 'gpt-image-1.5'

      // Get size based on aspect ratio
      const size = getOpenAISize(request.aspectRatio || '1:1')

      // Build request body based on model type
      // GPT Image models use different parameters than DALL-E
      const isGptImage = isGptImageModel(apiModelId)

      // GPT Image models with reference images → use /edits endpoint (multipart)
      const hasImages = !!(
        request.templateBase64 ||
        request.templateUrl?.startsWith('http') ||
        request.productImagesBase64?.length ||
        request.productImageUrls?.length
      )

      if (isGptImage && hasImages) {
        return await generateViaEdits(request, apiKey, apiModelId, prompt, size)
      }

      // Text-to-image via /generations (JSON)

      const requestBody: Record<string, unknown> = {
        model: apiModelId,
        prompt: prompt,
        n: 1,
        size: size,
      }

      if (isGptImage) {
        // GPT Image models (gpt-image-1, gpt-image-1.5, gpt-image-1-mini)
        // - Don't support response_format (always return base64)
        // - Use output_format instead (png, jpeg, webp)
        // - Use quality: low, medium, high
        requestBody.output_format = 'png'
        requestBody.quality = request.quality === '4k' || request.quality === 'hd' ? 'high' : 'medium'
      } else {
        // DALL-E models (dall-e-2, dall-e-3)
        // - Use response_format: url or b64_json
        // - Use quality: standard or hd (dall-e-3 only)
        requestBody.response_format = 'b64_json'
        if (apiModelId === 'dall-e-3') {
          requestBody.quality = request.quality === '4k' || request.quality === 'hd' ? 'hd' : 'standard'
        }
      }

      // Use OpenAI Images API
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
        )
      }

      const data = await response.json()

      // GPT Image models return base64 directly in data[0].b64_json
      // DALL-E with response_format=b64_json also returns in data[0].b64_json
      if (data.data && data.data[0]?.b64_json) {
        return {
          success: true,
          imageBase64: data.data[0].b64_json,
          mimeType: 'image/png',
          provider: 'openai',
        }
      }

      return {
        success: false,
        error: 'No image generated by OpenAI',
        provider: 'openai',
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'OpenAI generation failed',
        provider: 'openai',
      }
    }
  },
}

// Alternative: Edit image with mask (for more control)
export async function editImageWithOpenAI(
  apiKey: string,
  imageBase64: string,
  maskBase64: string,
  prompt: string,
  modelId?: string
): Promise<GenerateImageResult> {
  try {
    // Convert base64 to FormData
    const formData = new FormData()
    formData.append('model', modelId || 'gpt-image-1.5')

    // Convert base64 to Blob
    const imageBlob = await fetch(`data:image/png;base64,${imageBase64}`).then((r) => r.blob())
    const maskBlob = await fetch(`data:image/png;base64,${maskBase64}`).then((r) => r.blob())

    formData.append('image', imageBlob, 'image.png')
    formData.append('mask', maskBlob, 'mask.png')
    formData.append('prompt', prompt)

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI Edit API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      )
    }

    const data = await response.json()

    if (data.data && data.data[0]?.b64_json) {
      return {
        success: true,
        imageBase64: data.data[0].b64_json,
        mimeType: 'image/png',
        provider: 'openai',
      }
    }

    return {
      success: false,
      error: 'No edited image from OpenAI',
      provider: 'openai',
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'OpenAI edit failed',
      provider: 'openai',
    }
  }
}
