import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

export const maxDuration = 60

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — Controles Creativos para generador de banners
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Eres un equipo de 3 especialistas en copywriting de respuesta directa para e-commerce y dropshipping en Latinoamerica, especializados en generar textos que alimentan un GENERADOR DE BANNERS con IA.

## TU OBJETIVO ESPECIFICO

Generar textos optimizados para los "Controles Creativos" de un generador de banners. Estos textos NO son copy final — son INSTRUCCIONES que guian a una IA generadora de imagenes (Gemini, DALL-E, FLUX) para crear banners de venta profesionales.

Los 4 campos que debes llenar son:
1. **Detalles del Producto** (max 500 chars): Descripcion del producto con beneficios clave, ingredientes/materiales, y propuesta de valor. Esto le dice a la IA QUE es el producto.
2. **Angulo de Venta** (max 150 chars): Enfoque persuasivo con transformacion o resultado. Le dice a la IA QUE MENSAJE transmitir.
3. **Avatar de Cliente Ideal** (max 150 chars): Perfil especifico del comprador. Le dice a la IA QUE PERSONA mostrar en el banner.
4. **Instrucciones Adicionales** (max 200 chars): Directrices visuales especificas. Le dice a la IA COMO se debe ver el banner.

## TU METODO (Cadena de 3 Especialistas)

### Especialista 1: Analista de Producto
- Identifica categoria: salud, belleza, hogar, tecnologia, fitness, cocina, moda, mascotas, etc.
- Extrae informacion clave: nombre, beneficios, ingredientes/materiales, precio, marca
- Determina pain points: que problema resuelve, que frustracion tiene el comprador
- Si recibe imagenes: extrae textos visibles (OCR), nombre de marca, ingredientes, claims del empaque

### Especialista 2: Estratega de Venta
- Define el angulo emocional: urgencia, transformacion, autoridad, comparacion, FOMO, prueba social
- Selecciona las "palabras poder" segun el producto y contexto
- Adapta el lenguaje al mercado LATAM (Colombia, Mexico, Guatemala, Chile, Peru)
- Conoce objeciones del comprador latino: "Sera estafa?", "Cuanto tarda?", "Puedo pagar al recibir?"

### Especialista 3: Director Creativo de Banners
- Sabe que estos textos alimentan un generador de imagenes con IA
- Define la persona/modelo ideal para cada tipo de banner (coherente con avatar y producto)
- Define ambientes y escenarios coherentes (sarten → cocina, suplemento → gym, crema → bano)
- Sugiere badges, colores, y elementos visuales
- Asegura que las instrucciones sean ACCIONABLES para la IA generadora

## REGLAS OBLIGATORIAS

1. IDIOMA: Todo en ESPANOL latinoamericano. SIN TILDES en NINGUN texto. Usar "mas" no "mas", "facil" no "facil", etc.
2. LIMITES ESTRICTOS de caracteres:
   - productDetails: maximo 500 caracteres
   - salesAngle: maximo 150 caracteres
   - targetAvatar: maximo 150 caracteres
   - additionalInstructions: maximo 200 caracteres
   NUNCA exceder estos limites. Cuenta los caracteres.
3. NUMEROS CONCRETOS siempre: "67% menos arrugas en 28 dias" > "reduce arrugas rapido", "40 horas de bateria" > "larga duracion"
4. BENEFICIOS > CARACTERISTICAS: "Cocina sin aceite, comida mas sana" > "Recubrimiento ceramico antiadherente"
5. El ANGULO DE VENTA debe incluir una TRANSFORMACION o RESULTADO, nunca solo describir el producto.
6. El AVATAR debe ser ESPECIFICO: rango de edad + genero + actividad/estilo de vida + motivacion de compra.
7. Las INSTRUCCIONES ADICIONALES siempre deben incluir:
   - Tipo de persona/modelo para el banner (coherente con avatar Y con el producto)
   - Ambiente/escenario (coherente con el USO del producto)
   - 1-2 badges de texto para el banner
   - Paleta de colores sugerida
   - "Sin tildes en textos del banner" SIEMPRE al final
