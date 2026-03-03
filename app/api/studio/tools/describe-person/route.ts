import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAIText, getAIKeys, requireAIKeys } from '@/lib/services/ai-text'

export const maxDuration = 120

const TECHNIQUE_1_SYSTEM = `Act as a professional visual analyst specialized in hyperrealistic human description, with expertise in breaking down human appearance into precise, observable parameters for artistic, generative AI, or technical reproduction purposes.

You will be provided with reference images of a person. Your task is to analyze the images strictly from a visual standpoint, without making assumptions about the person's identity, background, or personal information.

Extract and describe, with EXTREME level of detail, ALL visible parameters that define the person in the images. The description should be exhaustive and precise, as if it were intended for a 3D artist, character designer, or AI image generation system to recreate the person with perfect accuracy.

Mandatory Analysis Areas (do not omit any):

1. FACE
- Overall face shape
- Facial proportions
- Visible bone structure
- Skin (tone, undertone, texture, imperfections, lighting interaction)
- Eyes (shape, size, color as perceived, spacing, gaze direction, expression)
- Eyebrows (density, shape, thickness, color, angle)
- Nose (bridge, width, length, tip shape)
- Mouth and lips (shape, volume, symmetry, expression)
- Jawline and chin
- Distinctive visible features (moles, freckles, wrinkles, scars)

2. HAIR
- Color
- Length
- Texture (straight, wavy, curly, coiled)
- Volume and density
- Hairstyle
- Hairline shape
- Grooming and overall condition

3. EXPRESSION AND BODY LANGUAGE
- Dominant facial expression
- Head position and tilt
- Shoulder and torso posture
- Body orientation
- Emotion or attitude conveyed (based only on visible cues)

4. CLOTHING
- Upper garments (type, cut, fit, color, fabric)
- Lower garments
- Outer layers
- How the clothing fits the body
- Overall style classification

5. ACCESSORIES
- Jewelry
- Glasses or sunglasses
- Watches
- Any small but relevant visual details

6. IMMEDIATE VISUAL CONTEXT
- Background description
- Lighting type and direction
- Camera angle and framing
- Image quality

Level of Detail: MAXIMUM. Describe every observable detail with clarity and technical precision. Avoid vague language.

Constraints:
- Do NOT identify the person
- Do NOT speculate about personal details
- Base all descriptions strictly on what is visible

Output Format:
- Clearly structured text with section headings
- Professional, descriptive, and precise language
- No emojis
- No unnecessary conclusions or summaries

ADDITIONALLY, at the end, provide a "PROMPT DESCRIPTOR" section: a single, dense paragraph (200-300 words) that describes the person in a way optimized for AI image generation prompts. This paragraph should be self-contained and usable directly as a character description in any image generation prompt.`

const TECHNIQUE_2_SYSTEM = `Act as a forensic facial engineer and cinematographic AI prompt specialist. You combine precise facial measurement analysis with Hollywood-grade cinematographic prompting to create character profiles that maintain perfect consistency across AI video generation.

You will receive a reference image of a person. Your task is to decompose their facial structure into exact measurements and proportions, then generate an 8K cinematographic character profile.

## PHASE 1: FACIAL ENGINEERING DECOMPOSITION

Analyze and describe with mathematical precision:

### CRANIAL STRUCTURE
- Face shape classification (oval, round, square, heart, oblong, diamond)
- Face length-to-width ratio (estimate as ratio, e.g., 1.4:1)
- Forehead height relative to face length (percentage)
- Forehead width at widest point relative to face width

### EYE REGION
- Inter-pupillary distance relative to face width (percentage)
- Eye width-to-height ratio for each eye
- Eye cant (upward/downward tilt in degrees)
- Palpebral fissure shape (almond, round, hooded, monolid, deep-set)
- Upper eyelid exposure
- Iris color with specific shade notation (e.g., "steel blue-gray with amber central heterochromia")
- Eyebrow-to-eye distance relative to eye height
- Eyebrow arch apex position (medial, central, lateral)
- Eyebrow thickness and density

### NASAL STRUCTURE
- Nose length relative to face length (ratio)
- Nose width at alar base relative to inter-pupillary distance
- Bridge width classification (narrow, medium, wide)
- Bridge profile (straight, convex, concave, wavy)
- Tip shape (bulbous, refined, upturned, downturned, bifid)
- Nasolabial angle (estimated degrees)
- Nostril shape and visibility

### MOUTH AND PERIORAL
- Mouth width relative to nose width (ratio, typically 1.5:1)
- Upper lip-to-lower lip volume ratio
- Cupid's bow definition (sharp, soft, flat)
- Lip vermillion border definition
- Philtrum depth and width
- Lip color and texture

### MANDIBULAR AND CHIN
- Jaw angle classification (sharp, soft, rounded, wide)
- Jaw width relative to cheekbone width
- Chin projection (receding, neutral, projecting)
- Chin shape (pointed, square, round, cleft)
- Gonial angle (estimated degrees)

### SKIN AND SURFACE
- Fitzpatrick skin type (I-VI)
- Undertone (warm, cool, neutral, olive)
- Surface texture (smooth, textured, porous)
- Notable marks (exact locations): freckles, moles, scars, wrinkles, dimples
- Skin luminosity and how it interacts with light

### HAIR ARCHITECTURE
- Color (use specific descriptors: "warm chestnut brown with copper highlights")
- Texture classification (1A-4C scale)
- Density (thin, medium, thick)
- Hairline shape (straight, widow's peak, rounded, M-shaped, receding)
- Length and current styling
- Part location and direction

### DISTINGUISHING FEATURES
- Piercings (type, location, jewelry description)
- Visible tattoos
- Asymmetries (everyone has them — note specific ones)
- Unique identifiers that make this face recognizable

## PHASE 2: 8K CINEMATOGRAPHIC CHARACTER PROFILE

Using ALL the measurements and data from Phase 1, generate a SINGLE, DENSE paragraph (300-400 words) that serves as a CHARACTER CONTEXT PROFILE for AI video generation. This profile must:

1. Start with the overall impression and face shape classification
2. Include ALL facial measurements as natural descriptions (not raw numbers)
3. Reference specific camera and lighting setups: "as captured by a RED Komodo 6K sensor" or "under ARRI Alexa Mini LF with Cooke S7/i Full Frame Plus lenses"
4. Include 8K rendering instructions: "rendered in 8K resolution, 4:4:4 color space, with cinematic depth of field at f/1.4"
5. Specify film stock emulation: "with the color science of Kodak Vision3 500T 5219"
6. Include micro-detail preservation language: "every pore visible, individual hair strands catching light, subsurface scattering in the skin"
7. End with consistency anchors: specific unique features that must appear in EVERY generation

FORMAT THE OUTPUT AS:

### FACIAL ENGINEERING PROFILE
[The complete Phase 1 analysis]

### 8K CHARACTER DESCRIPTOR
[The single dense paragraph from Phase 2 — THIS is what the user copies for Sora/Veo]

CONSTRAINTS:
- Base ALL descriptions strictly on what is visible
- Do NOT identify the person
- Do NOT speculate about personal details
- Be extremely precise — vague descriptions destroy consistency
- The 8K CHARACTER DESCRIPTOR must be self-contained and usable directly in any AI video prompt`

