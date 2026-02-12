'use client'

import { useState, useEffect, useRef } from 'react'
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
  Star,
  Tag,
  ArrowRightLeft,
  CheckCircle,
  LayoutGrid,
  Award,
  MessageSquare,
  BookOpen,
  Truck,
  HelpCircle,
  ImagePlus,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ControlsCreativos {
  productDetails: string
  salesAngle: string
  targetAvatar: string
  additionalInstructions: string
}

interface CopyResult {
  sections: Record<string, ControlsCreativos>
  analysis: string
}

interface LandingProduct {
  id: string
  name: string
  description?: string
  sections_count: number
}

interface GeneratedSection {
  id: string
  template_id: string | null
  generated_image_url: string
  prompt_used: string
  output_size: string
  status: string
  created_at: string
  template: {
    id: string
    name: string
    image_url: string
    category: string
    dimensions: string
  } | null
}

type CopyMode = 'from_landing' | 'from_scratch'

// Map landing_sections categories to copy-optimize section keys
const CATEGORY_MAP: Record<string, string> = {
  'hero': 'hero',
  'oferta': 'oferta',
  'antes-despues': 'antes_despues',
  'beneficios': 'beneficios',
  'tabla-comparativa': 'comparativa',
  'autoridad': 'autoridad',
  'testimonios': 'testimonios',
  'modo-uso': 'modo_uso',
  'logistica': 'logistica',
  'faq': 'preguntas',
}

