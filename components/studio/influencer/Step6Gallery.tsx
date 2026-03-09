'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, RefreshCw, Upload, Shuffle, Heart, Download, X, Share2, RectangleVertical, RectangleHorizontal, Square, Image as ImageIcon } from 'lucide-react'
import { IMAGE_MODELS, STUDIO_COMPANY_GROUPS, type ImageModelId } from '@/lib/image-providers/types'
import toast from 'react-hot-toast'
import { PublisherModal } from '@/components/studio/PublisherModal'

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
  'Caminando por una cafeteria acogedora con luz calida, llevando un latte',
  'Sentada en una banca del parque leyendo un libro en una tarde soleada',
  'De pie en una terraza con vista a la ciudad al atardecer',
  'Revisando discos de vinilo en una tienda de musica vintage',
  'Riendo mientras camina por un mercado callejero colorido',
  'Sentada junto a una fogata en la playa al atardecer, pose relajada',
  'Trabajando en un laptop en un coworking minimalista',
  'Probandose gafas de sol en una boutique de moda',
  'Tomandose una selfie frente a un mural urbano',
  'Disfrutando comida callejera en un mercado nocturno con luces neon',
  'Montando bicicleta por una avenida arbolada en otono',
  'De pie bajo un paraguas en una calle adoquinada bajo la lluvia',
  'Relajandose en una hamaca en un resort tropical',
  'Mirando vitrinas en una avenida comercial concurrida',
  'Posando casualmente contra un auto vintage en una calle tranquila',
  'Haciendo yoga en un jardin al aire libre al amanecer',
  'Caminando por la playa al atardecer, descalza en la arena',
  'Sentada en la terraza de un cafe europeo con un espresso',
  'Explorando un mercado de flores colorido, sosteniendo un ramo',
  'De pie en un mirador contemplando las montanas al amanecer',
  'Cocinando en una cocina moderna con vapor saliendo de la sarten',
  'En un gimnasio haciendo ejercicio con pesas, expresion concentrada',
  'Grabando contenido en un estudio con aro de luz, setup de influencer',
  'En la habitacion de un hotel de lujo, luz de manana por las cortinas',
  'En un festival de musica, multitud de fondo, vibra energetica',
]

const PRODUCT_POSITIONS = [
  { v: 'en_la_mano', l: 'En la mano' },
  { v: 'junto_al_rostro', l: 'Junto al rostro' },
  { v: 'en_la_mesa', l: 'En la mesa' },
  { v: 'usando', l: 'Usandolo' },
]

type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5'

const ASPECT_RATIOS: { value: AspectRatio; label: string; sublabel: string; icon: typeof RectangleVertical }[] = [
  { value: '9:16', label: 'Vertical', sublabel: 'Stories/TikTok', icon: RectangleVertical },
  { value: '16:9', label: 'Horizontal', sublabel: 'YouTube', icon: RectangleHorizontal },
  { value: '1:1', label: 'Cuadrado', sublabel: 'Feed', icon: Square },
  { value: '4:5', label: 'Post IG', sublabel: 'Instagram', icon: ImageIcon },
]

function getAspectClass(ratio?: string): string {
  switch (ratio) {
    case '16:9': return 'aspect-video'
    case '1:1': return 'aspect-square'
    case '4:5': return 'aspect-[4/5]'
    default: return 'aspect-[9/16]'
  }
}

