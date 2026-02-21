import type { ProductMetadata, CountryCode, AgentResult } from '../types'

const SYSTEM_PROMPT = `Eres un experto copywriter especializado en ventas contraentrega (COD) en LATAM.
Genera copy persuasivo, urgente y emocional para el mercado latinoamericano.
Tutea al cliente, crea urgencia real, habla de sus dolores.
Responde SOLO con JSON válido, sin markdown, sin texto adicional.`

export async function heroAgent(
  metadata: ProductMetadata,
  country: CountryCode,
  geminiKey: string
): Promise<AgentResult> {
  const schema = {
    hero: {
      headline: "Título principal impactante max 10 palabras",
      subheadline: "Subtítulo emocional 15-20 palabras que conecte con el dolor del cliente",
      cta_text: "¡Lo quiero ahora! / Pedir ahora / Quiero el mío",
      badge: "Solo quedan X unidades / Oferta termina hoy / Más vendido"
    },
    banner_oferta: {
      headline: "¡Última oportunidad! / ¡No te quedes sin el tuyo!",
      subtext: "Texto urgencia 10-15 palabras con referencia al precio",
      cta_text: "CTA final urgente",
      countdown_text: "Oferta válida por tiempo limitado"
    }
  }

  const prompt = `
Producto: ${metadata.title}
Descripción: ${metadata.description}
Beneficios: ${metadata.benefits.join(', ')}
Dolores del cliente: ${metadata.pains.join(', ')}
Ángulos de venta: ${metadata.angles.join(', ')}
País objetivo: ${country}
Precio: ${metadata.price || 'no especificado'}

Genera hero section y banner de oferta final para este producto COD.
Schema esperado: ${JSON.stringify(schema, null, 2)}
`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API error (${res.status}): ${errText.substring(0, 200)}`)
    }

    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)

    return {
      agentName: 'hero',
      success: true,
      sections: [
        { type: 'hero', order: 0, content: parsed.hero },
        { type: 'banner_oferta', order: 8, content: parsed.banner_oferta }
      ]
    }
  } catch (e: any) {
    return { agentName: 'hero', success: false, sections: [], error: e.message }
  }
}
