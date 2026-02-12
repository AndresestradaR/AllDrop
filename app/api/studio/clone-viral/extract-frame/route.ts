import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

/**
 * Extract a frame from a video at a specific timestamp.
 * Uses the browser-side canvas approach (client sends frame as base64).
 * This endpoint just uploads the frame to Supabase Storage.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { frame_base64 } = body as { frame_base64: string }

    if (!frame_base64) {
      return NextResponse.json({ error: 'Se requiere el frame en base64' }, { status: 400 })
    }

    // Clean base64
    const base64Clean = frame_base64.includes(',')
      ? frame_base64.split(',')[1]
      : frame_base64

    const buffer = Buffer.from(base64Clean, 'base64')
    const filename = `clone-viral/frames/${user.id}/${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(filename)

    console.log(`[CloneViral/ExtractFrame] User: ${user.id.substring(0, 8)}..., Frame: ${publicUrl}`)

    return NextResponse.json({ frame_url: publicUrl })

  } catch (error: any) {
    console.error('[CloneViral/ExtractFrame] Error:', error.message)
    return NextResponse.json({ error: error.message || 'Error al extraer frame' }, { status: 500 })
  }
}
