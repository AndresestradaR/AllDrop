import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const formData = await request.formData()
    const file = formData.get('file') as File
    const mentorId = formData.get('mentorId') as string

    if (!file || !mentorId) {
      return NextResponse.json({ error: 'file y mentorId requeridos' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'webp'
    const fileName = `mentor-${mentorId}-${Date.now()}.${ext}`
    const storagePath = `coaching/mentors/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await adminClient.storage
      .from('landing-images')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/webp',
        upsert: true,
      })

    if (uploadError) {
      console.error('[Coaching] Photo upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = adminClient.storage
      .from('landing-images')
      .getPublicUrl(storagePath)

    // Update mentor photo_url
    const { error: updateError } = await adminClient
      .from('coaching_mentors')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', mentorId)

    if (updateError) {
      console.error('[Coaching] Photo URL update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: urlData.publicUrl })
  } catch (error: any) {
    console.error('[Coaching] POST mentor/photo error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
