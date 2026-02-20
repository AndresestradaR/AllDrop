import type { ProductMetadata, CountryCode, AgentResult } from '../types'
import { COD_FAQS_STATIC } from '../types'

const SYSTEM_PROMPT = `Eres un experto copywriter especializado en ventas contraentrega (COD) en LATAM.
Genera contenido persuasivo y emocional para el mercado latinoamericano.
Responde SOLO con JSON válido, sin markdown, sin texto adicional.`

async function callGemini(geminiKey: string, prompt: string): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    }
  )

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean)
}

export async function faqsAgent(
  metadata: ProductMetadata,
  country: CountryCode,
  geminiKey: string
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
      callGemini(geminiKey, faqPrompt),
      callGemini(geminiKey, beneficiosPrompt),
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
