import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assembleSections } from '@/lib/landing-ia/assembler'
import { heroAgent } from '@/lib/landing-ia/agents/hero-agent'
import { testimoniosAgent } from '@/lib/landing-ia/agents/testimonios-agent'
import { faqsAgent } from '@/lib/landing-ia/agents/faqs-agent'
import { antesAgent } from '@/lib/landing-ia/agents/antes-agent'
import { getAIKeys, requireAIKeys } from '@/lib/services/ai-text'
import type { ProductMetadata, CountryCode, SSEEvent, AgentResult } from '@/lib/landing-ia/types'

export const maxDuration = 120

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    }

    // 2. Parse body
    const body = await request.json()
    const { productMetadata, country } = body as {
      productMetadata: ProductMetadata
      country: CountryCode
    }

    if (!productMetadata?.title || !country) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), { status: 400 })
    }

    // 3. Get AI keys (KIE primary, Google fallback)
    const aiKeys = await getAIKeys(supabase, user.id)
    try {
      requireAIKeys(aiKeys)
    } catch {
      return new Response(JSON.stringify({ error: 'Configura tu API key de KIE o Google en Settings' }), { status: 400 })
    }

    // 4. Create draft
    const { data: draft, error: draftError } = await supabase
      .from('landing_ia_drafts')
      .insert({
        user_id: user.id,
        status: 'processing',
        product_name: productMetadata.title,
        country,
        product_metadata: productMetadata,
      })
      .select('id')
      .single()

    if (draftError || !draft) {
      return new Response(JSON.stringify({ error: 'Error creando borrador' }), { status: 500 })
    }

    const draftId = draft.id

    // 5. Create SSE stream
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: SSEEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        // Initial event
        sendEvent({
          type: 'agent_done',
          agent: 'init',
          progress: 5,
          message: 'Iniciando generación con IA...',
          draftId,
        })

        const withProgress = (
          agentFn: Promise<AgentResult>,
          name: string,
          progress: number
        ): Promise<AgentResult> =>
          agentFn.then(result => {
            sendEvent({
              type: result.success ? 'agent_done' : 'agent_error',
              agent: name,
              progress,
              message: result.success ? `${name} listo ✅` : `${name} con advertencia ⚠️`,
            })
            return result
          })

        try {
          const results = await Promise.allSettled([
            withProgress(heroAgent(productMetadata, country, aiKeys), 'Hero & Oferta', 20),
            withProgress(testimoniosAgent(productMetadata, country, aiKeys), 'Testimonios', 40),
            withProgress(faqsAgent(productMetadata, country, aiKeys), 'FAQs & Beneficios', 60),
            withProgress(antesAgent(productMetadata, country, aiKeys), 'Transformación', 75),
          ])

          // Collect fulfilled results
          const agentResults = results
            .filter((r): r is PromiseFulfilledResult<AgentResult> => r.status === 'fulfilled')
            .map(r => r.value)

          // Assemble sections
          const sections = assembleSections(agentResults)

          // Update draft
          const serviceClient = await createServiceClient()
          await serviceClient
            .from('landing_ia_drafts')
            .update({
              status: 'completed',
              sections_json: sections,
            })
            .eq('id', draftId)

          sendEvent({
            type: 'completed',
            agent: 'assembler',
            progress: 100,
            message: '¡Landing generada exitosamente!',
            draftId,
            sectionsCount: sections.length,
          })
        } catch (err: any) {
          // Update draft with error
          const serviceClient = await createServiceClient()
          await serviceClient
            .from('landing_ia_drafts')
            .update({
              status: 'error',
              error_message: err.message,
            })
            .eq('id', draftId)

          sendEvent({
            type: 'error',
            agent: 'system',
            progress: 0,
            message: `Error: ${err.message}`,
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
