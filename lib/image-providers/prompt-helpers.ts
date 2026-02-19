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

export function buildSectionTypeSection(request: GenerateImageRequest): string {
  const sectionType = request.creativeControls?.sectionType
  if (!sectionType) return ''

  const angleName = request.creativeControls?.angleName || ''
  const angleTone = request.creativeControls?.angleTone || ''

  const sectionGuides: Record<string, string> = {
    'hero': 'SECCION HERO: Banner principal. Headline GRANDE e impactante. Producto prominente. Persona del avatar. CTA claro. Maximo impacto visual.',
    'oferta': 'SECCION OFERTA: Enfocado en PRECIO. Badge grande con precio de oferta. Precio anterior tachado. Urgencia (SOLO HOY, ULTIMAS UNIDADES). Combos si hay.',
    'antes-despues': 'SECCION ANTES/DESPUES: Dividido visualmente. Lado izquierdo "ANTES" (problema, dolor). Lado derecho "DESPUES" (solucion, resultado). Contraste dramatico.',
    'beneficios': 'SECCION BENEFICIOS: 3-4 beneficios con iconos/checkmarks. Layout limpio y organizado. Cada beneficio con titulo corto y una linea de descripcion.',
    'tabla-comparativa': 'SECCION COMPARATIVA: Tabla de comparacion. Tu producto con checks verdes. Competencia generica con X rojas. Demostrar superioridad clara.',
    'autoridad': 'SECCION AUTORIDAD: Certificaciones, estudios, endorsements, numeros de clientes satisfechos. Sellos de garantia. Credibilidad maxima.',
    'testimonios': 'SECCION TESTIMONIOS: 2-3 testimonios con foto de persona, nombre, texto corto con resultado. Estrellas de rating. Estilo reviews reales.',
    'ingredientes': 'SECCION INGREDIENTES: Mostrar los componentes/ingredientes/materiales clave. Iconos o imagenes de cada uno. Descripcion corta de que hace cada uno.',
    'modo-uso': 'SECCION MODO DE USO: Pasos numerados 1-2-3 (maximo 4). Iconos o mini-ilustraciones. Instrucciones claras y simples.',
    'logistica': 'SECCION LOGISTICA: Envio gratis, pago contraentrega, tiempos de entrega, devolucion. Sellos de confianza. Iconos de camion, escudo, reloj.',
    'faq': 'SECCION FAQ: 3-4 preguntas frecuentes con respuestas cortas. Formato pregunta/respuesta claro. Resolver objeciones comunes.',
    'casos-uso': 'SECCION CASOS DE USO: Situaciones reales donde el producto resuelve un problema. 3-4 escenarios con mini-ilustraciones. Texto que conecta con el dia a dia del cliente.',
    'caracteristicas': 'SECCION CARACTERISTICAS: Especificaciones y features del producto. Iconos tecnicos con datos concretos (tamaño, material, capacidad). Layout tipo ficha tecnica profesional.',
    'comunidad': 'SECCION COMUNIDAD: Numero de clientes/seguidores. Fotos de personas usando el producto. Hashtags, mentions. Social proof masivo. Estilo "unete a miles".',
  }

  const guide = sectionGuides[sectionType] || ''

  let result = ''
  if (guide) {
    result += `\n=== TIPO DE SECCION ===\n\n${guide}\n`
  }
  if (angleName) {
    result += `\nANGULO DE VENTA SELECCIONADO: "${angleName}" (tono: ${angleTone})\nTODO el contenido del banner debe reflejar este angulo. El headline, los textos y la atmosfera deben alinearse con este enfoque.\n`
  }

  return result
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
