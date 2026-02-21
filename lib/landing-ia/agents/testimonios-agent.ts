import type { ProductMetadata, CountryCode, AgentResult } from '../types'
import { generateAIText, extractJSON, type AITextKeys } from '@/lib/services/ai-text'

const SYSTEM_PROMPT = `Eres un experto copywriter especializado en ventas contraentrega (COD) en LATAM.
Genera testimonios realistas y emocionales de clientes satisfechos.
Responde SOLO con JSON válido, sin markdown, sin texto adicional.`

export async function testimoniosAgent(
  metadata: ProductMetadata,
  country: CountryCode,
  aiKeys: AITextKeys
): Promise<AgentResult> {
  const countryNames: Record<CountryCode, string> = {
    CO: 'Colombia', MX: 'México', GT: 'Guatemala', EC: 'Ecuador'
  }

  const schema = {
    testimonios: [
      {
        nombre: "Nombre latino real",
        ciudad: "Ciudad del país objetivo",
        rating: 5,
        texto: "Testimonio emocional 20-30 palabras",
        avatar: "https://i.pravatar.cc/60?img=N",
        fecha: "hace X días/semanas"
      }
    ]
  }

  const prompt = `
Producto: ${metadata.title}
Descripción: ${metadata.description}
Beneficios: ${metadata.benefits.join(', ')}
País: ${countryNames[country]}

Genera EXACTAMENTE 6 testimonios de clientes satisfechos de ${countryNames[country]}.
- Nombres latinos reales del país
- Ciudades reales del país
- Rating entre 4 y 5
- Texto emocional de 20-30 palabras
- Avatar: https://i.pravatar.cc/60?img=N donde N es un número diferente entre 1 y 70 para cada testimonio
- Fecha: "hace X días" o "hace X semanas" (variado)

Schema esperado: ${JSON.stringify(schema, null, 2)}
`

  try {
    const raw = await generateAIText(aiKeys, {
      systemPrompt: SYSTEM_PROMPT,
      userMessage: prompt,
      temperature: 0.8,
      jsonMode: true,
      signal: AbortSignal.timeout(30000),
    })

    const parsed = JSON.parse(extractJSON(raw))

    // Static trust badges - no AI needed
    const confianza = {
      badges: [
        { emoji: '🚚', titulo: 'Envío Gratis', subtitulo: 'A todo el país' },
        { emoji: '💰', titulo: 'Pago al Recibir', subtitulo: 'Pagas cuando llega' },
        { emoji: '🛡️', titulo: 'Garantía 30 días', subtitulo: 'O te devolvemos tu dinero' },
        { emoji: '⭐', titulo: '+500 clientes felices', subtitulo: 'Calificación 4.9/5' }
      ]
    }

    return {
      agentName: 'social',
      success: true,
      sections: [
        { type: 'testimonios', order: 4, content: { testimonios: parsed.testimonios } },
        { type: 'confianza', order: 1, content: confianza }
      ]
    }
  } catch (e: any) {
    return { agentName: 'social', success: false, sections: [], error: e.message }
  }
}