interface GalleryItem {
  id?: string
  image_url: string
  imageBase64?: string
  mimeType?: string
  situation: string
  type: string
  product_name?: string
  is_favorite?: boolean
  aspect_ratio?: string
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')
  const [situation, setSituation] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null)
  const [isLoadingGallery, setIsLoadingGallery] = useState(true)
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'favorites' | 'solo' | 'with_product'>('all')
  const [publishItem, setPublishItem] = useState<GalleryItem | null>(null)

  // Product mode state
  const [productName, setProductName] = useState('')
  const [productPosition, setProductPosition] = useState('en_la_mano')
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [productBase64, setProductBase64] = useState<string | null>(null)
  const [productMime, setProductMime] = useState<string>('image/jpeg')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableModels = STUDIO_COMPANY_GROUPS.flatMap(g => g.models)

  // Reset form state when switching influencers
  useEffect(() => {
    setMode('solo')
    setSituation('')
    setAspectRatio('9:16')
    setProductName('')
    setProductPosition('en_la_mano')
    setProductPreview(null)
    setProductBase64(null)
    setError(null)
    setSelectedImage(null)
  }, [influencerId])

  // Cargar galería existente al montar
  useEffect(() => {
    const loadGallery = async () => {
      setIsLoadingGallery(true)
      try {
        const res = await fetch(`/api/studio/influencer/gallery?influencerId=${influencerId}`)
        const data = await res.json()
        if (data.items) {
          setGallery(data.items.map((item: any) => ({
            id: item.id,
            image_url: item.image_url,
            situation: item.situation || '',
            type: item.type || 'solo',
            product_name: item.product_name,
            is_favorite: item.is_favorite,
            aspect_ratio: item.aspect_ratio || '9:16',
          })))
        }
      } catch (err) {
        console.error('Error loading gallery:', err)
      } finally {
        setIsLoadingGallery(false)
      }
    }
    loadGallery()
  }, [influencerId])

  const filteredGallery = gallery.filter(item => {
    if (galleryFilter === 'all') return true
    if (galleryFilter === 'favorites') return item.is_favorite
    if (galleryFilter === 'solo') return item.type === 'solo'
    if (galleryFilter === 'with_product') return item.type === 'with_product'
    return true
  })

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
          promptDescriptor,
          realisticImageUrl,
          aspectRatio,
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
        id: data.galleryId,
        image_url: data.imageUrl,
        imageBase64: data.imageBase64,
        mimeType: data.mimeType,
        situation: situation.trim(),
        type: mode,
        product_name: mode === 'with_product' ? productName : undefined,
        is_favorite: false,
        aspect_ratio: aspectRatio,
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

  const handleToggleFavorite = async (item: GalleryItem) => {
    if (!item.id) return
    const newVal = !item.is_favorite
    try {
      await fetch('/api/studio/influencer/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_favorite: newVal }),
      })
      setGallery(prev => prev.map(g =>
        g.id === item.id ? { ...g, is_favorite: newVal } : g
      ))
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  const handleDeleteImage = async (item: GalleryItem) => {
    if (!item.id) return
    try {
      await fetch(`/api/studio/influencer/gallery?id=${item.id}`, { method: 'DELETE' })
      setGallery(prev => prev.filter(g => g.id !== item.id))
      toast.success('Imagen eliminada')
    } catch {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        Genera contenido con tu influencer. Elige una situacion y crea imagenes unicas.
      </p>

      {/* Warning if no prompt descriptor */}
      {!promptDescriptor && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
          <p className="text-sm text-amber-400">Sin prompt descriptor. Las imagenes pueden no mantener consistencia.</p>
        </div>
      )}

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

      {/* Aspect Ratio selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Formato de imagen</label>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map(ar => {
            const Icon = ar.icon
            return (
              <button
                key={ar.value}
                onClick={() => setAspectRatio(ar.value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border',
                  aspectRatio === ar.value
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{ar.label}</span>
                <span className="text-[9px] opacity-60">{ar.sublabel}</span>
              </button>
            )
          })}
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

      {/* Gallery section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Galeria de {influencerName} ({gallery.length})
          </h4>
          <div className="flex gap-1">
            {(['all', 'favorites', 'solo', 'with_product'] as const).map(f => (
              <button
                key={f}
                onClick={() => setGalleryFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
                  galleryFilter === f
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {f === 'all' ? 'Todas' : f === 'favorites' ? 'Favoritas' : f === 'solo' ? 'Solo' : 'Producto'}
              </button>
            ))}
          </div>
        </div>

        {isLoadingGallery ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : filteredGallery.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">
              {galleryFilter === 'all' ? 'No hay imagenes aun. Genera tu primer contenido!' : 'No hay imagenes en esta categoria'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredGallery.map((item, idx) => (
              <div
                key={item.id || idx}
                className="group relative rounded-xl overflow-hidden bg-surface-elevated border border-border cursor-pointer"
                onClick={() => setSelectedImage(item)}
              >
                <img
                  src={item.image_url}
                  alt={item.situation}
                  className={cn('w-full object-cover', getAspectClass(item.aspect_ratio))}
                />
                {/* Overlay con info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-[10px] text-white/80 line-clamp-2 mb-1.5">{item.situation}</p>
                    {item.product_name && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-accent/30 text-accent rounded-full">
                        {item.product_name}
                      </span>
                    )}
                  </div>
                </div>
                {/* Botones superiores */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item) }}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      item.is_favorite ? 'bg-amber-500/80 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                    )}
                  >
                    <Heart className={cn('w-3.5 h-3.5', item.is_favorite && 'fill-current')} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPublishItem(item) }}
                    className="p-1.5 bg-black/40 rounded-lg text-white hover:bg-black/60 transition-colors"
                    title="Publicar en redes"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(item) }}
                    className="p-1.5 bg-black/40 rounded-lg text-white hover:bg-black/60 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(item) }}
                    className="p-1.5 bg-error/60 rounded-lg text-white hover:bg-error/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Favorite indicator (always visible) */}
                {item.is_favorite && (
                  <div className="absolute top-2 left-2">
                    <Heart className="w-3.5 h-3.5 text-amber-400 fill-current" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Publisher modal (Publer) */}
      <PublisherModal
        isOpen={!!publishItem}
        onClose={() => setPublishItem(null)}
        mediaUrl={publishItem?.image_url}
        contentType="photo"
        defaultCaption={publishItem?.situation || 'Contenido generado con IA'}
        previewUrl={publishItem?.image_url}
      />

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
