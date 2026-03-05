'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, X, Upload, Music, Download, Copy, Loader2, ChevronUp, ChevronDown, Play, Pause, Film } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface VideoEditorProps {
  initialClips: { url: string; label: string }[]
  onBack: () => void
  onExported?: (videoUrl: string) => void
}

interface ClipState {
  url: string
  label: string
  startTime: number
  endTime: number
  duration: number
}

export function VideoEditor({ initialClips, onBack, onExported }: VideoEditorProps) {
  const [clips, setClips] = useState<ClipState[]>([])
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [voiceVolume, setVoiceVolume] = useState(100)
  const [musicVolume, setMusicVolume] = useState(50)
  const [showMusic, setShowMusic] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load clip durations
  useEffect(() => {
    const loadDurations = async () => {
      const loaded: ClipState[] = await Promise.all(
        initialClips.map(
          (clip) =>
            new Promise<ClipState>((resolve) => {
              const video = document.createElement('video')
              video.preload = 'metadata'
              video.onloadedmetadata = () => {
                resolve({
                  url: clip.url,
                  label: clip.label,
                  startTime: 0,
                  endTime: video.duration,
                  duration: video.duration,
                })
              }
              video.onerror = () => {
                resolve({
                  url: clip.url,
                  label: clip.label,
                  startTime: 0,
                  endTime: 10,
                  duration: 10,
                })
              }
              video.src = clip.url
            })
        )
      )
      setClips(loaded)
    }
    loadDurations()
  }, [initialClips])

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const updateClip = (index: number, update: Partial<ClipState>) => {
    setClips((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)))
  }

  const removeClip = (index: number) => {
    setClips((prev) => prev.filter((_, i) => i !== index))
  }

  const moveClip = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= clips.length) return
    setClips((prev) => {
      const next = [...prev]
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
  }

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setMusicFile(file)
      setMusicUrl(null)
    }
  }

  const toggleAudioPreview = () => {
    if (audioRef.current) {
      if (isPlayingAudio) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlayingAudio(!isPlayingAudio)
    }
  }

  const totalDuration = clips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)

  const handleExport = useCallback(async () => {
    if (clips.length === 0) return

    setIsExporting(true)
    setExportProgress('Preparando...')
    setExportedVideoUrl(null)

    try {
      // Upload music to Supabase Storage if provided
      let uploadedMusicUrl = musicUrl
      if (musicFile && !musicUrl) {
        setExportProgress('Subiendo musica...')
        const supabase = createClient()
        const musicPath = `temp/music-${Date.now()}.mp3`
        const { error: uploadErr } = await supabase.storage
          .from('landing-images')
          .upload(musicPath, musicFile, { contentType: musicFile.type })

        if (uploadErr) throw new Error('Error al subir musica: ' + uploadErr.message)

        const { data: signedData } = await supabase.storage
          .from('landing-images')
          .createSignedUrl(musicPath, 3600) // 1h

        uploadedMusicUrl = signedData?.signedUrl || null
      }

      // Send to API
      setExportProgress('Enviando a procesar...')
      const resp = await fetch('/api/studio/video-editor/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clips: clips.map((c) => ({
            url: c.url,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
          musicUrl: uploadedMusicUrl,
          voiceVolume: voiceVolume / 100,
          musicVolume: musicVolume / 100,
        }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al procesar')

      const jobId = data.jobId
      setExportProgress('Procesando video...')

      // Poll for completion
      await new Promise<void>((resolve, reject) => {
        let attempts = 0
        const maxAttempts = 120 // 6 minutes @ 3s

        pollingRef.current = setInterval(async () => {
          attempts++
          if (attempts > maxAttempts) {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            reject(new Error('Timeout: el procesamiento tardo demasiado'))
            return
          }

          try {
            const statusResp = await fetch(`/api/studio/video-editor/status?jobId=${jobId}`)
            const statusData = await statusResp.json()

            if (statusData.status === 'completed' && statusData.videoUrl) {
              clearInterval(pollingRef.current!)
              pollingRef.current = null
              setExportedVideoUrl(statusData.videoUrl)
              onExported?.(statusData.videoUrl)
              resolve()
            } else if (statusData.status === 'failed') {
              clearInterval(pollingRef.current!)
              pollingRef.current = null
              reject(new Error(statusData.error || 'Error al procesar video'))
            } else {
              setExportProgress(`Procesando... ${statusData.progress || ''}`)
            }
          } catch {
            // Network error, keep polling
          }
        }, 3000)
      })

      toast.success('Video exportado!')
    } catch (err: any) {
      toast.error(err.message || 'Error al exportar')
    } finally {
      setIsExporting(false)
      setExportProgress('')
    }
  }, [clips, musicFile, musicUrl, voiceVolume, musicVolume, onExported])

  const handleDownload = async () => {
    if (!exportedVideoUrl) return
    try {
      const resp = await fetch(exportedVideoUrl)
      const blob = await resp.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `video-editado-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(exportedVideoUrl, '_blank')
    }
  }

  const handleCopyUrl = async () => {
    if (!exportedVideoUrl) return
    try {
      await navigator.clipboard.writeText(exportedVideoUrl)
      toast.success('URL copiada')
    } catch {
      toast.error('Error al copiar')
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (clips.length === 0 && initialClips.length > 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Editor de Video</h2>
            <p className="text-xs text-text-secondary">
              {clips.length} clips · {formatTime(totalDuration)} total
            </p>
          </div>
        </div>
      </div>

      {/* Exported video result */}
      {exportedVideoUrl && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-green-400 mb-3">Video Exportado</h3>
          <video
            src={exportedVideoUrl}
            controls
            className="w-full rounded-xl aspect-video object-contain bg-black mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar
            </button>
            <button
              onClick={handleCopyUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border hover:border-accent/50 text-text-primary rounded-xl text-sm font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copiar URL
            </button>
          </div>
        </div>
      )}

      {/* Clips list */}
      <div className="space-y-3">
        {clips.map((clip, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl border border-border p-4 flex gap-4"
          >
            {/* Mini player */}
            <div className="w-40 flex-shrink-0">
              <video
                src={clip.url}
                controls
                muted
                playsInline
                className="w-full rounded-lg aspect-video object-contain bg-black"
              />
            </div>

            {/* Controls */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary truncate">{clip.label}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveClip(i, -1)}
                    disabled={i === 0}
                    className="p-1 hover:bg-border/50 rounded disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={() => moveClip(i, 1)}
                    disabled={i === clips.length - 1}
                    className="p-1 hover:bg-border/50 rounded disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={() => removeClip(i)}
                    className="p-1 hover:bg-error/20 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-error" />
                  </button>
                </div>
              </div>

              {/* Trim sliders */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-text-muted w-10">Inicio</label>
                  <input
                    type="range"
                    min={0}
                    max={clip.duration}
                    step={0.1}
                    value={clip.startTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (val < clip.endTime) updateClip(i, { startTime: val })
                    }}
                    className="flex-1 h-1.5 accent-accent"
                  />
                  <span className="text-[10px] text-text-muted w-10 text-right">
                    {formatTime(clip.startTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-text-muted w-10">Fin</label>
                  <input
                    type="range"
                    min={0}
                    max={clip.duration}
                    step={0.1}
                    value={clip.endTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (val > clip.startTime) updateClip(i, { endTime: val })
                    }}
                    className="flex-1 h-1.5 accent-accent"
                  />
                  <span className="text-[10px] text-text-muted w-10 text-right">
                    {formatTime(clip.endTime)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-text-muted">
                De {formatTime(clip.startTime)} a {formatTime(clip.endTime)} (
                {formatTime(clip.endTime - clip.startTime)})
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Music section */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowMusic(!showMusic)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-medium text-text-primary">Musica de Fondo</span>
            {musicFile && (
              <span className="text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded">
                {musicFile.name}
              </span>
            )}
          </div>
          {showMusic ? (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          )}
        </button>

        {showMusic && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {/* Audio upload */}
            {musicFile ? (
              <div className="flex items-center gap-3 bg-surface-elevated rounded-lg p-3">
                <button
                  onClick={toggleAudioPreview}
                  className="w-9 h-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors flex-shrink-0"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {musicFile.name}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {(musicFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMusicFile(null)
                    setMusicUrl(null)
                    setIsPlayingAudio(false)
                  }}
                  className="p-1.5 hover:bg-error/20 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-error" />
                </button>
                <audio
                  ref={audioRef}
                  src={URL.createObjectURL(musicFile)}
                  onEnded={() => setIsPlayingAudio(false)}
                  className="hidden"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/*"
                  className="hidden"
                  onChange={handleMusicUpload}
                />
                <Upload className="w-6 h-6 text-text-secondary mb-1" />
                <p className="text-xs text-text-primary font-medium">Subir audio</p>
                <p className="text-[10px] text-text-muted">MP3, WAV, M4A</p>
              </label>
            )}

            {/* Volume sliders */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Volumen Voz ({voiceVolume}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseInt(e.target.value))}
                  className="w-full h-1.5 accent-accent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Volumen Musica ({musicVolume}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                  className="w-full h-1.5 accent-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={clips.length === 0 || isExporting}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
          clips.length === 0 || isExporting
            ? 'bg-border text-text-secondary cursor-not-allowed'
            : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-500/25'
        }`}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {exportProgress}
          </>
        ) : (
          <>
            <Film className="w-4 h-4" />
            Exportar Video ({clips.length} clips · {formatTime(totalDuration)})
          </>
        )}
      </button>
    </div>
  )
}
