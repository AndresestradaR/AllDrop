import { GenerateImageRequest } from './types'

export function buildColorSection(request: GenerateImageRequest): string {
  const palette = request.creativeControls?.colorPalette
  if (!palette?.primary) return ''

  const extraLine = palette.extra
    ? `- COLOR 4 (EXTRA): ${palette.extra} → elementos secundarios, decoraciones, variaciones, bordes`
    : ''

  return `
=== ⚠️ PALETA DE COLORES — RESTRICCION ABSOLUTA ⚠️ ===

ESTOS SON LOS UNICOS COLORES PERMITIDOS EN ESTE BANNER:

🎨 COLOR 1 (PRIMARIO): ${palette.primary} → fondo principal del banner, areas grandes, headers
🎨 COLOR 2 (SECUNDARIO): ${palette.secondary} → acentos principales, badges de precio, botones, CTAs
🎨 COLOR 3 (ACENTO): ${palette.accent} → iconos, checkmarks, highlights, detalles decorativos
${extraLine}

TAMBIEN PERMITIDOS (neutros complementarios):
- Blanco (#FFFFFF) para textos sobre fondos oscuros
- Negro (#000000) para textos sobre fondos claros
- Variaciones de opacidad de los colores de arriba (mas claros o mas oscuros)

🚫 COLORES ABSOLUTAMENTE PROHIBIDOS:
- NO usar beige, crema, marron, cafe, arena, dorado, amarillo, naranja NI NINGUN otro color que NO este en la paleta de arriba
- NO usar los colores del template de referencia si son diferentes a esta paleta
- NO inventar colores nuevos basandote en el "contexto" del producto
- NO usar grises como fondo principal (solo como texto)
- El FONDO del banner DEBE ser el color PRIMARIO (${palette.primary}) o una variacion clara/oscura de este
- CADA area visible del banner debe usar EXCLUSIVAMENTE colores de esta paleta

PRUEBA MENTAL: Antes de generar, verifica que CADA pixel de color en el banner proviene de esta paleta o de blanco/negro. Si encuentras beige, crema, marron u otro color externo → ELIMINALO y reemplazalo con uno de la paleta.`
}

export function buildProductContextSection(request: GenerateImageRequest): string {
  const ctx = request.creativeControls?.productContext
  if (!ctx) return ''

  const hasContent = ctx.description || ctx.benefits || ctx.problems || ctx.ingredients || ctx.differentiator
  if (!hasContent) return ''

  const lines: string[] = ['=== CONTEXTO DETALLADO DEL PRODUCTO ===']

  if (ctx.description) {
    lines.push(`\nDESCRIPCION COMPLETA: ${ctx.description}`)
  }
  if (ctx.benefits) {
    lines.push(`\nBENEFICIOS CLAVE: ${ctx.benefits}`)
  }
  if (ctx.problems) {
    lines.push(`\nPROBLEMAS QUE RESUELVE: ${ctx.problems}`)
  }
  if (ctx.ingredients) {
    lines.push(`\nINGREDIENTES/MATERIALES: ${ctx.ingredients}`)
  }
  if (ctx.differentiator) {
    lines.push(`\nDIFERENCIADOR CLAVE: ${ctx.differentiator}`)
  }

  lines.push('\nUSA esta informacion para crear textos y beneficios MAS ESPECIFICOS y relevantes en el banner. NO uses textos genericos — usa datos concretos del producto.')

  return lines.join('\n')
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
