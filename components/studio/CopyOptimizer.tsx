'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Heart,
  Shield,
  FileText,
  PenTool,
  ExternalLink,
} from 'lucide-react'

interface CopyVariant {
  label: string
  headline: string
  sub_headline: string
  description: string
  bullets: string[]
  objections: string[]
  guarantee: string
  cta_primary: string
  cta_whatsapp: string
  short_ad_copy: string
  ad_headline: string
}

interface CopyResult {
  variants: CopyVariant[]
  analysis: string
}

interface LandingProduct {
  id: string
  name: string
  description?: string
  sections_count: number
}

type CopyMode = 'from_landing' | 'from_scratch'

const TONES = [
  { id: 'urgente', label: 'Urgente', icon: Zap, color: 'text-red-400' },
  { id: 'profesional', label: 'Profesional', icon: Shield, color: 'text-blue-400' },
  { id: 'casual', label: 'Casual', icon: Heart, color: 'text-pink-400' },
  { id: 'emocional', label: 'Emocional', icon: Heart, color: 'text-purple-400' },
]

const CURRENCIES = ['COP', 'MXN', 'USD', 'GTQ', 'PEN', 'CLP', 'PYG', 'PAB']

const VARIANT_ICONS = [
  { icon: Zap, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { icon: Heart, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  { icon: Shield, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
]

export function CopyOptimizer() {
  // Mode
  const [mode, setMode] = useState<CopyMode>('from_scratch')

  // From Landing mode
  const [landings, setLandings] = useState<LandingProduct[]>([])
  const [selectedLandingId, setSelectedLandingId] = useState('')
  const [isLoadingLandings, setIsLoadingLandings] = useState(false)

  // From Scratch mode
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('COP')
  const [currentText, setCurrentText] = useState('')
  const [problemSolved, setProblemSolved] = useState('')
  const [targetAudience, setTargetAudience] = useState('')

  // Common
  const [tone, setTone] = useState('urgente')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [activeVariant, setActiveVariant] = useState(0)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch user's landings when switching to from_landing mode
  useEffect(() => {
    if (mode === 'from_landing' && landings.length === 0) {
      fetchLandings()
    }
  }, [mode])

  const fetchLandings = async () => {
    setIsLoadingLandings(true)
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      if (data.products) {
        setLandings(data.products)
      }
    } catch (err) {
      console.error('Error fetching landings:', err)
    } finally {
      setIsLoadingLandings(false)
    }
  }

  const handleGenerate = async () => {
    if (mode === 'from_scratch' && !productName.trim()) return
    if (mode === 'from_landing' && !selectedLandingId) return

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const body: any = { mode, tone }

      if (mode === 'from_landing') {
        body.product_id = selectedLandingId
        if (price) body.price = parseFloat(price.replace(/[^0-9.]/g, ''))
        if (currency) body.currency = currency
        if (problemSolved) body.problem_solved = problemSolved
        if (targetAudience) body.target_audience = targetAudience
      } else {
        body.product_name = productName
        if (price) body.price = parseFloat(price.replace(/[^0-9.]/g, ''))
        if (currency) body.currency = currency
        if (currentText) body.current_text = currentText
        if (problemSolved) body.problem_solved = problemSolved
        if (targetAudience) body.target_audience = targetAudience
      }

      const response = await fetch('/api/studio/copy-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al optimizar copy')
      }

      if (data.variants && data.variants.length > 0) {
        setResult(data)
        setActiveVariant(0)
      } else {
        throw new Error('No se generaron variantes')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const copyAllVariant = async (variant: CopyVariant) => {
    const text = [
      `HEADLINE: ${variant.headline}`,
      `SUB-HEADLINE: ${variant.sub_headline}`,
      '',
      `DESCRIPCION:`,
      variant.description,
      '',
      'BENEFICIOS:',
      ...variant.bullets.map(b => `- ${b}`),
      '',
      'OBJECIONES:',
      ...(variant.objections || []).map(o => `- ${o}`),
      '',
      `GARANTIA: ${variant.guarantee || ''}`,
      '',
      `CTA PRINCIPAL: ${variant.cta_primary}`,
      `CTA WHATSAPP: ${variant.cta_whatsapp}`,
      '',
      `AD COPY: ${variant.short_ad_copy}`,
      `AD HEADLINE: ${variant.ad_headline}`,
    ].join('\n')
    await copyToClipboard(text, 'all')
  }

  const canGenerate = mode === 'from_landing'
    ? !!selectedLandingId
    : !!productName.trim()

  const CopyButton = ({ text, fieldId }: { text: string; fieldId: string }) => (
    <button
      onClick={() => copyToClipboard(text, fieldId)}
      className="p-1.5 rounded-lg hover:bg-border/50 transition-colors group"
      title="Copiar"
    >
      {copiedField === fieldId ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary" />
      )}
    </button>
  )

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel — Input */}
      <div className="w-[420px] flex-shrink-0 bg-surface rounded-2xl border border-border p-5 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">Copy Optimizer</h3>
            <p className="text-xs text-text-secondary">
              Genera 3 variantes de copy optimizado para LATAM e-commerce.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('from_landing')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                mode === 'from_landing'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-accent/50'
              )}
            >
              <FileText className="w-4 h-4" />
              Desde Landing
            </button>
            <button
              onClick={() => setMode('from_scratch')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                mode === 'from_scratch'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-accent/50'
              )}
            >
              <PenTool className="w-4 h-4" />
              Desde Cero
            </button>
          </div>

          {/* FROM LANDING MODE */}
          {mode === 'from_landing' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Selecciona tu landing *
              </label>
              {isLoadingLandings ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-elevated border border-border rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                  <span className="text-sm text-text-muted">Cargando landings...</span>
                </div>
              ) : landings.length === 0 ? (
                <div className="px-4 py-3 bg-surface-elevated border border-border rounded-xl">
                  <p className="text-sm text-text-muted">No tienes landings creadas aun.</p>
                  <a
                    href="/dashboard/landing"
                    className="text-xs text-accent hover:underline mt-1 inline-flex items-center gap-1"
                  >
                    Crear landing <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <select
                  value={selectedLandingId}
                  onChange={(e) => setSelectedLandingId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                >
                  <option value="">Selecciona una landing...</option>
                  {landings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.sections_count} secciones)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* FROM SCRATCH MODE — Product Name */}
          {mode === 'from_scratch' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Nombre del producto *
              </label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Glucometro Digital Pro"
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
          )}

          {/* Price + Currency (both modes) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Precio
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="89900"
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Problem Solved */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Problema que resuelve
            </label>
            <input
              value={problemSolved}
              onChange={(e) => setProblemSolved(e.target.value)}
              placeholder="Ej: Monitoreo facil de azucar en sangre"
              className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Publico objetivo
            </label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Ej: Personas con diabetes en Colombia"
              className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Tono
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TONES.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center',
                      tone === t.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50 bg-surface-elevated'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', tone === t.id ? 'text-accent' : t.color)} />
                    <span className={cn(
                      'text-xs font-medium',
                      tone === t.id ? 'text-accent' : 'text-text-secondary'
                    )}>
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Current Text (from_scratch only) */}
          {mode === 'from_scratch' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Texto actual de la landing
                <span className="text-text-muted ml-1">(opcional)</span>
              </label>
              <textarea
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                placeholder="Pega aqui el texto actual de tu landing para que la IA lo analice y mejore..."
                rows={4}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200',
              isGenerating || !canGenerate
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 hover:shadow-accent/40'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Optimizando copy...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Optimizar Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel — Output */}
      <div className="flex-1 bg-surface rounded-2xl border border-border p-5 overflow-hidden flex flex-col">
        {!result ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-border/50 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-text-secondary">
                Tus variantes de copy optimizado apareceran aqui
              </p>
              <p className="text-xs text-text-muted mt-1">
                3 enfoques: Urgencia, Historia, Autoridad
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Variant Tabs */}
            <div className="flex gap-2 mb-4">
              {result.variants.map((variant, idx) => {
                const style = VARIANT_ICONS[idx] || VARIANT_ICONS[0]
                const Icon = style.icon
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveVariant(idx)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                      activeVariant === idx
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-accent/50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {variant.label}
                  </button>
                )
              })}
            </div>

            {/* Active Variant Content */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {(() => {
                const variant = result.variants[activeVariant]
                if (!variant) return null
                const vid = `v${activeVariant}`

                return (
                  <>
                    {/* Headline */}
                    <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Headline</span>
                        <CopyButton text={variant.headline} fieldId={`${vid}-headline`} />
                      </div>
                      <p className="text-lg font-bold text-text-primary">{variant.headline}</p>
                    </div>

                    {/* Sub-headline */}
                    <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Sub-headline</span>
                        <CopyButton text={variant.sub_headline} fieldId={`${vid}-sub`} />
                      </div>
                      <p className="text-sm text-text-secondary">{variant.sub_headline}</p>
                    </div>

                    {/* Description */}
                    {variant.description && (
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Descripcion</span>
                          <CopyButton text={variant.description} fieldId={`${vid}-desc`} />
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">{variant.description}</p>
                      </div>
                    )}

                    {/* Bullets */}
                    <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Beneficios</span>
                        <CopyButton text={variant.bullets.join('\n')} fieldId={`${vid}-bullets`} />
                      </div>
                      <ul className="space-y-1.5">
                        {variant.bullets.map((b, i) => (
                          <li key={i} className="text-sm text-text-primary flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Objections */}
                    {variant.objections && variant.objections.length > 0 && (
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Objeciones resueltas</span>
                          <CopyButton text={variant.objections.join('\n')} fieldId={`${vid}-objections`} />
                        </div>
                        <ul className="space-y-1.5">
                          {variant.objections.map((o, i) => (
                            <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                              <Shield className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                              {o}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Guarantee */}
                    {variant.guarantee && (
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Garantia</span>
                          <CopyButton text={variant.guarantee} fieldId={`${vid}-guarantee`} />
                        </div>
                        <p className="text-sm text-green-400 font-medium">{variant.guarantee}</p>
                      </div>
                    )}

                    {/* CTAs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">CTA Principal</span>
                          <CopyButton text={variant.cta_primary} fieldId={`${vid}-cta`} />
                        </div>
                        <p className="text-sm font-semibold text-accent">{variant.cta_primary}</p>
                      </div>
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">CTA WhatsApp</span>
                          <CopyButton text={variant.cta_whatsapp} fieldId={`${vid}-wa`} />
                        </div>
                        <p className="text-sm font-semibold text-green-400">{variant.cta_whatsapp}</p>
                      </div>
                    </div>

                    {/* Ad Copy */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Ad Copy (125 chars)</span>
                          <CopyButton text={variant.short_ad_copy} fieldId={`${vid}-ad`} />
                        </div>
                        <p className="text-sm text-text-secondary">{variant.short_ad_copy}</p>
                        <p className="text-[10px] text-text-muted mt-1">{variant.short_ad_copy?.length || 0}/125</p>
                      </div>
                      <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Ad Headline (40 chars)</span>
                          <CopyButton text={variant.ad_headline} fieldId={`${vid}-adh`} />
                        </div>
                        <p className="text-sm font-semibold text-text-primary">{variant.ad_headline}</p>
                        <p className="text-[10px] text-text-muted mt-1">{variant.ad_headline?.length || 0}/40</p>
                      </div>
                    </div>

                    {/* Copy All */}
                    <button
                      onClick={() => copyAllVariant(variant)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-accent/30 text-accent hover:bg-accent/10 font-medium text-sm transition-colors"
                    >
                      {copiedField === 'all' ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar toda la variante
                        </>
                      )}
                    </button>
                  </>
                )
              })()}

              {/* Analysis */}
              {result.analysis && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAnalysis(!showAnalysis)}
                    className="w-full flex items-center justify-between p-4 hover:bg-surface-elevated/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-text-secondary">Analisis</span>
                    {showAnalysis ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                  {showAnalysis && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-text-secondary leading-relaxed">{result.analysis}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