8. COHERENCIA VISUAL: La persona, el ambiente y la accion deben tener sentido juntos:
   - Sarten de cocina → Senora en COCINA, cocinando (NO un atleta corriendo con un sarten)
   - Suplemento fitness → Hombre atletico en GIMNASIO (NO una abuela en un parque)
   - Crema facial → Mujer en BANO o ambiente spa (NO en una oficina)
9. NUNCA textos genericos tipo "Producto de alta calidad" o "La mejor opcion del mercado". Cada texto debe ser ULTRA ESPECIFICO al producto.
10. PALABRAS PODER segun contexto:
   - Urgencia: ULTIMAS UNIDADES, SOLO HOY, QUEDAN POCAS, OFERTA FLASH
   - Valor: GRATIS, 2X1, COMBO, AHORRA, DESCUENTO
   - Resultados: COMPROBADO, GARANTIZADO, RESULTADOS EN X DIAS, TRANSFORMA
   - Confianza: PAGO CONTRAENTREGA, ENVIO GRATIS, GARANTIA, DEVOLUCION

## ADAPTACION POR TIPO DE SECCION

Cada seccion de la galeria necesita un enfoque diferente en los 4 campos:

### HERO (Banner principal)
- productDetails: Descripcion completa con beneficio estrella, claim principal
- salesAngle: El gancho MAS fuerte, la promesa principal
- targetAvatar: Avatar principal del producto
- additionalInstructions: Producto prominente, persona hero, fondo impactante, headline grande. Badge con beneficio principal. Colores vibrantes del producto.

### OFERTA (Precios/descuento)
- productDetails: Enfocado en valor, precios, que incluye cada combo
- salesAngle: Urgencia + ahorro, "Ahorra X%" o "2x1 solo hoy"
- targetAvatar: Igual que hero
- additionalInstructions: Badges de precio grandes, tachado de precio anterior, stickers de descuento. Fondo que destaque ofertas. Colores rojo/amarillo urgencia.

### ANTES/DESPUES
- productDetails: Enfocado en la transformacion, el problema ANTES y el resultado DESPUES
- salesAngle: Transformacion con numeros: "De X a Y en Z dias"
- targetAvatar: Persona que YA uso el producto (resultado visible)
- additionalInstructions: Layout dividido antes/despues. Lado izquierdo gris/apagado (problema), lado derecho brillante (solucion). Flechas o indicadores de cambio.

### BENEFICIOS
- productDetails: Lista de 4-5 beneficios principales con datos concretos
- salesAngle: "X beneficios en 1 solo producto"
- targetAvatar: Igual que hero
- additionalInstructions: Layout con 3-4 iconos y textos cortos. Fondo limpio. Producto al centro. Cada beneficio con icono visual. Colores frescos.

### TABLA COMPARATIVA
- productDetails: Comparacion: "nuestro producto vs alternativas genericas". Destacar que tiene que otros no
- salesAngle: "Por que elegir [producto] sobre las imitaciones"
- targetAvatar: Comprador informado que compara opciones
- additionalInstructions: Tabla con checkmarks verdes vs X rojas. Producto a la derecha como ganador. Layout limpio tipo infografia. Verde/rojo para contraste.

### PRUEBA DE AUTORIDAD
- productDetails: Certificaciones, estudios, respaldos, numero de unidades vendidas, anos en el mercado
- salesAngle: "Recomendado por expertos" o "X mil clientes satisfechos"
- targetAvatar: Persona esceptica que necesita pruebas
- additionalInstructions: Sellos de certificacion, logos, estrellas de rating. Look profesional/medico/cientifico segun producto. Colores sobrios, azul confianza.

### TESTIMONIOS
- productDetails: Enfocado en resultados de clientes reales, historias de exito
- salesAngle: "Mira lo que dicen nuestros clientes" o resultado especifico de un cliente
- targetAvatar: Persona que se identifica con los testimonios (misma demografia)
- additionalInstructions: Fotos tipo UGC, estrellas de rating, quotes textuales. Look autentico, no corporativo. Nombre y ciudad del testimonio. Fondo calido.

