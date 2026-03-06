'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ArrowLeft, X, Upload, Music, Download, Copy, Loader2, Play, Pause, Film, Trash2, ChevronLeft, ChevronRight, Scissors, Volume2, ZoomIn, ZoomOut, SplitSquareHorizontal } from 'lucide-react'
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [globalTime, setGlobalTime] = useState(0)
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null)
  const [isDraggingTrim, setIsDraggingTrim] = useState<'start' | 'end' | null>(null)
  const [showTrimPanel, setShowTrimPanel] = useState(false)
  const [timelineZoom, setTimelineZoom] = useState(1) // 1 = fit all, >1 = zoomed
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [voiceVolume, setVoiceVolume] = useState(100)
  const [musicVolume, setMusicVolume] = useState(50)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null)
  const [showExportOverlay, setShowExportOverlay] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
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
                resolve({ url: clip.url, label: clip.label, startTime: 0, endTime: video.duration, duration: video.duration })
              }
              video.onerror = () => {
                resolve({ url: clip.url, label: clip.label, startTime: 0, endTime: 10, duration: 10 })
              }
              video.src = clip.url
            })
        )
      )
      setClips(loaded)
    }
    loadDurations()
  }, [initialClips])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (musicObjectUrlRef.current) URL.revokeObjectURL(musicObjectUrlRef.current)
    }
  }, [])

  const clipTimeMap = useMemo(() => {
    let offset = 0
    return clips.map((c) => {
      const dur = c.endTime - c.startTime
      const entry = { globalStart: offset, globalEnd: offset + dur, clip: c }
      offset += dur
      return entry
    })
  }, [clips])

  const totalDuration = useMemo(() => clips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0), [clips])

  useEffect(() => {
    if (musicObjectUrlRef.current) { URL.revokeObjectURL(musicObjectUrlRef.current); musicObjectUrlRef.current = null }
    if (musicFile) musicObjectUrlRef.current = URL.createObjectURL(musicFile)
  }, [musicFile])

  const loadClip = useCallback((index: number, seekTo?: number) => {
    if (!videoRef.current || index < 0 || index >= clips.length) return
    const clip = clips[index]
    const video = videoRef.current
    if (video.src !== clip.url) video.src = clip.url
    video.currentTime = seekTo ?? clip.startTime
  }, [clips])

  const onVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current || isTransitioningRef.current) return
    const video = videoRef.current
    const clip = clips[activeClipIndex]
    if (!clip) return
    const map = clipTimeMap[activeClipIndex]
    if (!map) return
    const currentGlobal = map.globalStart + (video.currentTime - clip.startTime)
    setGlobalTime(currentGlobal)
    if (video.currentTime >= clip.endTime - 0.05) {
      const nextIndex = activeClipIndex + 1
      if (nextIndex < clips.length) {
        isTransitioningRef.current = true
        video.pause()
        setActiveClipIndex(nextIndex)
        const nextClip = clips[nextIndex]
        video.src = nextClip.url
        video.currentTime = nextClip.startTime
        video.play().then(() => { isTransitioningRef.current = false }).catch(() => { isTransitioningRef.current = false })
      } else {
        video.pause()
        setIsPlaying(false)
        setGlobalTime(totalDuration)
      }
    }
  }, [activeClipIndex, clips, clipTimeMap, totalDuration])

  const togglePlay = useCallback(() => {
    if (!videoRef.current || clips.length === 0) return
    const video = videoRef.current
    if (isPlaying) { video.pause(); setIsPlaying(false) }
    else {
      if (globalTime >= totalDuration - 0.1) {
        setActiveClipIndex(0); setGlobalTime(0); loadClip(0, clips[0].startTime)
        setTimeout(() => { videoRef.current?.play(); setIsPlaying(true) }, 100)
      } else {
        video.play().then(() => setIsPlaying(true)).catch(() => {})
      }
    }
  }, [isPlaying, clips, globalTime, totalDuration, loadClip])

  const seekToGlobal = useCallback((targetTime: number) => {
    if (clips.length === 0) return
    const clamped = Math.max(0, Math.min(targetTime, totalDuration))
    for (let i = 0; i < clipTimeMap.length; i++) {
      const map = clipTimeMap[i]
      if (clamped >= map.globalStart && clamped < map.globalEnd) {
        const localTime = clips[i].startTime + (clamped - map.globalStart)
        setActiveClipIndex(i); setGlobalTime(clamped); loadClip(i, localTime); return
      }
    }
    const lastIdx = clips.length - 1
    setActiveClipIndex(lastIdx); setGlobalTime(totalDuration); loadClip(lastIdx, clips[lastIdx].endTime)
  }, [clips, clipTimeMap, totalDuration, loadClip])

  useEffect(() => {
    if (clips.length > 0 && videoRef.current && !videoRef.current.src) loadClip(0, clips[0].startTime)
  }, [clips, loadClip])

  const updateClip = (index: number, update: Partial<ClipState>) => {
    setClips((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)))
  }

  const removeClip = (index: number) => {
    if (clips.length <= 1) return
    setClips((prev) => prev.filter((_, i) => i !== index))
    if (selectedClipIndex === index) setSelectedClipIndex(null)
    if (activeClipIndex >= index && activeClipIndex > 0) setActiveClipIndex((prev) => prev - 1)
  }

  const moveClip = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= clips.length) return
    setClips((prev) => { const next = [...prev]; [next[index], next[newIndex]] = [next[newIndex], next[index]]; return next })
    setSelectedClipIndex(newIndex)
  }

  // Split clip at playhead position
  const splitAtPlayhead = useCallback(() => {
    if (clips.length === 0) return
    // Find which clip the playhead is in
    for (let i = 0; i < clipTimeMap.length; i++) {
      const map = clipTimeMap[i]
      if (globalTime > map.globalStart + 0.5 && globalTime < map.globalEnd - 0.5) {
        const clip = clips[i]
        const localSplitTime = clip.startTime + (globalTime - map.globalStart)
        // Create two clips from one
        const clipA: ClipState = { ...clip, endTime: Math.round(localSplitTime * 10) / 10 }
        const clipB: ClipState = { ...clip, startTime: Math.round(localSplitTime * 10) / 10, label: clip.label + ' (B)' }
        setClips(prev => [...prev.slice(0, i), clipA, clipB, ...prev.slice(i + 1)])
        setSelectedClipIndex(i)
        toast.success('Clip dividido')
        return
      }
    }
    toast.error('Posiciona el playhead dentro de un clip para cortar')
  }, [clips, clipTimeMap, globalTime])

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setMusicFile(file); setMusicUrl(null) }
  }

  const toggleAudioPreview = () => {
    if (audioRef.current) {
      if (isPlayingAudio) audioRef.current.pause()
      else audioRef.current.play()
      setIsPlayingAudio(!isPlayingAudio)
    }
  }

  // Timeline click → seek (accounts for zoom + scroll)
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isDraggingTrim) return
    const rect = timelineRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const targetTime = percent * totalDuration
    seekToGlobal(targetTime)
  }

  const handleTrimMouseDown = (clipIndex: number, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setIsDraggingTrim(edge); setSelectedClipIndex(clipIndex)
    const timelineEl = timelineRef.current
    if (!timelineEl) return
    const clip = clips[clipIndex]
    const timelineRect = timelineEl.getBoundingClientRect()
    const timelineWidth = timelineRect.width
    const onMove = (me: MouseEvent) => {
      const mouseX = me.clientX - timelineRect.left
      const timeAtMouse = (mouseX / timelineWidth) * totalDuration
      const map = clipTimeMap[clipIndex]
      if (!map) return
      if (edge === 'start') {
        const globalOffset = timeAtMouse - map.globalStart
        const newStart = Math.max(0, Math.min(clip.startTime + globalOffset, clip.endTime - 1))
        const clampedStart = Math.max(0, Math.min(newStart, clip.duration))
        if (clampedStart < clip.endTime - 0.5) updateClip(clipIndex, { startTime: Math.round(clampedStart * 10) / 10 })
      } else {
        const globalOffset = timeAtMouse - map.globalStart
        const newEnd = clip.startTime + globalOffset
        const clampedEnd = Math.max(clip.startTime + 1, Math.min(newEnd, clip.duration))
        if (clampedEnd > clip.startTime + 0.5) updateClip(clipIndex, { endTime: Math.round(clampedEnd * 10) / 10 })
      }
    }
    const onUp = () => { setIsDraggingTrim(null); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    seekToGlobal(percent * totalDuration)
  }

  // Export (preserved)
  const handleExport = useCallback(async () => {
    if (clips.length === 0) return
    setIsExporting(true); setExportProgress('Preparando...'); setExportedVideoUrl(null)
    try {
      let uploadedMusicUrl = musicUrl
      if (musicFile && !musicUrl) {
        setExportProgress('Subiendo musica...')
        const supabase = createClient()
        const musicPath = `temp/music-${Date.now()}.mp3`
        const { error: uploadErr } = await supabase.storage.from('landing-images').upload(musicPath, musicFile, { contentType: musicFile.type })
        if (uploadErr) throw new Error('Error al subir musica: ' + uploadErr.message)
        const { data: signedData } = await supabase.storage.from('landing-images').createSignedUrl(musicPath, 3600)
        uploadedMusicUrl = signedData?.signedUrl || null
      }
      setExportProgress('Enviando a procesar...')
      const resp = await fetch('/api/studio/video-editor/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: clips.map((c) => ({ url: c.url, startTime: c.startTime, endTime: c.endTime })), musicUrl: uploadedMusicUrl, voiceVolume: voiceVolume / 100, musicVolume: musicVolume / 100 }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al procesar')
      const jobId = data.jobId
      setExportProgress('Procesando video...')
      await new Promise<void>((resolve, reject) => {
        let attempts = 0; const maxAttempts = 120
        pollingRef.current = setInterval(async () => {
          attempts++
          if (attempts > maxAttempts) { clearInterval(pollingRef.current!); pollingRef.current = null; reject(new Error('Timeout')); return }
          try {
            const statusResp = await fetch(`/api/studio/video-editor/status?jobId=${jobId}`)
            const statusData = await statusResp.json()
            if (statusData.status === 'completed' && statusData.videoUrl) {
              clearInterval(pollingRef.current!); pollingRef.current = null
              setExportedVideoUrl(statusData.videoUrl); setShowExportOverlay(true); onExported?.(statusData.videoUrl); resolve()
            } else if (statusData.status === 'failed') {
              clearInterval(pollingRef.current!); pollingRef.current = null; reject(new Error(statusData.error || 'Error al procesar'))
            } else { setExportProgress(`Procesando... ${statusData.progress || ''}`) }
          } catch { /* network error */ }
        }, 3000)
      })
      toast.success('Video exportado!')
    } catch (err: any) { toast.error(err.message || 'Error al exportar') }
    finally { setIsExporting(false); setExportProgress('') }
  }, [clips, musicFile, musicUrl, voiceVolume, musicVolume, onExported])

  const handleDownload = async () => {
    if (!exportedVideoUrl) return
    try { const resp = await fetch(exportedVideoUrl); const blob = await resp.blob(); const blobUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = blobUrl; a.download = `video-editado-${Date.now()}.mp4`; a.click(); URL.revokeObjectURL(blobUrl) }
    catch { window.open(exportedVideoUrl, '_blank') }
  }

  const handleCopyUrl = async () => {
    if (!exportedVideoUrl) return
    try { await navigator.clipboard.writeText(exportedVideoUrl); toast.success('URL copiada') }
    catch { toast.error('Error al copiar') }
  }

  const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}` }

  const playheadPercent = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0

  if (clips.length === 0 && initialClips.length > 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border flex-shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-border/50 rounded-lg transition-colors text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-medium">Volver</span>
          </button>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500">
              <Film className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-text-primary">Editor</span>
            <span className="text-[10px] text-text-muted">{clips.length} clips · {formatTime(totalDuration)}</span>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={clips.length === 0 || isExporting}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isExporting ? 'bg-border text-text-muted cursor-not-allowed' : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-500/20'
          }`}
        >
          {isExporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{exportProgress}</> : <><Film className="w-3.5 h-3.5" />Exportar</>}
        </button>
      </div>

      {/* Main area: Preview + Audio panel */}
      <div className="flex flex-1 min-h-0 bg-black">
        {/* Preview: video always fully visible with black bars */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-black relative min-h-0 p-2">
            <video
              ref={videoRef}
              className="max-h-full max-w-full object-contain"
              style={{ background: '#000' }}
              playsInline
              onTimeUpdate={onVideoTimeUpdate}
              onEnded={() => { if (activeClipIndex >= clips.length - 1) setIsPlaying(false) }}
              onClick={togglePlay}
            />
            {!isPlaying && (
              <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center group">
                <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/70 transition-colors backdrop-blur-sm border border-white/10">
                  <Play className="w-6 h-6 text-white ml-0.5" />
                </div>
              </button>
            )}
          </div>
          {/* Mini progress bar under video */}
          <div className="px-3 pb-1.5 pt-1 flex items-center gap-2 bg-black flex-shrink-0">
            <button onClick={togglePlay} className="p-1 hover:bg-white/10 rounded transition-colors">
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
            </button>
            <span className="text-[10px] text-gray-500 w-9 text-right font-mono">{formatTime(globalTime)}</span>
            <div className="flex-1 h-1 bg-gray-800 rounded-full cursor-pointer relative group" onClick={handleProgressClick}>
              <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full relative" style={{ width: `${playheadPercent}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-[10px] text-gray-500 w-9 font-mono">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Audio Panel */}
        <div className="w-56 border-l border-[#222] bg-[#111] flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-[#222]">
            <div className="flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-white">Audio</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {musicFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-2">
                  <button onClick={toggleAudioPreview} className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 transition-colors flex-shrink-0">
                    {isPlayingAudio ? <Pause className="w-2.5 h-2.5 text-white" /> : <Play className="w-2.5 h-2.5 text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-white truncate">{musicFile.name}</p>
                    <p className="text-[9px] text-gray-500">{(musicFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button onClick={() => { setMusicFile(null); setMusicUrl(null); setIsPlayingAudio(false) }} className="p-0.5 hover:bg-red-500/20 rounded transition-colors">
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
                {musicObjectUrlRef.current && <audio ref={audioRef} src={musicObjectUrlRef.current} onEnded={() => setIsPlayingAudio(false)} className="hidden" />}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-16 border border-dashed border-[#333] hover:border-emerald-500/50 rounded-lg cursor-pointer transition-colors bg-[#1a1a1a]/50">
                <input type="file" accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/*" className="hidden" onChange={handleMusicUpload} />
                <Upload className="w-4 h-4 text-gray-500 mb-0.5" />
                <p className="text-[9px] text-gray-400 font-medium">Subir musica</p>
              </label>
            )}
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><Volume2 className="w-3 h-3" />Voz</label>
                  <span className="text-[10px] text-gray-500 font-mono">{voiceVolume}%</span>
                </div>
                <input type="range" min={0} max={200} value={voiceVolume} onChange={(e) => setVoiceVolume(parseInt(e.target.value))}
                  className="w-full h-1 accent-teal-500 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><Music className="w-3 h-3" />Musica</label>
                  <span className="text-[10px] text-gray-500 font-mono">{musicVolume}%</span>
                </div>
                <input type="range" min={0} max={200} value={musicVolume} onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                  className="w-full h-1 accent-emerald-500 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TIMELINE SECTION (always below video, never overlapping) ===== */}
      <div className="bg-[#111] border-t border-[#222] flex-shrink-0 rounded-b-2xl">
        {/* Zoom controls + toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#1a1a1a]">
          {/* Zoom */}
          <button onClick={() => setTimelineZoom(z => Math.max(1, z - 0.5))} className="p-1 hover:bg-white/10 rounded transition-colors" title="Alejar">
            <ZoomOut className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <div className="w-16 flex items-center">
            <input type="range" min={1} max={5} step={0.5} value={timelineZoom} onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
              className="w-full h-0.5 accent-gray-400 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
          </div>
          <button onClick={() => setTimelineZoom(z => Math.min(5, z + 0.5))} className="p-1 hover:bg-white/10 rounded transition-colors" title="Acercar">
            <ZoomIn className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <span className="text-[9px] text-gray-600 ml-1">{timelineZoom.toFixed(1)}x</span>

          <div className="w-px h-4 bg-[#2a2a2a] mx-2" />

          {/* Split tool */}
          <button
            onClick={splitAtPlayhead}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium hover:bg-white/10 text-gray-400 transition-colors"
            title="Cortar en la posicion del playhead"
          >
            <Scissors className="w-3.5 h-3.5" />
            Cortar
          </button>

          <div className="flex-1" />

          {/* Selected clip actions */}
          {selectedClipIndex !== null && clips[selectedClipIndex] && (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-gray-500 mr-1.5 max-w-32 truncate">
                {clips[selectedClipIndex].label}
              </span>
              <button onClick={() => moveClip(selectedClipIndex, -1)} disabled={selectedClipIndex === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-20 transition-colors" title="Mover izquierda">
                <ChevronLeft className="w-3 h-3 text-gray-400" />
              </button>
              <button onClick={() => moveClip(selectedClipIndex, 1)} disabled={selectedClipIndex === clips.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-20 transition-colors" title="Mover derecha">
                <ChevronRight className="w-3 h-3 text-gray-400" />
              </button>
              <button
                onClick={() => setShowTrimPanel(!showTrimPanel)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${showTrimPanel ? 'bg-teal-500/20 text-teal-300' : 'hover:bg-white/10 text-gray-400'}`}
              >
                Trim
              </button>
              <button onClick={() => removeClip(selectedClipIndex)} disabled={clips.length <= 1} className="p-1 hover:bg-red-500/20 rounded disabled:opacity-20 transition-colors" title="Eliminar">
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable timeline */}
        <div ref={timelineScrollRef} className="overflow-x-auto">
          <div ref={timelineRef} className="relative cursor-pointer select-none" style={{ width: `${100 * timelineZoom}%`, minWidth: '100%' }} onClick={handleTimelineClick}>
            {/* Video track */}
            <div className="flex h-14 gap-[2px] px-2 pt-2">
              {clips.map((clip, i) => {
                const clipDur = clip.endTime - clip.startTime
                const widthPercent = totalDuration > 0 ? (clipDur / totalDuration) * 100 : 0
                const isSelected = selectedClipIndex === i
                const isActive = activeClipIndex === i
                return (
                  <div
                    key={i}
                    className={`relative h-full rounded-md flex items-center justify-center overflow-hidden transition-all cursor-pointer group ${
                      isSelected ? 'ring-2 ring-pink-500 bg-teal-600/40' : isActive ? 'bg-teal-600/30' : 'bg-teal-700/20 hover:bg-teal-600/25'
                    }`}
                    style={{ width: `${widthPercent}%`, minWidth: 48 }}
                    onClick={(e) => { e.stopPropagation(); setSelectedClipIndex(i); seekToGlobal(clipTimeMap[i]?.globalStart ?? 0) }}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-2 bg-pink-500 cursor-col-resize z-10 rounded-l-md hover:bg-pink-400 transition-colors" onMouseDown={(e) => handleTrimMouseDown(i, 'start', e)}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-0.5 px-3">
                      <span className="text-[10px] font-semibold text-teal-200 whitespace-nowrap">{clip.label.length > 14 ? clip.label.slice(0, 14) + '...' : clip.label}</span>
                      <span className="text-[9px] text-teal-300/60 font-mono">{formatTime(clipDur)}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-pink-500 cursor-col-resize z-10 rounded-r-md hover:bg-pink-400 transition-colors" onMouseDown={(e) => handleTrimMouseDown(i, 'end', e)}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Audio track */}
            <div className="h-7 px-2 mt-0.5">
              {musicFile ? (
                <div className="h-full bg-emerald-700/25 rounded-md flex items-center px-3 gap-2 border border-emerald-600/20">
                  <Music className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                  <span className="text-[9px] text-emerald-300/80 truncate">{musicFile.name}</span>
                </div>
              ) : (
                <div className="h-full rounded-md border border-dashed border-[#222] flex items-center justify-center">
                  <span className="text-[8px] text-gray-700">Sin musica</span>
                </div>
              )}
            </div>

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-20" style={{ left: `${playheadPercent}%` }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-white" />
            </div>
          </div>
        </div>

        {/* Trim sliders panel */}
        {showTrimPanel && selectedClipIndex !== null && clips[selectedClipIndex] && (
          <div className="px-3 pb-2 pt-1.5 border-t border-[#1a1a1a] space-y-1">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-8">Inicio</label>
              <input type="range" min={0} max={clips[selectedClipIndex].duration} step={0.1} value={clips[selectedClipIndex].startTime}
                onChange={(e) => { const val = parseFloat(e.target.value); if (val < clips[selectedClipIndex!].endTime - 0.5) updateClip(selectedClipIndex!, { startTime: val }) }}
                className="flex-1 h-1 accent-teal-500" />
              <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{formatTime(clips[selectedClipIndex].startTime)}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-8">Fin</label>
              <input type="range" min={0} max={clips[selectedClipIndex].duration} step={0.1} value={clips[selectedClipIndex].endTime}
                onChange={(e) => { const val = parseFloat(e.target.value); if (val > clips[selectedClipIndex!].startTime + 0.5) updateClip(selectedClipIndex!, { endTime: val }) }}
                className="flex-1 h-1 accent-teal-500" />
              <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{formatTime(clips[selectedClipIndex].endTime)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Export overlay */}
      {showExportOverlay && exportedVideoUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-green-400">Video Exportado</h3>
              <button onClick={() => setShowExportOverlay(false)} className="p-1 hover:bg-white/10 rounded transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <video src={exportedVideoUrl} controls className="w-full rounded-xl aspect-video object-contain bg-black mb-4" />
            <div className="flex gap-2">
              <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold transition-colors">
                <Download className="w-4 h-4" />Descargar
              </button>
              <button onClick={handleCopyUrl} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#222] border border-[#333] hover:border-gray-500 text-white rounded-xl text-xs font-semibold transition-colors">
                <Copy className="w-4 h-4" />Copiar URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
