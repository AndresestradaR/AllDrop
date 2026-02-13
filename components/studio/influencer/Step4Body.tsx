'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react'
import { IMAGE_MODELS, STUDIO_COMPANY_GROUPS, type ImageModelId } from '@/lib/image-providers/types'

interface Step4BodyProps {
  influencerId: string
  realisticImageUrl: string
  realisticImageBase64?: string | null
  realisticImageMimeType?: string
  modelId: ImageModelId
  onModelChange: (id: ImageModelId) => void
  onComplete: (bodyGridUrl: string) => void
  onBack: () => void
}

const BODY_GRID_LABELS = [
  'Cuerpo completo, frontal',
  'Cuerpo completo, 3/4 frontal',
  'Cuerpo completo, perfil',
  'Tres cuartos, pose casual',
  'Cuerpo completo, espalda',
  'Tres cuartos, 3/4 posterior',
  'Cuerpo completo, caminando',
  'Cuerpo completo, sentado',
  'Cuerpo completo, pose dinamica',
]

export function Step4Body({
  influencerId,
  realisticImageUrl,
  realisticImageBase64,
  realisticImageMimeType,
  modelId,
  onModelChange,
  onComplete,
  onBack,
}: Step4BodyProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [gridImage, setGridImage] = useState<string | null>(null)
  const [gridUrl, setGridUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableModels = STUDIO_COMPANY_GROUPS.flatMap(g => g.models).filter(m => m.supportsImageInput)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/generate-body-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          modelId,
          realisticImageBase64: realisticImageBase64 || undefined,
          realisticImageMimeType: realisticImageMimeType || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar grid de cuerpo')
      }

      setGridImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      setGridUrl(data.imageUrl)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = () => {
    if (gridUrl) {
      onComplete(gridUrl)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        Generaremos un grid con poses de cuerpo completo de tu influencer para mayor consistencia en contenido.
      </p>

      {/* Model selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Modelo de IA</label>
        <select
          value={modelId}
          onChange={(e) => onModelChange(e.target.value as ImageModelId)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {availableModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </select>
      </div>

      {/* Reference thumbnail */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-surface-elevated rounded-xl border border-border">
        <img
          src={realisticImageUrl}
          alt="Reference"
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
        <div>
          <p className="text-sm font-medium text-text-primary">Imagen hiperrealista</p>
          <p className="text-xs text-text-secondary">Se usara como referencia para el grid de cuerpo completo</p>
        </div>
      </div>

      {/* Grid result */}
      {gridImage ? (
        <div className="mb-4">
          <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border">
            <img src={gridImage} alt="Body grid" className="w-full" />
          </div>
          {/* Grid labels */}
          <div className="grid grid-cols-3 gap-1 mt-2">
            {BODY_GRID_LABELS.map((label, i) => (
              <p key={i} className="text-[10px] text-text-muted text-center py-1">{label}</p>
            ))}
          </div>
        </div>
      ) : isGenerating ? (
        <div className="flex items-center justify-center py-16 bg-surface-elevated rounded-xl border border-border mb-4">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-secondary">Generando grid de cuerpo completo...</p>
            <p className="text-xs text-text-muted mt-1">Esto puede tomar hasta 2 minutos</p>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {gridImage ? (
        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 transition-all"
          >
            <Check className="w-5 h-5" />
            Continuar
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-all"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerar
          </button>
        </div>
      ) : !isGenerating ? (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          Generar Grid de Cuerpo
        </button>
      ) : null}
    </div>
  )
}
