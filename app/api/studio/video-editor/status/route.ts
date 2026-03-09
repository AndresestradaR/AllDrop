import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 30

const VIDEO_EDITOR_SERVICE_URL = process.env.VIDEO_EDITOR_SERVICE_URL || ''
const VIDEO_EDITOR_SECRET = process.env.VIDEO_EDITOR_SECRET || ''

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { userId, supabase } = auth

    if (!VIDEO_EDITOR_SERVICE_URL) {
      return NextResponse.json(
        { error: 'Servicio de edicion no configurado' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'jobId es requerido' }, { status: 400 })
    }

    // Forward to Railway service
    const resp = await fetch(`${VIDEO_EDITOR_SERVICE_URL}/api/status/${jobId}`, {
      headers: {
        'X-Editor-Secret': VIDEO_EDITOR_SECRET,
      },
    })

    if (!resp.ok) {
      return NextResponse.json(
        { error: 'Error al consultar estado' },
        { status: resp.status }
      )
    }

    const data = await resp.json()

    // If completed, create signed URL and save to generations
    if (data.status === 'completed' && data.videoPath) {
      // Create signed URL from Supabase Storage
      const { data: signedData } = await supabase.storage
        .from('landing-images')
        .createSignedUrl(data.videoPath, 86400) // 24h

      const videoUrl = signedData?.signedUrl || null

      // Save to generations table (fire-and-forget)
      if (videoUrl) {
        const serviceClient = await createServiceClient()
        serviceClient
          .from('generations')
          .insert({
            user_id: userId,
            product_name: 'Video: Editor',
            original_prompt: 'Video editado con Editor de Video',
            enhanced_prompt: `ar:16:9|editor:true`,
            status: 'completed',
            generated_image_url: `storage:${data.videoPath}`,
          })
          .then(({ error: dbErr }) => {
            if (dbErr) console.warn('[VideoEditor/status] DB save failed:', dbErr.message)
          })
      }

      return NextResponse.json({
        status: 'completed',
        videoUrl,
        videoPath: data.videoPath,
      })
    }

    if (data.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: data.error || 'Error al procesar video',
      })
    }

    // Still processing
    return NextResponse.json({
      status: 'processing',
      progress: data.progress || '0/0',
    })
  } catch (error: any) {
    console.error('[VideoEditor/status] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
