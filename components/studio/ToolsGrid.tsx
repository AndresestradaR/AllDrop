'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  Layers,
  Maximize2,
  Eraser,
  RotateCcw,
  Smartphone,
  Mic2,
  X,
  ArrowLeft,
  Sparkles,
  Upload,
  Loader2,
  Music,
  Download,
  Share2,
  Play,
  Pause,
  Check,
  Hash,
  Video,
  MessageSquare,
  UserCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PublisherModal } from './PublisherModal'
import { PromptBotGenerator } from './PromptBotGenerator'
import { PersonDescriptor } from './PersonDescriptor'
import { VideoPromptStudio } from './video-prompt/VideoPromptStudio'

// Lip Sync Models
type LipSyncModel = 'kling' | 'infinitalk'

const LIP_SYNC_MODELS = [
  {
    id: 'kling' as LipSyncModel,
    name: 'Kling AI Avatar',
    description: 'Sincronización básica de labios',
    apiModel: 'kling/ai-avatar-standard',
  },
  {
    id: 'infinitalk' as LipSyncModel,
    name: 'Infinitalk',
    description: 'Alta calidad con prompt y configuración avanzada',
    apiModel: 'infinitalk/from-audio',
  },
]

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

interface Tool {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  soon?: boolean
  adminOnly?: boolean // visible but locked for non-admin users
  requiresAudio?: boolean
  outputsVideo?: boolean
}

const TOOLS: Tool[] = [
  {
    id: 'variations',
    name: 'Variaciones',
    description: 'Genera variantes de una imagen',
    icon: Layers,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'upscale',
    name: 'Mejorar Imagen',
    description: 'Aumenta la resolucion (Upscaler)',
    icon: Maximize2,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'remove-bg',
    name: 'Quitar Fondo',
    description: 'Elimina el fondo de imagenes',
    icon: Eraser,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'camera-angle',
    name: 'Cambiar Angulo',
    description: 'Cambia la perspectiva de la camara',
    icon: RotateCcw,
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'mockup',
    name: 'Mockup Generator',
    description: 'Crea mockups de productos',
    icon: Smartphone,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'lip-sync',
    name: 'Lip Sync',
    description: 'Sincroniza labios con audio',
    icon: Mic2,
    color: 'from-rose-500 to-pink-500',
    requiresAudio: true,
    outputsVideo: true,
  },
  {
    id: 'prompt-video',
    name: 'Video Prompt Studio',
    description: 'Genera guiones y videos con IA por escenas',
    icon: Video,
    color: 'from-violet-500 to-purple-500',
  },
  {
    id: 'prompt-bot',
    name: 'Prompt Bot',
    description: 'Genera system prompts para bots de ventas',
    icon: MessageSquare,
    color: 'from-green-500 to-emerald-500',
    soon: true,
    adminOnly: true,
  },
  {
    id: 'person-descriptor',
    name: 'Descriptor de Persona',
    description: 'Descripcion 4K para videos IA (2 tecnicas)',
    icon: UserCircle,
    color: 'from-amber-500 to-orange-500',
  },
]

type ActiveTool = typeof TOOLS[number]['id'] | null

