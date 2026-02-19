import { GenerateImageRequest } from './types'

export function buildColorSection(request: GenerateImageRequest): string {
  const palette = request.creativeControls?.colorPalette
  if (!palette?.primary) return ''

  let colorLines = `- COLOR PRIMARIO: ${palette.primary} (fondos principales, headers, areas grandes)
- COLOR SECUNDARIO: ${palette.secondary} (acentos, badges de precio, botones)
- COLOR ACENTO: ${palette.accent} (detalles, iconos, highlights, CTAs)`

  if (palette.extra) {
    colorLines += `\n- COLOR EXTRA: ${palette.extra} (elementos secundarios, decoraciones, variaciones)`
  }

  return `=== PALETA DE COLORES OBLIGATORIA ===

REGLA CRITICA DE COLORES: DEBES usar EXACTAMENTE estos colores como los colores dominantes del banner. NO cambies la paleta sin importar el template de referencia. Mantén estos colores en TODA la composicion.

${colorLines}

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
  if (!typo?.fontStyle) return ''

  return `=== TIPOGRAFIA OBLIGATORIA ===

REGLA CRITICA DE TIPOGRAFIA: Usa CONSISTENTEMENTE el estilo tipografico "${typo.fontName}" en todo el banner.

${typo.fontStyle}

IMPORTANTE:
- TODOS los textos del banner (titulos, subtitulos, beneficios, precios, CTAs) deben usar este estilo tipografico
- Los titulos usan la version MAS BOLD y GRANDE de esta tipografia
- Los subtitulos usan una version semibold/medium
- Los textos pequenos usan una version regular/light
- MANTÉN el mismo estilo tipografico en TODOS los banners que generes
- NO cambies la tipografia por la del template de referencia`
}