const CATEGORY_LABELS: Record<string, string> = {
  'hero': 'Hero',
  'oferta': 'Oferta',
  'antes-despues': 'Antes/Despues',
  'beneficios': 'Beneficios',
  'tabla-comparativa': 'Comparativa',
  'autoridad': 'Autoridad',
  'testimonios': 'Testimonios',
  'modo-uso': 'Modo de Uso',
  'logistica': 'Logistica',
  'faq': 'Preguntas',
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_TABS = [
  { id: 'hero', label: 'Hero', icon: Star },
  { id: 'oferta', label: 'Oferta', icon: Tag },
  { id: 'antes_despues', label: 'Antes/Despues', icon: ArrowRightLeft },
  { id: 'beneficios', label: 'Beneficios', icon: CheckCircle },
  { id: 'comparativa', label: 'Comparativa', icon: LayoutGrid },
  { id: 'autoridad', label: 'Autoridad', icon: Award },
  { id: 'testimonios', label: 'Testimonios', icon: MessageSquare },
  { id: 'modo_uso', label: 'Modo de Uso', icon: BookOpen },
  { id: 'logistica', label: 'Logistica', icon: Truck },
  { id: 'preguntas', label: 'Preguntas', icon: HelpCircle },
] as const

const FIELD_LABELS: Record<string, { label: string; maxChars: number; color: string }> = {
  productDetails: { label: 'Detalles del Producto', maxChars: 500, color: 'text-blue-400' },
  salesAngle: { label: 'Angulo de Venta', maxChars: 150, color: 'text-amber-400' },
  targetAvatar: { label: 'Avatar de Cliente Ideal', maxChars: 150, color: 'text-purple-400' },
  additionalInstructions: { label: 'Instrucciones Adicionales', maxChars: 200, color: 'text-green-400' },
}

const TONES = [
  { id: 'urgente', label: 'Urgente', icon: Zap, color: 'text-red-400' },
  { id: 'profesional', label: 'Profesional', icon: Shield, color: 'text-blue-400' },
  { id: 'casual', label: 'Casual', icon: Heart, color: 'text-pink-400' },
  { id: 'emocional', label: 'Emocional', icon: Heart, color: 'text-purple-400' },
]

const CURRENCIES = ['COP', 'MXN', 'USD', 'GTQ', 'PEN', 'CLP', 'PYG', 'PAB']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CopyOptimizer() {
  // Mode
  const [mode, setMode] = useState<CopyMode>('from_scratch')

  // From Landing mode
  const [landings, setLandings] = useState<LandingProduct[]>([])
  const [selectedLandingId, setSelectedLandingId] = useState('')
  const [isLoadingLandings, setIsLoadingLandings] = useState(false)

  // Banner selector (multi-select)
  const [bannerSections, setBannerSections] = useState<GeneratedSection[]>([])
  const [isLoadingBanners, setIsLoadingBanners] = useState(false)
  const [selectedBanners, setSelectedBanners] = useState<Map<string, GeneratedSection>>(new Map())

  // From Scratch mode
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('COP')
  const [currentText, setCurrentText] = useState('')
  const [problemSolved, setProblemSolved] = useState('')
  const [targetAudience, setTargetAudience] = useState('')

  // Product photos
  const [productPhotos, setProductPhotos] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Common
  const [tone, setTone] = useState('urgente')
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [activeSection, setActiveSection] = useState('hero')
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch user's landings when switching to from_landing mode
  useEffect(() => {
    if (mode === 'from_landing' && landings.length === 0) {
      fetchLandings()
    }
  }, [mode])

  // Fetch banner sections when a landing is selected
  useEffect(() => {
    if (mode === 'from_landing' && selectedLandingId) {
      fetchSections(selectedLandingId)
    } else {
      setBannerSections([])
      setSelectedBanners(new Map())
    }
  }, [selectedLandingId])

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

  const fetchSections = async (productId: string) => {
    setIsLoadingBanners(true)
    setBannerSections([])
    setSelectedBanners(new Map())
    try {
      const response = await fetch(`/api/products/${productId}/sections`)
      const data = await response.json()
      if (data.sections) {
        setBannerSections(data.sections)
      }
    } catch (err) {
      console.error('Error fetching sections:', err)
    } finally {
      setIsLoadingBanners(false)
    }
  }

  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const MAX = 1024
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = dataUrl
    })

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const remaining = 4 - productPhotos.length
    const toProcess = Array.from(files).slice(0, remaining)

    toProcess.forEach((file) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        const compressed = await compressImage(dataUrl)
        setProductPhotos((prev) => [...prev, compressed].slice(0, 4))
      }
      reader.readAsDataURL(file)
    })

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePhoto = (index: number) => {
    setProductPhotos((prev) => prev.filter((_, i) => i !== index))
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
        if (selectedBanners.size > 0) {
          body.selected_banners = Array.from(selectedBanners.values()).map(banner => ({
            url: banner.generated_image_url,
            category: banner.template?.category || 'hero',
            template_name: banner.template?.name || '',
          }))
        }
      } else {
        body.product_name = productName
        if (price) body.price = parseFloat(price.replace(/[^0-9.]/g, ''))
        if (currency) body.currency = currency
        if (currentText) body.current_text = currentText
        if (problemSolved) body.problem_solved = problemSolved
        if (targetAudience) body.target_audience = targetAudience
      }

      // Product photos only in from_scratch mode (from_landing uses banner images server-side)
      if (mode === 'from_scratch' && productPhotos.length > 0) {
        body.product_photos = productPhotos
      }

      const response = await fetch('/api/studio/copy-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar textos')
      }

      // New format: sections object
      if (data.sections) {
        setResult(data)
        // Auto-select first available section
        const sectionKeys = Object.keys(data.sections)
        setActiveSection(sectionKeys[0] || 'hero')
      } else {
        throw new Error('Formato de respuesta no reconocido')
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

  const copyAllSection = async (section: ControlsCreativos) => {
    const text = [
      `DETALLES DEL PRODUCTO:`,
      section.productDetails,
      '',
      `ANGULO DE VENTA:`,
      section.salesAngle,
      '',
      `AVATAR DE CLIENTE IDEAL:`,
      section.targetAvatar,
      '',
      `INSTRUCCIONES ADICIONALES:`,
      section.additionalInstructions,
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

  const currentSection = result?.sections?.[activeSection]

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel — Input */}
      <div className="w-[420px] flex-shrink-0 bg-surface rounded-2xl border border-border p-5 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">Textos para Banners</h3>
            <p className="text-xs text-text-secondary">
              Genera Controles Creativos optimizados para las 10 secciones de tu landing.
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

          {/* Banner Selector — multi-select (from_landing mode) */}
          {mode === 'from_landing' && selectedLandingId && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Optimizar para banners especificos
                  <span className="text-text-muted ml-1">(opcional)</span>
                </label>
                {bannerSections.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedBanners.size === bannerSections.length) {
                        setSelectedBanners(new Map())
                      } else {
                        const all = new Map<string, GeneratedSection>()
                        bannerSections.forEach(s => all.set(s.id, s))
                        setSelectedBanners(all)
                      }
                    }}
                    className="text-xs text-accent hover:underline cursor-pointer"
                  >
                    {selectedBanners.size === bannerSections.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>
              {isLoadingBanners ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-elevated border border-border rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                  <span className="text-sm text-text-muted">Cargando banners...</span>
                </div>
              ) : bannerSections.length === 0 ? (
                <div className="px-4 py-3 bg-surface-elevated border border-border rounded-xl">
                  <p className="text-xs text-text-muted">Esta landing no tiene banners generados aun.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-[180px] overflow-y-auto rounded-xl border border-border bg-surface-elevated p-2 space-y-2 scrollbar-thin">
                    {Object.entries(
                      bannerSections.reduce((acc, section) => {
                        const cat = section.template?.category || 'otros'
                        if (!acc[cat]) acc[cat] = []
                        acc[cat].push(section)
                        return acc
                      }, {} as Record<string, GeneratedSection[]>)
                    ).map(([category, sections]) => (
                      <div key={category}>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1 px-1">
                          {CATEGORY_LABELS[category] || category}
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          {sections.map((section) => {
                            const isSelected = selectedBanners.has(section.id)
                            return (
                              <button
                                key={section.id}
                                onClick={() => {
                                  setSelectedBanners(prev => {
                                    const next = new Map(prev)
                                    if (next.has(section.id)) {
                                      next.delete(section.id)
                                    } else {
                                      next.set(section.id, section)
                                    }
                                    return next
                                  })
                                }}
                                className={cn(
                                  'relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                                  isSelected
                                    ? 'border-accent ring-2 ring-accent/30 scale-105'
                                    : 'border-transparent hover:border-accent/50'
                                )}
                              >
                                <img
                                  src={section.generated_image_url}
                                  alt={category}
                                  className="w-full h-full object-cover"
                                />
                                {isSelected && (
                                  <>
                                    <div className="absolute inset-0 bg-accent/20" />
                                    <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-white" />
                                    </div>
                                  </>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedBanners.size > 0 && (
                    <p className="text-[10px] text-text-muted px-1">
                      {selectedBanners.size} banner{selectedBanners.size > 1 ? 's' : ''} seleccionado{selectedBanners.size > 1 ? 's' : ''} — la IA analizara estas imagenes
                    </p>
                  )}
                </div>
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
                rows={3}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
            </div>
          )}

          {/* Product Photos Upload */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Fotos del producto
              <span className="text-text-muted ml-1">(opcional, max 4)</span>
            </label>
            {productPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {productPhotos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                    <img src={photo} alt={`Producto ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {productPhotos.length < 4 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-accent/50 text-text-muted hover:text-text-secondary transition-all"
              >
                <ImagePlus className="w-4 h-4" />
                <span className="text-sm">Subir fotos del producto</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

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
                Generando textos...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generar Textos para Banners
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
                Tus Controles Creativos apareceran aqui
              </p>
              <p className="text-xs text-text-muted mt-1">
                10 secciones: Hero, Oferta, Beneficios, Testimonios y mas
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Selected banners badge */}
            {result.sections && Object.keys(result.sections).length < 10 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-accent/10 border border-accent/30 rounded-xl">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <p className="text-xs text-accent font-medium">
                  Optimizado para {Object.keys(result.sections).length} banner{Object.keys(result.sections).length > 1 ? 's' : ''} seleccionado{Object.keys(result.sections).length > 1 ? 's' : ''}
                </p>
              </div>
            )}

            {/* Section Tabs — scrollable */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-thin">
              {SECTION_TABS.map((tab) => {
                const Icon = tab.icon
                const hasData = !!result.sections?.[tab.id]
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                      activeSection === tab.id
                        ? 'border-accent bg-accent/10 text-accent'
                        : hasData
                          ? 'border-border bg-surface-elevated text-text-secondary hover:text-text-primary hover:border-accent/50'
                          : 'border-border/50 bg-surface-elevated/50 text-text-muted'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Section Content */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {currentSection ? (
                <>
                  {/* 4 Creative Control fields */}
                  {(['productDetails', 'salesAngle', 'targetAvatar', 'additionalInstructions'] as const).map((fieldKey) => {
                    const meta = FIELD_LABELS[fieldKey]
                    const value = currentSection[fieldKey] || ''
                    const fid = `${activeSection}-${fieldKey}`

                    return (
                      <div key={fieldKey} className="p-4 bg-surface-elevated rounded-xl border border-border">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs font-semibold uppercase tracking-wider', meta.color)}>
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {value.length}/{meta.maxChars}
                            </span>
                          </div>
                          <CopyButton text={value} fieldId={fid} />
                        </div>
                        <p className={cn(
                          'text-sm leading-relaxed',
                          fieldKey === 'salesAngle' ? 'text-text-primary font-semibold' : 'text-text-secondary'
                        )}>
                          {value}
                        </p>
                      </div>
                    )
                  })}

                  {/* Copy All */}
                  <button
                    onClick={() => copyAllSection(currentSection)}
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
                        Copiar los 4 campos
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <p className="text-sm text-text-muted">No hay datos para esta seccion</p>
                </div>
              )}

              {/* Analysis */}
              {result.analysis && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAnalysis(!showAnalysis)}
                    className="w-full flex items-center justify-between p-4 hover:bg-surface-elevated/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-text-secondary">Analisis del Producto</span>
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