export function ToolsGrid() {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [resultVideo, setResultVideo] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [publishResult, setPublishResult] = useState<{
    base64?: string
    mimeType?: string
    url?: string
    type: 'photo' | 'video'
  } | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const audioPreviewRef = useRef<HTMLAudioElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const isAdmin = userEmail === ADMIN_EMAIL

  // Lip Sync specific state
  const [lipSyncModel, setLipSyncModel] = useState<LipSyncModel>('kling')
  const [infinitalkPrompt, setInfinitalkPrompt] = useState('')
  const [infinitalkResolution, setInfinitalkResolution] = useState<'480p' | '720p'>('720p')
  const [infinitalkSeed, setInfinitalkSeed] = useState<number>(Math.floor(Math.random() * (1000000 - 10000 + 1)) + 10000)

  const currentTool = TOOLS.find((t) => t.id === activeTool)

  // Fetch user email for admin check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null)
    })
  }, [])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      setResultImage(null)
      setResultVideo(null)
    }
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedAudio(file)
      setResultVideo(null)
    }
  }

  const toggleAudioPreview = () => {
    if (audioPreviewRef.current) {
      if (isPlaying) {
        audioPreviewRef.current.pause()
      } else {
        audioPreviewRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const pollForLipSyncResult = async (taskId: string) => {
    let attempts = 0
    const maxAttempts = 200 // ~10 minutes with 3s interval

    pollingRef.current = setInterval(async () => {
      attempts++

      if (attempts > maxAttempts) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setIsProcessing(false)
        setProcessingStatus('')
        toast.error('Tiempo de espera agotado')
        return
      }

      try {
        const response = await fetch(`/api/studio/tools?taskId=${taskId}`)
        const data = await response.json()

        if (data.status === 'completed' && data.videoUrl) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setResultVideo(data.videoUrl)
          setIsProcessing(false)
          setProcessingStatus('')
          toast.success('Video generado exitosamente')
        } else if (!data.success && data.error) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setIsProcessing(false)
          setProcessingStatus('')
          toast.error(data.error)
        } else {
          // Still processing
          setProcessingStatus(`Generando video... (${Math.round((attempts / maxAttempts) * 100)}%)`)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 3000)
  }

  const handleProcess = async () => {
    if (!uploadedImage || !activeTool) return

    // Lip sync requires audio
    if (currentTool?.requiresAudio && !uploadedAudio) {
      toast.error('Necesitas subir un audio')
      return
    }

    setIsProcessing(true)
    setProcessingStatus(currentTool?.outputsVideo ? 'Iniciando...' : '')

    try {
      const formData = new FormData()
      formData.append('image', uploadedImage)
      formData.append('tool', activeTool)

      if (uploadedAudio && currentTool?.requiresAudio) {
        formData.append('audio', uploadedAudio)
      }

      // Add lip sync specific fields
      if (activeTool === 'lip-sync') {
        formData.append('lipSyncModel', lipSyncModel)
        formData.append('prompt', infinitalkPrompt) // Send prompt for both models
        if (lipSyncModel === 'infinitalk') {
          formData.append('resolution', infinitalkResolution)
          formData.append('seed', infinitalkSeed.toString())
        }
      }

      const response = await fetch('/api/studio/tools', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error procesando')
      }

      // For lip sync, we get a taskId and need to poll
      if (data.taskId && currentTool?.outputsVideo) {
        setProcessingStatus('Procesando video...')
        pollForLipSyncResult(data.taskId)
        return
      }

      // For image tools, we get the result immediately
      if (data.success && data.imageBase64) {
        setResultImage(`data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`)
        toast.success('Imagen procesada exitosamente')
      }
    } catch (error) {
      console.error('Processing error:', error)
      toast.error(error instanceof Error ? error.message : 'Error procesando')
    } finally {
      if (!currentTool?.outputsVideo) {
        setIsProcessing(false)
      }
    }
  }

  const handleDownload = () => {
    if (resultImage) {
      const link = document.createElement('a')
      link.href = resultImage
      link.download = `${activeTool}-${Date.now()}.png`
      link.click()
    } else if (resultVideo) {
      const link = document.createElement('a')
      link.href = resultVideo
      link.download = `lip-sync-${Date.now()}.mp4`
      link.click()
    }
  }

  const resetTool = () => {
    setUploadedImage(null)
    setUploadedAudio(null)
    setResultImage(null)
    setResultVideo(null)
    setProcessingStatus('')
    setIsPlaying(false)
    // Reset lip sync specific state
    setLipSyncModel('kling')
    setInfinitalkPrompt('')
    setInfinitalkResolution('720p')
    setInfinitalkSeed(Math.floor(Math.random() * (1000000 - 10000 + 1)) + 10000)
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const generateNewSeed = () => {
    setInfinitalkSeed(Math.floor(Math.random() * (1000000 - 10000 + 1)) + 10000)
  }

  // Filter tools: adminOnly tools hidden for non-admin, admin bypasses soon
  const visibleTools = useMemo(() =>
    TOOLS.filter(t => !t.adminOnly || isAdmin).map(t =>
      isAdmin && t.adminOnly ? { ...t, soon: false } : t
    ),
    [isAdmin]
  )

  // Prompt Generator tools (separate full-screen components)
  if (activeTool === 'prompt-video') {
    return <VideoPromptStudio onBack={() => { setActiveTool(null); resetTool() }} />
  }

  if (activeTool === 'prompt-bot') {
    return <PromptBotGenerator onBack={() => { setActiveTool(null); resetTool() }} />
  }

  if (activeTool === 'person-descriptor') {
    return <PersonDescriptor onBack={() => { setActiveTool(null); resetTool() }} />
  }

  // Tool interface view
  if (activeTool && currentTool) {
    const isLipSync = currentTool.requiresAudio

    return (
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
            <button
              onClick={() => {
                setActiveTool(null)
                resetTool()
              }}
              className="p-2 hover:bg-border/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br',
                  currentTool.color
                )}
              >
                <currentTool.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {currentTool.name}
                </h2>
                <p className="text-sm text-text-secondary">{currentTool.description}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 flex gap-6 overflow-hidden">
            {/* Upload / Input Section */}
            <div className={cn('flex flex-col', isLipSync ? 'w-1/3 overflow-y-auto' : 'flex-1')}>
              {/* Image Upload */}
              <label className="block text-sm font-medium text-text-secondary mb-3">
                {isLipSync ? 'Imagen (cara/persona)' : 'Imagen original'}
              </label>
              {uploadedImage ? (
                <div className={cn(
                  'relative bg-surface-elevated rounded-xl overflow-hidden',
                  isLipSync ? 'h-48' : 'flex-1'
                )}>
                  <img
                    src={URL.createObjectURL(uploadedImage)}
                    alt="Uploaded"
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => {
                      setUploadedImage(null)
                      setResultImage(null)
                      setResultVideo(null)
                    }}
                    className="absolute top-3 right-3 p-2 bg-error/80 hover:bg-error rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className={cn(
                  'flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors',
                  isLipSync ? 'h-48' : 'flex-1'
                )}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Upload className="w-10 h-10 text-text-secondary mb-3" />
                  <p className="text-text-primary font-medium text-sm">
                    Arrastra o haz click
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    PNG, JPG hasta 10MB
                  </p>
                </label>
              )}

              {/* Lip Sync Model Selector */}
              {isLipSync && (
                <div className="mt-5">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Modelo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LIP_SYNC_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setLipSyncModel(model.id)}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all',
                          lipSyncModel === model.id
                            ? 'border-accent bg-accent/10'
                            : 'border-border hover:border-accent/50 bg-surface-elevated'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <p className={cn(
                            'text-sm font-medium',
                            lipSyncModel === model.id ? 'text-accent' : 'text-text-primary'
                          )}>
                            {model.name}
                          </p>
                          {lipSyncModel === model.id && (
                            <Check className="w-4 h-4 text-accent" />
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {model.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Upload (for Lip Sync) */}
              {isLipSync && (
                <>
                  <label className="block text-sm font-medium text-text-secondary mb-3 mt-5">
                    Audio (voz para sincronizar) *
                  </label>
                  {uploadedAudio ? (
                    <div className="relative bg-surface-elevated rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={toggleAudioPreview}
                          className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 text-white" />
                          ) : (
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {uploadedAudio.name}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {(uploadedAudio.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setUploadedAudio(null)
                            setResultVideo(null)
                            setIsPlaying(false)
                          }}
                          className="p-2 hover:bg-error/20 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-error" />
                        </button>
                      </div>
                      <audio
                        ref={audioPreviewRef}
                        src={URL.createObjectURL(uploadedAudio)}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioUpload}
                      />
                      <Music className="w-8 h-8 text-text-secondary mb-2" />
                      <p className="text-text-primary font-medium text-sm">
                        Subir audio
                      </p>
                      <p className="text-xs text-text-secondary mt-1">
                        MP3, WAV, M4A {lipSyncModel === 'infinitalk' && '(máx 15s)'}
                      </p>
                    </label>
                  )}
                </>
              )}

              {/* Infinitalk-specific fields */}
              {/* Prompt (for both Lip Sync models) */}
              {isLipSync && (
                <div className="mt-5">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Prompt <span className="text-text-muted">(opcional)</span>
                  </label>
                  <textarea
                    value={infinitalkPrompt}
                    onChange={(e) => setInfinitalkPrompt(e.target.value)}
                    placeholder="Describe gestos o expresiones adicionales..."
                    rows={2}
                    maxLength={5000}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    {infinitalkPrompt.length}/5000 caracteres
                  </p>
                </div>
              )}

              {/* Resolution & Seed (Infinitalk only) */}
              {isLipSync && lipSyncModel === 'infinitalk' && (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {/* Resolution */}
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Resolución
                      </label>
                      <select
                        value={infinitalkResolution}
                        onChange={(e) => setInfinitalkResolution(e.target.value as '480p' | '720p')}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                      </select>
                    </div>

                    {/* Seed */}
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Seed <span className="text-text-muted">(opcional)</span>
                      </label>
                      <div className="flex gap-1">
                        <div className="relative flex-1">
                          <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                          <input
                            type="number"
                            min={10000}
                            max={1000000}
                            value={infinitalkSeed}
                            onChange={(e) => {
                              const val = parseInt(e.target.value)
                              if (val >= 10000 && val <= 1000000) {
                                setInfinitalkSeed(val)
                              }
                            }}
                            className="w-full pl-7 pr-2 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                        <button
                          onClick={generateNewSeed}
                          className="px-2.5 py-2 bg-surface-elevated border border-border rounded-lg hover:border-accent/50 transition-colors"
                          title="Nuevo seed"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-text-secondary" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Result Section */}
            <div className={cn('flex flex-col', isLipSync ? 'flex-1' : 'flex-1')}>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Resultado
              </label>
              <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
                {resultVideo ? (
                  <video
                    ref={videoRef}
                    src={resultVideo}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay
                  />
                ) : resultImage ? (
                  <img
                    src={resultImage}
                    alt="Result"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                        <p className="text-text-primary font-medium">
                          {processingStatus || 'Procesando...'}
                        </p>
                        <p className="text-sm text-text-secondary mt-1">
                          Esto puede tardar unos momentos
                        </p>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                        <p className="text-text-secondary">
                          El resultado aparecera aqui
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <button
              onClick={resetTool}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Limpiar
            </button>
            <div className="flex items-center gap-3">
              {(resultImage || resultVideo) && (
                <>
                  <button
                    onClick={() => {
                      if (resultVideo) {
                        setPublishResult({ url: resultVideo, type: 'video' })
                      } else if (resultImage) {
                        const base64Part = resultImage.split(',')[1]
                        const mimeType = resultImage.split(';')[0]?.split(':')[1] || 'image/png'
                        setPublishResult({ base64: base64Part, mimeType, type: 'photo' })
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                    title="Publicar en redes"
                  >
                    <Share2 className="w-4 h-4" />
                    Publicar
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-border/50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </button>
                </>
              )}
              <button
                onClick={handleProcess}
                disabled={!uploadedImage || isProcessing || (isLipSync && !uploadedAudio)}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
                  !uploadedImage || isProcessing || (isLipSync && !uploadedAudio)
                    ? 'bg-border text-text-secondary cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-background'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {isLipSync ? 'Generar Video' : 'Procesar'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Publisher Modal */}
        <PublisherModal
          isOpen={!!publishResult}
          onClose={() => setPublishResult(null)}
          mediaBase64={publishResult?.base64}
          mediaUrl={publishResult?.url}
          mediaContentType={publishResult?.mimeType}
          contentType={publishResult?.type || 'photo'}
          previewUrl={
            publishResult?.url ||
            (publishResult?.base64 ? `data:${publishResult.mimeType || 'image/png'};base64,${publishResult.base64}` : undefined)
          }
        />
      </div>
    )
  }

  // Grid view
  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Herramientas IA</h2>
        <p className="text-text-secondary">
          Herramientas de edicion y procesamiento de imagenes con IA
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {visibleTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => !tool.soon && setActiveTool(tool.id)}
            disabled={tool.soon}
            className={cn(
              'relative p-6 bg-surface rounded-2xl border border-border text-left transition-all duration-200',
              tool.soon
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-1'
            )}
          >
            {tool.soon && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-border text-text-secondary rounded">
                Próximamente
              </span>
            )}
            {tool.outputsVideo && !tool.soon && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded">
                Video
              </span>
            )}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4',
                tool.color
              )}
            >
              <tool.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {tool.name}
            </h3>
            <p className="text-sm text-text-secondary">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
