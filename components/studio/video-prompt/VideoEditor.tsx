'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ArrowLeft, X, Upload, Music, Download, Copy, Loader2, Play, Pause, Film, Trash2, ChevronLeft, ChevronRight, Scissors, Volume2 } from 'lucide-react'
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
  // Clip state
  const [clips, setClips] = useState<ClipState[]>([])

  // Player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [globalTime, setGlobalTime] = useState(0)
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null)

  // Trim drag state
  const [isDraggingTrim, setIsDraggingTrim] = useState<'start' | 'end' | null>(null)
  const [showTrimPanel, setShowTrimPanel] = useState(false)

  // Audio state
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [voiceVolume, setVoiceVolume] = useState(100)
  const [musicVolume, setMusicVolume] = useState(50)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null)
  const [showExportOverlay, setShowExportOverlay] = useState(false)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number | null>(null)
  const isTransitioningRef = useRef(false)
  const musicObjectUrlRef = useRef<string | null>(null)

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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
    }
  }, [])

  // Compute clip time map
  const clipTimeMap = useMemo(() => {
    let offset = 0
    return clips.map((c) => {
      const dur = c.endTime - c.startTime
      const entry = { globalStart: offset, globalEnd: offset + dur, clip: c }
      offset += dur
      return entry
    })
  }, [clips])

  const totalDuration = useMemo(() => {
    return clips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)
  }, [clips])

  // Music object URL management
  useEffect(() => {
    if (musicObjectUrlRef.current) {
      URL.revokeObjectURL(musicObjectUrlRef.current)
      musicObjectUrlRef.current = null
    }
    if (musicFile) {
      musicObjectUrlRef.current = URL.createObjectURL(musicFile)
    }
  }, [musicFile])

  // Playback: load the active clip into the video element
  const loadClip = useCallback((index: number, seekTo?: number) => {
    if (!videoRef.current || index < 0 || index >= clips.length) return
    const clip = clips[index]
    const video = videoRef.current

    if (video.src !== clip.url) {
      video.src = clip.url
    }
    video.currentTime = seekTo ?? clip.startTime
  }, [clips])

  // Handle time updates during playback
  const onVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current || isTransitioningRef.current) return
    const video = videoRef.current
    const clip = clips[activeClipIndex]
    if (!clip) return

    const map = clipTimeMap[activeClipIndex]
    if (!map) return

    const currentGlobal = map.globalStart + (video.currentTime - clip.startTime)
    setGlobalTime(currentGlobal)

    // Check if we've reached the end of this clip
    if (video.currentTime >= clip.endTime - 0.05) {
      const nextIndex = activeClipIndex + 1
      if (nextIndex < clips.length) {
        // Transition to next clip
        isTransitioningRef.current = true
        video.pause()
        setActiveClipIndex(nextIndex)
        const nextClip = clips[nextIndex]
        video.src = nextClip.url
        video.currentTime = nextClip.startTime
        video.play().then(() => {
          isTransitioningRef.current = false
        }).catch(() => {
          isTransitioningRef.current = false
        })
      } else {
        // End of all clips
        video.pause()
        setIsPlaying(false)
        setGlobalTime(totalDuration)
      }
    }
  }, [activeClipIndex, clips, clipTimeMap, totalDuration])

  // Play/Pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current || clips.length === 0) return
    const video = videoRef.current

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      // If at the end, restart from beginning
      if (globalTime >= totalDuration - 0.1) {
        setActiveClipIndex(0)
        setGlobalTime(0)
        loadClip(0, clips[0].startTime)
        setTimeout(() => {
          videoRef.current?.play()
          setIsPlaying(true)
        }, 100)
      } else {
        video.play().then(() => setIsPlaying(true)).catch(() => {})
      }
    }
  }, [isPlaying, clips, globalTime, totalDuration, loadClip])

  // Seek to global position
  const seekToGlobal = useCallback((targetTime: number) => {
    if (clips.length === 0) return
    const clamped = Math.max(0, Math.min(targetTime, totalDuration))

    for (let i = 0; i < clipTimeMap.length; i++) {
      const map = clipTimeMap[i]
      if (clamped >= map.globalStart && clamped < map.globalEnd) {
        const localTime = clips[i].startTime + (clamped - map.globalStart)
        setActiveClipIndex(i)
        setGlobalTime(clamped)
        loadClip(i, localTime)
        return
      }
    }
    // If at the very end, show last frame
    const lastIdx = clips.length - 1
    setActiveClipIndex(lastIdx)
    setGlobalTime(totalDuration)
    loadClip(lastIdx, clips[lastIdx].endTime)
  }, [clips, clipTimeMap, totalDuration, loadClip])

  // Load first clip when clips are loaded
  useEffect(() => {
    if (clips.length > 0 && videoRef.current && !videoRef.current.src) {
      loadClip(0, clips[0].startTime)
    }
  }, [clips, loadClip])

  // Clip operations
  const updateClip = (index: number, update: Partial<ClipState>) => {
    setClips((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)))
  }

  const removeClip = (index: number) => {
    if (clips.length <= 1) return
    setClips((prev) => prev.filter((_, i) => i !== index))
    if (selectedClipIndex === index) setSelectedClipIndex(null)
    if (activeClipIndex >= index && activeClipIndex > 0) {
      setActiveClipIndex((prev) => prev - 1)
    }
  }

  const moveClip = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= clips.length) return
    setClips((prev) => {
      const next = [...prev]
      ;[next[index], next[newIndex]] = [next[newIndex], next[index]]
      return next
    })
    setSelectedClipIndex(newIndex)
  }

  // Music
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

  // Timeline click → seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isDraggingTrim) return
    const rect = timelineRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const targetTime = percent * totalDuration
    seekToGlobal(targetTime)
  }

  // Trim drag handlers
  const handleTrimMouseDown = (clipIndex: number, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDraggingTrim(edge)
    setSelectedClipIndex(clipIndex)

    const timelineEl = timelineRef.current
    if (!timelineEl) return

    const clip = clips[clipIndex]
    const timelineRect = timelineEl.getBoundingClientRect()
    const timelineWidth = timelineRect.width

    const onMove = (me: MouseEvent) => {
      const mouseX = me.clientX - timelineRect.left
      const timeAtMouse = (mouseX / timelineWidth) * totalDuration

      // Convert global time to local time within this clip's full duration
      const map = clipTimeMap[clipIndex]
      if (!map) return

      if (edge === 'start') {
        // Calculate new start time
        const globalOffset = timeAtMouse - map.globalStart
        const newStart = Math.max(0, Math.min(clip.startTime + globalOffset, clip.endTime - 1))
        const clampedStart = Math.max(0, Math.min(newStart, clip.duration))
        if (clampedStart < clip.endTime - 0.5) {
          updateClip(clipIndex, { startTime: Math.round(clampedStart * 10) / 10 })
        }
      } else {
        const globalOffset = timeAtMouse - map.globalStart
        const newEnd = clip.startTime + globalOffset
        const clampedEnd = Math.max(clip.startTime + 1, Math.min(newEnd, clip.duration))
        if (clampedEnd > clip.startTime + 0.5) {
          updateClip(clipIndex, { endTime: Math.round(clampedEnd * 10) / 10 })
        }
      }
    }

    const onUp = () => {
      setIsDraggingTrim(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seekToGlobal(percent * totalDuration)
  }

  // Export logic (preserved from original)
  const handleExport = useCallback(async () => {
    if (clips.length === 0) return

    setIsExporting(true)
    setExportProgress('Preparando...')
    setExportedVideoUrl(null)

    try {
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
          .createSignedUrl(musicPath, 3600)

        uploadedMusicUrl = signedData?.signedUrl || null
      }

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

      await new Promise<void>((resolve, reject) => {
        let attempts = 0
        const maxAttempts = 120

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
              setShowExportOverlay(true)
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

  const playheadPercent = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0

  // Loading state
  if (clips.length === 0 && initialClips.length > 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-6xl mx-auto bg-[#0d0d0d] rounded-2xl overflow-hidden border border-[#2a2a2a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a2a] bg-[#141414] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500">
              <Film className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Editor de Video</h2>
              <p className="text-[10px] text-gray-500">
                {clips.length} clips · {formatTime(totalDuration)}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={clips.length === 0 || isExporting}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isExporting
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-500/20'
          }`}
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {exportProgress}
            </>
          ) : (
            <>
              <Film className="w-3.5 h-3.5" />
              Exportar
            </>
          )}
        </button>
      </div>

      {/* Main: Preview + Audio Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Preview Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-black relative">
          {/* Video element */}
          <div className="relative w-full flex-1 flex items-center justify-center p-4">
            <video
              ref={videoRef}
              className="max-h-full max-w-full rounded-lg object-contain"
              playsInline
              muted={false}
              onTimeUpdate={onVideoTimeUpdate}
              onEnded={() => {
                if (activeClipIndex < clips.length - 1) {
                  // handled in onTimeUpdate
                } else {
                  setIsPlaying(false)
                }
              }}
              onClick={togglePlay}
            />

            {/* Play/Pause overlay */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors backdrop-blur-sm">
                  <Play className="w-7 h-7 text-white ml-1" />
                </div>
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full px-4 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-10 text-right font-mono">
                {formatTime(globalTime)}
              </span>
              <div
                className="flex-1 h-1.5 bg-gray-800 rounded-full cursor-pointer relative group"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full relative"
                  style={{ width: `${playheadPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <span className="text-[10px] text-gray-500 w-10 font-mono">
                {formatTime(totalDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Panel */}
        <div className="w-60 border-l border-[#2a2a2a] bg-[#141414] flex flex-col flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-white">Audio</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Music upload / preview */}
            {musicFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-2.5">
                  <button
                    onClick={toggleAudioPreview}
                    className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 transition-colors flex-shrink-0"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-3 h-3 text-white" />
                    ) : (
                      <Play className="w-3 h-3 text-white ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white truncate">
                      {musicFile.name}
                    </p>
                    <p className="text-[9px] text-gray-500">
                      {(musicFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setMusicFile(null)
                      setMusicUrl(null)
                      setIsPlayingAudio(false)
                    }}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
                {musicObjectUrlRef.current && (
                  <audio
                    ref={audioRef}
                    src={musicObjectUrlRef.current}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="hidden"
                  />
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-20 border border-dashed border-[#333] hover:border-emerald-500/50 rounded-lg cursor-pointer transition-colors bg-[#1a1a1a]/50">
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/*"
                  className="hidden"
                  onChange={handleMusicUpload}
                />
                <Upload className="w-5 h-5 text-gray-500 mb-1" />
                <p className="text-[10px] text-gray-400 font-medium">Subir musica</p>
                <p className="text-[9px] text-gray-600">MP3, WAV, M4A</p>
              </label>
            )}

            {/* Volume sliders */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    Voz
                  </label>
                  <span className="text-[10px] text-gray-500 font-mono">{voiceVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseInt(e.target.value))}
                  className="w-full h-1 accent-teal-500 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    Musica
                  </label>
                  <span className="text-[10px] text-gray-500 font-mono">{musicVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                  className="w-full h-1 accent-emerald-500 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t border-[#2a2a2a] bg-[#141414] flex-shrink-0">
        {/* Video Track */}
        <div
          ref={timelineRef}
          className="relative h-16 mx-2 mt-2 cursor-pointer select-none"
          onClick={handleTimelineClick}
        >
          {/* Clip blocks */}
          <div className="flex h-full gap-[2px]">
            {clips.map((clip, i) => {
              const clipDur = clip.endTime - clip.startTime
              const widthPercent = totalDuration > 0 ? (clipDur / totalDuration) * 100 : 0
              const isSelected = selectedClipIndex === i
              const isActive = activeClipIndex === i

              return (
                <div
                  key={i}
                  className={`relative h-full rounded-md flex items-center justify-center overflow-hidden transition-all cursor-pointer group ${
                    isSelected
                      ? 'ring-2 ring-pink-500 bg-teal-600/40'
                      : isActive
                        ? 'bg-teal-600/30'
                        : 'bg-teal-700/20 hover:bg-teal-600/25'
                  }`}
                  style={{ width: `${widthPercent}%`, minWidth: 40 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedClipIndex(i)
                    seekToGlobal(clipTimeMap[i]?.globalStart ?? 0)
                  }}
                >
                  {/* Left trim handle */}
                  {isSelected && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 bg-pink-500 cursor-col-resize z-10 rounded-l-md hover:bg-pink-400 transition-colors"
                      onMouseDown={(e) => handleTrimMouseDown(i, 'start', e)}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
                    </div>
                  )}

                  {/* Clip content */}
                  <div className="flex flex-col items-center gap-0.5 px-2">
                    <span className="text-[10px] font-semibold text-teal-200 whitespace-nowrap">
                      {clip.label.length > 12 ? clip.label.slice(0, 12) + '...' : clip.label}
                    </span>
                    <span className="text-[9px] text-teal-300/60 font-mono">
                      {formatTime(clipDur)}
                    </span>
                  </div>

                  {/* Right trim handle */}
                  {isSelected && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 bg-pink-500 cursor-col-resize z-10 rounded-r-md hover:bg-pink-400 transition-colors"
                      onMouseDown={(e) => handleTrimMouseDown(i, 'end', e)}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)] pointer-events-none z-20"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg" />
          </div>
        </div>

        {/* Audio Track */}
        <div className="h-8 mx-2 mt-1">
          {musicFile ? (
            <div className="h-full bg-emerald-700/25 rounded-md flex items-center px-3 gap-2 border border-emerald-600/20">
              <Music className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-[10px] text-emerald-300/80 truncate">{musicFile.name}</span>
            </div>
          ) : (
            <div className="h-full rounded-md border border-dashed border-[#2a2a2a] flex items-center justify-center">
              <span className="text-[9px] text-gray-600">Sin musica de fondo</span>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="h-10 flex items-center gap-1 px-3 border-t border-[#2a2a2a] mt-1.5">
          {selectedClipIndex !== null && clips[selectedClipIndex] ? (
            <>
              <span className="text-[10px] text-gray-400 mr-2">
                {clips[selectedClipIndex].label}
                <span className="text-gray-600 ml-1">
                  ({formatTime(clips[selectedClipIndex].startTime)} - {formatTime(clips[selectedClipIndex].endTime)})
                </span>
              </span>

              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => moveClip(selectedClipIndex, -1)}
                  disabled={selectedClipIndex === 0}
                  className="p-1.5 hover:bg-white/10 rounded disabled:opacity-20 transition-colors"
                  title="Mover izquierda"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <button
                  onClick={() => moveClip(selectedClipIndex, 1)}
                  disabled={selectedClipIndex === clips.length - 1}
                  className="p-1.5 hover:bg-white/10 rounded disabled:opacity-20 transition-colors"
                  title="Mover derecha"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </button>

                <div className="w-px h-4 bg-[#2a2a2a] mx-1" />

                <button
                  onClick={() => setShowTrimPanel(!showTrimPanel)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    showTrimPanel
                      ? 'bg-teal-500/20 text-teal-300'
                      : 'hover:bg-white/10 text-gray-400'
                  }`}
                >
                  <Scissors className="w-3 h-3" />
                  Trim
                </button>

                <button
                  onClick={() => removeClip(selectedClipIndex)}
                  disabled={clips.length <= 1}
                  className="p-1.5 hover:bg-red-500/20 rounded disabled:opacity-20 transition-colors"
                  title="Eliminar clip"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </>
          ) : (
            <span className="text-[10px] text-gray-600">
              Selecciona un clip en el timeline
            </span>
          )}
        </div>

        {/* Trim panel (expanded) */}
        {showTrimPanel && selectedClipIndex !== null && clips[selectedClipIndex] && (
          <div className="px-3 pb-2 border-t border-[#1f1f1f] pt-2 space-y-1.5">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-10">Inicio</label>
              <input
                type="range"
                min={0}
                max={clips[selectedClipIndex].duration}
                step={0.1}
                value={clips[selectedClipIndex].startTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (val < clips[selectedClipIndex!].endTime - 0.5) {
                    updateClip(selectedClipIndex!, { startTime: val })
                  }
                }}
                className="flex-1 h-1 accent-teal-500"
              />
              <span className="text-[10px] text-gray-500 w-10 text-right font-mono">
                {formatTime(clips[selectedClipIndex].startTime)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-10">Fin</label>
              <input
                type="range"
                min={0}
                max={clips[selectedClipIndex].duration}
                step={0.1}
                value={clips[selectedClipIndex].endTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (val > clips[selectedClipIndex!].startTime + 0.5) {
                    updateClip(selectedClipIndex!, { endTime: val })
                  }
                }}
                className="flex-1 h-1 accent-teal-500"
              />
              <span className="text-[10px] text-gray-500 w-10 text-right font-mono">
                {formatTime(clips[selectedClipIndex].endTime)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Export result overlay */}
      {showExportOverlay && exportedVideoUrl && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-green-400">Video Exportado</h3>
              <button
                onClick={() => setShowExportOverlay(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <video
              src={exportedVideoUrl}
              controls
              className="w-full rounded-xl aspect-video object-contain bg-black mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
              <button
                onClick={handleCopyUrl}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#222] border border-[#333] hover:border-gray-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copiar URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
