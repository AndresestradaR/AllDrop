'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Check, Loader2, Film } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'

interface VideoClipSelectorProps {
  onClipsSelected: (clips: { url: string; label: string }[]) => void
  onBack: () => void
}

interface VideoEntry {
  id: string
  product_name: string
  generated_image_url: string
  enhanced_prompt: string | null
  created_at: string
  signedUrl?: string
}

export function VideoClipSelector({ onClipsSelected, onBack }: VideoClipSelectorProps) {
  const { t } = useI18n()
  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadVideos = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('generations')
        .select('id, product_name, generated_image_url, enhanced_prompt, created_at')
        .eq('user_id', user.id)
        .like('product_name', 'Video:%')
        .order('created_at', { ascending: false })
        .limit(30)

      if (error || !data) {
        setLoading(false)
        return
      }

      // Generate signed URLs for storage: entries
      const entries: VideoEntry[] = await Promise.all(
        data.map(async (entry) => {
          let signedUrl = entry.generated_image_url

          if (entry.generated_image_url?.startsWith('storage:')) {
            const path = entry.generated_image_url.replace('storage:', '')
            const { data: signed } = await supabase.storage
              .from('landing-images')
              .createSignedUrl(path, 86400)
            signedUrl = signed?.signedUrl || ''
          } else if (
            entry.generated_image_url?.includes('supabase') &&
            entry.generated_image_url?.includes('/landing-images/')
          ) {
            const pathMatch = entry.generated_image_url.match(/landing-images\/(.+?)(\?|$)/)
            if (pathMatch) {
              const { data: signed } = await supabase.storage
                .from('landing-images')
                .createSignedUrl(pathMatch[1], 86400)
              signedUrl = signed?.signedUrl || signedUrl
            }
          }

          return { ...entry, signedUrl }
        })
      )

      setVideos(entries.filter((e) => e.signedUrl))
      setLoading(false)
    }

    loadVideos()
  }, [])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 10) return prev
        next.add(id)
      }
      return next
    })
  }

  const handleContinue = () => {
    const clips = videos
      .filter((v) => selected.has(v.id))
      .map((v) => ({
        url: v.signedUrl || v.generated_image_url,
        label: v.product_name.replace('Video: ', ''),
      }))
    onClipsSelected(clips)
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${date.getDate()}/${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t.studio.videoPrompt.selectClips}</h2>
            <p className="text-xs text-text-secondary">{t.studio.videoPrompt.selectClipsDesc}</p>
          </div>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Film className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">{t.studio.videoPrompt.noVideos}</p>
            <p className="text-xs mt-1">{t.studio.videoPrompt.noVideosHint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {videos.map((video) => {
              const isSelected = selected.has(video.id)
              const modelName = video.product_name.replace('Video: ', '')

              return (
                <button
                  key={video.id}
                  onClick={() => toggleSelect(video.id)}
                  className={`relative rounded-xl border overflow-hidden text-left transition-all ${
                    isSelected
                      ? 'border-accent ring-2 ring-accent/30'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  <video
                    src={video.signedUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full aspect-video object-contain bg-black"
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                    onMouseLeave={(e) => {
                      const v = e.target as HTMLVideoElement
                      v.pause()
                      v.currentTime = 0
                    }}
                  />

                  {/* Selection indicator */}
                  <div
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected ? 'bg-accent' : 'bg-black/50 border border-white/30'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-[11px] font-medium text-text-primary truncate">
                      {modelName}
                    </p>
                    <p className="text-[10px] text-text-muted">{formatDate(video.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {selected.size > 0 && (
        <div className="mt-3 flex items-center justify-between bg-surface rounded-xl border border-border px-4 py-3">
          <span className="text-sm text-text-primary font-medium">
            {t.studio.videoPrompt.clipsSelected.replace('{count}', String(selected.size))}
          </span>
          <button
            onClick={handleContinue}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-sm font-bold hover:from-pink-500 hover:to-rose-500 transition-all"
          >
            {t.studio.videoPrompt.continueToEditor}
          </button>
        </div>
      )}
    </div>
  )
}
