import { ImageProvider, GenerateImageRequest, GenerateImageResult, getApiModelId } from './types'
import { buildColorSection, buildTypographySection } from './prompt-helpers'

function buildPricingSection(request: GenerateImageRequest): string {
  const { creativeControls } = request
  const currencySymbol = creativeControls?.currencySymbol || '$'
  const priceAfter = creativeControls?.priceAfter
  const priceBefore = creativeControls?.priceBefore
  const priceCombo2 = creativeControls?.priceCombo2
  const priceCombo3 = creativeControls?.priceCombo3

  const hasPricing = priceAfter || priceBefore || priceCombo2 || priceCombo3

  if (!hasPricing) {
    return 'No prices - branding banner only.'
  }

  const lines: string[] = []
  if (priceAfter) lines.push(`Price displayed prominently: ${currencySymbol}${priceAfter}`)
  if (priceBefore) lines.push(`Original price crossed out: ${currencySymbol}${priceBefore}`)
  if (priceCombo2) lines.push(`2 units price: ${currencySymbol}${priceCombo2}`)
  if (priceCombo3) lines.push(`3 units price: ${currencySymbol}${priceCombo3}`)

  return lines.join('\n')
}

function buildPrompt(request: GenerateImageRequest): string {
  const { productName, creativeControls } = request
  const targetCountry = creativeControls?.targetCountry || 'CO'

  const countryNames: Record<string, string> = {
    CO: 'Colombia', MX: 'Mexico', PA: 'Panama', EC: 'Ecuador', PE: 'Peru',
    CL: 'Chile', PY: 'Paraguay', AR: 'Argentina', GT: 'Guatemala', ES: 'Espana',
  }
  const countryName = countryNames[targetCountry] || 'Colombia'

  const pricingSection = buildPricingSection(request)

  return `Professional e-commerce marketing banner for "${productName}" in Spanish.

STYLE:
- Modern, clean e-commerce banner design
- Vibrant colors with professional gradients
- Product as the hero element
- Dynamic composition with splashes and decorative elements

CONTENT:
- Product: ${productName}
- Target country: ${countryName}
${pricingSection}
${creativeControls?.productDetails ? `- Product features: ${creativeControls.productDetails}` : ''}

TEXT:
- All text in SPANISH
- Bold, impactful headlines
- Trust badges at bottom (Envio Gratis, Pago Contraentrega, Garantia)

${creativeControls?.salesAngle ? `Marketing angle: ${creativeControls.salesAngle}` : ''}
${creativeControls?.targetAvatar ? `Target audience: ${creativeControls.targetAvatar}` : ''}
${creativeControls?.additionalInstructions ? `Special: ${creativeControls.additionalInstructions}` : ''}

${buildColorSection(request)}

${buildTypographySection(request)}

Create a stunning, professional banner ready for social media advertising.`
}

// Map our model IDs to BFL API endpoints
function getFluxEndpoint(apiModelId: string): string {
  return `https://api.bfl.ai/v1/${apiModelId}`
}

// Check which models support image input
function supportsImageInput(apiModelId: string): boolean {
  if (apiModelId === 'flux-2-klein-4b' || apiModelId === 'flux-2-klein-9b') {
    return false
  }
  if (apiModelId.startsWith('flux-2-')) {
    return true
  }
  if (apiModelId.includes('kontext')) {
    return true
  }
  return false
}

// Clean base64 string - remove data URL prefix if present
function cleanBase64(data: string): string {
  if (data.includes(',')) {
    return data.split(',')[1]
  }
  return data
}

/**
 * Enhance prompt to reference input images for FLUX 2 multi-reference editing.
 * FLUX 2 understands natural language references like "the product from image 1"
 * or explicit indexing like "image 1", "image 2", etc.
 * 
 * This function modifies the prompt to explicitly reference uploaded images
 * so FLUX knows to incorporate them into the generation.
 */
function enhancePromptWithImageReferences(prompt: string, imageCount: number): string {
  if (imageCount === 0) return prompt
  
  // Check if prompt already references images (common patterns)
  const hasImageRef = /image\s*\d|imagen\s*\d|@img\d|from\s+image|de\s+la\s+imagen/i.test(prompt)
  if (hasImageRef) return prompt
  
  // Check for common product-related keywords that should reference the image
  const productKeywords = [
    'producto', 'product', 
    'crema', 'cream', 
    'botella', 'bottle',
    'frasco', 'jar',
    'caja', 'box',
    'paquete', 'package',
    'artículo', 'article', 'item',
    'el producto', 'the product',
    'con el producto', 'with the product',
    'sosteniendo', 'holding',
    'mostrando', 'showing',
  ]
  
  // Check if prompt mentions product-related terms
  const mentionsProduct = productKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword.toLowerCase())
  )
  
  if (mentionsProduct) {
    // Add instruction to use the exact product from the reference image
    // FLUX 2 understands "the product from image 1" syntax
    const imageRefs = Array.from({ length: imageCount }, (_, i) => `image ${i + 1}`).join(', ')
    
    return `${prompt}

IMPORTANT: Use the EXACT product shown in ${imageRefs} - preserve its appearance, label, packaging, and branding exactly as shown in the reference image(s). The product must be identical to the one in the input image.`
  }
  
  // For other prompts, add a general reference
  if (imageCount === 1) {
    return `${prompt}

Reference the content from image 1 in this generation, preserving its key elements and appearance.`
  }
  
  return `${prompt}

Reference the content from the ${imageCount} input images in this generation.`
}

