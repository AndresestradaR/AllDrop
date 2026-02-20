'use client'

import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import type { SSEEvent, CountryCode, ProductMetadata } from '@/lib/landing-ia/types'

type WizardState = 'idle' | 'analyzing' | 'ready' | 'generating' | 'done'

interface AgentStatus {
  name: string
  status: 'pending' | 'done' | 'error'
}

const ANALYZING_MESSAGES = [
  'Leyendo la pagina del producto...',
  'Extrayendo informacion con IA...',
  'Casi listo...',
]

export default function LandingIAPage() {
  const [state, setState] = useState<WizardState>('idle')
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState<ProductMetadata | null>(null)
  const [country, setCountry] = useState<CountryCode>('CO')
  const [editableForm, setEditableForm] = useState({
    title: '',
    description: '',
    benefits: '',
    pains: '',
    price: '',
  })
  const [progress, setProgress] = useState(0)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [sectionsCount, setSectionsCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [analyzingMsg, setAnalyzingMsg] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: 'Hero & Oferta final', status: 'pending' },
    { name: 'Testimonios de clientes', status: 'pending' },
    { name: 'FAQs & Beneficios', status: 'pending' },
    { name: 'Transformacion & Modo de uso', status: 'pending' },
  ])

  // Rotating analyzing messages
  useEffect(() => {
    if (state !== 'analyzing') return
    const interval = setInterval(() => {
      setAnalyzingMsg(prev => (prev + 1) % ANALYZING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [state])

  const handleAnalyze = async () => {
    let finalUrl = url.trim()
    if (!finalUrl) return
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`
      setUrl(finalUrl)
    }

    setState('analyzing')
    setAnalyzingMsg(0)
    setError(null)

    try {
      const res = await fetch('/api/landing-ia/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error)
        setState('idle')
        return
      }

      setMetadata(data.metadata)
      setEditableForm({
        title: data.metadata.title || '',
        description: data.metadata.description || '',
        benefits: (data.metadata.benefits || []).join('\n'),
        pains: (data.metadata.pains || []).join('\n'),
        price: data.metadata.price || '',
      })
      setState('ready')
    } catch (err: any) {
      toast.error('Error al analizar la URL')
      setState('idle')
    }
  }

  const handleManual = () => {
    setMetadata(null)
    setEditableForm({ title: '', description: '', benefits: '', pains: '', price: '' })
    setState('ready')
  }

  const handleChangeUrl = () => {
    setState('idle')
    setUrl('')
    setMetadata(null)
    setError(null)
  }

  const handleGenerate = async () => {
    if (!editableForm.title.trim() || !editableForm.description.trim()) return

    const finalMetadata: ProductMetadata = {
      title: editableForm.title.trim(),
      description: editableForm.description.trim(),
      benefits: editableForm.benefits.split('\n').filter(Boolean),
      pains: editableForm.pains.split('\n').filter(Boolean),
      angles: metadata?.angles || [],
      images: metadata?.images || [],
      price: editableForm.price.trim() || undefined,
      category: metadata?.category,
    }

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
          productMetadata: finalMetadata,
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
                  'Transformacion': 3,
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
                  'Transformacion': 3,
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
    setUrl('')
    setMetadata(null)
    setProgress(0)
    setDraftId(null)
    setError(null)
    setSectionsCount(0)
    setEditableForm({ title: '', description: '', benefits: '', pains: '', price: '' })
    setCountry('CO')
    setAgents(prev => prev.map(a => ({ ...a, status: 'pending' })))
  }

  const stepLabels = ['URL', 'Datos', 'Generando', 'Listo']
  const stateToStep: Record<WizardState, number> = {
    idle: 0,
    analyzing: 0,
    ready: 1,
    generating: 2,
    done: 3,
  }
  const currentStep = stateToStep[state]

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Landing Code</h1>
        <p className="mt-1 text-text-secondary">
          Genera tu landing completa con IA en segundos
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {stepLabels.map((step, i) => {
          const isActive = i <= currentStep
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
              {i < stepLabels.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < currentStep ? 'bg-accent' : 'bg-border'
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

      {/* IDLE STATE - URL Input */}
      {state === 'idle' && (
        <div className="space-y-6">
          <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                URL del producto
              </label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder="Pega la URL del producto: Amazon, AliExpress, Shopify..."
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition text-center"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="w-full py-3 rounded-lg bg-accent text-background font-semibold text-base hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Analizar Producto
            </button>

            <p className="text-xs text-text-secondary">
              Funciona con: Amazon &middot; AliExpress &middot; Shopify &middot; cualquier tienda online
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={handleManual}
              className="text-sm text-text-secondary hover:text-accent transition"
            >
              No tienes URL? &rarr; Completar informacion manualmente
            </button>
          </div>
        </div>
      )}

      {/* ANALYZING STATE */}
      {state === 'analyzing' && (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10">
            <div className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-base font-medium text-text-primary">
              {ANALYZING_MESSAGES[analyzingMsg]}
            </p>
            <p className="mt-2 text-sm text-text-secondary truncate max-w-md mx-auto">
              {url}
            </p>
          </div>
        </div>
      )}

      {/* READY STATE - Editable Form */}
      {state === 'ready' && (
        <div className="space-y-5">
          {metadata && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm font-medium text-emerald-400">Producto analizado</span>
              <button
                onClick={handleChangeUrl}
                className="text-sm text-text-secondary hover:text-accent transition"
              >
                Cambiar URL
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Nombre del producto *
            </label>
            <input
              type="text"
              value={editableForm.title}
              onChange={e => setEditableForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Faja Reductora Premium"
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Descripcion del producto *
            </label>
            <textarea
              value={editableForm.description}
              onChange={e => setEditableForm(f => ({ ...f, description: e.target.value }))}
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
              value={editableForm.benefits}
              onChange={e => setEditableForm(f => ({ ...f, benefits: e.target.value }))}
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
              value={editableForm.pains}
              onChange={e => setEditableForm(f => ({ ...f, pains: e.target.value }))}
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
                value={editableForm.price}
                onChange={e => setEditableForm(f => ({ ...f, price: e.target.value }))}
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
            disabled={!editableForm.title.trim() || !editableForm.description.trim()}
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
              Se generaron {sectionsCount} secciones para tu landing de {editableForm.title}
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
