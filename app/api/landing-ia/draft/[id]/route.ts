import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const { data: draft, error } = await supabase
    .from('landing_ia_drafts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !draft) {
    return new Response(JSON.stringify({ error: 'Borrador no encontrado' }), { status: 404 })
  }

  return Response.json(draft)
}
