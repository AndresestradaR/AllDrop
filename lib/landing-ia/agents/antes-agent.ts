import type { ProductMetadata, CountryCode, AgentResult } from '../types'
import { generateAIText, extractJSON, type AITextKeys } from '@/lib/services/ai-text'

const SYSTEM_PROMPT = `Eres un experto copywriter especializado en ventas contraentrega (COD) en LATAM.
Genera contenido persuasivo y emocional para el mercado latinoamericano.
Responde SOLO con JSON válido, sin markdown, sin texto adicional.`

export async function antesAgent(
  metadata: ProductMetadata,
  country: CountryCode,
  aiKeys: AITextKeys
): Promise<AgentResult> {
  const prompt = `
Producto: ${metadata.title}
Descripción: ${metadata.description}
Beneficios: ${metadata.benefits.join(', ')}
Dolores del cliente: ${metadata.pains.join(', ')}
País: ${country}

Genera dos secciones:

1. Antes/Después: título emocional + 3 puntos "antes" (dolor) y 3 puntos "después" (transformación)
2. Modo de Uso: título + 3 pasos simples con emoji

Schema esperado:
{
  "antes_despues": {
    "titulo": "Así cambiará tu vida",
    "antes_items": ["Antes 1...", "Antes 2...", "Antes 3..."],
    "despues_items": ["Después 1...", "Después 2...", "Después 3..."]
  },
  "modo_uso": {
    "titulo": "Así de fácil funciona",
    "pasos": [
      { "numero": 1, "titulo": "...", "descripcion": "...", "emoji": "📦" },
      { "numero": 2, "titulo": "...", "descripcion": "...", "emoji": "✨" },
      { "numero": 3, "titulo": "...", "descripcion": "...", "emoji": "🎉" }
    ]
  }
}
`

  try {
    const raw = await generateAIText(aiKeys, {
      systemPrompt: SYSTEM_PROMPT,
      userMessage: prompt,
      temperature: 0.7,
      jsonMode: true,
      signal: AbortSignal.timeout(30000),
    })

    const parsed = JSON.parse(extractJSON(raw))

    return {
      agentName: 'transform',
      success: true,
      sections: [
        { type: 'antes_despues', order: 2, content: parsed.antes_despues },
        { type: 'modo_uso', order: 6, content: parsed.modo_uso }
      ]
    }
  } catch (e: any) {
    return { agentName: 'transform', success: false, sections: [], error: e.message }
  }
}
