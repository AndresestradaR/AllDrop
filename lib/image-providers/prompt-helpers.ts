import { GenerateImageRequest } from './types'

export function buildColorSection(request: GenerateImageRequest): string {
  const palette = request.creativeControls?.colorPalette
  if (!palette?.primary) return ''

  return `=== PALETA DE COLORES OBLIGATORIA ===

REGLA CRITICA DE COLORES: DEBES usar EXACTAMENTE estos colores como los colores dominantes del banner. NO cambies la paleta sin importar el template de referencia. Mantén estos colores en TODA la composicion.

- COLOR PRIMARIO: ${palette.primary} (fondos principales, headers, areas grandes)
- COLOR SECUNDARIO: ${palette.secondary} (acentos, badges de precio, botones)
- COLOR ACENTO: ${palette.accent} (detalles, iconos, highlights, CTAs)

IMPORTANTE:
- El fondo del banner debe usar el color PRIMARIO como base dominante
- Los precios y CTAs deben usar el color SECUNDARIO o ACENTO
- Los textos blancos o muy claros contrastan sobre el color primario
- NUNCA cambies estos colores por los del template de referencia
- Si el template tiene otros colores, REEMPLAZALOS por esta paleta
- MANTÉN esta misma paleta en TODOS los banners que generes`
}

export function buildTypographySection(request: GenerateImageRequest): string {
  const typo = request.creativeControls?.typography
  if (!typo?.headings) return ''

  return `=== TIPOGRAFIA OBLIGATORIA ===

REGLA CRITICA DE TIPOGRAFIA: Usa CONSISTENTEMENTE estos estilos tipograficos en todo el banner.

- TITULOS PRINCIPALES: ${typo.headings}
- SUBTITULOS Y BADGES: ${typo.subheadings}
- TEXTOS DE CUERPO Y BENEFICIOS: ${typo.body}

IMPORTANTE:
- MANTÉN el mismo estilo tipografico en todo el banner
- Los titulos deben ser GRANDES y usar el estilo especificado
- NO cambies la tipografia por la del template de referencia
- Mantén esta misma tipografia en TODOS los banners que generes`
}
