import type { ProductMetadata, CountryCode, AgentResult } from '../types'
import { COD_FAQS_STATIC } from '../types'
import { generateAIText, extractJSON, type AITextKeys } from '@/lib/services/ai-text'

const SYSTEM_PROMPT = `Eres un experto copywriter especializado en ventas contraentrega (COD) en LATAM.
Genera contenido persuasivo y emocional para el mercado latinoamericano.
Responde SOLO con JSON válido, sin markdown, sin texto adicional.`

async function callAI(aiKeys: AITextKeys, prompt: string): Promise<any> {
  const raw = await generateAIText(aiKeys, {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: prompt,
    temperature: 0.7,
    jsonMode: true,
    signal: AbortSignal.timeout(30000),
  })
  return JSON.parse(extractJSON(raw))
}

export async function faqsAgent(
  metadata: ProductMetadata,
  country: CountryCode,
  aiKeys: AITextKeys
): Promise<AgentResult> {
  const faqPrompt = `
Producto: ${metadata.title}
Descripción: ${metadata.description}
Beneficios: ${metadata.benefits.join(', ')}

Genera EXACTAMENTE 4 preguntas frecuentes específicas sobre este producto.
No incluyas preguntas sobre envío, pago o garantía (esas ya las tenemos).

Schema esperado: { "faqs": [{ "pregunta": "...", "respuesta": "..." }] }
`

  const beneficiosPrompt = `
Producto: ${metadata.title}
Descripción: ${metadata.description}
Beneficios: ${metadata.benefits.join(', ')}
Dolores del cliente: ${metadata.pains.join(', ')}

Genera:
1. Lista de 4-6 beneficios con emoji, título y descripción corta
2. Tabla comparativa: nuestro producto vs competencia genérica (4-5 filas)

Schema esperado:
{
  "beneficios": [
    { "emoji": "✅", "titulo": "...", "descripcion": "..." }
  ],
  "tabla_comparativa": {
    "headers": ["Característica", "Nuestro Producto", "Competencia"],
    "rows": [["Calidad", "✅ Premium", "❌ Regular"]]
  }
}
`

  try {
    const [faqResult, beneficiosResult] = await Promise.all([
      callAI(aiKeys, faqPrompt),
      callAI(aiKeys, beneficiosPrompt),
    ])

    // Merge product FAQs + static COD FAQs
    const staticFaqs = COD_FAQS_STATIC[country] || COD_FAQS_STATIC.CO
    const allFaqs = [...(faqResult.faqs || []), ...staticFaqs]

    return {
      agentName: 'content',
      success: true,
      sections: [
        { type: 'faq', order: 7, content: { faqs: allFaqs } },
        { type: 'beneficios', order: 3, content: { beneficios: beneficiosResult.beneficios } },
        { type: 'tabla_comparativa', order: 5, content: beneficiosResult.tabla_comparativa }
      ]
    }
  } catch (e: any) {
    return { agentName: 'content', success: false, sections: [], error: e.message }
  }
}
