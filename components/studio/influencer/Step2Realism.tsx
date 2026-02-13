'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react'
import { IMAGE_MODELS, STUDIO_COMPANY_GROUPS, type ImageModelId } from '@/lib/image-providers/types'

interface Step2RealismProps {
  influencerId: string
  baseImageUrl: string
  baseImageBase64?: string | null
  baseImageMimeType?: string
  modelId: ImageModelId
  onModelChange: (id: ImageModelId) => void
  onComplete: (realisticImageUrl: string, imageBase64: string, mimeType: string) => void
  onBack: () => void
}

export function Step2Realism({
  influencerId,
  baseImageUrl,
  baseImageBase64,
  baseImageMimeType,
  modelId,
  onModelChange,
  onComplete,
  onBack,
}: Step2RealismProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [resultBase64, setResultBase64] = useState<string | null>(null)
  const [resultMime, setResultMime] = useState<string>('image/png')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableModels = STUDIO_COMPANY_GROUPS.flatMap(g => g.models).filter(m => m.supportsImageInput)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/enhance-realism', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          modelId,
          baseImageBase64: baseImageBase64 || undefined,
          baseImageMimeType: baseImageMimeType || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al mejorar imagen')
      }

      setResultImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      setResultBase64(data.imageBase64)
      setResultMime(data.mimeType || 'image/png')
      setResultUrl(data.imageUrl)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = () => {
    if (resultUrl && resultBase64) {
      onComplete(resultUrl, resultBase64, resultMime)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        Vamos a darle hiperrealismo a tu influencer con tecnicas de fotografia profesional.
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

      {/* Before / After comparison */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2 text-center">Imagen base</p>
          <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border aspect-[9/16]">
            <img
              src={baseImageUrl}
              alt="Base"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2 text-center">
            {resultImage ? 'Hiperrealista' : 'Resultado'}
          </p>
          <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border aspect-[9/16] flex items-center justify-center">
            {resultImage ? (
              <img
                src={resultImage}
                alt="Realistic"
                className="w-full h-full object-cover"
              />
            ) : isGenerating ? (
              <div className="text-center p-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-2" />
                <p className="text-xs text-text-secondary">Aplicando hiperrealismo...</p>
              </div>
            ) : (
              <p className="text-xs text-text-muted text-center px-4">
                Presiona el boton para aplicar hiperrealismo
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {resultImage ? (
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
      ) : (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all',
            isGenerating
              ? 'bg-border text-text-secondary cursor-not-allowed'
              : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Aplicando hiperrealismo...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Aplicar Hiperrealismo
            </>
          )}
        </button>
      )}
    </div>
  )
}
