'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react'
import { IMAGE_MODELS, STUDIO_COMPANY_GROUPS, type ImageModelId } from '@/lib/image-providers/types'
import { useI18n } from '@/lib/i18n'

interface Step3AnglesProps {
  influencerId: string
  realisticImageUrl: string
  realisticImageBase64?: string | null
  realisticImageMimeType?: string
  modelId: ImageModelId
  onModelChange: (id: ImageModelId) => void
  onComplete: (anglesGridUrl: string) => void
  onBack: () => void
}

export function Step3Angles({
  influencerId,
  realisticImageUrl,
  realisticImageBase64,
  realisticImageMimeType,
  modelId,
  onModelChange,
  onComplete,
  onBack,
}: Step3AnglesProps) {
  const { t } = useI18n()
  const s = t.studio.influencer.step3

  const [isGenerating, setIsGenerating] = useState(false)
  const [gridImage, setGridImage] = useState<string | null>(null)
  const [gridUrl, setGridUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when switching influencers
  useEffect(() => {
    setGridImage(null)
    setGridUrl(null)
    setError(null)
  }, [influencerId])

  const availableModels = STUDIO_COMPANY_GROUPS.flatMap(g => g.models).filter(m => m.supportsImageInput)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/generate-angles', {
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
        throw new Error(data.error || 'Error al generar grid')
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
        {s.description}
      </p>

      {/* Reference thumbnail */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-surface-elevated rounded-xl border border-border">
        <img
          src={realisticImageUrl}
          alt="Reference"
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
        <div>
          <p className="text-sm font-medium text-text-primary">{s.hyperrealisticImage}</p>
          <p className="text-xs text-text-secondary">{s.referenceForGrid}</p>
        </div>
      </div>

      {/* Grid result */}
      {gridImage ? (
        <div className="mb-4">
          <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border">
            <img src={gridImage} alt="Angles grid" className="w-full" />
          </div>
          {/* Grid labels */}
          <div className="grid grid-cols-3 gap-1 mt-2">
            {s.gridLabels.map((label: string, i: number) => (
              <p key={i} className="text-[10px] text-text-muted text-center py-1">{label}</p>
            ))}
          </div>
        </div>
      ) : isGenerating ? (
        <div className="flex items-center justify-center py-16 bg-surface-elevated rounded-xl border border-border mb-4">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-secondary">{s.generatingGrid}</p>
            <p className="text-xs text-text-muted mt-1">{s.canTakeMinutes}</p>
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
            {s.continue}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-all"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {s.regenerate}
          </button>
        </div>
      ) : !isGenerating ? (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          {s.generateAnglesGrid}
        </button>
      ) : null}
    </div>
  )
}
