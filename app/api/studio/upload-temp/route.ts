import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 60

/**
 * POST /api/studio/upload-temp
 * Upload a temporary file to Supabase Storage and return a public URL.
 * Used for: reference videos for viral transformation analysis.
 * Files are stored in landing-images/temp/{userId}/ and should be cleaned up after use.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo debe ser menor a 100MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'mp4'
    const fileName = `${Date.now()}-${crypto.randomUUID().substring(0, 8)}.${ext}`
    const storagePath = `temp/${user.id}/${fileName}`

    // Use service role client to bypass RLS
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await adminClient.storage
      .from('landing-images')
      .upload(storagePath, buffer, {
        contentType: file.type || 'video/mp4',
        upsert: false,
      })

    if (uploadError) {
      console.error('[UploadTemp] Upload error:', uploadError.message)
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
    }

    // Generate a signed URL (public for 1 hour — enough for Gemini to download)
    const { data: signedData, error: signedError } = await adminClient.storage
      .from('landing-images')
      .createSignedUrl(storagePath, 3600) // 1 hour

    if (signedError || !signedData?.signedUrl) {
      console.error('[UploadTemp] Signed URL error:', signedError?.message)
      // Fallback: try public URL
      const { data: publicData } = adminClient.storage
        .from('landing-images')
        .getPublicUrl(storagePath)

      return NextResponse.json({
        url: publicData.publicUrl,
        path: storagePath,
      })
    }

    console.log(`[UploadTemp] Uploaded ${storagePath} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)

    return NextResponse.json({
      url: signedData.signedUrl,
      path: storagePath,
    })
  } catch (error: any) {
    console.error('[UploadTemp] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al subir' }, { status: 500 })
  }
}
