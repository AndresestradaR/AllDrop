'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, RefreshCw, Upload, Shuffle, Heart, Download, X } from 'lucide-react'
import { IMAGE_MODELS, STUDIO_COMPANY_GROUPS, type ImageModelId } from '@/lib/image-providers/types'
import toast from 'react-hot-toast'

interface Step6GalleryProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
  modelId: ImageModelId
  onModelChange: (id: ImageModelId) => void
  onBack: () => void
}

const RANDOM_SITUATIONS = [
  'Walking through a cozy coffee shop with warm lighting, carrying a latte',
  'Sitting on a park bench reading a book on a sunny afternoon',
  'Standing on a rooftop terrace at golden hour with a city skyline behind',
  'Browsing vinyl records at a vintage music store',
  'Laughing while walking down a colorful street market',
  'Sitting at a beach bonfire at sunset, relaxed pose',
  'Working on a laptop at a minimalist co-working space',
  'Trying on sunglasses at a trendy boutique',
  'Taking a selfie in front of a mural on a city wall',
  'Enjoying street food at a night market with neon lights',
  'Riding a bicycle through a tree-lined avenue in autumn',
  'Standing under an umbrella on a rainy cobblestone street',
  'Relaxing in a hammock at a tropical resort',
  'Window shopping on a busy commercial avenue',
  'Posing casually against a vintage car on a quiet street',
  'Doing yoga in a serene outdoor garden at sunrise',
  'Walking along the beach at sunset, barefoot in the sand',
  'Sitting at a European cafe terrace with an espresso',
  'Exploring a colorful flower market, holding a bouquet',
  'Standing at a viewpoint overlooking mountains at dawn',
]

const PRODUCT_POSITIONS = [
  { v: 'en_la_mano', l: 'En la mano' },
  { v: 'junto_al_rostro', l: 'Junto al rostro' },
  { v: 'en_la_mesa', l: 'En la mesa' },
  { v: 'usando', l: 'Usandolo' },
]

interface GalleryItem {
  id?: string
  image_url: string
  imageBase64?: string
  mimeType?: string
  situation: string
  type: string
  product_name?: string
}

export function Step6Gallery({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
  modelId,
  onModelChange,
  onBack,
}: Step6GalleryProps) {
  const [mode, setMode] = useState<'solo' | 'with_product'>('solo')
  const [situation, setSituation] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null)

  // Product mode state
  const [productName, setProductName] = useState('')
  const [productPosition, setProductPosition] = useState('en_la_mano')
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [productBase64, setProductBase64] = useState<string | null>(null)
  const [productMime, setProductMime] = useState<string>('image/jpeg')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableModels = STUDIO_COMPANY_GROUPS.flatMap(g => g.models)

  const handleRandomSituation = () => {
    const random = RANDOM_SITUATIONS[Math.floor(Math.random() * RANDOM_SITUATIONS.length)]
    setSituation(random)
  }

  const handleProductFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProductPreview(URL.createObjectURL(file))

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      setProductBase64(base64)
      setProductMime(file.type || 'image/jpeg')
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (!situation.trim()) {
      toast.error('Escribe o genera una situacion')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          modelId,
          mode,
          situation: situation.trim(),
          productName: mode === 'with_product' ? productName : undefined,
          productPosition: mode === 'with_product' ? productPosition : undefined,
          productImageBase64: mode === 'with_product' ? productBase64 : undefined,
          productImageMimeType: mode === 'with_product' ? productMime : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar contenido')
      }

      const newItem: GalleryItem = {
        image_url: data.imageUrl,
        imageBase64: data.imageBase64,
        mimeType: data.mimeType,
        situation: situation.trim(),
        type: mode,
        product_name: mode === 'with_product' ? productName : undefined,
      }

      setGallery(prev => [newItem, ...prev])
      toast.success('Imagen generada')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async (item: GalleryItem) => {
    try {
      const response = await fetch(item.image_url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${influencerName}_content_${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al descargar')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        Genera contenido con tu influencer. Elige una situacion y crea imagenes unicas.
      </p>

      {/* Mode selector */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setMode('solo')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
            mode === 'solo' ? 'bg-accent text-background shadow-lg shadow-accent/25' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          )}
        >
          Solo
        </button>
        <button
          onClick={() => setMode('with_product')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
            mode === 'with_product' ? 'bg-accent text-background shadow-lg shadow-accent/25' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          )}
        >
          Con Producto
        </button>
      </div>

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

      {/* Product upload (only in with_product mode) */}
      {mode === 'with_product' && (
        <div className="space-y-3 mb-4 p-4 bg-surface-elevated rounded-xl border border-border">
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Nombre del producto</label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ej: Perfume Channel N°5"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Posicion del producto</label>
            <div className="flex gap-2 flex-wrap">
              {PRODUCT_POSITIONS.map(p => (
                <button
                  key={p.v}
                  onClick={() => setProductPosition(p.v)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                    productPosition === p.v
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                  )}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Imagen del producto (opcional)</label>
            {productPreview ? (
              <div className="relative inline-block">
                <img src={productPreview} alt="Product" className="w-24 h-24 rounded-xl object-cover border border-border" />
                <button
                  onClick={() => { setProductPreview(null); setProductBase64(null) }}
                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-error rounded-full text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent/50 transition-colors">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductFileSelect} />
                <Upload className="w-4 h-4 text-text-muted" />
                <span className="text-xs text-text-secondary">Subir imagen de producto</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Situation input */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Situacion / Escena</label>
        <div className="relative">
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Describe la situacion o escena para la foto..."
            rows={3}
            className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 pr-12"
          />
          <button
            onClick={handleRandomSituation}
            className="absolute top-2 right-2 p-2 rounded-lg hover:bg-border/50 text-text-secondary hover:text-accent transition-colors"
            title="Situacion aleatoria"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !situation.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all mb-6',
          isGenerating || !situation.trim()
            ? 'bg-border text-text-secondary cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generando contenido...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generar Imagen
          </>
        )}
      </button>

      {/* Gallery grid */}
      {gallery.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
            Galeria ({gallery.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gallery.map((item, idx) => (
              <div
                key={idx}
                className="group relative rounded-xl overflow-hidden bg-surface-elevated border border-border cursor-pointer"
                onClick={() => setSelectedImage(item)}
              >
                <img
                  src={item.image_url}
                  alt={item.situation}
                  className="w-full aspect-[9/16] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[10px] text-white/80 line-clamp-2">{item.situation}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(item) }}
                  className="absolute top-2 right-2 p-1.5 bg-black/40 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-lg max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.image_url}
              alt={selectedImage.situation}
              className="w-full h-full object-contain rounded-xl"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl">
              <p className="text-sm text-white/90">{selectedImage.situation}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-lg text-xs text-white hover:bg-white/30 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