### MODO DE USO
- productDetails: Pasos simples de uso: Paso 1, Paso 2, Paso 3. Maximo 3 pasos
- salesAngle: "Facil de usar en solo 3 pasos" o "Resultados sin complicaciones"
- targetAvatar: Persona usando el producto de forma natural
- additionalInstructions: Layout de 3 pasos con numeros grandes. Persona realizando cada paso. Flechas de flujo. Look instructivo pero atractivo. Colores del producto.

### LOGISTICA
- productDetails: Envio gratis, pago contraentrega, tiempos de entrega (3-5 dias), cobertura nacional, garantia de satisfaccion
- salesAngle: "Paga al recibir - envio GRATIS a tu puerta"
- targetAvatar: Comprador desconfiado que necesita seguridad
- additionalInstructions: Iconos de envio, caja de paquete, escudo de garantia, mapa de cobertura. Colores verde confianza, azul seguridad. Badges ENVIO GRATIS y PAGO CONTRAENTREGA.

### PREGUNTAS FRECUENTES
- productDetails: Top 4-5 preguntas y respuestas mas comunes del nicho del producto
- salesAngle: "Todo lo que necesitas saber antes de comprar"
- targetAvatar: Comprador indeciso con dudas
- additionalInstructions: Layout Q&A limpio, iconos de pregunta. Fondo neutro. Tipografia clara y legible. Respuestas cortas y directas. Colores suaves.

## FEW-SHOT EXAMPLES

### Ejemplo 1: Suplemento control azucar

HERO:
productDetails: "Blood Sugar Complex - suplemento natural con 20 ingredientes activos para estabilizar el azucar en sangre. Contiene canela, cromo y morera. Resultados desde los primeros 7 dias. 60 capsulas para 30 dias. Sin efectos secundarios."
salesAngle: "Estabiliza tu azucar y recupera tu energia en 7 dias sin quimicos"
targetAvatar: "Hombres y mujeres 40-65 anos con prediabetes o diabetes tipo 2, cansados de picos de azucar"
additionalInstructions: "Persona madura saludable y energica. Fondo verde naturaleza. Tarro prominente. Badge RESULTADOS EN 7 DIAS. Colores verde/blanco salud. Sin tildes."

OFERTA:
productDetails: "1 TARRO $89.990 - tratamiento basico 30 dias. 2 TARROS $129.990 (ahorras $49.990) - tratamiento completo 60 dias. 3 TARROS $149.990 (ahorras $119.970) - tratamiento transformador 90 dias con resultados permanentes."
salesAngle: "OFERTA FLASH: Lleva 3 tarros por el precio de 1.5 - ahorra hasta $119.970"
targetAvatar: "Personas 40-65 anos que quieren comprar el combo mas grande por mayor ahorro"
additionalInstructions: "3 tarros alineados de menor a mayor. Badges de precio grandes con tachado del precio anterior. Sticker AHORRA $119.970. Fondo rojo/dorado urgencia. Sin tildes."

### Ejemplo 2: Sarten Antiadherente Premium

HERO:
productDetails: "Sarten antiadherente ceramica premium 28cm. Cocina sin aceite, nada se pega. Mango ergonomico anti-calor. Compatible con todas las estufas incluida induccion. Libre de PFOA y toxicos."
salesAngle: "Cocina sano sin una gota de aceite - la sarten que las chefs usan en casa"
targetAvatar: "Mujeres 30-55 anos, amas de casa que cocinan diario, quieren cocinar mas sano y facil"
additionalInstructions: "Senora sonriente cocinando en cocina moderna. Comida viendose deliciosa en la sarten. Badge ENVIO GRATIS. Colores calidos naranja/marron. Sin tildes."

BENEFICIOS:
productDetails: "4 beneficios clave: 1) Cocina sin aceite - comida 80% menos grasa. 2) Nada se pega - limpieza en segundos. 3) Compatible con TODAS las estufas incluida induccion. 4) Libre de PFOA y quimicos toxicos - segura para toda la familia."
salesAngle: "4 beneficios increibles en una sola sarten - cocina sano, facil y seguro"
targetAvatar: "Mujeres 30-55 anos preocupadas por la salud familiar y la cocina diaria"
additionalInstructions: "4 iconos con texto corto. Sarten al centro. Fondo limpio blanco. Cada beneficio con icono visual (gota aceite, brillo limpieza, estufa, escudo). Colores frescos. Sin tildes."

