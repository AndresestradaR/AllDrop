'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import type { SSEEvent, CountryCode, ProductMetadata } from '@/lib/landing-ia/types'

type WizardStep = 'url' | 'angles' | 'images' | 'generating' | 'done'

interface Angle {
  id: string
  emoji: string
  titulo: string
  descripcion: string
  tagline: string
}

interface TaskStatus {
  label: string
  key: string
  status: 'pending' | 'processing' | 'done' | 'error'
}

const ANALYZING_MESSAGES = [
  'Leyendo la pagina del producto...',
  'Extrayendo informacion con IA...',
  'Generando angulos de venta...',
  'Casi listo...',
]

function CircularProgress({ progress }: { progress: number }) {
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(77,190,164,0.15) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <svg width="200" height="200" className="transform -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke="#4DBEA4"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
            filter: 'drop-shadow(0 0 8px #4DBEA4) drop-shadow(0 0 20px #4DBEA4)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{progress}</span>
        <span className="text-sm text-text-secondary">Completo</span>
      </div>
    </div>
  )
}

export default function LandingIAPage() {
  const [step, setStep] = useState<WizardStep>('url')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingMsg, setAnalyzingMsg] = useState(0)
  const [url, setUrl] = useState('')
  const [country, setCountry] = useState<CountryCode>('CO')
  const [metadata, setMetadata] = useState<any>(null)
  const [angles, setAngles] = useState<Angle[]>([])
  const [selectedAngle, setSelectedAngle] = useState<Angle | null>(null)
  const [iaDecides, setIaDecides] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [sectionsCount, setSectionsCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [tasks, setTasks] = useState<TaskStatus[]>([
    { label: 'Analizando el producto...', key: 'init', status: 'pending' },
    { label: 'Escribiendo hero y oferta...', key: 'Hero & Oferta', status: 'pending' },
    { label: 'Generando testimonios...', key: 'Testimonios', status: 'pending' },
    { label: 'Creando FAQs y beneficios...', key: 'FAQs & Beneficios', status: 'pending' },
    { label: 'Preparando transformacion...', key: 'Transformacion', status: 'pending' },
    { label: 'Finalizando tu landing...', key: 'assembler', status: 'pending' },
  ])

  // Rotating analyzing messages
  useEffect(() => {
    if (!analyzing) return
    const interval = setInterval(() => {
      setAnalyzingMsg(prev => (prev + 1) % ANALYZING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [analyzing])

  const handleAnalyze = async () => {
    let finalUrl = url.trim()
    if (!finalUrl) return
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`
      setUrl(finalUrl)
    }

    setAnalyzing(true)
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
        setAnalyzing(false)
        return
      }

      setMetadata(data.metadata)
      setAngles(data.metadata.angles || [])
      setImageUrls(data.metadata.images || [])
      setSelectedImages(data.metadata.images || [])
      setAnalyzing(false)
      setStep('angles')
    } catch {
      toast.error('Error al analizar la URL')
      setAnalyzing(false)
    }
  }

  const handleManual = () => {
    setMetadata({
      title: '',
      description: '',
      benefits: [],
      pains: [],
      angles: [],
      images: [],
      price: null,
      category: 'otro',
    })
    setAngles([])
    setImageUrls([])
    setSelectedImages([])
    setAnalyzing(false)
    // Skip to generating directly with empty metadata for manual mode
    setStep('angles')
  }

  const handleContinueFromAngles = () => {
    if (imageUrls.length > 0) {
      setStep('images')
    } else {
      handleGenerate()
    }
  }

  const toggleImage = (imgUrl: string) => {
    setSelectedImages(prev =>
      prev.includes(imgUrl) ? prev.filter(u => u !== imgUrl) : [...prev, imgUrl]
    )
  }

  const handleGenerate = async () => {
    setStep('generating')
    setProgress(5)
    setTasks(prev => prev.map(t => ({ ...t, status: t.key === 'init' ? 'processing' : 'pending' })))

    const finalMetadata: ProductMetadata = {
      title: metadata?.title || '',
      description: metadata?.description || '',
      benefits: metadata?.benefits || [],
      pains: metadata?.pains || [],
      angles: iaDecides ? ['best_angle'] : selectedAngle ? [selectedAngle.tagline] : [],
      images: selectedImages,
      price: metadata?.price || undefined,
      category: metadata?.category,
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/landing-ia/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ productMetadata: finalMetadata, country }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error del servidor')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No se pudo leer la respuesta')

      // Mark init as done once stream starts
      setTasks(prev => prev.map(t => t.key === 'init' ? { ...t, status: 'done' } : t))

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

            // Update task statuses
            if (event.type === 'agent_done' && event.agent !== 'init') {
              setTasks(prev => prev.map(t => {
                if (t.key === event.agent) return { ...t, status: 'done' }
                // Mark next pending as processing
                return t
              }))
              // Mark next pending task as processing
              setTasks(prev => {
                const firstPending = prev.findIndex(t => t.status === 'pending')
                if (firstPending === -1) return prev
                const next = [...prev]
                next[firstPending] = { ...next[firstPending], status: 'processing' }
                return next
              })
            }

            if (event.type === 'agent_error') {
              setTasks(prev => prev.map(t =>
                t.key === event.agent ? { ...t, status: 'error' } : t
              ))
            }

            if (event.type === 'completed') {
              setDraftId(event.draftId || null)
              setSectionsCount(event.sectionsCount || 0)
              setTasks(prev => prev.map(t => ({
                ...t,
                status: t.status === 'pending' || t.status === 'processing' ? 'done' : t.status,
              })))
              setProgress(100)
              setTimeout(() => setStep('done'), 800)
            }

            if (event.type === 'error') {
              setError(event.message)
              setStep('url')
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        setStep('url')
      }
    }
  }

  const handleReset = () => {
    setStep('url')
    setUrl('')
    setMetadata(null)
    setAngles([])
    setSelectedAngle(null)
    setIaDecides(false)
    setImageUrls([])
    setSelectedImages([])
    setProgress(0)
    setDraftId(null)
    setSectionsCount(0)
    setError(null)
    setTasks(prev => prev.map(t => ({ ...t, status: 'pending' })))
  }

  const stepIndex = { url: 0, angles: 1, images: 2, generating: 3, done: 4 }[step]
  const totalSteps = imageUrls.length > 0 ? 3 : 2
  const showStepBar = step === 'url' || step === 'angles' || step === 'images'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Landing Code</h1>
        <p className="mt-1 text-text-secondary">
          Genera tu landing completa con IA en segundos
        </p>
      </div>

      {/* Step bar */}
      {showStepBar && (
        <div className="mb-8">
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-accent' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Paso {Math.min(stepIndex + 1, totalSteps)} de {totalSteps}
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* ===== STEP: URL ===== */}
      {step === 'url' && !analyzing && (
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
                placeholder="Pega la URL del producto..."
                className="w-full px-4 py-3 rounded-lg bg-background border border-border text-text-primary placeholder:text-text-secondary/50 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition text-center"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Pais de venta</label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value as CountryCode)}
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition text-center"
              >
                <option value="CO">Colombia</option>
                <option value="MX">Mexico</option>
                <option value="GT">Guatemala</option>
                <option value="EC">Ecuador</option>
              </select>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="w-full py-3 rounded-lg bg-accent text-background font-semibold text-base hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Analizar Producto
            </button>

            <div className="flex flex-wrap justify-center gap-2">
              {['AliExpress', 'Amazon', 'Shopify', 'Cualquier tienda'].map(name => (
                <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-border/50 text-text-secondary">
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-secondary">o</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="text-center">
            <button
              onClick={handleManual}
              className="text-sm text-text-secondary hover:text-accent transition"
            >
              No tienes URL? Completar manualmente
            </button>
          </div>
        </div>
      )}

      {/* ===== ANALYZING ===== */}
      {step === 'url' && analyzing && (
        <div className="p-12 rounded-2xl bg-surface border border-border text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10">
            <div className="w-8 h-8 border-[3px] border-accent/30 border-t-accent rounded-full animate-spin" />
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

      {/* ===== STEP: ANGLES ===== */}
      {step === 'angles' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Como quieres vender este producto?</h2>
            <p className="mt-1 text-sm text-text-secondary">Elige el angulo que mejor conecte con tus clientes</p>
          </div>

          {angles.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {angles.map(angle => (
                <button
                  key={angle.id}
                  onClick={() => { setSelectedAngle(angle); setIaDecides(false) }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedAngle?.id === angle.id && !iaDecides
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface hover:border-accent/50'
                  }`}
                >
                  <div className="text-2xl mb-2">{angle.emoji}</div>
                  <div className="text-sm font-semibold text-text-primary">{angle.titulo}</div>
                  <div className="mt-1 text-xs text-text-secondary leading-relaxed">{angle.descripcion}</div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => { setIaDecides(true); setSelectedAngle(null) }}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              iaDecides
                ? 'border-accent bg-accent/5'
                : 'border-border bg-surface hover:border-accent/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">&#129504;</span>
              <div>
                <div className="text-sm font-semibold text-text-primary">Dejar que la IA decida</div>
                <div className="text-xs text-text-secondary">Elegiremos el mejor angulo automaticamente</div>
              </div>
            </div>
          </button>

          <button
            onClick={handleContinueFromAngles}
            disabled={!selectedAngle && !iaDecides}
            className="w-full py-3 rounded-lg bg-accent text-background font-semibold text-base hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Continuar
          </button>
        </div>
      )}

      {/* ===== STEP: IMAGES ===== */}
      {step === 'images' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Imagenes del producto</h2>
            <p className="mt-1 text-sm text-text-secondary">Selecciona las que quieres usar en tu landing</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {imageUrls.map((imgUrl, i) => {
              const isSelected = selectedImages.includes(imgUrl)
              return (
                <button
                  key={i}
                  onClick={() => toggleImage(imgUrl)}
                  className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${
                    isSelected ? 'border-accent' : 'border-border opacity-50'
                  }`}
                >
                  <img
                    src={`/api/landing-ia/proxy-image?url=${encodeURIComponent(imgUrl)}`}
                    alt={`Producto ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3 rounded-lg bg-accent text-background font-semibold text-base hover:bg-accent/90 transition"
          >
            Generar mi Landing Code
          </button>
        </div>
      )}

      {/* ===== STEP: GENERATING ===== */}
      {step === 'generating' && (
        <div
          className="py-12 -mx-6 px-6"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="flex flex-col items-center space-y-8">
            <CircularProgress progress={progress} />

            <div className="text-center">
              <h2 className="text-lg font-bold text-text-primary">Generando tu Landing Code</h2>
              <p className="mt-1 text-sm text-text-secondary">Preparando tu contenido...</p>
            </div>

            <div className="w-full max-w-sm space-y-3">
              {tasks.map(task => (
                <div key={task.key} className="flex items-center justify-between">
                  <span className={`text-sm ${
                    task.status === 'done' ? 'text-text-primary' :
                    task.status === 'processing' ? 'text-text-primary' :
                    task.status === 'error' ? 'text-amber-400' :
                    'text-text-secondary/50'
                  }`}>
                    {task.label}
                  </span>
                  <span className="text-sm ml-3">
                    {task.status === 'done' && <span className="text-accent">&#10003;</span>}
                    {task.status === 'processing' && <span className="inline-block animate-spin text-accent">&#9696;</span>}
                    {task.status === 'error' && <span className="text-amber-400">&#9888;</span>}
                    {task.status === 'pending' && <span className="text-text-secondary/30">&#183;</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP: DONE ===== */}
      {step === 'done' && (
        <div className="space-y-8">
          <div className="text-center py-8">
            <div className="text-5xl mb-4">&#127881;</div>
            <h2 className="text-xl font-bold text-text-primary">
              Tu Landing Code esta lista!
            </h2>
            <p className="mt-2 text-text-secondary">
              Se generaron {sectionsCount} secciones optimizadas para ventas COD
            </p>
          </div>

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