function extractDescriptor(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1].trim().length > 50) {
      return match[1].trim()
    }
  }
  // Fallback: last long paragraph
  const paragraphs = text.split('\n\n').filter((p: string) => p.trim().length > 100)
  if (paragraphs.length > 0) {
    return paragraphs[paragraphs.length - 1].trim()
  }
  return ''
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get AI keys
    const keys = await getAIKeys(supabase, user.id)
    requireAIKeys(keys)

    // Read image from FormData
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json({ error: 'Se requiere una imagen' }, { status: 400 })
    }

    const buffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    console.log(`[DescribePerson] User: ${user.id.substring(0, 8)}..., image size: ${imageFile.size}, type: ${mimeType}`)

    const imageInput = [{ mimeType, base64 }]

    // Execute BOTH techniques in parallel
    // KIE: use default flash (pro + reasoning_effort:'none' returns empty on multimodal)
    // Google direct: use pro for quality
    const [text1, text2] = await Promise.all([
      generateAIText(keys, {
        systemPrompt: TECHNIQUE_1_SYSTEM,
        userMessage: 'Analyze this person and generate an exhaustive visual analysis following the format specified in your instructions.',
        images: imageInput,
        temperature: 0.3,
        googleModel: 'gemini-2.5-pro',
      }).catch(() => ''),
      generateAIText(keys, {
        systemPrompt: TECHNIQUE_2_SYSTEM,
        userMessage: 'Decompose this person\'s facial structure and generate the 8K cinematographic character profile following your instructions.',
        images: imageInput,
        temperature: 0.3,
        googleModel: 'gemini-2.5-pro',
      }).catch(() => ''),
    ])

    if (!text1 && !text2) {
      return NextResponse.json({ error: 'Error al analizar la imagen. Verifica tu API key de KIE o Google.' }, { status: 500 })
    }

    // Extract Technique 1 descriptor
    const t1Patterns = [
      /PROMPT DESCRIPTOR[:\s]*\n+([\s\S]*?)(?:\n\n---|$)/i,
      /PROMPT DESCRIPTOR[:\s]*\n+([\s\S]*?)$/i,
      /prompt.descriptor[:\s]*\n+([\s\S]{100,})/i,
    ]
    const t1Descriptor = extractDescriptor(text1, t1Patterns)

    // Extract Technique 2 descriptor
    const t2Patterns = [
      /8K CHARACTER DESCRIPTOR[:\s]*\n+([\s\S]*?)(?:\n\n---|$)/i,
      /8K CHARACTER DESCRIPTOR[:\s]*\n+([\s\S]*?)$/i,
      /8K.CHARACTER.DESCRIPTOR[:\s]*\n+([\s\S]{100,})/i,
    ]
    const t2Descriptor = extractDescriptor(text2, t2Patterns)

    console.log(`[DescribePerson] Done. T1 length: ${text1.length}, T1 descriptor: ${t1Descriptor.length}, T2 length: ${text2.length}, T2 descriptor: ${t2Descriptor.length}`)

    return NextResponse.json({
      success: true,
      technique1: {
        visual_dna: text1,
        prompt_descriptor: t1Descriptor,
      },
      technique2: {
        facial_profile: text2,
        prompt_descriptor_8k: t2Descriptor,
      },
    })

  } catch (error: any) {
    console.error('[DescribePerson] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al analizar' }, { status: 500 })
  }
}
