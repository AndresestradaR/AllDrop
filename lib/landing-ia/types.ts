export type CountryCode = 'CO' | 'MX' | 'GT' | 'EC'

export interface ProductMetadata {
  title: string
  description: string
  benefits: string[]
  images: string[]
  angles: string[]
  pains: string[]
  price?: string
  category?: string
}

export type SectionType =
  | 'hero'
  | 'confianza'
  | 'beneficios'
  | 'testimonios'
  | 'antes_despues'
  | 'modo_uso'
  | 'tabla_comparativa'
  | 'faq'
  | 'banner_oferta'

export interface GeneratedSection {
  type: SectionType
  order: number
  content: Record<string, any>
}

export interface AgentResult {
  agentName: string
  sections: GeneratedSection[]
  success: boolean
  error?: string
}

export interface SSEEvent {
  type: 'agent_done' | 'agent_error' | 'completed' | 'error'
  agent: string
  progress: number
  message: string
  draftId?: string
  sectionsCount?: number
}

export const SECTION_ORDER: SectionType[] = [
  'hero', 'confianza', 'antes_despues', 'beneficios',
  'testimonios', 'tabla_comparativa', 'modo_uso', 'faq', 'banner_oferta'
]

export const COD_FAQS_STATIC: Record<CountryCode, { pregunta: string; respuesta: string }[]> = {
  CO: [
    { pregunta: '¿Puedo pagar cuando me llegue?', respuesta: 'Sí, aceptamos pago contraentrega en todo Colombia. Pagas cuando recibes tu pedido.' },
    { pregunta: '¿Cuánto tarda el envío?', respuesta: 'Entre 3 a 5 días hábiles a cualquier ciudad de Colombia. Envío gratis.' },
    { pregunta: '¿Qué pasa si no me gusta?', respuesta: 'Tienes 30 días para devolverlo sin preguntas. Te reembolsamos completamente.' },
  ],
  MX: [
    { pregunta: '¿Puedo pagar al recibir?', respuesta: 'Sí, aceptamos pago contraentrega en toda la República Mexicana.' },
    { pregunta: '¿Cuánto tarda el envío?', respuesta: 'Entre 3 a 7 días hábiles. Envío gratis a todo México.' },
    { pregunta: '¿Qué pasa si no me satisface?', respuesta: 'Garantía de 30 días. Si no te convence, te devolvemos tu dinero.' },
  ],
  GT: [
    { pregunta: '¿Puedo pagar cuando llegue?', respuesta: 'Sí, aceptamos pago contraentrega en toda Guatemala.' },
    { pregunta: '¿Cuánto tarda el envío?', respuesta: 'Entre 2 a 4 días hábiles. Envío gratis a todo el país.' },
    { pregunta: '¿Tienen garantía?', respuesta: 'Sí, 30 días de garantía. Si no estás satisfecho, te devolvemos tu dinero.' },
  ],
  EC: [
    { pregunta: '¿Puedo pagar al recibir?', respuesta: 'Sí, aceptamos pago contraentrega en toda Ecuador.' },
    { pregunta: '¿Cuánto demora el envío?', respuesta: 'Entre 3 a 5 días hábiles. Envío gratis a todo Ecuador.' },
    { pregunta: '¿Qué garantía tienen?', respuesta: '30 días de garantía total. Si no te convence, te reembolsamos.' },
  ],
}
