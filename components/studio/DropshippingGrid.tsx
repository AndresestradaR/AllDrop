'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  Star,
  Drama,
  RefreshCw,
  Video,
  UserCircle,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'

interface DropshippingTool {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  emoji: string
  soon?: boolean
}

const DROPSHIPPING_TOOLS: DropshippingTool[] = [
  {
    id: 'resena-ugc',
    name: 'Resena UGC',
    description: 'Genera resenas realistas con IA',
    icon: Star,
    color: 'from-yellow-500 to-amber-500',
    emoji: '⭐',
  },
  {
    id: 'deep-face',
    name: 'Deep Face',
    description: 'Cambia cara y voz de videos',
    icon: Drama,
    color: 'from-purple-500 to-pink-500',
    emoji: '🎭',
  },
  {
    id: 'clonar-viral',
    name: 'Clonar Viral',
    description: 'Recrea videos virales para tu producto',
    icon: RefreshCw,
    color: 'from-blue-500 to-cyan-500',
    emoji: '🔄',
  },
  {
    id: 'video-producto',
    name: 'Video Producto',
    description: 'Crea videos de tu producto con IA',
    icon: Video,
    color: 'from-red-500 to-orange-500',
    emoji: '🎥',
  },
  {
    id: 'mi-influencer',
    name: 'Mi Influencer',
    description: 'Crea y guarda personajes consistentes',
    icon: UserCircle,
    color: 'from-green-500 to-emerald-500',
    emoji: '👤',
  },
]

type ActiveTool = typeof DROPSHIPPING_TOOLS[number]['id'] | null

// ============================================
// RESENA UGC COMPONENT
// ============================================
function ResenaUGCTool({ onBack }: { onBack: () => void }) {
  const [productName, setProductName] = useState('')
  const [productBenefit, setProductBenefit] = useState('')
  const [persona, setPersona] = useState<'mujer-joven' | 'mujer-adulta' | 'hombre-joven' | 'hombre-adulto'>('mujer-joven')
  const [tone, setTone] = useState<'casual' | 'entusiasta' | 'esceptico-convencido'>('casual')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReview, setGeneratedReview] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!productName.trim()) return
    setIsGenerating(true)
    // TODO: Implement API call
    setTimeout(() => {
      setGeneratedReview(`Me encanta este ${productName}! Al principio estaba un poco esceptica pero despues de usarlo por una semana, puedo decir que realmente funciona. ${productBenefit ? `Lo mejor es que ${productBenefit.toLowerCase()}.` : ''} Super recomendado para todas las que buscan resultados reales. 10/10 lo volveria a comprar!`)
      setIsGenerating(false)
    }, 1500)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'resena-ugc')!

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button
            onClick={onBack}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-1/2 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Nombre del producto *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Serum facial, Faja reductora..."
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Beneficio principal (opcional)
              </label>
              <input
                type="text"
                value={productBenefit}
                onChange={(e) => setProductBenefit(e.target.value)}
                placeholder="Ej: Reduce arrugas en 2 semanas..."
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Persona del reviewer
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'mujer-joven', label: 'Mujer joven (18-30)' },
                  { id: 'mujer-adulta', label: 'Mujer adulta (30-50)' },
                  { id: 'hombre-joven', label: 'Hombre joven (18-30)' },
                  { id: 'hombre-adulto', label: 'Hombre adulto (30-50)' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setPersona(option.id as typeof persona)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                      persona === option.id
                        ? 'bg-accent text-background'
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Tono de la resena
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'casual', label: 'Casual' },
                  { id: 'entusiasta', label: 'Entusiasta' },
                  { id: 'esceptico-convencido', label: 'Esceptico convencido' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTone(option.id as typeof tone)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      tone === option.id
                        ? 'bg-accent text-background'
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="w-1/2 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Resena generada
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl p-4 overflow-auto">
              {generatedReview ? (
                <div className="relative">
                  <p className="text-text-primary whitespace-pre-wrap">{generatedReview}</p>
                  <button
                    onClick={handleCopy}
                    className="absolute top-0 right-0 p-2 hover:bg-border/50 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-text-secondary" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center">
                  {isGenerating ? (
                    <div>
                      <Loader2 className="w-8 h-8 text-accent mx-auto mb-2 animate-spin" />
                      <p className="text-text-secondary">Generando resena...</p>
                    </div>
                  ) : (
                    <div>
                      <Star className="w-8 h-8 text-text-secondary mx-auto mb-2" />
                      <p className="text-text-secondary">La resena aparecera aqui</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end">
          <button
            onClick={handleGenerate}
            disabled={!productName.trim() || isGenerating}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
              !productName.trim() || isGenerating
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar Resena
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PLACEHOLDER TOOL COMPONENT
// ============================================
function PlaceholderTool({ toolId, onBack }: { toolId: string; onBack: () => void }) {
  const tool = DROPSHIPPING_TOOLS.find(t => t.id === toolId)!

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button
            onClick={onBack}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Content - Placeholder */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <span className="text-6xl mb-4 block">{tool.emoji}</span>
            <h3 className="text-xl font-semibold text-text-primary mb-2">{tool.name}</h3>
            <p className="text-text-secondary max-w-md">
              Esta herramienta esta en desarrollo. Pronto podras {tool.description.toLowerCase()}.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN GRID COMPONENT
// ============================================
export function DropshippingGrid() {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)

  const handleBack = () => setActiveTool(null)

  // Render specific tool UI
  if (activeTool === 'resena-ugc') {
    return <ResenaUGCTool onBack={handleBack} />
  }

  if (activeTool) {
    return <PlaceholderTool toolId={activeTool} onBack={handleBack} />
  }

  // Grid view
  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Herramientas Dropshipping</h2>
        <p className="text-text-secondary">
          Herramientas de IA especializadas para crear contenido de ventas
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {DROPSHIPPING_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => !tool.soon && setActiveTool(tool.id)}
            disabled={tool.soon}
            className={cn(
              'relative p-6 bg-surface rounded-2xl border border-border text-left transition-all duration-200',
              tool.soon
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-1'
            )}
          >
            {tool.soon && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-border text-text-secondary rounded">
                Pronto
              </span>
            )}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4',
                tool.color
              )}
            >
              <span className="text-2xl">{tool.emoji}</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {tool.name}
            </h3>
            <p className="text-sm text-text-secondary">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
