'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Heart, Download, Image as ImageIcon, Video, X, Grid3X3, LayoutGrid, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import toast from 'react-hot-toast'

interface InfluencerBoardProps {
  influencer: any
  onBack: () => void
  onCreateContent: () => void
  onCreateVideo: () => void
}

export function InfluencerBoard({
  influencer,
  onBack,
  onCreateContent,
  onCreateVideo,
}: InfluencerBoardProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'favorites'>('all')
  const [gridCols, setGridCols] = useState<3 | 4>(3)
  const [lightboxItem, setLightboxItem] = useState<any | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/studio/influencer/gallery?influencerId=${influencer.id}`)
        const data = await res.json()
        if (data.items) setItems(data.items)
      } catch (err) {
        console.error('Error loading gallery:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [influencer.id])

  const handleToggleFavorite = async (item: any) => {
    const newVal = !item.is_favorite
    try {
      await fetch('/api/studio/influencer/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_favorite: newVal }),
      })
      setItems(prev => prev.map(g =>
        g.id === item.id ? { ...g, is_favorite: newVal } : g
      ))
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  const handleDownload = async (item: any) => {
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
      toast.success('Descargado')
    } catch {
      toast.error('Error al descargar')
    }
  }

  const handleDelete = async (item: any) => {
    try {
      const res = await fetch(`/api/studio/influencer/gallery?id=${item.id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(prev => prev.filter(g => g.id !== item.id))
        setLightboxItem(null)
        toast.success('Eliminado')
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const filtered = items.filter(item => {
    if (filter === 'all') return true
    if (filter === 'favorites') return item.is_favorite
    if (filter === 'images') return item.content_type !== 'video'
    if (filter === 'videos') return item.content_type === 'video'
    return true
  })

  const imageCount = items.filter(i => i.content_type !== 'video').length
  const videoCount = items.filter(i => i.content_type === 'video').length

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-border/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Pizarra de {influencer.name}
              </h2>
              <p className="text-sm text-text-secondary">
                {imageCount} fotos, {videoCount} videos
              </p>
            </div>
          </div>

          {/* Grid size toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGridCols(3)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                gridCols === 3 ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setGridCols(4)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                gridCols === 4 ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
          {([
            { key: 'all', label: 'Todo' },
            { key: 'images', label: 'Fotos' },
            { key: 'videos', label: 'Videos' },
            { key: 'favorites', label: 'Favoritos' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter === f.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated'
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={onCreateContent}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg text-xs font-medium transition-all"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Crear Foto
          </button>
          <button
            onClick={onCreateVideo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-all border border-border"
          >
            <Video className="w-3.5 h-3.5" />
            Crear Video
          </button>
        </div>

        {/* Content grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">
                {filter === 'all' ? 'No hay contenido generado aun' : `No hay ${filter === 'images' ? 'fotos' : filter === 'videos' ? 'videos' : 'favoritos'}`}
              </p>
              <p className="text-xs text-text-muted mt-1">Usa los botones de arriba para crear contenido</p>
            </div>
          ) : (
            <div className={cn(
              'grid gap-3',
              gridCols === 3 ? 'grid-cols-3' : 'grid-cols-4'
            )}>
              {filtered.map((item: any) => (
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

                  {/* Favorite badge */}
                  {item.is_favorite && (
                    <div className="absolute top-1.5 left-1.5">
                      <Heart className="w-3 h-3 text-amber-400 fill-current" />
                    </div>
                  )}

                  {/* Hover buttons */}
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
                      onClick={(e) => { e.stopPropagation(); handleDownload(item) }}
                      className="p-1 bg-black/40 rounded-md text-white hover:bg-black/60 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
            {/* Close */}
            <button
              onClick={() => setLightboxItem(null)}
              className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
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

            {/* Info + actions */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {lightboxItem.situation && (
                  <p className="text-sm text-white/80 truncate">{lightboxItem.situation}</p>
                )}
                <p className="text-[10px] text-white/40 mt-0.5">
                  {new Date(lightboxItem.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2 ml-3">
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
                  onClick={() => handleDownload(lightboxItem)}
                  className="p-2 bg-white/10 rounded-lg text-white/70 hover:bg-white/20 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(lightboxItem)}
                  className="p-2 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
