import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const productId = formData.get('productId') as string
    const index = formData.get('index') as string

    if (!file || !productId) {
      return NextResponse.json({ error: 'file y productId requeridos' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `product-photos/${user.id}/${productId}-${index || '0'}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(fileName, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      console.error('[upload-photo] Storage error:', uploadError.message)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('landing-images')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error: any) {
    console.error('[upload-photo] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
