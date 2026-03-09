'use client'

import { useState, useEffect } from 'react'
import { Loader2, Film, Play, Sparkles, ChevronDown, ChevronUp, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { SavedAnglesPanel } from '@/components/studio/SavedAnglesPanel'

interface AngleData {
  id: string
  name: string
  hook: string
  description: string
  avatarSuggestion: string
  tone: string
  salesAngle: string
}

export interface SceneData {
  sceneNumber: number
  action: string
  dialogue: string
  camera: string
  sound: string
  veoPrompt: string
}

interface SceneScriptGeneratorProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
  onFillVeoPrompt: (prompt: string, sceneIndex: number) => void
  onGenerateAll: (scenes: SceneData[]) => void
  onStartSequential: (scenes: SceneData[]) => void
}

interface ProductWithContext {
  id: string
  name: string
  context: {
    description?: string
    benefits?: string
    problems?: string
    ingredients?: string
    differentiator?: string
  }
}

export function SceneScriptGenerator({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
  onFillVeoPrompt,
  onGenerateAll,
  onStartSequential,
}: SceneScriptGeneratorProps) {
  // Product selector (loads from Banner Generator context)
  const [products, setProducts] = useState<ProductWithContext[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)

  // Step 1: Angle selection
  const [selectedAngle, setSelectedAngle] = useState<AngleData | null>(null)
  const [showAngleSelector, setShowAngleSelector] = useState(true)

  // Step 2: Config
  const [productDescription, setProductDescription] = useState('')
  const [voiceGender, setVoiceGender] = useState<'femenina' | 'masculina'>('femenina')
  const [numberOfScenes, setNumberOfScenes] = useState(4)

  // Load all products with context on mount
  useEffect(() => {
    fetch('/api/products/context?list=true')
      .then(r => r.json())
      .then(data => {
        if (data.products?.length) {
          setProducts(data.products)
          // Auto-select first product
          setSelectedProductId(data.products[0].id)
          fillDescriptionFromContext(data.products[0].context)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingProducts(false))
  }, [])

  // When product changes, fill description
  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId)
    const product = products.find(p => p.id === productId)
    if (product?.context) {
      fillDescriptionFromContext(product.context)
    } else {
      setProductDescription('')
    }
  }

  const fillDescriptionFromContext = (ctx: ProductWithContext['context']) => {
    const parts: string[] = []
    if (ctx.description) parts.push(ctx.description)
    if (ctx.benefits) parts.push(`Beneficios: ${ctx.benefits}`)
    if (ctx.problems) parts.push(`Problemas que resuelve: ${ctx.problems}`)
    if (ctx.ingredients) parts.push(`Ingredientes/Componentes: ${ctx.ingredients}`)
    if (ctx.differentiator) parts.push(`Diferenciador: ${ctx.differentiator}`)
    if (parts.length > 0) {
      setProductDescription(parts.join('\n'))
    }
  }

  // Step 3: Generated scenes
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedScene, setExpandedScene] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!selectedAngle) {
      toast.error('Selecciona un angulo de venta primero')
      return
    }
    if (!productDescription.trim()) {
      toast.error('Describe el producto')
      return
    }

    setIsGenerating(true)
    setScenes([])

    try {
      const res = await fetch('/api/studio/influencer/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          angle: {
            name: selectedAngle.name,
            hook: selectedAngle.hook,
            salesAngle: selectedAngle.salesAngle,
            tone: selectedAngle.tone,
          },
          productDescription: productDescription.trim(),
          numberOfScenes,
          promptDescriptor,
          influencerName,
          voiceGender,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar guion')
      }

      setScenes(data.scenes)
      setExpandedScene(0)
      toast.success(`Guion generado con ${data.scenes.length} escenas`)
    } catch (error: any) {
      toast.error(error.message || 'Error al generar guion')
    } finally {
      setIsGenerating(false)
    }
  }

  const updateScenePrompt = (index: number, newPrompt: string) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, veoPrompt: newPrompt } : s))
  }

  return (
    <div className="mt-3 p-4 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-500/5 to-transparent">
      <h3 className="text-sm font-bold text-teal-400 mb-3 flex items-center gap-2">
        <Film className="w-4 h-4" />
        Guion por Escenas (Veo 3.1)
      </h3>

      {/* Product Selector — auto-loads context from Banner Generator */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-[#e5e5e5] uppercase tracking-wide mb-1 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-teal-400" />
          Producto
        </label>
        {isLoadingProducts ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
            <span className="text-xs text-text-muted">Cargando productos...</span>
          </div>
        ) : products.length > 0 ? (
          <select
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-[11px] text-text-muted px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg">
            No hay productos con contexto. Ve al Banner Generator y llena el &quot;Contexto del Producto&quot;.
          </p>
        )}
      </div>

      {/* Step 1: Angle Selector */}
      <div className="mb-4">
        <button
          onClick={() => setShowAngleSelector(!showAngleSelector)}
          className="w-full flex items-center justify-between text-xs font-semibold text-[#e5e5e5] uppercase tracking-wide mb-2"
        >
          <span>1. Selecciona un Angulo de Venta</span>
          {showAngleSelector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAngleSelector && (
          <div>
            {selectedAngle && (
              <div className="mb-2 p-2 rounded-lg bg-teal-500/10 border border-teal-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-400">{selectedAngle.name}</span>
                  <button
                    onClick={() => setSelectedAngle(null)}
                    className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
                  >
                    Cambiar
                  </button>
                </div>
                <p className="text-[10px] text-[#999] mt-0.5 line-clamp-1">{selectedAngle.salesAngle}</p>
              </div>
            )}
            {!selectedAngle && (
              <SavedAnglesPanel
                selectable
                showProductFilter
                selectedAngleId={null}
                onSelectAngle={(angle) => {
                  setSelectedAngle(angle)
                  setShowAngleSelector(false)
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Step 2: Product Description (auto-filled, editable) */}
      <div className="mb-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#e5e5e5] uppercase tracking-wide mb-1">
            2. Descripcion del Producto {productDescription && <span className="text-teal-400 text-[10px] font-normal ml-1">(del Banner Generator — editable)</span>}
          </label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Selecciona un producto arriba o describe manualmente..."
            rows={3}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-[#e5e5e5] placeholder:text-[#666] resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">
              Voz
            </label>
            <select
              value={voiceGender}
              onChange={(e) => setVoiceGender(e.target.value as 'femenina' | 'masculina')}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              <option value="femenina">Femenina</option>
              <option value="masculina">Masculina</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">
              Escenas: {numberOfScenes}
            </label>
            <input
              type="range"
              min={3}
              max={6}
              value={numberOfScenes}
              onChange={(e) => setNumberOfScenes(Number(e.target.value))}
              className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer accent-teal-500 mt-2"
            />
            <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !selectedAngle || !productDescription.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl text-sm font-semibold hover:from-teal-500 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/20"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generando guion...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generar Guion ({numberOfScenes} escenas)
          </>
        )}
      </button>

      {/* Generated Scenes */}
      {scenes.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-wide">
            Escenas Generadas
          </h4>

          {scenes.map((scene, i) => {
            const isExpanded = expandedScene === i

            return (
              <div
                key={i}
                className="rounded-xl border border-[#333] bg-[#1a1a1a] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedScene(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#222] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-teal-400 bg-teal-500/15 px-2 py-0.5 rounded-full">
                      {scene.sceneNumber}
                    </span>
                    <span className="text-xs text-[#e5e5e5] truncate max-w-[200px]">{scene.action}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-text-muted">8s</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    <div>
                      <span className="text-[9px] font-semibold text-text-muted uppercase">Accion</span>
                      <p className="text-[11px] text-[#ccc]">{scene.action}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-text-muted uppercase">Dialogo</span>
                      <p className="text-[11px] text-amber-400/80 italic">&quot;{scene.dialogue}&quot;</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <span className="text-[9px] font-semibold text-text-muted uppercase">Camara</span>
                        <p className="text-[10px] text-[#999]">{scene.camera}</p>
                      </div>
                      <div className="flex-1">
                        <span className="text-[9px] font-semibold text-text-muted uppercase">Sonido</span>
                        <p className="text-[10px] text-[#999]">{scene.sound}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-teal-400 uppercase">Veo Prompt</span>
                      <textarea
                        value={scene.veoPrompt}
                        onChange={(e) => updateScenePrompt(i, e.target.value)}
                        rows={3}
                        maxLength={400}
                        className="w-full mt-1 px-2 py-1.5 bg-[#111] border border-[#333] rounded-lg text-[11px] text-[#e5e5e5] resize-none focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-text-muted">{scene.veoPrompt.length}/400</span>
                        <button
                          onClick={() => onFillVeoPrompt(scene.veoPrompt, i)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-teal-500/20 text-teal-400 rounded-lg text-[10px] font-semibold hover:bg-teal-500/30 transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          Generar Video
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ===== Modo de Generacion: Secuencial vs Paralelo ===== */}
          <div className="mt-4 pt-4 border-t border-[#333]">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3 text-center">
              Generar {scenes.length} Escenas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* Secuencial con Veo Extend */}
              <button
                onClick={() => onStartSequential(scenes)}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-gradient-to-b from-teal-600/20 to-teal-600/5 text-teal-400 rounded-xl text-xs font-semibold hover:from-teal-600/30 hover:to-teal-600/10 transition-all border border-teal-500/30"
              >
                <Film className="w-5 h-5" />
                <span className="font-bold">Secuencial</span>
                <span className="text-[9px] text-teal-400/60 font-normal leading-tight text-center">
                  Veo Extend — transiciones fluidas entre escenas
                </span>
              </button>
              {/* Paralelo */}
              <button
                onClick={() => onGenerateAll(scenes)}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-gradient-to-b from-emerald-600/20 to-emerald-600/5 text-emerald-400 rounded-xl text-xs font-semibold hover:from-emerald-600/30 hover:to-emerald-600/10 transition-all border border-emerald-500/30"
              >
                <Play className="w-5 h-5" />
                <span className="font-bold">Paralelo</span>
                <span className="text-[9px] text-emerald-400/60 font-normal leading-tight text-center">
                  Todas a la vez — más rápido, sin transiciones
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
