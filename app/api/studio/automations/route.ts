import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_SYSTEM_PROMPT = `Eres un experto en crear contenido UGC para dropshipping en Colombia y LATAM.
Tu trabajo es generar un prompt de video corto (5-10 segundos) para un influencer virtual que promociona un producto.

REGLAS:
- El video debe verse natural, como un reel de Instagram/TikTok real
- El influencer debe hablar en español con acento {voice_style}
- Cada video debe tener un escenario/situación DIFERENTE y creativo
- Incluye emociones genuinas y lenguaje coloquial colombiano
- El producto debe aparecer de forma natural, no forzada
- El prompt debe ser específico y visual (describe poses, gestos, mirada, entorno)

PRODUCTO: {product_name}
INFLUENCER: {influencer_name}
DESCRIPCIÓN INFLUENCER: {influencer_descriptor}

{scenarios_instruction}

Genera UN escenario aleatorio creativo y el prompt de video optimizado.
Responde SOLO en JSON válido:
{
  "scenario": "descripción breve del escenario",
  "video_prompt": "prompt completo optimizado para el modelo de video",
  "caption": "texto para publicar en redes sociales con emojis y hashtags"
}`

const DEFAULT_SCENARIOS = [
  'Mostrando el producto recién llegado, abriendo el paquete emocionada',
  'Grabándose frente al espejo usando el producto por primera vez',
  'Haciendo un story time de cómo descubrió el producto',
  'Recomendando el producto a una amiga por videollamada',
  'Antes y después de usar el producto, reacción genuina',
  'Usando el producto en su rutina diaria, de forma casual',
  'Respondiendo a un comentario hater sobre el producto',
  'Mostrando el producto en su mesa de noche, aesthetic',
  'Haciendo un Get Ready With Me incluyendo el producto',
  'Review honesta después de 2 semanas usando el producto',
]

// GET: List all automations for the user
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const includeRuns = searchParams.get('includeRuns') === 'true'

    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Optionally include last 5 runs for each
    if (includeRuns && automations) {
      for (const auto of automations) {
        const { data: runs } = await supabase
          .from('automation_runs')
          .select('*')
          .eq('automation_id', auto.id)
          .order('created_at', { ascending: false })
          .limit(5)
        ;(auto as any).recent_runs = runs || []
      }
    }

    return NextResponse.json({ automations: automations || [] })
  } catch (err: any) {
    console.error('[Automations] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: Create a new automation
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      name,
      influencer_id,
      preset = 'rapido',
      product_name,
      product_image_url,
      system_prompt,
      scenarios,
      voice_style = 'latina',
      publer_account_ids = [],
      caption_prompt,
      hashtags,
      frequency_hours = 12,
      mode = 'auto',
      aspect_ratio = '9:16',
      duration = 10,
    } = body

    if (!name || !influencer_id || !product_name) {
      return NextResponse.json(
        { error: 'name, influencer_id y product_name son requeridos' },
        { status: 400 }
      )
    }

    const now = new Date()
    const nextRun = new Date(now.getTime() + frequency_hours * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('automations')
      .insert({
        user_id: user.id,
        name,
        influencer_id,
        preset,
        product_name,
        product_image_url: product_image_url || null,
        system_prompt: system_prompt || DEFAULT_SYSTEM_PROMPT,
        scenarios: scenarios && scenarios.length > 0 ? scenarios : DEFAULT_SCENARIOS,
        voice_style,
        publer_account_ids,
        caption_prompt: caption_prompt || null,
        hashtags: hashtags || null,
        frequency_hours,
        mode,
        aspect_ratio,
        duration,
        status: 'paused',
        next_run_at: nextRun.toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, automation: data })
  } catch (err: any) {
    console.error('[Automations] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT: Update an automation
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    // Recalculate next_run if frequency changed
    if (updates.frequency_hours) {
      const now = new Date()
      updates.next_run_at = new Date(now.getTime() + updates.frequency_hours * 60 * 60 * 1000).toISOString()
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, automation: data })
  } catch (err: any) {
    console.error('[Automations] PUT error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE: Remove an automation
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Automations] DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
