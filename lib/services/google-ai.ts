import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Build a base prompt for landing page image generation
 */
export function buildBasePrompt(productName: string, notes?: string): string {
  let prompt = `Professional e-commerce product landing page hero image for "${productName}". 
Clean white background, studio lighting, high-quality product photography style. 
Modern, minimalist aesthetic suitable for a premium dropshipping store. 
Sharp focus, professional composition, commercial quality.`

  if (notes) {
    prompt += `\n\nAdditional details: ${notes}`
  }

  return prompt
}

/**
 * Enhance prompt using Gemini
 */
export async function enhancePrompt(
  apiKey: string,
  productName: string,
  notes?: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    systemInstruction: `You are an expert at creating prompts for AI image generation, specifically for e-commerce product landing pages.
Your task is to transform simple product descriptions into detailed, professional prompts that will generate high-quality hero images for landing pages.

Focus on:
- Clean, professional aesthetic
- White or light gradient backgrounds
- Studio-quality lighting
- E-commerce/dropshipping visual style
- Modern, premium feel
- High contrast and sharp details

Always output ONLY the enhanced prompt, nothing else. No explanations, no quotes, just the prompt text.`
  })

  const userMessage = `Create an optimized image generation prompt for a landing page hero image.

Product: ${productName}
${notes ? `Additional notes: ${notes}` : ''}

Generate a detailed prompt that will create a professional, conversion-optimized hero image.`

  try {
    const result = await model.generateContent(userMessage)
    const response = await result.response
    const enhancedPrompt = response.text()?.trim()
    
    if (!enhancedPrompt) {
      throw new Error('Empty response from Gemini')
    }

    return enhancedPrompt
  } catch (error) {
    console.error('Gemini enhancement failed:', error)
    // Return base prompt if enhancement fails
    return buildBasePrompt(productName, notes)
  }
}

/**
 * Generate image using Nano Banana Pro (Google's Imagen 3 model)
 */
export async function generateImage(
  apiKey: string,
  prompt: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    // Use Imagen 3 model for image generation
    const model = genAI.getGenerativeModel({ 
      model: 'imagen-3.0-generate-002'
    })

    const result = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        responseMimeType: 'image/png',
      },
    })

    const response = await result.response
    const parts = response.candidates?.[0]?.content?.parts || []
    
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        // Convert base64 to data URL
        const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        return { success: true, imageUrl }
      }
    }

    // If no inline image, try text response (some models return URLs)
    const textResponse = response.text()
    if (textResponse && textResponse.startsWith('http')) {
      return { success: true, imageUrl: textResponse.trim() }
    }

    return { 
      success: false, 
      error: 'No image generated in response' 
    }
  } catch (error: any) {
    console.error('Image generation failed:', error)
    const msg = error.message || ''

    if (msg.includes('API_KEY_INVALID') || msg.includes('invalid API key')) {
      return { success: false, error: 'API key invalida. Copiala de nuevo desde console.cloud.google.com → Credentials → API Keys' }
    }
    if (msg.includes('not found') || msg.includes('404')) {
      return { success: false, error: 'Modelo de imagen no disponible. Selecciona otro modelo en Settings.' }
    }
    if (msg.includes('SAFETY') || msg.includes('blocked')) {
      return { success: false, error: 'Contenido bloqueado por filtros de seguridad. Modifica tu prompt o plantilla.' }
    }
    if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return { success: false, error: 'Limite de API alcanzado. Espera unos minutos o revisa tu cuota en console.cloud.google.com' }
    }

    return { success: false, error: `Error de generacion: ${msg.substring(0, 300)}` }
  }
}
