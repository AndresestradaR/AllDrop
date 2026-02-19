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
  if (!typo?.headings) return ''

  return `
=== TIPOGRAFIA DEL BANNER ===

Usa CONSISTENTEMENTE estos estilos tipograficos en el banner:

- TITULOS PRINCIPALES: ${typo.headings}
- SUBTITULOS, BADGES Y PRECIOS: ${typo.subheadings}
- TEXTOS DE CUERPO, BENEFICIOS Y FOOTER: ${typo.body}

Reglas:
- Mantén estas mismas fuentes en TODOS los banners de la landing
- Los titulos deben ser GRANDES y en version BOLD/BLACK de la fuente indicada
- NO sustituyas estas fuentes por las del template de referencia
- Respeta la ESTRUCTURA y LAYOUT del template, solo cambia la tipografia`
}
