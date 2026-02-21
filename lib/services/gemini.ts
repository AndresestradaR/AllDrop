import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = `Eres un experto en fotografía de producto para e-commerce y dropshipping.
Tu tarea es crear prompts detallados para generar imágenes de producto verticales (9:16) 
optimizadas para landings móviles.

El prompt debe describir:
- Producto centrado con fondo limpio, gradiente suave o contexto lifestyle
- Iluminación profesional de estudio (soft light, rim light)
- Ángulo que muestre mejor el producto (3/4 view, frontal, hero shot)
- Estilo aspiracional y premium
- Colores que resalten el producto

Responde SOLO con el prompt optimizado en inglés, sin explicaciones ni texto adicional.
El prompt debe ser específico y detallado para obtener la mejor imagen posible.`

export async function enhancePrompt(
  apiKey: string, 
  productName: string, 
  notes?: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const userPrompt = `Producto: ${productName}${notes ? `\nNotas adicionales: ${notes}` : ''}`

  const result = await model.generateContent([SYSTEM_PROMPT, userPrompt])
  const response = result.response
  const text = response.text()

  return text.trim()
}

export function buildBasePrompt(productName: string, notes?: string): string {
  return `Professional product photography of ${productName}, studio lighting, clean gradient background, vertical composition 9:16 aspect ratio, e-commerce style, high quality, sharp focus${notes ? `, ${notes}` : ''}`
}
