import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'
import { aiLimiter, getClientIp } from '@/lib/rate-limit'

// Call Gemini 2.5 Flash Image API for editing
async function editImageWithGemini(
  apiKey: string,
  originalImageBase64: string,
  originalMimeType: string,
  editInstruction: string,
  referenceImageBase64?: string,
  referenceMimeType?: string
): Promise<{ imageBase64: string; mimeType: string } | null> {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
  
  // Build the parts array with original image and edit instruction
  const parts: any[] = [
    {
      inline_data: {
        mime_type: originalMimeType,
        data: originalImageBase64
      }
    }
  ]
  
  // Add reference image if provided
  if (referenceImageBase64 && referenceMimeType) {
    parts.push({
      inline_data: {
        mime_type: referenceMimeType,
        data: referenceImageBase64
      }
    })
    parts.push({
      text: `Edit the first image following this instruction: "${editInstruction}". Use the second image as a style/design reference if relevant.`
    })
  } else {
    parts.push({
      text: `Edit this landing page image following this instruction: "${editInstruction}". Maintain the overall professional e-commerce style and layout.`
    })
  }

  const payload = {
    contents: [{
      parts: parts
    }],
    generationConfig: {
      responseModalities: ['IMAGE']
    }
  }

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini Edit API error:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Extract image from response
    const candidates = data.candidates || []
    for (const candidate of candidates) {
      const contentParts = candidate.content?.parts || []
      for (const part of contentParts) {
        if (part.inlineData?.data) {
          return {
            imageBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          }
        }
      }
    }
    
    return null
  } catch (error: any) {
    console.error('Gemini edit error:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { success } = aiLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }, { status: 429 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId, originalImageUrl, editInstruction, referenceImageUrl, productName } = body

    if (!sectionId || !originalImageUrl || !editInstruction) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Get user's API key
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_api_key')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.google_api_key) {
      return NextResponse.json({ error: 'Configura tu API key de Google en Settings' }, { status: 400 })
    }

    const googleApiKey = decrypt(profile.google_api_key)

    // Get original section to verify ownership
    const { data: section, error: sectionError } = await supabase
      .from('landing_sections')
      .select('*')
      .eq('id', sectionId)
      .eq('user_id', user.id)
      .single()

    if (sectionError || !section) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    // Convert original image to base64
    let originalBase64: string
    let originalMimeType: string
    
    if (originalImageUrl.startsWith('data:')) {
      originalBase64 = originalImageUrl.split(',')[1]
      originalMimeType = originalImageUrl.split(';')[0].split(':')[1]
    } else {
      const response = await fetch(originalImageUrl)
      const buffer = await response.arrayBuffer()
      originalBase64 = Buffer.from(buffer).toString('base64')
      originalMimeType = response.headers.get('content-type') || 'image/png'
    }

    // Convert reference image if provided
    let referenceBase64: string | undefined
    let referenceMimeType: string | undefined
    
    if (referenceImageUrl) {
      if (referenceImageUrl.startsWith('data:')) {
        referenceBase64 = referenceImageUrl.split(',')[1]
        referenceMimeType = referenceImageUrl.split(';')[0].split(':')[1]
      } else {
        const response = await fetch(referenceImageUrl)
        const buffer = await response.arrayBuffer()
        referenceBase64 = Buffer.from(buffer).toString('base64')
        referenceMimeType = response.headers.get('content-type') || 'image/png'
      }
    }

    // Edit image with Gemini
    const editResult = await editImageWithGemini(
      googleApiKey,
      originalBase64,
      originalMimeType,
      editInstruction,
      referenceBase64,
      referenceMimeType
    )

    if (!editResult) {
      return NextResponse.json({ 
        success: false,
        error: 'No se pudo editar la imagen'
      }, { status: 200 })
    }

    const generatedImageUrl = `data:${editResult.mimeType};base64,${editResult.imageBase64}`

    // Save as a new section (keeping history)
    const serviceClient = await createServiceClient()
    const { data: newSection, error: insertError } = await serviceClient
      .from('landing_sections')
      .insert({
        product_id: section.product_id,
        user_id: user.id,
        template_id: section.template_id,
        output_size: section.output_size,
        generated_image_url: generatedImageUrl,
        prompt_used: `EDIT: ${editInstruction}\n\nORIGINAL PROMPT: ${section.prompt_used}`,
        status: 'completed',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
    }

    return NextResponse.json({
      success: true,
      imageUrl: generatedImageUrl,
      sectionId: newSection?.id,
    })
  } catch (error: any) {
    console.error('Edit section API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Error al editar sección' 
    }, { status: 500 })
  }
}
