'use client'

import { useState } from 'react'
import { Loader2, Film, Sparkles, ChevronDown, ChevronUp, Copy, Check, ArrowRight } from 'lucide-react'
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

interface StandaloneScriptGeneratorProps {
  onScenesGenerated: (scenes: SceneData[]) => void
}

export function StandaloneScriptGenerator({ onScenesGenerated }: StandaloneScriptGeneratorProps) {
  // Step 1: Angle selection
  const [selectedAngle, setSelectedAngle] = useState<AngleData | null>(null)
  const [showAngleSelector, setShowAngleSelector] = useState(true)

  // Step 2: Config
  const [productDescription, setProductDescription] = useState('')
  const [voiceGender, setVoiceGender] = useState<'femenina' | 'masculina'>('femenina')
  const [numberOfScenes, setNumberOfScenes] = useState(4)

  // Step 3: Generated scenes
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

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
      const res = await fetch('/api/studio/generate-video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          angle: {
            name: selectedAngle.name,
            hook: selectedAngle.hook,
            salesAngle: selectedAngle.salesAngle,
            tone: selectedAngle.tone,
          },
          productDescription: productDescription.trim(),
          numberOfScenes,
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

  const handleCopyPrompt = async (prompt: string, index: number) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedIndex(index)
      toast.success('Prompt copiado')
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      toast.error('Error al copiar')
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Angle Selector */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <button
          onClick={() => setShowAngleSelector(!showAngleSelector)}
          className="w-full flex items-center justify-between text-sm font-semibold text-text-primary mb-4"
        >
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center">1</span>
            Selecciona un Angulo de Venta
          </span>
          {showAngleSelector ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
        </button>

        {showAngleSelector && (
          <div>
            {selectedAngle && (
              <div className="mb-3 p-3 rounded-xl bg-accent/10 border border-accent/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-accent">{selectedAngle.name}</span>
                  <button
                    onClick={() => setSelectedAngle(null)}
                    className="text-xs text-text-secondary hover:text-error transition-colors"
                  >
                    Cambiar
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">{selectedAngle.salesAngle}</p>
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

      {/* Step 2: Config */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center">2</span>
          <span className="text-sm font-semibold text-text-primary">Configura el Guion</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Descripcion del Producto
            </label>
            <textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Describe el producto: que es, que hace, para quien es, precio..."
              rows={3}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Genero de Voz
              </label>
              <select
                value={voiceGender}
                onChange={(e) => setVoiceGender(e.target.value as 'femenina' | 'masculina')}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              >
                <option value="femenina">Femenina</option>
                <option value="masculina">Masculina</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Escenas: {numberOfScenes}
              </label>
              <input
                type="range"
                min={3}
                max={6}
                value={numberOfScenes}
                onChange={(e) => setNumberOfScenes(Number(e.target.value))}
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent mt-2"
              />
              <div className="flex justify-between text-[10px] text-text-muted mt-1">
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
          className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20"
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
      </div>

      {/* Step 3: Generated Scenes */}
      {scenes.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center">3</span>
            <span className="text-sm font-semibold text-text-primary">Escenas Generadas</span>
            <span className="text-xs text-text-secondary ml-auto">{scenes.length} escenas · {scenes.length * 8}s total</span>
          </div>

          <div className="space-y-2">
            {scenes.map((scene, i) => {
              const isExpanded = expandedScene === i

              return (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface-elevated overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedScene(isExpanded ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-border/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-accent bg-accent/15 px-2 py-0.5 rounded-full">
                        {scene.sceneNumber}
                      </span>
                      <span className="text-sm text-text-primary truncate max-w-[300px]">{scene.action}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">8s</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Accion</span>
                        <p className="text-xs text-text-secondary mt-0.5">{scene.action}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Dialogo</span>
                        <p className="text-xs text-amber-500/80 italic mt-0.5">&quot;{scene.dialogue}&quot;</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Camara</span>
                          <p className="text-[11px] text-text-secondary mt-0.5">{scene.camera}</p>
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Sonido</span>
                          <p className="text-[11px] text-text-secondary mt-0.5">{scene.sound}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">Veo Prompt</span>
                        <textarea
                          value={scene.veoPrompt}
                          onChange={(e) => updateScenePrompt(i, e.target.value)}
                          rows={3}
                          maxLength={400}
                          className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent/50"
                        />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-text-muted">{scene.veoPrompt.length}/400</span>
                          <button
                            onClick={() => handleCopyPrompt(scene.veoPrompt, i)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent rounded-lg text-[11px] font-semibold hover:bg-accent/20 transition-colors"
                          >
                            {copiedIndex === i ? (
                              <>
                                <Check className="w-3 h-3" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copiar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Continue button */}
          <button
            onClick={() => onScenesGenerated(scenes)}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25"
          >
            <ArrowRight className="w-4 h-4" />
            Continuar — Configurar Video
          </button>
        </div>
      )}
    </div>
  )
}
