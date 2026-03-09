'use client'

import { useState } from 'react'
import { Play, Trash2, User, X } from 'lucide-react'
import { getYouTubeThumbnail, getYouTubeEmbedUrl } from '@/lib/utils/youtube'

interface CommunityVideoCardProps {
  id: string
  title: string
  description?: string | null
  youtube_video_id: string
  user_name?: string | null
  created_at: string
  canDelete?: boolean
  onDelete?: (id: string) => void
}

export function CommunityVideoCard({
  id,
  title,
  description,
  youtube_video_id,
  user_name,
  created_at,
  canDelete,
  onDelete,
}: CommunityVideoCardProps) {
  const [showPlayer, setShowPlayer] = useState(false)

  const timeAgo = getTimeAgo(created_at)

  return (
    <>
      <div className="group rounded-xl border border-border bg-surface overflow-hidden transition-all duration-200 hover:border-accent/50 hover:shadow-lg">
        <div
          className="relative aspect-video bg-background overflow-hidden cursor-pointer"
          onClick={() => setShowPlayer(true)}
        >
          <img
            src={getYouTubeThumbnail(youtube_video_id)}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-background ml-0.5" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3
            className="font-semibold text-text-primary line-clamp-2 mb-1 cursor-pointer hover:text-accent transition-colors"
            onClick={() => setShowPlayer(true)}
          >
            {title}
          </h3>
          {description && (
            <p className="text-xs text-text-secondary line-clamp-2 mb-2">{description}</p>
          )}
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {user_name || 'Anonimo'}
            </span>
            <span>{timeAgo}</span>
          </div>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(id)
              }}
              className="mt-2 flex items-center gap-1 text-xs text-text-secondary hover:text-error transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      {showPlayer && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPlayer(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPlayer(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="rounded-xl overflow-hidden border border-border bg-surface">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`${getYouTubeEmbedUrl(youtube_video_id)}?autoplay=1`}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
            <p className="mt-3 text-white font-medium">{title}</p>
          </div>
        </div>
      )}
    </>
  )
}

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'ahora'
  if (diffMins < 60) return `hace ${diffMins}m`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
