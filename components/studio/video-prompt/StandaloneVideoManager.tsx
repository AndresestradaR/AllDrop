'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Check, X, RefreshCw, Film, Copy, FastForward, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { VIDEO_MODELS } from '@/lib/video-providers/types'
import type { VideoModelId } from '@/lib/video-providers/types'
import type { SceneData } from './StandaloneScriptGenerator'

type SceneStatus = 'pending' | 'generating' | 'polling' | 'completed' | 'error'

interface SceneState {
  status: SceneStatus
  taskId: string | null
  videoUrl: string | null
  error: string | null
  pollCount: number
  isExtending: boolean
  extendPrompt: string
}

interface StandaloneVideoManagerProps {
  scenes: SceneData[]
  modelId: VideoModelId
  aspectRatio: '16:9' | '9:16' | '1:1'
  enableAudio: boolean
  onBack: () => void
}

const MAX_CONCURRENT = 3
const MAX_POLLS = 60
const POLL_INTERVAL = 5000

export function StandaloneVideoManager({
  scenes,
  modelId,
  aspectRatio,
  enableAudio,
  onBack,
}: StandaloneVideoManagerProps) {
  const [sceneStates, setSceneStates] = useState<Map<number, SceneState>>(() => {
    const map = new Map<number, SceneState>()
    scenes.forEach((_, i) => {
      map.set(i, {
        status: 'pending',
        taskId: null,
        videoUrl: null,
        error: null,
        pollCount: 0,
        isExtending: false,
        extendPrompt: '',
      })
    })
    return map
  })

  const activeCountRef = useRef(0)
  const startedRef = useRef(false)
  const cancelledRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

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

  const pollScene = useCallback(async (index: number, taskId: string, scene: SceneData) => {
    let pollCount = 0
    const modelName = VIDEO_MODELS[modelId]?.name || modelId

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
        const params = new URLSearchParams({
          taskId,
          modelName,
          prompt: scene.veoPrompt.substring(0, 200),
          aspectRatio,
        })
        const res = await fetch(`/api/studio/video-status?${params}`)
        const data = await res.json()

        if (cancelledRef.current) return

        if (data.status === 'completed' && data.videoUrl) {
          updateScene(index, { status: 'completed', videoUrl: data.videoUrl, taskId })
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
  }, [modelId, aspectRatio, updateScene])

  const generateScene = useCallback(async (index: number, scene: SceneData) => {
    if (cancelledRef.current) return

    activeCountRef.current++
    updateScene(index, { status: 'generating' })

    try {
      const res = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          prompt: scene.veoPrompt,
          duration: 8,
          aspectRatio,
          enableAudio,
          resolution: '720p',
          veoSeed: Math.floor(Math.random() * 1000000),
        }),
      })

      const data = await res.json()

      if (!res.ok || (!data.success && !data.taskId)) {
        throw new Error(data.error || 'Error al generar video')
      }

      if (data.taskId) {
        updateScene(index, { status: 'polling', taskId: data.taskId })
        await pollScene(index, data.taskId, scene)
      } else if (data.videoUrl) {
        updateScene(index, { status: 'completed', videoUrl: data.videoUrl })
      }
    } catch (err: any) {
      updateScene(index, { status: 'error', error: err.message || 'Error desconocido' })
    } finally {
      activeCountRef.current--
    }
  }, [modelId, aspectRatio, enableAudio, updateScene, pollScene])

  const retryScene = (index: number) => {
    updateScene(index, {
      status: 'pending',
      taskId: null,
      videoUrl: null,
      error: null,
      pollCount: 0,
      isExtending: false,
      extendPrompt: '',
    })
  }

  const handleExtend = async (index: number) => {
    const state = sceneStates.get(index)
    if (!state?.taskId || !state.videoUrl) return

    const prompt = state.extendPrompt.trim() || scenes[index].veoPrompt

    updateScene(index, { isExtending: true })

    try {
      const veoModel = modelId === 'veo-3.1' ? 'veo3' : 'veo3_fast'
      const res = await fetch('/api/studio/extend-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: state.taskId,
          prompt,
          model: veoModel,
        }),
      })

      const data = await res.json()

      if (!data.success || !data.taskId) {
        throw new Error(data.error || 'Error al extender video')
      }

      // Poll the extended video
      updateScene(index, {
        status: 'polling',
        taskId: data.taskId,
        videoUrl: null,
        pollCount: 0,
        isExtending: false,
      })

      activeCountRef.current++
      await pollScene(index, data.taskId, { ...scenes[index], veoPrompt: prompt })
      activeCountRef.current--
    } catch (err: any) {
      toast.error(err.message || 'Error al extender video')
      updateScene(index, { isExtending: false })
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('URL copiada')
    } catch {
      toast.error('Error al copiar')
    }
  }

  // Queue processor: starts pending scenes respecting concurrency limit
  useEffect(() => {
    if (startedRef.current && activeCountRef.current === 0) {
      const states = Array.from(sceneStates.values())
      const allDone = states.every(s => s.status === 'completed' || s.status === 'error')
      if (allDone) {
        const completedCount = states.filter(s => s.status === 'completed').length
        if (completedCount === states.length) {
          toast.success(`${completedCount} videos generados!`)
        } else {
          toast.success(`${completedCount}/${states.length} videos completados`)
        }
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
  }, [sceneStates, scenes, generateScene])

  const completedCount = Array.from(sceneStates.values()).filter(s => s.status === 'completed').length
  const totalCount = scenes.length
  const progressPercent = (completedCount / totalCount) * 100
  const modelConfig = VIDEO_MODELS[modelId]
  const supportsExtend = modelConfig?.supportsExtend === true

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <Film className="w-4 h-4 text-accent" />
          Generacion Paralela — {modelConfig?.name || modelId}
        </h3>
        <span className="text-sm text-text-primary font-mono">
          {completedCount}/{totalCount} completadas
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scene cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenes.map((scene, i) => {
          const state = sceneStates.get(i)!

          return (
            <div
              key={i}
              className={`rounded-xl border p-4 transition-all ${
                state.status === 'pending'
                  ? 'border-border bg-surface-elevated'
                  : state.status === 'generating'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : state.status === 'polling'
                      ? 'border-blue-500/40 bg-blue-500/5'
                      : state.status === 'completed'
                        ? 'border-green-500/40 bg-green-500/5'
                        : 'border-red-500/40 bg-red-500/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-primary">Escena {scene.sceneNumber}</span>
                {state.status === 'pending' && (
                  <span className="text-[10px] text-text-muted">Pendiente</span>
                )}
                {state.status === 'generating' && (
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                )}
                {state.status === 'polling' && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-blue-400">#{state.pollCount}</span>
                  </div>
                )}
                {state.status === 'completed' && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
                {state.status === 'error' && (
                  <X className="w-4 h-4 text-red-400" />
                )}
              </div>

              <p className="text-[11px] text-text-secondary line-clamp-2 mb-2">{scene.action}</p>

              {state.status === 'completed' && state.videoUrl && (
                <div className="space-y-2">
                  <video
                    src={state.videoUrl}
                    className="w-full rounded-lg aspect-video object-contain bg-black"
                    controls
                    muted
                    playsInline
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleCopyUrl(state.videoUrl!)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-surface border border-border rounded-lg text-[10px] font-medium text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar URL
                    </button>
                    {supportsExtend && state.taskId && (
                      <button
                        onClick={() => updateScene(i, { isExtending: !state.isExtending })}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-[10px] font-medium text-violet-400 hover:bg-violet-500/20 transition-colors"
                      >
                        <FastForward className="w-3 h-3" />
                        Extender
                      </button>
                    )}
                  </div>

                  {/* Extend panel */}
                  {state.isExtending && supportsExtend && state.taskId && (
                    <div className="p-2 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-2">
                      <textarea
                        value={state.extendPrompt}
                        onChange={(e) => updateScene(i, { extendPrompt: e.target.value })}
                        placeholder="Prompt para continuacion (vacio = usa prompt original)"
                        rows={2}
                        maxLength={400}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-[11px] text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                      <button
                        onClick={() => handleExtend(i)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-violet-600 text-white rounded-lg text-[11px] font-semibold hover:bg-violet-500 transition-colors"
                      >
                        <FastForward className="w-3 h-3" />
                        Generar Extension
                      </button>
                    </div>
                  )}
                </div>
              )}

              {state.status === 'error' && (
                <div className="mt-1">
                  <p className="text-[10px] text-red-400 line-clamp-2 mb-1.5">{state.error}</p>
                  <button
                    onClick={() => retryScene(i)}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
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

      {/* Back button */}
      <button
        onClick={onBack}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-elevated text-text-secondary border border-border rounded-xl text-sm font-medium hover:text-text-primary hover:border-accent/50 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Configuracion
      </button>
    </div>
  )
}
