'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ArrowLeft, X, Upload, Music, Download, Copy, Loader2, Play, Pause, Film, Trash2, ChevronLeft, ChevronRight, Scissors, Volume2, ZoomIn, ZoomOut, Undo2, Redo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

interface VideoEditorProps {
  initialClips: { url: string; label: string }[]
  onBack: () => void
  onExported?: (videoUrl: string) => void
  influencerId?: string
}

interface ClipState {
  url: string
  label: string
  startTime: number
  endTime: number
  duration: number
}

const MAX_HISTORY = 50
const FFMPEG_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

export function VideoEditor({ initialClips, onBack, onExported, influencerId }: VideoEditorProps) {
  const [clips, setClips] = useState<ClipState[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeClipIndex, setActiveClipIndex] = useState(0)
  const [globalTime, setGlobalTime] = useState(0)
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null)
  const [isDraggingTrim, setIsDraggingTrim] = useState<'start' | 'end' | null>(null)
  const [showTrimPanel, setShowTrimPanel] = useState(false)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [musicStartTime, setMusicStartTime] = useState(0)
  const [musicEndTime, setMusicEndTime] = useState(0)
  const [musicDuration, setMusicDuration] = useState(0)
  const [voiceVolume, setVoiceVolume] = useState(100)
  const [musicVolume, setMusicVolume] = useState(50)
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<'video' | 'audio' | null>(null)
  const [musicUrl, setMusicUrl] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null)
  const [showExportOverlay, setShowExportOverlay] = useState(false)
  const [savedToPizarra, setSavedToPizarra] = useState(false)

  // Undo/Redo
  const [history, setHistory] = useState<ClipState[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoRef = useRef(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const isTransitioningRef = useRef(false)
  const prevMusicUrlRef = useRef<string | null>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  // History tracking
  useEffect(() => {
    if (clips.length === 0) return
    if (isUndoRedoRef.current) { isUndoRedoRef.current = false; return }
    setHistory(prev => {
      const h = prev.slice(0, historyIndex + 1)
      h.push(clips)
      if (h.length > MAX_HISTORY) h.shift()
      return h
    })
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const undo = useCallback(() => {
    if (!canUndo) return
    isUndoRedoRef.current = true
    const i = historyIndex - 1
    setHistoryIndex(i); setClips(history[i])
    toast('Deshacer', { duration: 1000 })
  }, [canUndo, historyIndex, history])

  const redo = useCallback(() => {
    if (!canRedo) return
    isUndoRedoRef.current = true
    const i = historyIndex + 1
    setHistoryIndex(i); setClips(history[i])
    toast('Rehacer', { duration: 1000 })
  }, [canRedo, historyIndex, history])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // Load clip durations
  useEffect(() => {
    const load = async () => {
      const loaded: ClipState[] = await Promise.all(
        initialClips.map(clip => new Promise<ClipState>((resolve) => {
          const v = document.createElement('video')
          v.preload = 'metadata'
          v.onloadedmetadata = () => resolve({ url: clip.url, label: clip.label, startTime: 0, endTime: v.duration, duration: v.duration })
          v.onerror = () => resolve({ url: clip.url, label: clip.label, startTime: 0, endTime: 10, duration: 10 })
          v.src = clip.url
        }))
      )
      setClips(loaded)
    }
    load()
  }, [initialClips])

  useEffect(() => {
    return () => { if (prevMusicUrlRef.current) URL.revokeObjectURL(prevMusicUrlRef.current) }
  }, [])

  const clipTimeMap = useMemo(() => {
    let offset = 0
    return clips.map(c => {
      const dur = c.endTime - c.startTime
      const entry = { globalStart: offset, globalEnd: offset + dur, clip: c }
      offset += dur
      return entry
    })
  }, [clips])

  const totalDuration = useMemo(() => clips.reduce((sum, c) => sum + (c.endTime - c.startTime), 0), [clips])
  const musicTrimmedDuration = musicEndTime - musicStartTime
  const timelineMaxDuration = Math.max(totalDuration, musicFile ? musicTrimmedDuration : 0, 0.1)

  const timeRulerMarks = useMemo(() => {
    const dur = timelineMaxDuration
    let interval = 1
    if (dur > 120) interval = 30
    else if (dur > 60) interval = 15
    else if (dur > 30) interval = 10
    else if (dur > 10) interval = 5
    else if (dur > 5) interval = 2
    const marks: { time: number; pct: number; major: boolean }[] = []
    for (let t = 0; t <= dur; t += interval) marks.push({ time: t, pct: (t / dur) * 100, major: true })
    const minor = interval / 2
    if (minor >= 0.5) for (let t = minor; t < dur; t += interval) marks.push({ time: t, pct: (t / dur) * 100, major: false })
    return marks
  }, [timelineMaxDuration])

  // Music object URL (state-based so audio element re-renders)
  useEffect(() => {
    if (prevMusicUrlRef.current) URL.revokeObjectURL(prevMusicUrlRef.current)
    if (musicFile) {
      const url = URL.createObjectURL(musicFile)
      setMusicUrl(url)
      prevMusicUrlRef.current = url
    } else {
      setMusicUrl(null)
      prevMusicUrlRef.current = null
    }
  }, [musicFile])

  // Sync volumes to elements
  useEffect(() => { if (videoRef.current) videoRef.current.volume = Math.min(voiceVolume / 100, 1) }, [voiceVolume])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = Math.min(musicVolume / 100, 1) }, [musicVolume])

  const loadClip = useCallback((index: number, seekTo?: number) => {
    if (!videoRef.current || index < 0 || index >= clips.length) return
    const clip = clips[index]
    const video = videoRef.current
    if (video.src !== clip.url) video.src = clip.url
    video.currentTime = seekTo ?? clip.startTime
    video.volume = Math.min(voiceVolume / 100, 1)
  }, [clips, voiceVolume])

  const onVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current || isTransitioningRef.current) return
    const video = videoRef.current
    const clip = clips[activeClipIndex]
    if (!clip) return
    const map = clipTimeMap[activeClipIndex]
    if (!map) return
    setGlobalTime(map.globalStart + (video.currentTime - clip.startTime))
    if (video.currentTime >= clip.endTime - 0.05) {
      const next = activeClipIndex + 1
      if (next < clips.length) {
        isTransitioningRef.current = true
        video.pause()
        setActiveClipIndex(next)
        const nc = clips[next]
        video.src = nc.url
        video.currentTime = nc.startTime
        video.play().then(() => { isTransitioningRef.current = false }).catch(() => { isTransitioningRef.current = false })
      } else {
        video.pause(); audioRef.current?.pause()
        setIsPlaying(false); setGlobalTime(totalDuration)
      }
    }
  }, [activeClipIndex, clips, clipTimeMap, totalDuration])

  const togglePlay = useCallback(() => {
    if (!videoRef.current || clips.length === 0) return
    const video = videoRef.current
    if (isPlaying) {
      video.pause(); audioRef.current?.pause(); setIsPlaying(false)
    } else {
      if (globalTime >= totalDuration - 0.1) {
        setActiveClipIndex(0); setGlobalTime(0); loadClip(0, clips[0].startTime)
        if (audioRef.current) audioRef.current.currentTime = musicStartTime
        setTimeout(() => {
          videoRef.current?.play()
          if (audioRef.current && musicFile && musicTrimmedDuration > 0) audioRef.current.play().catch(() => {})
          setIsPlaying(true)
        }, 100)
      } else {
        video.play().then(() => {
          setIsPlaying(true)
          if (audioRef.current && musicFile && globalTime < musicTrimmedDuration) {
            audioRef.current.currentTime = musicStartTime + globalTime
            audioRef.current.play().catch(() => {})
          }
        }).catch(() => {})
      }
    }
  }, [isPlaying, clips, globalTime, totalDuration, loadClip, musicFile])

  const seekToGlobal = useCallback((targetTime: number) => {
    if (clips.length === 0) return
    const clamped = Math.max(0, Math.min(targetTime, totalDuration))
    for (let i = 0; i < clipTimeMap.length; i++) {
      const map = clipTimeMap[i]
      if (clamped >= map.globalStart && clamped < map.globalEnd) {
        setActiveClipIndex(i); setGlobalTime(clamped)
        loadClip(i, clips[i].startTime + (clamped - map.globalStart))
        if (audioRef.current) audioRef.current.currentTime = musicStartTime + clamped
        return
      }
    }
    const last = clips.length - 1
    setActiveClipIndex(last); setGlobalTime(totalDuration); loadClip(last, clips[last].endTime)
  }, [clips, clipTimeMap, totalDuration, loadClip, musicStartTime])

  useEffect(() => {
    if (clips.length > 0 && videoRef.current && !videoRef.current.src) loadClip(0, clips[0].startTime)
  }, [clips, loadClip])

  const updateClip = (index: number, update: Partial<ClipState>) => {
    setClips(prev => prev.map((c, i) => i === index ? { ...c, ...update } : c))
  }

  const removeClip = (index: number) => {
    if (clips.length <= 1) { toast.error('No puedes eliminar el unico clip'); return }
    setClips(prev => prev.filter((_, i) => i !== index))
    if (selectedClipIndex === index) setSelectedClipIndex(null)
    if (activeClipIndex >= index && activeClipIndex > 0) setActiveClipIndex(prev => prev - 1)
  }

  const moveClip = (index: number, dir: -1 | 1) => {
    const ni = index + dir
    if (ni < 0 || ni >= clips.length) return
    setClips(prev => { const n = [...prev]; [n[index], n[ni]] = [n[ni], n[index]]; return n })
    setSelectedClipIndex(ni)
  }

  const splitAtPlayhead = useCallback(() => {
    // Try splitting video clip first
    for (let i = 0; i < clipTimeMap.length; i++) {
      const map = clipTimeMap[i]
      if (globalTime > map.globalStart + 0.1 && globalTime < map.globalEnd - 0.1) {
        const clip = clips[i]
        const sp = Math.round((clip.startTime + (globalTime - map.globalStart)) * 100) / 100
        setClips(prev => [...prev.slice(0, i), { ...clip, endTime: sp }, { ...clip, startTime: sp, label: clip.label + ' (B)' }, ...prev.slice(i + 1)])
        setSelectedClipIndex(i + 1); setSelectedTrack('video')
        toast.success('Clip dividido en ' + fmtTime(sp))
        return
      }
    }
    // Try trimming audio at playhead
    if (musicFile && musicTrimmedDuration > 0 && globalTime > 0.5 && globalTime < musicTrimmedDuration - 0.5) {
      setMusicEndTime(Math.round((musicStartTime + globalTime) * 10) / 10)
      setSelectedTrack('audio')
      toast.success('Audio recortado en ' + fmtTime(globalTime))
      return
    }
    toast.error('Mueve el playhead al punto donde quieres cortar')
  }, [clips, clipTimeMap, globalTime, musicFile, musicStartTime, musicTrimmedDuration])

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMusicFile(file)
    const audio = new Audio()
    audio.onloadedmetadata = () => {
      setMusicDuration(audio.duration)
      setMusicEndTime(audio.duration)
      setMusicStartTime(0)
      URL.revokeObjectURL(audio.src)
    }
    audio.src = URL.createObjectURL(file)
  }

  const handleRemoveMusic = () => {
    setMusicFile(null)
    setMusicStartTime(0); setMusicEndTime(0); setMusicDuration(0)
    audioRef.current?.pause()
    if (selectedTrack === 'audio') setSelectedTrack(null)
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isDraggingTrim || isDraggingPlayhead) return
    const rect = timelineRef.current.getBoundingClientRect()
    const t = ((e.clientX - rect.left) / rect.width) * timelineMaxDuration
    seekToGlobal(Math.min(t, totalDuration))
  }

  const handleTrimMouseDown = (ci: number, edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setIsDraggingTrim(edge); setSelectedClipIndex(ci); setSelectedTrack('video')
    const el = timelineRef.current
    if (!el) return
    const clip = clips[ci]
    const rect = el.getBoundingClientRect()
    const w = rect.width
    const onMove = (me: MouseEvent) => {
      const t = ((me.clientX - rect.left) / w) * timelineMaxDuration
      const map = clipTimeMap[ci]
      if (!map) return
      if (edge === 'start') {
        const ns = Math.max(0, Math.min(clip.startTime + (t - map.globalStart), clip.endTime - 1))
        const cs = Math.max(0, Math.min(ns, clip.duration))
        if (cs < clip.endTime - 0.5) updateClip(ci, { startTime: Math.round(cs * 10) / 10 })
      } else {
        const ne = clip.startTime + (t - map.globalStart)
        const ce = Math.max(clip.startTime + 1, Math.min(ne, clip.duration))
        if (ce > clip.startTime + 0.5) updateClip(ci, { endTime: Math.round(ce * 10) / 10 })
      }
    }
    const onUp = () => { setIsDraggingTrim(null); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seekToGlobal(((e.clientX - rect.left) / rect.width) * totalDuration)
  }

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setIsDraggingPlayhead(true)
    const el = timelineRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (me: MouseEvent) => {
      const pct = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width))
      const t = pct * timelineMaxDuration
      seekToGlobal(Math.min(t, totalDuration))
    }
    const onUp = () => {
      setIsDraggingPlayhead(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleAudioTrimMouseDown = (edge: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    setSelectedTrack('audio'); setSelectedClipIndex(null)
    const el = timelineRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (me: MouseEvent) => {
      const t = ((me.clientX - rect.left) / rect.width) * timelineMaxDuration
      if (edge === 'start') {
        const ns = Math.max(0, Math.min(t, musicEndTime - 1))
        setMusicStartTime(Math.round(ns * 10) / 10)
      } else {
        const ne = Math.max(musicStartTime + 1, Math.min(t, musicDuration))
        setMusicEndTime(Math.round(ne * 10) / 10)
      }
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  // =================== CLIENT-SIDE EXPORT WITH FFMPEG.WASM ===================

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current
    const ff = new FFmpeg()
    ff.on('log', ({ message }) => console.log('[ffmpeg]', message))
    ff.on('progress', ({ progress }) => {
      if (progress > 0 && progress <= 1) setExportProgress('Procesando... ' + Math.round(progress * 100) + '%')
    })
    await ff.load({
      coreURL: await toBlobURL(FFMPEG_BASE + '/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await toBlobURL(FFMPEG_BASE + '/ffmpeg-core.wasm', 'application/wasm'),
    })
    ffmpegRef.current = ff
    return ff
  }, [])

  const handleExport = useCallback(async () => {
    if (clips.length === 0) return
    setIsExporting(true); setSavedToPizarra(false)
    try {
      setExportProgress('Cargando motor de video...')
      let ff: FFmpeg
      try { ff = await loadFFmpeg() }
      catch { toast.error('No se pudo cargar el motor de video. Recarga la pagina.'); return }

      // Download clips via proxy (avoids CORS)
      for (let i = 0; i < clips.length; i++) {
        setExportProgress('Descargando clip ' + (i + 1) + ' de ' + clips.length + '...')
        try {
          const proxyUrl = '/api/studio/video-editor/proxy?url=' + encodeURIComponent(clips[i].url)
          await ff.writeFile('in' + i + '.mp4', await fetchFile(proxyUrl))
        } catch {
          try { await ff.writeFile('in' + i + '.mp4', await fetchFile(clips[i].url)) }
          catch { toast.error('No se pudo descargar el clip ' + (i + 1)); return }
        }
      }

      // Trim clips — always re-encode for consistent codec (ffmpeg.wasm can't copy VP9/H.265)
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i]
        setExportProgress('Procesando clip ' + (i + 1) + ' de ' + clips.length + '...')
        // Re-encode to H.264 + AAC — preserves both video and audio
        const code = await ff.exec([
          '-i', 'in' + i + '.mp4',
          '-ss', c.startTime.toFixed(2), '-to', c.endTime.toFixed(2),
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
          '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
          '-avoid_negative_ts', '1',
          'tr' + i + '.mp4'
        ])
        if (code !== 0) {
          // If re-encode with audio failed, try without audio (source might lack audio track)
          await ff.exec([
            '-i', 'in' + i + '.mp4',
            '-ss', c.startTime.toFixed(2), '-to', c.endTime.toFixed(2),
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30',
            '-an', '-avoid_negative_ts', '1',
            'tr' + i + '.mp4'
          ])
        }
      }

      // Concat
      setExportProgress('Uniendo clips...')
      const needsAudio = !!musicFile || voiceVolume !== 100
      const concatOut = needsAudio ? 'joined.mp4' : 'final.mp4'

      if (clips.length === 1) {
        const d = await ff.readFile('tr0.mp4')
        await ff.writeFile(concatOut, d)
      } else {
        const list = clips.map((_, i) => "file 'tr" + i + ".mp4'").join('\n')
        await ff.writeFile('list.txt', new TextEncoder().encode(list))
        const code = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', concatOut])

        // Verify concat output — if failed or too small, re-encode all clips
        let needsReencode = code !== 0
        if (!needsReencode) {
          try {
            const check = await ff.readFile(concatOut)
            if ((check as Uint8Array).length < 100) needsReencode = true
          } catch { needsReencode = true }
        }

        if (needsReencode) {
          setExportProgress('Re-codificando clips...')
          for (let i = 0; i < clips.length; i++) {
            await ff.exec(['-i', 'tr' + i + '.mp4', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', '-r', '30', 'enc' + i + '.mp4'])
          }
          const list2 = clips.map((_, i) => "file 'enc" + i + ".mp4'").join('\n')
          await ff.writeFile('list2.txt', new TextEncoder().encode(list2))
          await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list2.txt', '-c', 'copy', concatOut])
        }
      }

      // Audio mixing
      if (musicFile) {
        setExportProgress('Procesando musica...')
        await ff.writeFile('music_raw.mp3', await fetchFile(musicFile))
        // Trim music if user adjusted start/end
        if (musicStartTime > 0.1 || (musicDuration > 0 && musicEndTime < musicDuration - 0.1)) {
          const tc = await ff.exec(['-i', 'music_raw.mp3', '-ss', musicStartTime.toFixed(2), '-to', musicEndTime.toFixed(2), '-c', 'copy', 'music.mp3'])
          if (tc !== 0) await ff.exec(['-i', 'music_raw.mp3', '-ss', musicStartTime.toFixed(2), '-to', musicEndTime.toFixed(2), '-c:a', 'aac', '-b:a', '128k', 'music.mp3'])
        } else {
          const d = await ff.readFile('music_raw.mp3'); await ff.writeFile('music.mp3', d)
        }
        setExportProgress('Mezclando musica...')
        const vv = (voiceVolume / 100).toFixed(2)
        const mv = (musicVolume / 100).toFixed(2)

        // First try: mix video audio + music (if video has audio track)
        const mixCode = await ff.exec([
          '-i', 'joined.mp4', '-i', 'music.mp3',
          '-filter_complex', '[0:a]volume=' + vv + '[voice];[1:a]volume=' + mv + '[mus];[voice][mus]amix=inputs=2:duration=first:dropout_transition=2[aout]',
          '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', 'final.mp4'
        ])
        if (mixCode !== 0) {
          // Video has no audio track — add music as only audio using filter_complex (NOT -af with -map)
          const fallbackCode = await ff.exec([
            '-i', 'joined.mp4', '-i', 'music.mp3',
            '-filter_complex', '[1:a]volume=' + mv + '[mus]',
            '-map', '0:v', '-map', '[mus]',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', 'final.mp4'
          ])
          if (fallbackCode !== 0) {
            // Last resort: video without music
            const d = await ff.readFile('joined.mp4')
            await ff.writeFile('final.mp4', d)
            toast('Video exportado sin musica (formato no compatible)', { icon: '⚠️' })
          }
        }
      } else if (voiceVolume !== 100) {
        setExportProgress('Ajustando volumen...')
        const code = await ff.exec(['-i', 'joined.mp4', '-af', 'volume=' + (voiceVolume / 100).toFixed(2), '-c:v', 'copy', '-c:a', 'aac', 'final.mp4'])
        if (code !== 0) {
          const d = await ff.readFile('joined.mp4')
          await ff.writeFile('final.mp4', d)
        }
      }

      // Read output
      setExportProgress('Preparando video...')
      const outData = await ff.readFile('final.mp4')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = new Blob([outData as any], { type: 'video/mp4' })
      const localUrl = URL.createObjectURL(blob)

      // Upload to Supabase Storage
      setExportProgress('Subiendo a la nube...')
      const supabase = createClient()
      const storagePath = 'editor/' + Date.now() + '_edited.mp4'
      const { error: upErr } = await supabase.storage.from('landing-images').upload(storagePath, blob, { contentType: 'video/mp4', upsert: true })

      // Always use local blob URL for immediate playback/download (fastest, most reliable)
      // Upload to Storage for persistence (signed URL for pizarra)
      if (!upErr) {
        // Save to pizarra with signed URL
        if (influencerId) {
          setExportProgress('Guardando en la pizarra...')
          const { data: signedData } = await supabase.storage.from('landing-images').createSignedUrl(storagePath, 86400)
          const signedUrl = signedData?.signedUrl || localUrl
          const saveResp = await fetch('/api/studio/influencer/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              influencerId,
              image_url: signedUrl,
              video_url: signedUrl,
              content_type: 'video',
              type: 'solo',
              situation: 'Video editado con Editor',
              prompt_used: clips.map(c => c.label).join(' + '),
            })
          })
          if (saveResp.ok) { setSavedToPizarra(true); toast.success('Guardado en la pizarra') }
        }
      } else {
        console.error('Upload error:', upErr)
        toast.error('Video listo pero no se pudo subir a la nube')
      }

      // Use local blob URL — works instantly, no CORS, no auth needed
      setExportedVideoUrl(localUrl)
      setShowExportOverlay(true)
      onExported?.(localUrl)
      toast.success('Video exportado!')

      // Cleanup
      for (let i = 0; i < clips.length; i++) {
        try { await ff.deleteFile('in' + i + '.mp4') } catch {}
        try { await ff.deleteFile('tr' + i + '.mp4') } catch {}
        try { await ff.deleteFile('enc' + i + '.mp4') } catch {}
      }
      for (const f of ['list.txt', 'list2.txt', 'joined.mp4', 'final.mp4', 'music.mp3', 'music_raw.mp3']) {
        try { await ff.deleteFile(f) } catch {}
      }
    } catch (err: any) {
      console.error('Export error:', err)
      toast.error(err.message || 'Error al exportar video')
    } finally {
      setIsExporting(false); setExportProgress('')
    }
  }, [clips, musicFile, musicStartTime, musicEndTime, musicDuration, voiceVolume, musicVolume, influencerId, onExported, loadFFmpeg])

  const handleDownload = async () => {
    if (!exportedVideoUrl) return
    try {
      const resp = await fetch(exportedVideoUrl); const blob = await resp.blob()
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = u; a.download = 'video-editado-' + Date.now() + '.mp4'; a.click()
      URL.revokeObjectURL(u)
    } catch { window.open(exportedVideoUrl, '_blank') }
  }

  const handleCopyUrl = async () => {
    if (!exportedVideoUrl) return
    try { await navigator.clipboard.writeText(exportedVideoUrl); toast.success('URL copiada') }
    catch { toast.error('Error al copiar') }
  }

  const fmtTime = (s: number) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return m + ':' + sec.toString().padStart(2, '0') }
  const playheadPct = timelineMaxDuration > 0 ? (globalTime / timelineMaxDuration) * 100 : 0

  if (clips.length === 0 && initialClips.length > 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface border-b border-border flex-shrink-0 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1 hover:bg-border/50 rounded-lg transition-colors text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4" /><span className="text-xs font-medium">Volver</span>
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center bg-gradient-to-br from-pink-500 to-rose-500"><Film className="w-3 h-3 text-white" /></div>
            <span className="text-sm font-semibold text-text-primary">Editor</span>
            <span className="text-[10px] text-text-muted">{clips.length} clips &middot; {fmtTime(totalDuration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <button onClick={undo} disabled={!canUndo} className="p-1.5 hover:bg-border/50 rounded-lg disabled:opacity-20 transition-colors" title="Deshacer (Ctrl+Z)"><Undo2 className="w-4 h-4 text-text-secondary" /></button>
            <button onClick={redo} disabled={!canRedo} className="p-1.5 hover:bg-border/50 rounded-lg disabled:opacity-20 transition-colors" title="Rehacer (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4 text-text-secondary" /></button>
          </div>
          <button onClick={handleExport} disabled={clips.length === 0 || isExporting}
            className={'flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ' + (isExporting ? 'bg-border text-text-muted cursor-not-allowed' : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-500/20')}>
            {isExporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{exportProgress}</> : <><Film className="w-3.5 h-3.5" />Exportar</>}
          </button>
        </div>
      </div>

      {/* Preview + Audio */}
      <div className="flex bg-black flex-shrink-0" style={{ height: 'min(42vh, 340px)' }}>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex items-center justify-center bg-black relative min-h-0 p-1">
            <video ref={videoRef} className="max-h-full max-w-full object-contain rounded" style={{ background: '#000' }} playsInline
              onTimeUpdate={onVideoTimeUpdate} onEnded={() => { if (activeClipIndex >= clips.length - 1) { setIsPlaying(false); audioRef.current?.pause() } }} onClick={togglePlay} />
            {!isPlaying && (
              <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center group">
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-black/70 transition-colors backdrop-blur-sm border border-white/10"><Play className="w-5 h-5 text-white ml-0.5" /></div>
              </button>
            )}
          </div>
          <div className="px-3 pb-1 pt-0.5 flex items-center gap-2 bg-black flex-shrink-0">
            <button onClick={togglePlay} className="p-0.5 hover:bg-white/10 rounded transition-colors">
              {isPlaying ? <Pause className="w-3 h-3 text-white" /> : <Play className="w-3 h-3 text-white ml-0.5" />}
            </button>
            <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{fmtTime(globalTime)}</span>
            <div className="flex-1 h-1 bg-gray-800 rounded-full cursor-pointer relative group" onClick={handleProgressClick}>
              <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full relative" style={{ width: playheadPct + '%' }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-[10px] text-gray-500 w-8 font-mono">{fmtTime(totalDuration)}</span>
          </div>
        </div>

        {/* Audio Panel */}
        <div className="w-52 border-l border-[#222] bg-[#111] flex flex-col flex-shrink-0">
          <div className="px-3 py-1.5 border-b border-[#222]">
            <div className="flex items-center gap-2"><Music className="w-3 h-3 text-gray-400" /><span className="text-[11px] font-semibold text-white">Audio</span></div>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            {musicFile ? (
              <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-2">
                <Music className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-white truncate">{musicFile.name}</p>
                  <p className="text-[9px] text-gray-500">{(musicFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={handleRemoveMusic} className="p-0.5 hover:bg-red-500/20 rounded transition-colors"><X className="w-3 h-3 text-red-400" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-14 border border-dashed border-[#333] hover:border-emerald-500/50 rounded-lg cursor-pointer transition-colors bg-[#1a1a1a]/50">
                <input type="file" accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg,audio/*" className="hidden" onChange={handleMusicUpload} />
                <Upload className="w-3.5 h-3.5 text-gray-500 mb-0.5" /><p className="text-[9px] text-gray-400 font-medium">Subir musica</p>
              </label>
            )}
            {musicFile && <p className="text-[9px] text-emerald-400/70 text-center">Suena al reproducir el video</p>}
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><Volume2 className="w-2.5 h-2.5" />Voz</label>
                  <span className="text-[9px] text-gray-500 font-mono">{voiceVolume}%</span>
                </div>
                <input type="range" min={0} max={200} value={voiceVolume} onChange={e => setVoiceVolume(parseInt(e.target.value))}
                  className="w-full h-1 accent-teal-500 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] font-medium text-gray-400 flex items-center gap-1"><Music className="w-2.5 h-2.5" />Musica</label>
                  <span className="text-[9px] text-gray-500 font-mono">{musicVolume}%</span>
                </div>
                <input type="range" min={0} max={200} value={musicVolume} onChange={e => setMusicVolume(parseInt(e.target.value))}
                  className="w-full h-1 accent-emerald-500 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio for music sync during preview */}
      {musicUrl && <audio ref={audioRef} src={musicUrl} loop className="hidden" />}

      {/* Timeline */}
      <div className="bg-[#111] border-t-2 border-[#333] flex-1 min-h-0 flex flex-col rounded-b-2xl">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#1a1a1a] flex-shrink-0">
          <button onClick={() => setTimelineZoom(z => Math.max(1, z - 0.5))} className="p-1 hover:bg-white/10 rounded transition-colors" title="Alejar"><ZoomOut className="w-3.5 h-3.5 text-gray-400" /></button>
          <div className="w-14 flex items-center">
            <input type="range" min={1} max={5} step={0.5} value={timelineZoom} onChange={e => setTimelineZoom(parseFloat(e.target.value))}
              className="w-full h-0.5 accent-gray-400 bg-gray-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
          </div>
          <button onClick={() => setTimelineZoom(z => Math.min(5, z + 0.5))} className="p-1 hover:bg-white/10 rounded transition-colors" title="Acercar"><ZoomIn className="w-3.5 h-3.5 text-gray-400" /></button>
          <span className="text-[9px] text-gray-600 ml-0.5">{timelineZoom.toFixed(1)}x</span>
          <div className="w-px h-4 bg-[#2a2a2a] mx-1.5" />
          <button onClick={splitAtPlayhead}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#1a1a1a] hover:bg-[#252525] text-orange-400 hover:text-orange-300 transition-colors border border-[#333] hover:border-orange-500/30"
            title="Cortar en la posicion del playhead"><Scissors className="w-3.5 h-3.5" />Cortar aqui</button>
          <div className="flex-1" />
          {/* Video clip selected */}
          {selectedClipIndex !== null && clips[selectedClipIndex] && selectedTrack !== 'audio' && (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-gray-500 mr-1.5 max-w-28 truncate">{clips[selectedClipIndex].label}</span>
              <button onClick={() => moveClip(selectedClipIndex, -1)} disabled={selectedClipIndex === 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-20 transition-colors"><ChevronLeft className="w-3 h-3 text-gray-400" /></button>
              <button onClick={() => moveClip(selectedClipIndex, 1)} disabled={selectedClipIndex === clips.length - 1} className="p-1 hover:bg-white/10 rounded disabled:opacity-20 transition-colors"><ChevronRight className="w-3 h-3 text-gray-400" /></button>
              <button onClick={() => setShowTrimPanel(!showTrimPanel)}
                className={'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ' + (showTrimPanel ? 'bg-teal-500/20 text-teal-300' : 'hover:bg-white/10 text-gray-400')}>Trim</button>
              <button onClick={() => removeClip(selectedClipIndex)} disabled={clips.length <= 1} className="p-1 hover:bg-red-500/20 rounded disabled:opacity-20 transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
            </div>
          )}
          {/* Audio track selected */}
          {selectedTrack === 'audio' && musicFile && (
            <div className="flex items-center gap-1">
              <Music className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-300 mr-1 max-w-28 truncate">{musicFile.name}</span>
              <span className="text-[9px] text-gray-500 font-mono">{fmtTime(musicTrimmedDuration)}</span>
              <button onClick={() => setShowTrimPanel(!showTrimPanel)}
                className={'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ' + (showTrimPanel ? 'bg-emerald-500/20 text-emerald-300' : 'hover:bg-white/10 text-gray-400')}>Trim</button>
              <button onClick={handleRemoveMusic} className="p-1 hover:bg-red-500/20 rounded transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
            </div>
          )}
        </div>

        {/* Scrollable timeline area */}
        <div ref={timelineScrollRef} className="overflow-x-auto flex-1 min-h-0">
          <div ref={timelineRef} className="relative cursor-pointer select-none min-h-full" style={{ width: (100 * timelineZoom) + '%', minWidth: '100%' }} onClick={handleTimelineClick}>

            {/* Time ruler */}
            <div className="h-5 relative border-b border-[#222] flex-shrink-0">
              {timeRulerMarks.map((mark, mi) => (
                <div key={mi} className="absolute top-0" style={{ left: mark.pct + '%' }}>
                  <div className={'w-px ' + (mark.major ? 'h-3 bg-gray-600' : 'h-2 bg-gray-800')} />
                  {mark.major && <span className="absolute top-2.5 left-1/2 -translate-x-1/2 text-[7px] text-gray-600 font-mono whitespace-nowrap">{fmtTime(mark.time)}</span>}
                </div>
              ))}
            </div>

            {/* Video track */}
            <div className="flex h-12 gap-[2px] pt-1" style={{ width: timelineMaxDuration > 0 ? ((totalDuration / timelineMaxDuration) * 100) + '%' : '100%', minWidth: clips.length * 48 }}>
              {clips.map((clip, i) => {
                const dur = clip.endTime - clip.startTime
                const wp = totalDuration > 0 ? (dur / totalDuration) * 100 : 0
                const sel = selectedClipIndex === i && selectedTrack !== 'audio'
                const act = activeClipIndex === i
                return (
                  <div key={i} className={'relative h-full rounded-md flex items-center justify-center overflow-hidden transition-all cursor-pointer group ' + (sel ? 'ring-2 ring-pink-500 bg-teal-600/40' : act ? 'bg-teal-600/30' : 'bg-teal-700/20 hover:bg-teal-600/25')}
                    style={{ width: wp + '%', minWidth: 48 }}
                    onClick={e => { e.stopPropagation(); setSelectedClipIndex(i); setSelectedTrack('video'); seekToGlobal(clipTimeMap[i]?.globalStart ?? 0) }}>
                    {sel && <div className="absolute left-0 top-0 bottom-0 w-2 bg-pink-500 cursor-col-resize z-10 rounded-l-md hover:bg-pink-400 transition-colors" onMouseDown={e => handleTrimMouseDown(i, 'start', e)}><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" /></div>}
                    <div className="flex flex-col items-center gap-0.5 px-2">
                      <span className="text-[10px] font-semibold text-teal-200 whitespace-nowrap">{clip.label.length > 14 ? clip.label.slice(0, 14) + '...' : clip.label}</span>
                      <span className="text-[9px] text-teal-300/60 font-mono">{fmtTime(dur)}</span>
                    </div>
                    {sel && <div className="absolute right-0 top-0 bottom-0 w-2 bg-pink-500 cursor-col-resize z-10 rounded-r-md hover:bg-pink-400 transition-colors" onMouseDown={e => handleTrimMouseDown(i, 'end', e)}><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/60 rounded-full" /></div>}
                  </div>
                )
              })}
            </div>

            {/* Audio track */}
            <div className="h-9 mt-1">
              {musicFile && musicTrimmedDuration > 0 ? (
                <div className={'relative h-full rounded-md flex items-center overflow-hidden cursor-pointer transition-all ' + (selectedTrack === 'audio' ? 'ring-2 ring-emerald-400 bg-emerald-700/35' : 'bg-emerald-700/20 hover:bg-emerald-700/30')}
                  style={{ width: ((musicTrimmedDuration / timelineMaxDuration) * 100) + '%', minWidth: 48 }}
                  onClick={e => { e.stopPropagation(); setSelectedTrack('audio'); setSelectedClipIndex(null) }}>
                  {selectedTrack === 'audio' && (
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-400 cursor-col-resize z-10 rounded-l-md hover:bg-emerald-300 transition-colors" onMouseDown={e => handleAudioTrimMouseDown('start', e)}>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/60 rounded-full" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 min-w-0">
                    <Music className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-[9px] text-emerald-300/80 truncate">{musicFile.name}</span>
                    <span className="text-[8px] text-emerald-400/50 font-mono flex-shrink-0">{fmtTime(musicTrimmedDuration)}</span>
                  </div>
                  {selectedTrack === 'audio' && (
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-emerald-400 cursor-col-resize z-10 rounded-r-md hover:bg-emerald-300 transition-colors" onMouseDown={e => handleAudioTrimMouseDown('end', e)}>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/60 rounded-full" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full rounded-md border border-dashed border-[#222] flex items-center justify-center" style={{ width: ((totalDuration / timelineMaxDuration) * 100) + '%', minWidth: 48 }}>
                  <span className="text-[8px] text-gray-700">Sin musica</span>
                </div>
              )}
            </div>

            {/* Playhead — red line with draggable handle */}
            <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: playheadPct + '%' }}>
              {/* Draggable handle (triangle + hit area) */}
              <div className={'absolute -top-0.5 left-1/2 -translate-x-1/2 pointer-events-auto z-40 group ' + (isDraggingPlayhead ? 'cursor-grabbing' : 'cursor-grab')}
                onMouseDown={handlePlayheadMouseDown}>
                <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[10px] border-l-transparent border-r-transparent border-t-red-500 group-hover:border-t-red-400 transition-colors" />
                {/* Wider invisible hit area */}
                <div className="absolute -inset-x-3 -inset-y-1.5" />
              </div>
              {/* Vertical line */}
              <div className="absolute top-2.5 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-red-500/90" />
            </div>
          </div>
        </div>

        {/* Trim panel — video clip */}
        {showTrimPanel && selectedClipIndex !== null && clips[selectedClipIndex] && selectedTrack !== 'audio' && (
          <div className="px-3 pb-2 pt-1.5 border-t border-[#1a1a1a] space-y-1 flex-shrink-0">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-8">Inicio</label>
              <input type="range" min={0} max={clips[selectedClipIndex].duration} step={0.1} value={clips[selectedClipIndex].startTime}
                onChange={e => { const v = parseFloat(e.target.value); if (v < clips[selectedClipIndex!].endTime - 0.5) updateClip(selectedClipIndex!, { startTime: v }) }} className="flex-1 h-1 accent-teal-500" />
              <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{fmtTime(clips[selectedClipIndex].startTime)}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-8">Fin</label>
              <input type="range" min={0} max={clips[selectedClipIndex].duration} step={0.1} value={clips[selectedClipIndex].endTime}
                onChange={e => { const v = parseFloat(e.target.value); if (v > clips[selectedClipIndex!].startTime + 0.5) updateClip(selectedClipIndex!, { endTime: v }) }} className="flex-1 h-1 accent-teal-500" />
              <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{fmtTime(clips[selectedClipIndex].endTime)}</span>
            </div>
          </div>
        )}

        {/* Trim panel — audio */}
        {showTrimPanel && selectedTrack === 'audio' && musicFile && musicDuration > 0 && (
          <div className="px-3 pb-2 pt-1.5 border-t border-[#1a1a1a] space-y-1 flex-shrink-0">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-8">Inicio</label>
              <input type="range" min={0} max={musicDuration} step={0.1} value={musicStartTime}
                onChange={e => { const v = parseFloat(e.target.value); if (v < musicEndTime - 0.5) setMusicStartTime(v) }} className="flex-1 h-1 accent-emerald-500" />
              <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{fmtTime(musicStartTime)}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-gray-500 w-8">Fin</label>
              <input type="range" min={0} max={musicDuration} step={0.1} value={musicEndTime}
                onChange={e => { const v = parseFloat(e.target.value); if (v > musicStartTime + 0.5) setMusicEndTime(v) }} className="flex-1 h-1 accent-emerald-500" />
              <span className="text-[10px] text-gray-500 w-8 text-right font-mono">{fmtTime(musicEndTime)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Export overlay */}
      {showExportOverlay && exportedVideoUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-green-400">Video Exportado</h3>
                {savedToPizarra && <p className="text-[11px] text-emerald-400/80 mt-0.5">Guardado en la pizarra</p>}
              </div>
              <button onClick={() => setShowExportOverlay(false)} className="p-1 hover:bg-white/10 rounded transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <video src={exportedVideoUrl} controls className="w-full rounded-xl aspect-video object-contain bg-black mb-4" />
            <div className="flex gap-2">
              <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-semibold transition-colors"><Download className="w-4 h-4" />Descargar</button>
              <button onClick={handleCopyUrl} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#222] border border-[#333] hover:border-gray-500 text-white rounded-xl text-xs font-semibold transition-colors"><Copy className="w-4 h-4" />Copiar URL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
