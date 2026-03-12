import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'El parámetro id es requerido' },
        { status: 400 }
      )
    }

    const { data: record, error: fetchError } = await supabase
      .from('generations')
      .select('generated_image_url, product_name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !record) {
      return NextResponse.json(
        { error: 'Ebook no encontrado' },
        { status: 404 }
      )
    }

    let url = record.generated_image_url

    if (url && url.startsWith('storage:')) {
      const path = url.replace('storage:', '')
      const { data: signedData, error: signError } = await supabase
        .storage
        .from('landing-images')
        .createSignedUrl(path, 86400)

      if (signError || !signedData?.signedUrl) {
        return NextResponse.json(
          { error: 'Error al generar URL de descarga' },
          { status: 500 }
        )
      }

      url = signedData.signedUrl
    }

    if (!url) {
      return NextResponse.json(
        { error: 'URL del ebook no disponible' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      url,
      title: record.product_name,
    })

  } catch (error) {
    console.error('Ebook download error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