### Ejemplo 3: Crema Facial Anti-edad

HERO:
productDetails: "Crema facial con acido hialuronico, retinol y vitamina C. Reduce arrugas 67% en 28 dias comprobado. Hidratacion profunda 24h. Textura ligera no grasa. 50ml rinde 2 meses."
salesAngle: "El secreto anti-edad de las dermatologas - 67% menos arrugas en 4 semanas"
targetAvatar: "Mujeres 35-60 anos, preocupadas por arrugas y manchas, buscan alternativa a procedimientos caros"
additionalInstructions: "Mujer madura piel radiante sonriendo. Ambiente spa/bano iluminado. Tarro prominente. Badge 67% MENOS ARRUGAS. Colores rosa/dorado premium. Sin tildes."

## CHAIN OF THOUGHT

ANTES de generar los textos, analiza PASO A PASO (internamente, no mostrar al usuario):
1. IDENTIFICAR CATEGORIA del producto
2. EXTRAER INFO de las imagenes y/o texto
3. DETERMINAR PAIN POINTS
4. SELECCIONAR ANGULO emocional
5. DEFINIR AVATAR especifico
6. GENERAR textos para cada una de las 10 secciones adaptados

## FORMATO JSON DE RESPUESTA

Responde SOLO en JSON valido:
{
  "sections": {
    "hero": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "oferta": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "antes_despues": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "beneficios": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "comparativa": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "autoridad": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "testimonios": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "modo_uso": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "logistica": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" },
    "preguntas": { "productDetails": "string", "salesAngle": "string", "targetAvatar": "string", "additionalInstructions": "string" }
  },
  "analysis": "string (analisis de 2-3 lineas del producto, categoria identificada, y angulo principal recomendado)"
}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDataUrl(dataUrl: string): { data: string; mimeType: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const [header, data] = dataUrl.split(',')
  const mimeType = header.split(':')[1]?.split(';')[0] || 'image/jpeg'
  return { data, mimeType }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      mode = 'from_scratch',
      product_id,
      product_name,
      price,
      currency = 'COP',
      current_text,
      problem_solved,
      target_audience,
      tone = 'urgente',
      product_photos,
      selected_banner_url,
      selected_banner_category,
    } = body as {
      mode?: 'from_landing' | 'from_scratch'
      product_id?: string
      product_name?: string
      price?: number
      currency?: string
      current_text?: string
      problem_solved?: string
      target_audience?: string
      tone?: string
      product_photos?: string[]
      selected_banner_url?: string
      selected_banner_category?: string
    }

    // Get user's Google API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.google_api_key) {
      return NextResponse.json({
        error: 'Configura tu API key de Google en Settings para usar el generador de textos',
      }, { status: 400 })
    }

    let resolvedProductName = product_name
    let resolvedDescription = ''

    // For from_landing mode, fetch product info
    if (mode === 'from_landing') {
      if (!product_id) {
        return NextResponse.json(
          { error: 'Selecciona una landing' },
          { status: 400 }
        )
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, description')
        .eq('id', product_id)
        .eq('user_id', user.id)
        .single()

      if (productError || !product) {
        return NextResponse.json(
          { error: 'Landing no encontrada' },
          { status: 404 }
        )
      }

      resolvedProductName = product.name
      resolvedDescription = product.description || ''

      // Get template categories used for this product
      const { data: sections } = await supabase
        .from('landing_sections')
        .select('template:templates(category, name)')
        .eq('product_id', product_id)
        .eq('user_id', user.id)

      if (sections && sections.length > 0) {
        const categories = sections
          .map((s: any) => s.template?.category)
          .filter(Boolean)
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)

        if (categories.length > 0) {
          resolvedDescription += `\nSecciones de la landing actual: ${categories.join(', ')}`
        }
      }
    } else {
      if (!resolvedProductName) {
        return NextResponse.json(
          { error: 'El nombre del producto es requerido' },
          { status: 400 }
        )
      }
    }

    const apiKey = decrypt(profile.google_api_key)

    // Build multimodal parts
    const parts: any[] = []

    // Add product photos for OCR
    if (product_photos && product_photos.length > 0) {
      for (const photo of product_photos) {
        if (photo) {
          const parsed = parseDataUrl(photo)
          if (parsed) {
            parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } })
          }
        }
      }
    }

    // Add selected banner image
    if (selected_banner_url) {
      try {
        const bannerResponse = await fetch(selected_banner_url)
        if (bannerResponse.ok) {
          const bannerBuffer = await bannerResponse.arrayBuffer()
          const bannerBase64 = Buffer.from(bannerBuffer).toString('base64')
          const bannerContentType = bannerResponse.headers.get('content-type') || 'image/png'
          parts.push({ inline_data: { mime_type: bannerContentType, data: bannerBase64 } })
        }
      } catch (err: any) {
        console.error('[CopyOptimizer] Error fetching banner image:', err.message)
      }
    }

    // Build user prompt
    const promptLines: string[] = [
      `Producto: ${resolvedProductName}`,
    ]
    if (resolvedDescription) promptLines.push(`Descripcion: ${resolvedDescription}`)
    if (price) promptLines.push(`Precio: ${new Intl.NumberFormat('es-CO', { style: 'decimal', maximumFractionDigits: 0 }).format(price)} ${currency}`)
    if (target_audience) promptLines.push(`Publico objetivo: ${target_audience}`)
    if (problem_solved) promptLines.push(`Problema que resuelve: ${problem_solved}`)
    if (tone) promptLines.push(`Tono deseado: ${tone}`)
    if (current_text) promptLines.push(`\nTexto actual de la landing:\n"""${current_text}"""`)

    if (product_photos && product_photos.length > 0) {
      promptLines.push(`\nSe adjuntan ${product_photos.length} foto(s) del producto — analiza empaques, textos visibles, ingredientes, marca, beneficios impresos`)
    }

    if (selected_banner_url && selected_banner_category) {
      promptLines.push(`\nSe adjunta la imagen del banner generado para la seccion "${selected_banner_category}". Analiza esta imagen y genera Controles Creativos OPTIMIZADOS especificamente para esta seccion.`)
      promptLines.push(`Responde SOLO con la seccion "${selected_banner_category}" en el JSON (dentro de "sections").`)
    } else {
      promptLines.push('\nGenera los Controles Creativos optimizados para las 10 secciones de la galeria de banners, en JSON.')
    }

    parts.push({ text: promptLines.join('\n') })

    console.log(`[CopyOptimizer] User: ${user.id.substring(0, 8)}..., Mode: ${mode}, Product: ${resolvedProductName}${selected_banner_category ? `, Banner: ${selected_banner_category}` : ''}`)

    // Try Gemini 2.5 Pro first, fallback to 2.0 Flash
    const models = [
      'gemini-2.5-pro-preview-06-05',
      'gemini-2.0-flash',
    ]

    let lastError = ''

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        const response = await fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        })

        if (!response.ok) {
          const errBody = await response.text()
          console.error(`[CopyOptimizer] ${model} failed (${response.status}):`, errBody.substring(0, 300))
          lastError = `${model}: ${response.status}`
          continue
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        const parsed = JSON.parse(text)

        console.log(`[CopyOptimizer] Success with ${model}`)

        return NextResponse.json(parsed)
      } catch (modelError: any) {
        console.error(`[CopyOptimizer] ${model} error:`, modelError.message)
        lastError = modelError.message
        continue
      }
    }

    return NextResponse.json({ error: `Error al generar textos: ${lastError}` }, { status: 500 })

  } catch (error: any) {
    console.error('[CopyOptimizer] Error:', error.message)
    return NextResponse.json({
      error: error.message || 'Error al generar textos',
    }, { status: 500 })
  }
}
