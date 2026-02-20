'use client'

import { useState, useRef } from 'react'
import type { SSEEvent, CountryCode } from '@/lib/landing-ia/types'

type WizardState = 'idle' | 'generating' | 'done'

interface AgentStatus {
  name: string
  status: 'pending' | 'done' | 'error'
}

export default function LandingIAPage() {
  const [state, setState] = useState<WizardState>('idle')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [benefits, setBenefits] = useState('')
  const [pains, setPains] = useState('')
  const [price, setPrice] = useState('')
  const [country, setCountry] = useState<CountryCode>('CO')
  const [progress, setProgress] = useState(0)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [sectionsCount, setSectionsCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: 'Hero & Oferta final', status: 'pending' },
    { name: 'Testimonios de clientes', status: 'pending' },
    { name: 'FAQs & Beneficios', status: 'pending' },
    { name: 'Transformación & Modo de uso', status: 'pending' },
  ])

  const handleGenerate = async () => {
    if (!title.trim() || !description.trim()) return

    setState('generating')
    setProgress(0)
    setError(null)
    setDraftId(null)
    setAgents(prev => prev.map(a => ({ ...a, status: 'pending' })))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/landing-ia/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          productMetadata: {
            title: title.trim(),
            description: description.trim(),
            benefits: benefits.split('\n').filter(Boolean),
            pains: pains.split('\n').filter(Boolean),
            images: [],
            angles: [],
            price: price.trim() || undefined,
          },
          country,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error del servidor')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No se pudo leer la respuesta')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event: SSEEvent = JSON.parse(line.slice(6))
            setProgress(event.progress)

            if (event.type === 'agent_done' && event.agent !== 'init' && event.agent !== 'assembler') {
              setAgents(prev => {
                const agentMap: Record<string, number> = {
                  'Hero & Oferta': 0,
                  'Testimonios': 1,
                  'FAQs & Beneficios': 2,
                  'Transformación': 3,
                }
                const idx = agentMap[event.agent]
                if (idx === undefined) return prev
                const next = [...prev]
                next[idx] = { ...next[idx], status: 'done' }
                return next
              })
            }

            if (event.type === 'agent_error') {
              setAgents(prev => {
                const agentMap: Record<string, number> = {
                  'Hero & Oferta': 0,
                  'Testimonios': 1,
                  'FAQs & Beneficios': 2,
                  'Transformación': 3,
                }
                const idx = agentMap[event.agent]
                if (idx === undefined) return prev
                const next = [...prev]
                next[idx] = { ...next[idx], status: 'error' }
                return next
              })
            }

            if (event.type === 'completed') {
              setDraftId(event.draftId || null)
              setSectionsCount(event.sectionsCount || 0)
              setState('done')
            }

            if (event.type === 'error') {
              setError(event.message)
              setState('idle')
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        setState('idle')
      }
    }
  }

  const handleReset = () => {
    setState('idle')
    setProgress(0)
    setDraftId(null)
    setError(null)
    setSectionsCount(0)
    setTitle('')
    setDescription('')
    setBenefits('')
    setPains('')
    setPrice('')
    setCountry('CO')
    setAgents(prev => prev.map(a => ({ ...a, status: 'pending' })))
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Landing Code</h1>
        <p className="mt-1 text-text-secondary">
          Genera landings de venta COD con inteligencia artificial en segundos
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {['Datos', 'Generando', 'Listo'].map((step, i) => {
          const stepStates: WizardState[] = ['idle', 'generating', 'done']
          const currentIdx = stepStates.indexOf(state)
          const isActive = i <= currentIdx
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isActive
                    ? 'bg-accent text-background'
                    : 'bg-border text-text-secondary'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? 'text-text-primary' : 'text-text-secondary'
                }`}
              >
                {step}
              </span>
              {i < 2 && (
                <div
                  className={`w-12 h-0.5 ${
                    i < currentIdx ? 'bg-accent' : 'bg-border'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* IDLE STATE - Form */}
      {state === 'idle' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Nombre del producto *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Faja Reductora Premium"
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Descripcion del producto *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe tu producto: que hace, para quien es..."
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Beneficios (uno por linea)
            </label>
            <textarea
              value={benefits}
              onChange={e => setBenefits(e.target.value)}
              rows={3}
              placeholder={"Reduce medidas al instante\nMaterial transpirable\nSoporte lumbar"}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Dolores del cliente (uno por linea)
            </label>
            <textarea
              value={pains}
              onChange={e => setPains(e.target.value)}
              rows={3}
              placeholder={"No me siento comoda con mi cuerpo\nLa ropa no me queda bien\nHe probado de todo sin resultados"}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Precio (opcional)
              </label>
              <input
                type="text"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="$99.900"
                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Pais
              </label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value as CountryCode)}
                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition"
              >
                <option value="CO">Colombia</option>
                <option value="MX">Mexico</option>
                <option value="GT">Guatemala</option>
                <option value="EC">Ecuador</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!title.trim() || !description.trim()}
            className="w-full py-3 rounded-lg bg-accent text-background font-semibold text-base hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Generar Landing Code
          </button>
        </div>
      )}

      {/* GENERATING STATE */}
      {state === 'generating' && (
        <div className="space-y-6">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">Generando con IA...</span>
              <span className="text-sm font-bold text-accent">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Agent statuses */}
          <div className="space-y-3">
            {agents.map(agent => (
              <div
                key={agent.name}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border"
              >
                <span className="text-lg">
                  {agent.status === 'pending' && (
                    <span className="inline-block animate-spin">&#9203;</span>
                  )}
                  {agent.status === 'done' && '✅'}
                  {agent.status === 'error' && '⚠️'}
                </span>
                <span
                  className={`text-sm font-medium ${
                    agent.status === 'done'
                      ? 'text-emerald-400'
                      : agent.status === 'error'
                        ? 'text-amber-400'
                        : 'text-text-secondary'
                  }`}
                >
                  {agent.name}
                  {agent.status === 'pending' && '...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DONE STATE */}
      {state === 'done' && (
        <div className="space-y-6">
          <div className="text-center py-8">
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-xl font-bold text-text-primary">
              Tu landing esta lista!
            </h2>
            <p className="mt-2 text-text-secondary">
              Se generaron {sectionsCount} secciones para tu landing de {title}
            </p>
          </div>

          {/* Agent results */}
          <div className="space-y-2">
            {agents.map(agent => (
              <div
                key={agent.name}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border"
              >
                <span className="text-lg">
                  {agent.status === 'done' ? '✅' : '⚠️'}
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {agent.name}
                </span>
                <span
                  className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                    agent.status === 'done'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {agent.status === 'done' ? 'Completado' : 'Parcial'}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {draftId && (
              <a
                href={`/dashboard/landing-ia/${draftId}`}
                className="flex-1 py-3 rounded-lg bg-accent text-background font-semibold text-center hover:bg-accent/90 transition"
              >
                Ver Landing
              </a>
            )}
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-lg bg-surface border border-border text-text-primary font-semibold hover:bg-border/50 transition"
            >
              Generar otra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
