import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (user.email !== 'trucosecomydrop@gmail.com') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs requeridos' }, { status: 400 })
    }

    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get image URLs before deleting (to clean up storage)
    const { data: templates } = await adminClient
      .from('templates')
      .select('id, image_url')
      .in('id', ids)

    // Delete from DB
    const { error: deleteError } = await adminClient
      .from('templates')
      .delete()
      .in('id', ids)

    if (deleteError) {
      console.error('[TemplateDelete] DB error:', deleteError)
      return NextResponse.json({ error: `DB error: ${deleteError.message}` }, { status: 500 })
    }

    // Try to clean up storage files (best effort)
    if (templates) {
      for (const t of templates) {
        try {
          const url = new URL(t.image_url)
          // Extract storage path from URL: .../landing-images/templates/category/file.webp
          const match = url.pathname.match(/landing-images\/(.+)$/)
          if (match) {
            await adminClient.storage.from('landing-images').remove([match[1]])
          }
        } catch {
          // Ignore storage cleanup errors
        }
      }
    }

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error: any) {
    console.error('[TemplateDelete] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
