'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Pencil, Loader2, Heart, Download, Image as ImageIcon, Video, LayoutGrid, Share2, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'
import { PublisherModal } from '../PublisherModal'

interface InfluencerSummaryProps {
  influencer: any
  onCreateContent: () => void
  onCreateVideo: () => void
  onViewBoard: () => void
  onEditName: (name: string) => void
  onBack: () => void
}

export function InfluencerSummary({
  influencer,
  onCreateContent,
  onCreateVideo,
  onViewBoard,
  onEditName,
  onBack,
}: InfluencerSummaryProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [name, setName] = useState(influencer.name || 'Mi Influencer')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [recentContent, setRecentContent] = useState<any[]>([])
  const [loadingContent, setLoadingContent] = useState(true)
  const [contentFilter, setContentFilter] = useState<'all' | 'favorites' | 'images' | 'videos'>('all')
  const [showAllContent, setShowAllContent] = useState(false)
  const [lightboxItem, setLightboxItem] = useState<any | null>(null)
  const [publishItem, setPublishItem] = useState<any | null>(null)

  // Load gallery content
  useEffect(() => {
    const loadContent = async () => {
      setLoadingContent(true)
      try {
        const res = await fetch(`/api/studio/influencer/gallery?influencerId=${influencer.id}`)
        const data = await res.json()
        if (data.items) {
          setRecentContent(data.items)
        }
      } catch (err) {
        console.error('Error loading content:', err)
      } finally {
        setLoadingContent(false)
      }
    }
    loadContent()
  }, [influencer.id])

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

  const handleToggleFavorite = async (item: any) => {
    const newVal = !item.is_favorite
    try {
      await fetch('/api/studio/influencer/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_favorite: newVal }),
      })
      setRecentContent(prev => prev.map(g =>
        g.id === item.id ? { ...g, is_favorite: newVal } : g
      ))
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  const handleDownloadItem = async (item: any) => {
    try {
      const url = item.content_type === 'video' ? item.video_url : item.image_url
      if (!url) return
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const ext = item.content_type === 'video' ? 'mp4' : 'jpg'
      a.download = `${influencer.name}_${Date.now()}.${ext}`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // silently fail
    }
  }

  const handleDeleteItem = async (item: any) => {
    if (!item.id) return
    try {
      const res = await fetch(`/api/studio/influencer/gallery?id=${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRecentContent(prev => prev.filter(g => g.id !== item.id))
        setLightboxItem(null)
        toast.success('Eliminado')
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const filteredContent = recentContent.filter(item => {
    if (contentFilter === 'all') return true
    if (contentFilter === 'favorites') return item.is_favorite
    if (contentFilter === 'images') return item.content_type !== 'video'
    if (contentFilter === 'videos') return item.content_type === 'video'
    return true
  })

  const displayContent = showAllContent ? filteredContent : filteredContent.slice(0, 6)

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

      {/* ============ PIZARRA: CONTENIDO DEL INFLUENCER ============ */}
      <div className="mt-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-semibold text-text-primary">
              Pizarra de Contenido
            </h4>
            <span className="text-xs text-text-muted">
              ({recentContent.length})
            </span>
          </div>
          <div className="flex gap-1">
            {(['all', 'favorites', 'images', 'videos'] as const).map(f => (
              <button
                key={f}
                onClick={() => setContentFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
                  contentFilter === f
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {f === 'all' ? 'Todo' : f === 'favorites' ? '⭐' : f === 'images' ? '📷 Fotos' : '🎬 Videos'}
              </button>
            ))}
          </div>
        </div>

        {loadingContent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          </div>
        ) : recentContent.length === 0 ? (
          <div className="text-center py-8 bg-surface-elevated rounded-xl border border-border">
            <ImageIcon className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted">No hay contenido generado aun</p>
            <p className="text-[10px] text-text-muted mt-1">Usa "Crear Contenido" para generar imagenes</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {displayContent.map((item: any) => (
                <div
                  key={item.id}
                  className="group relative rounded-xl overflow-hidden bg-surface-elevated border border-border aspect-[9/16] cursor-pointer"
                  onClick={() => setLightboxItem(item)}
                >
                  {item.content_type === 'video' && item.video_url ? (
                    <div className="relative w-full h-full">
                      <video
                        src={item.video_url}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        playsInline
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                      />
                      {/* Badge de video */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded-md">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ) : (
                    <img
                      src={item.image_url}
                      alt={item.situation || 'Contenido'}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-[9px] text-white/80 line-clamp-2">{item.situation}</p>
                      {item.type === 'with_product' && item.product_name && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-accent/30 text-accent rounded-full mt-1 inline-block">
                          {item.product_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Favorito badge */}
                  {item.is_favorite && (
                    <div className="absolute top-1.5 left-1.5">
                      <Heart className="w-3 h-3 text-amber-400 fill-current" />
                    </div>
                  )}
                  {/* Botones hover */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item) }}
                      className={cn(
                        'p-1 rounded-md transition-colors',
                        item.is_favorite ? 'bg-amber-500/80 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                      )}
                    >
                      <Heart className={cn('w-3 h-3', item.is_favorite && 'fill-current')} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPublishItem(item) }}
                      className="p-1 bg-indigo-500/80 rounded-md text-white hover:bg-indigo-500 transition-colors"
                      title="Publicar en redes"
                    >
                      <Share2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadItem(item) }}
                      className="p-1 bg-black/40 rounded-md text-white hover:bg-black/60 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item) }}
                      className="p-1 bg-red-500/60 rounded-md text-white hover:bg-red-500/80 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* Ver mas / Ver menos */}
            {filteredContent.length > 6 && (
              <button
                onClick={() => setShowAllContent(!showAllContent)}
                className="w-full mt-3 py-2 text-xs text-accent hover:bg-accent/5 rounded-lg transition-colors font-medium"
              >
                {showAllContent ? 'Ver menos' : `Ver todas (${filteredContent.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Ver pizarra completa */}
      <button
        onClick={onViewBoard}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all mb-4"
      >
        <LayoutGrid className="w-4 h-4" />
        Ver Pizarra de Contenido
      </button>

      {/* Acciones principales */}
      <div className="flex gap-3">
        <button
          onClick={onCreateContent}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent-hover text-background rounded-xl font-semibold transition-all shadow-lg shadow-accent/25"
        >
          <ImageIcon className="w-4 h-4" />
          Crear Contenido
        </button>
        <button
          onClick={onCreateVideo}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-elevated hover:bg-border/50 text-text-primary rounded-xl font-semibold transition-all border border-border"
        >
          <Video className="w-4 h-4" />
          Crear Video
        </button>
      </div>

      {/* Lightbox modal */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-lg w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxItem(null)}
              className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="rounded-2xl overflow-hidden bg-surface-elevated">
              {lightboxItem.content_type === 'video' && lightboxItem.video_url ? (
                <video
                  src={lightboxItem.video_url}
                  className="w-full max-h-[70vh] object-contain"
                  controls
                  autoPlay
                  loop
                />
              ) : (
                <img
                  src={lightboxItem.image_url}
                  alt={lightboxItem.situation || ''}
                  className="w-full max-h-[70vh] object-contain"
                />
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {lightboxItem.situation && (
                  <p className="text-sm text-white/80 truncate">{lightboxItem.situation}</p>
                )}
                {lightboxItem.created_at && (
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {new Date(lightboxItem.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-3">
                <button
                  onClick={() => { setPublishItem(lightboxItem); setLightboxItem(null) }}
                  className="p-2 bg-indigo-500/30 rounded-lg text-indigo-400 hover:bg-indigo-500/50 transition-colors"
                  title="Publicar en redes"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleToggleFavorite(lightboxItem)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    lightboxItem.is_favorite ? 'bg-amber-500/80 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                  )}
                >
                  <Heart className={cn('w-4 h-4', lightboxItem.is_favorite && 'fill-current')} />
                </button>
                <button
                  onClick={() => handleDownloadItem(lightboxItem)}
                  className="p-2 bg-white/10 rounded-lg text-white/70 hover:bg-white/20 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteItem(lightboxItem)}
                  className="p-2 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publisher Modal */}
      <PublisherModal
        isOpen={!!publishItem}
        onClose={() => setPublishItem(null)}
        mediaUrl={publishItem?.content_type === 'video' ? publishItem?.video_url : publishItem?.image_url}
        contentType={publishItem?.content_type === 'video' ? 'video' : 'photo'}
        defaultCaption={publishItem?.situation || `${influencer.name} - Contenido generado con IA`}
        previewUrl={publishItem?.content_type === 'video' ? publishItem?.video_url : publishItem?.image_url}
      />
    </div>
  )
}
