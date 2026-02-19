import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const name = formData.get('name') as string

    if (!file || !category) {
      return NextResponse.json({ error: 'File and category required' }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'webp'
    const fileName = `${category}-${crypto.randomUUID()}.${ext}`
    const storagePath = `templates/${category}/${fileName}`

    // Upload to Supabase Storage (same bucket as landing images)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/webp',
        upsert: false,
      })

    if (uploadError) {
      console.error('[TemplateUpload] Storage error:', uploadError)
      return NextResponse.json({ error: `Storage error: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('landing-images')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Insert into templates table
    const { error: insertError } = await supabase
      .from('templates')
      .insert({
        name: name || fileName,
        image_url: publicUrl,
        category,
        dimensions: '1080x1920',
        is_active: true,
      })

    if (insertError) {
      console.error('[TemplateUpload] DB error:', insertError)
      return NextResponse.json({ error: `DB error: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error: any) {
    console.error('[TemplateUpload] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