export const fluxProvider: ImageProvider = {
  id: 'flux',

  async generate(request: GenerateImageRequest, apiKey: string): Promise<GenerateImageResult> {
    try {
      // Get the API model ID from the selected model (default to flux-2-pro)
      const apiModelId = request.modelId ? getApiModelId(request.modelId) : 'flux-2-pro'
      const endpoint = getFluxEndpoint(apiModelId)

      // Get images from template or product images
      const images: string[] = []
      if (request.templateBase64) {
        images.push(cleanBase64(request.templateBase64))
      }
      if (request.productImagesBase64 && request.productImagesBase64.length > 0) {
        for (const img of request.productImagesBase64) {
          images.push(cleanBase64(img.data))
        }
      }

      // Build prompt - use direct prompt if provided (Studio IA), otherwise build landing prompt
      let prompt = request.prompt && request.prompt.trim()
        ? request.prompt
        : buildPrompt(request)

      // Enhance prompt with image references if we have images and model supports them
      if (supportsImageInput(apiModelId) && images.length > 0) {
        prompt = enhancePromptWithImageReferences(prompt, images.length)
        console.log(`[FLUX] Enhanced prompt with ${images.length} image reference(s)`)
      }

      // Build request body based on model capabilities
      const requestBody: Record<string, any> = {
        prompt: prompt,
        output_format: 'jpeg',
      }

      // FLUX 2 models (Pro, Max, Flex) use input_image for multi-reference editing
      if (supportsImageInput(apiModelId) && images.length > 0) {
        // First image is the main input_image
        requestBody.input_image = images[0]
        
        // Additional images go into input_image_2, input_image_3, etc.
        for (let i = 1; i < images.length && i < 8; i++) {
          requestBody[`input_image_${i + 1}`] = images[i]
        }
        
        console.log(`[FLUX] Added ${images.length} input image(s) to request`)
      } else {
        // For text-to-image (no input image), use aspect_ratio
        requestBody.aspect_ratio = request.aspectRatio || '9:16'
        console.log(`[FLUX] Text-to-image mode with aspect_ratio: ${requestBody.aspect_ratio}`)
      }

      console.log(`[FLUX] Endpoint: ${endpoint}`)
      console.log(`[FLUX] Model: ${apiModelId}`)
      console.log(`[FLUX] Has input images: ${images.length > 0}`)
      console.log(`[FLUX] Final prompt: ${prompt.substring(0, 200)}...`)

      const createResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'x-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        console.error(`[FLUX] API error response:`, errorData)
        throw new Error(
          `FLUX API error: ${createResponse.status} - ${JSON.stringify(errorData)}`
        )
      }

      const createData = await createResponse.json()
      const requestId = createData.id
      const pollingUrl = createData.polling_url

      if (!requestId && !pollingUrl) {
        throw new Error('No request ID or polling URL returned from FLUX')
      }

      console.log(`[FLUX] Task created: ${requestId || pollingUrl}`)
      if (createData.cost) {
        console.log(`[FLUX] Cost: ${createData.cost} credits`)
      }

      return {
        success: true,
        provider: 'flux',
        taskId: pollingUrl || requestId,
        status: 'processing',
      }
    } catch (error: any) {
      console.error(`[FLUX] Generation error:`, error)
      return {
        success: false,
        error: error.message || 'FLUX generation failed',
        provider: 'flux',
      }
    }
  },

  async checkStatus(pollingUrl: string, apiKey: string): Promise<GenerateImageResult> {
    try {
      const url = pollingUrl.startsWith('http')
        ? pollingUrl
        : `https://api.bfl.ai/v1/get_result?id=${pollingUrl}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-key': apiKey,
        },
      })

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'Pending' || data.status === 'Processing' || data.status === 'Queued') {
        return {
          success: true,
          provider: 'flux',
          taskId: pollingUrl,
          status: 'processing',
        }
      }

      if (data.status === 'Error' || data.status === 'Failed') {
        return {
          success: false,
          error: data.error || 'FLUX generation failed',
          provider: 'flux',
        }
      }

      if (data.status === 'Ready' && data.result?.sample) {
        const imageUrl = data.result.sample

        const imageResponse = await fetch(imageUrl)
        const imageBuffer = await imageResponse.arrayBuffer()
        const imageBase64 = Buffer.from(imageBuffer).toString('base64')
        const mimeType = imageResponse.headers.get('content-type') || 'image/png'

        return {
          success: true,
          imageBase64: imageBase64,
          mimeType: mimeType,
          provider: 'flux',
          status: 'completed',
        }
      }

      return {
        success: true,
        provider: 'flux',
        taskId: pollingUrl,
        status: 'processing',
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Status check failed',
        provider: 'flux',
      }
    }
  },
}

// FLUX Kontext Pro - supports image input for contextual editing
export async function generateWithFluxKontext(
  apiKey: string,
  prompt: string,
  modelId: string = 'flux-kontext-pro',
  aspectRatio: string = '1:1',
  imageBase64?: string
): Promise<GenerateImageResult> {
  try {
    const requestBody: Record<string, any> = {
      prompt: prompt,
      aspect_ratio: aspectRatio,
    }

    if (imageBase64) {
      requestBody.image_prompt = cleanBase64(imageBase64)
      requestBody.image_prompt_strength = 0.5
    }

    const createResponse = await fetch(`https://api.bfl.ai/v1/${modelId}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'x-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}))
      throw new Error(`FLUX Kontext API error: ${createResponse.status} - ${JSON.stringify(errorData)}`)
    }

    const createData = await createResponse.json()

    return {
      success: true,
      provider: 'flux',
      taskId: createData.polling_url || createData.id,
      status: 'processing',
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'FLUX Kontext generation failed',
      provider: 'flux',
    }
  }
}
