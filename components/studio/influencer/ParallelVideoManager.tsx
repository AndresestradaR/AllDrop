'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Check, X, RefreshCw, Film } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SceneData } from './SceneScriptGenerator'

type SceneStatus = 'pending' | 'generating' | 'polling' | 'completed' | 'error'

interface SceneState {
  status: SceneStatus
  taskId: string | null
  videoUrl: string | null
  error: string | null
  pollCount: number
}

interface ParallelVideoManagerProps {
  scenes: SceneData[]
  influencerId: string
  influencerName: string
  realisticImageUrl: string
  aspectRatio: '9:16' | '16:9' | '1:1'
  modelId: string
  onComplete: () => void
  onClose: () => void
}

const MAX_CONCURRENT = 3
const MAX_POLLS = 60
const POLL_INTERVAL = 5000

export function ParallelVideoManager({
  scenes,
  influencerId,
  influencerName,
  realisticImageUrl,
  aspectRatio,
  modelId,
  onComplete,
  onClose,
}: ParallelVideoManagerProps) {
  const [sceneStates, setSceneStates] = useState<Map<number, SceneState>>(() => {
    const map = new Map<number, SceneState>()
    scenes.forEach((_, i) => {
      map.set(i, { status: 'pending', taskId: null, videoUrl: null, error: null, pollCount: 0 })
    })
    return map
  })

  const activeCountRef = useRef(0)
  const startedRef = useRef(false)
  const cancelledRef = useRef(false)

  const updateScene = useCallback((index: number, update: Partial<SceneState>) => {
    setSceneStates(prev => {
      const next = new Map(prev)
      const current = next.get(index)
      if (current) {
        next.set(index, { ...current, ...update })
      }
      return next
    })
  }, [])

  const generateScene = useCallback(async (index: number, scene: SceneData) => {
    if (cancelledRef.current) return

    activeCountRef.current++
    updateScene(index, { status: 'generating' })

    try {
      // Start video generation
      const res = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          prompt: scene.veoPrompt,
          duration: 8,
          aspectRatio,
          enableAudio: true,
          resolution: '720p',
          imageUrl: realisticImageUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok || (!data.success && !data.taskId)) {
        throw new Error(data.error || 'Error al generar video')
      }

      if (data.taskId) {
        updateScene(index, { status: 'polling', taskId: data.taskId })
        // Start polling
        await pollScene(index, data.taskId, scene)
      } else if (data.videoUrl) {
        updateScene(index, { status: 'completed', videoUrl: data.videoUrl })
        await saveToGallery(data.videoUrl, scene)
      }
    } catch (err: any) {
      updateScene(index, { status: 'error', error: err.message || 'Error desconocido' })
    } finally {
      activeCountRef.current--
    }
  }, [aspectRatio, realisticImageUrl, modelId, updateScene])

  const pollScene = async (index: number, taskId: string, scene: SceneData) => {
    let pollCount = 0

    const poll = async (): Promise<void> => {
      if (cancelledRef.current || pollCount >= MAX_POLLS) {
        if (pollCount >= MAX_POLLS) {
          updateScene(index, { status: 'error', error: 'Timeout: el video tardo demasiado' })
        }
        return
      }

      pollCount++
      updateScene(index, { pollCount })

      try {
        const res = await fetch(`/api/studio/video-status?taskId=${taskId}`)
        const data = await res.json()

        if (cancelledRef.current) return

        if (data.status === 'completed' && data.videoUrl) {
          updateScene(index, { status: 'completed', videoUrl: data.videoUrl })
          await saveToGallery(data.videoUrl, scene)
          return
        }

        if (data.status === 'failed') {
          updateScene(index, { status: 'error', error: data.error || 'Video fallo' })
          return
        }

        // Still processing
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
        return poll()
      } catch {
        // Network error, retry with longer delay
        await new Promise(resolve => setTimeout(resolve, 8000))
        return poll()
      }
    }

    // Initial delay to let KIE register the task
    await new Promise(resolve => setTimeout(resolve, 3000))
    return poll()
  }

  const saveToGallery = async (videoUrl: string, scene: SceneData) => {
    try {
      await fetch('/api/studio/influencer/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          image_url: videoUrl,
          video_url: videoUrl,
          content_type: 'video',
          type: 'solo',
          situation: `Escena ${scene.sceneNumber}: ${scene.action}`,
          prompt_used: scene.veoPrompt,
        }),
      })
    } catch {
      // Silent fail for gallery save
    }
  }

  const retryScene = (index: number) => {
    updateScene(index, { status: 'pending', taskId: null, videoUrl: null, error: null, pollCount: 0 })
  }

  // Queue processor: starts pending scenes respecting concurrency limit
  useEffect(() => {
    if (startedRef.current && activeCountRef.current === 0) {
      // Check if all done
      const states = Array.from(sceneStates.values())
      const allDone = states.every(s => s.status === 'completed' || s.status === 'error')
      if (allDone) {
        const completedCount = states.filter(s => s.status === 'completed').length
        if (completedCount === states.length) {
          toast.success(`${completedCount} videos generados!`)
        } else {
          toast.success(`${completedCount}/${states.length} videos completados`)
        }
        onComplete()
        return
      }
    }

    // Find pending scenes and start them
    const pendingIndices: number[] = []
    sceneStates.forEach((state, index) => {
      if (state.status === 'pending') pendingIndices.push(index)
    })

    const slotsAvailable = MAX_CONCURRENT - activeCountRef.current
    const toStart = pendingIndices.slice(0, slotsAvailable)

    if (toStart.length > 0) {
      startedRef.current = true
      toStart.forEach(index => {
        generateScene(index, scenes[index])
      })
    }
  }, [sceneStates, scenes, generateScene, onComplete])

  const completedCount = Array.from(sceneStates.values()).filter(s => s.status === 'completed').length
  const totalCount = scenes.length
  const progressPercent = (completedCount / totalCount) * 100

  return (
    <div className="mt-4 p-4 rounded-2xl border border-teal-500/30 bg-[#111]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
          <Film className="w-4 h-4" />
          Generacion Paralela
        </h3>
        <span className="text-xs text-[#e5e5e5] font-mono">
          {completedCount}/{totalCount} completadas
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#333] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scene cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {scenes.map((scene, i) => {
          const state = sceneStates.get(i)!

          return (
            <div
              key={i}
              className={`rounded-xl border p-3 transition-all ${
                state.status === 'pending'
                  ? 'border-[#333] bg-[#1a1a1a]'
                  : state.status === 'generating'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : state.status === 'polling'
                      ? 'border-blue-500/40 bg-blue-500/5'
                      : state.status === 'completed'
                        ? 'border-teal-500/40 bg-teal-500/5'
                        : 'border-red-500/40 bg-red-500/5'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-[#e5e5e5]">Escena {scene.sceneNumber}</span>
                {state.status === 'pending' && (
                  <span className="text-[9px] text-text-muted">Pendiente</span>
                )}
                {state.status === 'generating' && (
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                )}
                {state.status === 'polling' && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-[9px] text-blue-400">#{state.pollCount}</span>
                  </div>
                )}
                {state.status === 'completed' && (
                  <Check className="w-3.5 h-3.5 text-teal-400" />
                )}
                {state.status === 'error' && (
                  <X className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>

              <p className="text-[10px] text-[#999] line-clamp-2 mb-1.5">{scene.action}</p>

              {state.status === 'completed' && state.videoUrl && (
                <video
                  src={state.videoUrl}
                  className="w-full rounded-lg aspect-video object-contain bg-black mt-1"
                  controls
                  muted
                  playsInline
                />
              )}

              {state.status === 'error' && (
                <div className="mt-1">
                  <p className="text-[9px] text-red-400 line-clamp-2 mb-1">{state.error}</p>
                  <button
                    onClick={() => retryScene(i)}
                    className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#222] text-[#e5e5e5] rounded-xl text-xs font-medium hover:bg-[#333] border border-[#333] transition-colors"
      >
        Cerrar
      </button>
    </div>
  )
}
