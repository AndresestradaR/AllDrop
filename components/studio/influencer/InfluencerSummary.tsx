'use client'

import { useState } from 'react'
import { Copy, Check, Palette, Video, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

interface InfluencerSummaryProps {
  influencer: any
  onCreateContent: () => void
  onCreateVideo: () => void
  onEditName: (name: string) => void
  onBack: () => void
}

export function InfluencerSummary({
  influencer,
  onCreateContent,
  onCreateVideo,
  onEditName,
  onBack,
}: InfluencerSummaryProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [name, setName] = useState(influencer.name || 'Mi Influencer')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success('Copiado al portapapeles')
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Error al copiar')
    }
  }

  const handleSaveName = () => {
    setIsEditingName(false)
    onEditName(name)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-text-primary mb-1">Influencer Listo</h3>
        <p className="text-sm text-text-secondary">Tu influencer virtual esta completo y listo para crear contenido</p>
      </div>

      {/* Main images */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {influencer.realistic_image_url && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Foto Realista</p>
            <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border">
              <img
                src={influencer.realistic_image_url}
                alt={name}
                className="w-full aspect-[9/16] object-cover"
              />
            </div>
          </div>
        )}
        {influencer.angles_grid_url && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Grid de Angulos</p>
            <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border">
              <img
                src={influencer.angles_grid_url}
                alt="Angles grid"
                className="w-full aspect-square object-cover"
              />
            </div>
          </div>
        )}
        {influencer.body_grid_url && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Grid de Cuerpo</p>
            <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border">
              <img
                src={influencer.body_grid_url}
                alt="Body grid"
                className="w-full aspect-square object-cover"
              />
            </div>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="mb-4 p-4 bg-surface-elevated rounded-xl border border-border">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-text-muted uppercase tracking-wide">Nombre</p>
          <button
            onClick={() => isEditingName ? handleSaveName() : setIsEditingName(true)}
            className="p-1 rounded hover:bg-border/50 text-text-secondary"
          >
            {isEditingName ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
        </div>
        {isEditingName ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            autoFocus
          />
        ) : (
          <p className="text-lg font-semibold text-text-primary">{name}</p>
        )}
      </div>

      {/* Prompt Descriptor */}
      {influencer.prompt_descriptor && (
        <div className="mb-4 p-4 bg-accent/5 border border-accent/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-accent uppercase tracking-wide">Prompt Descriptor</p>
            <button
              onClick={() => handleCopy(influencer.prompt_descriptor, 'descriptor')}
              className="p-1.5 rounded-lg hover:bg-accent/10 text-accent"
            >
              {copiedField === 'descriptor' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{influencer.prompt_descriptor}</p>
        </div>
      )}

      {/* Copy full DNA */}
      {influencer.visual_dna && (
        <button
          onClick={() => handleCopy(influencer.visual_dna, 'dna')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-all mb-4"
        >
          {copiedField === 'dna' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          Copiar ADN Visual completo
        </button>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCreateContent}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all"
        >
          <Palette className="w-5 h-5" />
          Crear Contenido
        </button>
        <button
          onClick={onCreateVideo}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all"
        >
          <Video className="w-5 h-5" />
          Crear Video
        </button>
      </div>
    </div>
  )
}
