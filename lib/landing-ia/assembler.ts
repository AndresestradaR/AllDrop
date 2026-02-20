import type { AgentResult, GeneratedSection, SectionType } from './types'
import { SECTION_ORDER } from './types'

export function assembleSections(results: AgentResult[]): GeneratedSection[] {
  // Flatten all sections from all agent results
  const allSections = results.flatMap(r => r.sections)

  // Build final ordered list based on SECTION_ORDER
  return SECTION_ORDER.map((type, index) => {
    const found = allSections.find(s => s.type === type)
    if (found) {
      return { ...found, order: index }
    }
    return {
      type,
      order: index,
      content: { error: true, message: 'No disponible' }
    }
  })
}
