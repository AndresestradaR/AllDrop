'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  Video,
  ChevronDown,
  ImageIcon,
  Sparkles,
  Loader2,
  Download,
  X,
  Check,
  Clock,
  Zap,
  Film,
  Volume2,
  VolumeX,
  Layers,
  Play,
  Type,
  Images,
  Users,
  Hash,
  Plus,
  Trash2,
  UserCircle,
} from 'lucide-react'
import {
  VIDEO_MODELS,
  VIDEO_COMPANY_GROUPS,
  type VideoModelId,
  type VideoModelConfig,
} from '@/lib/video-providers/types'

type VideoAspectRatio = '16:9' | '9:16' | '1:1'

// Veo generation types
type VeoGenerationType = 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO'

const VEO_GENERATION_TYPES = [
  {
    id: 'TEXT_2_VIDEO' as VeoGenerationType,
    name: 'Text to Video',
    description: 'Genera video solo con prompt',
    icon: Type,
    imagesRequired: 0,
    imagesMax: 0,
  },
  {
    id: 'FIRST_AND_LAST_FRAMES_2_VIDEO' as VeoGenerationType,
    name: 'First/Last Frames',
    description: '1-2 imágenes como frames inicial/final',
    icon: Film,
    imagesRequired: 1,
    imagesMax: 2,
  },
  {
    id: 'REFERENCE_2_VIDEO' as VeoGenerationType,
    name: 'Reference to Video',
    description: '1-3 imágenes de referencia (solo veo3_fast)',
    icon: Images,
    imagesRequired: 1,
    imagesMax: 3,
    modelRestriction: 'veo3_fast',
  },
]

interface GeneratedVideo {
  id: string
  url: string
  prompt: string
  model: string
  timestamp: Date
  duration: string
  aspectRatio: string
}

// Tag styling config
const TAG_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  NEW: { label: 'NUEVO', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Sparkles className="w-2.5 h-2.5" /> },
  FAST: { label: 'RÁPIDO', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Zap className="w-2.5 h-2.5" /> },
  PREMIUM: { label: 'PREMIUM', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Sparkles className="w-2.5 h-2.5" /> },
  AUDIO: { label: 'AUDIO', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Volume2 className="w-2.5 h-2.5" /> },
  REFERENCES: { label: 'REFS', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <ImageIcon className="w-2.5 h-2.5" /> },
  MULTI_SHOTS: { label: 'MULTI-SHOT', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <Layers className="w-2.5 h-2.5" /> },
  RECOMENDADO: { label: '⭐ TOP', color: 'bg-accent/20 text-accent border-accent/30', icon: null },
  IMG2VID: { label: 'IMG→VID', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30', icon: <Film className="w-2.5 h-2.5" /> },
}

export function VideoGenerator() {
  // Model selection - default to an affordable recommended model
  const [selectedModel, setSelectedModel] = useState<VideoModelId>('hailuo-2.3-standard')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  // Veo-specific options
  const [veoGenerationType, setVeoGenerationType] = useState<VeoGenerationType>('TEXT_2_VIDEO')
  const [veoImages, setVeoImages] = useState<{ file: File; preview: string }[]>([])
  const [veoSeed, setVeoSeed] = useState<number>(Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000)

  // Input image (for image-to-video - legacy for non-Veo models)
  const [inputImage, setInputImage] = useState<{ file: File; preview: string } | null>(null)

  // Generation options
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<number>(6)
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9')
  const [resolution, setResolution] = useState<string>('768p')
  const [enableAudio, setEnableAudio] = useState(true)

  // State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingStatus, setGeneratingStatus] = useState<string>('')
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedVideo[]>([])
  const [error, setError] = useState<string | null>(null)

  // Kling 3.0 multi-shot state
  const [multiShotEnabled, setMultiShotEnabled] = useState(false)
  const [multiPrompts, setMultiPrompts] = useState<{ prompt: string; duration: number }[]>([
    { prompt: '', duration: 3 },
    { prompt: '', duration: 3 },
  ])

  // Kling 3.0 element references state
  const [klingElements, setKlingElements] = useState<{
    name: string
    description: string
    images: { file: File; preview: string }[]
  }[]>([])

  // Refs
  const inputImageRef = useRef<HTMLInputElement>(null)
  const veoImageRefs = useRef<(HTMLInputElement | null)[]>([])
  const elementImageRefs = useRef<(HTMLInputElement | null)[]>([])

  // Check if current model is Veo
  const isVeoModel = selectedModel.startsWith('veo')
  const isKling30 = selectedModel === 'kling-3.0'

  const currentModel = VIDEO_MODELS[selectedModel]

  // Poll for video status
  const pollForStatus = async (taskId: string): Promise<{ success: boolean; videoUrl?: string; error?: string }> => {
    const maxAttempts = 200 // ~10 minutes at 3s intervals
    const interval = 3000 // 3 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        setGeneratingStatus(`Procesando video... (${Math.floor(attempt * 3 / 60)}:${String((attempt * 3) % 60).padStart(2, '0')})`)

        const response = await fetch(`/api/studio/video-status?taskId=${taskId}`)
        const data = await response.json()

        if (data.status === 'completed' && data.videoUrl) {
          return { success: true, videoUrl: data.videoUrl }
        }

        if (data.status === 'failed') {
          return { success: false, error: data.error || 'Error al generar video' }
        }

        // Still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, interval))
      } catch (err) {
        console.error('Polling error:', err)
        // Continue polling even if one request fails
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }

    return { success: false, error: 'Timeout: el video tardó demasiado en generarse' }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    // Validate Veo images if applicable
    if (isVeoModel && !validateVeoImages()) {
      setError(`Se requieren ${currentVeoType?.imagesRequired}-${currentVeoType?.imagesMax} imágenes para este modo`)
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratingStatus('Iniciando generación...')

    try {
      // Convert image to base64 if present (for non-Veo models)
      let imageBase64: string | undefined
      let veoImagesBase64: string[] = []

      if (isVeoModel && veoImages.length > 0) {
        setGeneratingStatus('Subiendo imágenes...')
        veoImagesBase64 = await Promise.all(
          veoImages.filter(img => img).map(img => fileToBase64(img.file))
        )
      } else if (inputImage && currentModel.supportsStartEndFrames) {
        setGeneratingStatus('Subiendo imagen...')
        imageBase64 = await fileToBase64(inputImage.file)
      }

      setGeneratingStatus('Creando tarea de video...')

      // Build request body
      const requestBody: Record<string, any> = {
        modelId: selectedModel,
        prompt,
        duration,
        aspectRatio,
        resolution,
        enableAudio: currentModel.supportsAudio ? enableAudio : false,
      }

      // Add Veo-specific parameters
      if (isVeoModel) {
        requestBody.veoGenerationType = veoGenerationType
        requestBody.veoSeed = veoSeed
        if (veoImagesBase64.length > 0) {
          requestBody.veoImages = veoImagesBase64
        }
      } else if (imageBase64) {
        requestBody.imageBase64 = imageBase64
      }

      // Kling 3.0 multi-shot and element references
      if (isKling30) {
        if (multiShotEnabled && multiPrompts.some(p => p.prompt.trim())) {
          requestBody.multiShots = true
          requestBody.multiPrompt = multiPrompts.filter(p => p.prompt.trim())
        }
        if (klingElements.length > 0) {
          // Convert element images to base64
          const elementsWithBase64 = await Promise.all(
            klingElements.map(async (el) => ({
              name: el.name,
              description: el.description,
              images: await Promise.all(el.images.map(img => fileToBase64(img.file))),
            }))
          )
          requestBody.klingElements = elementsWithBase64
        }
      }

      const response = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al iniciar generación')
      }

      if (!data.taskId) {
        throw new Error('No se recibió taskId del servidor')
      }

      // Poll for result from frontend
      setGeneratingStatus('Video en cola, esperando...')
      const result = await pollForStatus(data.taskId)

      if (!result.success) {
        throw new Error(result.error || 'Error al generar video')
      }

      // Add to gallery
      setGeneratedVideos((prev) => [
        {
          id: Date.now().toString(),
          url: result.videoUrl!,
          prompt,
          model: currentModel.name,
          timestamp: new Date(),
          duration: `${duration}s`,
          aspectRatio,
        },
        ...prev,
      ])

      setGeneratingStatus('')
    } catch (err: any) {
      setError(err.message)
      setGeneratingStatus('')
    } finally {
      setIsGenerating(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (value: { file: File; preview: string } | null) => void
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      setter({ file, preview: URL.createObjectURL(file) })
    }
  }

  // Handle Veo image selection
  const handleVeoImageSelect = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (file) {
      const newImages = [...veoImages]
      newImages[index] = { file, preview: URL.createObjectURL(file) }
      setVeoImages(newImages)
    }
  }

  // Remove Veo image
  const removeVeoImage = (index: number) => {
    const newImages = veoImages.filter((_, i) => i !== index)
    setVeoImages(newImages)
  }

  // Get current Veo generation type config
  const currentVeoType = VEO_GENERATION_TYPES.find(t => t.id === veoGenerationType)

  // Validate Veo images
  const validateVeoImages = () => {
    if (!isVeoModel) return true
    if (!currentVeoType) return true

    const validImages = veoImages.filter(img => img !== null && img !== undefined)

    if (veoGenerationType === 'TEXT_2_VIDEO') return true
    if (validImages.length < currentVeoType.imagesRequired) return false
    if (validImages.length > currentVeoType.imagesMax) return false

    return true
  }

  // Generate random seed
  const generateNewSeed = () => {
    setVeoSeed(Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000)
  }

  const getDurationOptions = () => {
    const range = currentModel.durationRange.match(/(\d+)-(\d+)/)
    if (!range) return [5, 10]
    const min = parseInt(range[1])
    const max = parseInt(range[2])
    const options = []
    for (let i = min; i <= max; i++) {
      options.push(i)
    }
    return options
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel - Controls */}
      <div className="w-[420px] flex-shrink-0 bg-surface rounded-2xl border border-border p-5 overflow-y-auto">
        <div className="space-y-5">
          {/* Model Selector */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Modelo
            </label>
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated border border-border rounded-xl hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
                    <Video className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-text-primary">
                      {currentModel.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {currentModel.companyName} · {currentModel.priceRange}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'w-5 h-5 text-text-secondary transition-transform',
                    isModelDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl z-50 p-2 max-h-[400px] overflow-y-auto">
                  {VIDEO_COMPANY_GROUPS.map((group) => (
                    <div key={group.id} className="mb-3 last:mb-0">
                      <p className="px-3 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {group.name}
                      </p>
                      {group.models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id)
                            setResolution(model.defaultResolution)
                            const range = model.durationRange.match(/(\d+)-(\d+)/)
                            if (range) {
                              setDuration(parseInt(range[1]))
                            }
                            // Reset Veo generation type if switching to veo-3.1 and current type is REFERENCE_2_VIDEO
                            if (model.id === 'veo-3.1' && veoGenerationType === 'REFERENCE_2_VIDEO') {
                              setVeoGenerationType('TEXT_2_VIDEO')
                              setVeoImages([])
                            }
                            // Reset Veo settings when switching away from Veo models
                            if (!model.id.startsWith('veo') && selectedModel.startsWith('veo')) {
                              setVeoGenerationType('TEXT_2_VIDEO')
                              setVeoImages([])
                            }
                            // Reset Kling 3.0 settings when switching away
                            if (model.id !== 'kling-3.0' && selectedModel === 'kling-3.0') {
                              setMultiShotEnabled(false)
                              setMultiPrompts([{ prompt: '', duration: 3 }, { prompt: '', duration: 3 }])
                              setKlingElements([])
                            }
                            setIsModelDropdownOpen(false)
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                            selectedModel === model.id
                              ? 'bg-accent/10 text-accent'
                              : 'hover:bg-border/50 text-text-primary'
                          )}
                        >
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br',
                            group.color
                          )}>
                            <Video className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{model.name}</p>
                              {model.tags?.slice(0, 3).map((tag) => {
                                const config = TAG_CONFIG[tag]
                                if (!config) return null
                                return (
                                  <span
                                    key={tag}
                                    className={cn(
                                      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border',
                                      config.color
                                    )}
                                  >
                                    {config.icon}
                                    {config.label}
                                  </span>
                                )
                              })}
                            </div>
                            <p className="text-xs text-text-secondary">
                              {model.durationRange} · {model.priceRange}
                            </p>
                          </div>
                          {selectedModel === model.id && (
                            <Check className="w-4 h-4 text-accent" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Model Features */}
          <div className="flex flex-wrap gap-2">
            {currentModel.supportsAudio && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Volume2 className="w-3 h-3" /> Audio
              </span>
            )}
            {currentModel.supportsStartEndFrames && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Film className="w-3 h-3" /> Image-to-Video
              </span>
            )}
            {currentModel.supportsMultiShots && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Layers className="w-3 h-3" /> Multi-shots
              </span>
            )}
          </div>

          {/* Veo Generation Type Selector */}
          {isVeoModel && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Tipo de Generación
              </label>
              <div className="grid grid-cols-1 gap-2">
                {VEO_GENERATION_TYPES.map((type) => {
                  const Icon = type.icon
                  const isRestricted = !!(type.modelRestriction && !selectedModel.includes(type.modelRestriction.replace('veo3_', '')))
                  const isSelected = veoGenerationType === type.id

                  return (
                    <button
                      key={type.id}
                      onClick={() => {
                        if (!isRestricted) {
                          setVeoGenerationType(type.id)
                          setVeoImages([]) // Reset images when changing type
                        }
                      }}
                      disabled={isRestricted}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                        isSelected
                          ? 'border-accent bg-accent/10'
                          : isRestricted
                          ? 'border-border/50 bg-surface-elevated/50 opacity-50 cursor-not-allowed'
                          : 'border-border hover:border-accent/50 bg-surface-elevated'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        isSelected ? 'bg-accent/20 text-accent' : 'bg-border/50 text-text-secondary'
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          'text-sm font-medium',
                          isSelected ? 'text-accent' : 'text-text-primary'
                        )}>
                          {type.name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {type.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-accent" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Veo Images Upload */}
          {isVeoModel && veoGenerationType !== 'TEXT_2_VIDEO' && currentVeoType && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO'
                  ? 'Frames (Inicial / Final)'
                  : 'Imágenes de Referencia'
                }
                <span className="text-xs text-text-muted ml-2">
                  ({currentVeoType.imagesRequired}-{currentVeoType.imagesMax} imágenes)
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: currentVeoType.imagesMax }).map((_, index) => (
                  <div key={index}>
                    <input
                      ref={(el) => { veoImageRefs.current[index] = el }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleVeoImageSelect(e, index)}
                    />
                    <button
                      onClick={() => veoImageRefs.current[index]?.click()}
                      className={cn(
                        'w-full aspect-square rounded-xl border border-dashed transition-all flex flex-col items-center justify-center gap-1',
                        veoImages[index]
                          ? 'border-accent bg-accent/5 p-0 overflow-hidden'
                          : index < currentVeoType.imagesRequired
                          ? 'border-accent/50 hover:border-accent bg-accent/5'
                          : 'border-border hover:border-accent/50'
                      )}
                    >
                      {veoImages[index] ? (
                        <div className="relative w-full h-full">
                          <img
                            src={veoImages[index].preview}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeVeoImage(index)
                            }}
                            className="absolute top-1 right-1 p-1 bg-error/90 rounded-full hover:bg-error transition-colors"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                          <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                            {veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO'
                              ? index === 0 ? 'Inicio' : 'Final'
                              : `Ref ${index + 1}`
                            }
                          </span>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5 text-text-secondary" />
                          <span className="text-[10px] text-text-secondary">
                            {veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO'
                              ? index === 0 ? 'Inicio' : 'Final'
                              : `Ref ${index + 1}`
                            }
                          </span>
                          {index < currentVeoType.imagesRequired && (
                            <span className="text-[9px] text-accent">Requerido</span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && (
                <p className="text-xs text-text-muted mt-2">
                  Primera imagen = frame inicial. Segunda imagen (opcional) = frame final.
                </p>
              )}
              {veoGenerationType === 'REFERENCE_2_VIDEO' && (
                <p className="text-xs text-text-muted mt-2">
                  Las imágenes de referencia guían el estilo visual del video.
                </p>
              )}
            </div>
          )}

          {/* Veo Seed */}
          {isVeoModel && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Seed
                <span className="text-xs text-text-muted ml-2">(10000-99999)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="number"
                    min={10000}
                    max={99999}
                    value={veoSeed}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (val >= 10000 && val <= 99999) {
                        setVeoSeed(val)
                      }
                    }}
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  />
                </div>
                <button
                  onClick={generateNewSeed}
                  className="px-4 py-2.5 bg-surface-elevated border border-border rounded-xl hover:border-accent/50 transition-colors"
                  title="Generar nuevo seed"
                >
                  <Sparkles className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Usa el mismo seed para resultados reproducibles.
              </p>
            </div>
          )}

          {/* Input Image (for image-to-video - non-Veo models) */}
          {!isVeoModel && currentModel.supportsStartEndFrames && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Imagen de entrada (opcional)
              </label>
              <input
                ref={inputImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, setInputImage)}
              />
              <button
                onClick={() => inputImageRef.current?.click()}
                className={cn(
                  'w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed transition-colors',
                  inputImage
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-accent/50'
                )}
              >
                {inputImage ? (
                  <div className="relative w-full aspect-video">
                    <img
                      src={inputImage.preview}
                      alt="Input"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setInputImage(null)
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-error/90 rounded-full hover:bg-error transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 text-text-secondary" />
                    <span className="text-sm text-text-secondary">
                      Subir imagen (convierte a video)
                    </span>
                  </>
                )}
              </button>
              <p className="text-xs text-text-muted mt-1">
                Sin imagen = text-to-video. Con imagen = image-to-video.
              </p>
            </div>
          )}

          {/* Veo Mode Info */}
          {isVeoModel && (
            <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl">
              <div className="flex items-start gap-2">
                <Video className="w-4 h-4 text-accent mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-accent">Modo Veo Activo</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {veoGenerationType === 'TEXT_2_VIDEO' && 'Generación de video solo con texto.'}
                    {veoGenerationType === 'FIRST_AND_LAST_FRAMES_2_VIDEO' && 'El video interpolará entre los frames inicial y final.'}
                    {veoGenerationType === 'REFERENCE_2_VIDEO' && 'Las imágenes guiarán el estilo visual del video.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              PROMPT
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe el video que quieres generar..."
              rows={4}
              className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Duración
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {getDurationOptions().map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Resolución
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {currentModel.resolutions.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
          </div>

          {/* Audio Toggle */}
          {currentModel.supportsAudio && (
            <div className="flex items-center justify-between p-3 bg-surface-elevated rounded-xl border border-border">
              <div className="flex items-center gap-3">
                {enableAudio ? (
                  <Volume2 className="w-5 h-5 text-accent" />
                ) : (
                  <VolumeX className="w-5 h-5 text-text-secondary" />
                )}
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Generar Audio
                  </p>
                  <p className="text-xs text-text-secondary">
                    Audio ambiental generado por IA
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEnableAudio(!enableAudio)}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  enableAudio ? 'bg-accent' : 'bg-border'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    enableAudio ? 'translate-x-7' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          {/* Kling 3.0 Multi-Shot */}
          {isKling30 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Multi-Shot
                </label>
                <button
                  onClick={() => setMultiShotEnabled(!multiShotEnabled)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative',
                    multiShotEnabled ? 'bg-accent' : 'bg-border'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                      multiShotEnabled ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              {multiShotEnabled && (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">
                    Hasta 6 tomas. Cada una con su prompt y duración.
                  </p>
                  {multiPrompts.map((shot, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          value={shot.prompt}
                          onChange={(e) => {
                            const next = [...multiPrompts]
                            next[idx] = { ...next[idx], prompt: e.target.value }
                            setMultiPrompts(next)
                          }}
                          placeholder={`Toma ${idx + 1}: describe la escena...`}
                          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <select
                        value={shot.duration}
                        onChange={(e) => {
                          const next = [...multiPrompts]
                          next[idx] = { ...next[idx], duration: parseInt(e.target.value) }
                          setMultiPrompts(next)
                        }}
                        className="w-16 px-2 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                      >
                        {[3, 5, 8].map(d => (
                          <option key={d} value={d}>{d}s</option>
                        ))}
                      </select>
                      {multiPrompts.length > 2 && (
                        <button
                          onClick={() => setMultiPrompts(multiPrompts.filter((_, i) => i !== idx))}
                          className="p-2 text-text-muted hover:text-error transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {multiPrompts.length < 6 && (
                    <button
                      onClick={() => setMultiPrompts([...multiPrompts, { prompt: '', duration: 3 }])}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar toma
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Kling 3.0 Element References */}
          {isKling30 && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                Element References
                <span className="text-xs text-text-muted">(opcional)</span>
              </label>
              <p className="text-xs text-text-muted mb-2">
                Sube imágenes de referencia para mantener consistencia. Usa @nombre en el prompt.
              </p>
              {klingElements.map((el, elIdx) => (
                <div key={elIdx} className="mb-3 p-3 bg-surface-elevated border border-border rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={el.name}
                      onChange={(e) => {
                        const next = [...klingElements]
                        next[elIdx] = { ...next[elIdx], name: e.target.value.replace(/\s/g, '_') }
                        setKlingElements(next)
                      }}
                      placeholder="nombre_elemento"
                      className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <button
                      onClick={() => setKlingElements(klingElements.filter((_, i) => i !== elIdx))}
                      className="p-1.5 text-text-muted hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    value={el.description}
                    onChange={(e) => {
                      const next = [...klingElements]
                      next[elIdx] = { ...next[elIdx], description: e.target.value }
                      setKlingElements(next)
                    }}
                    placeholder="Descripción del elemento..."
                    className="w-full px-3 py-1.5 mb-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <div className="flex gap-2">
                    {el.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                        <img src={img.preview} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            const next = [...klingElements]
                            next[elIdx] = { ...next[elIdx], images: next[elIdx].images.filter((_, i) => i !== imgIdx) }
                            setKlingElements(next)
                          }}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-error/90 rounded-full"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                    {el.images.length < 4 && (
                      <>
                        <input
                          ref={(r) => { elementImageRefs.current[elIdx] = r }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const next = [...klingElements]
                              next[elIdx] = { ...next[elIdx], images: [...next[elIdx].images, { file, preview: URL.createObjectURL(file) }] }
                              setKlingElements(next)
                            }
                          }}
                        />
                        <button
                          onClick={() => elementImageRefs.current[elIdx]?.click()}
                          className="w-16 h-16 flex items-center justify-center rounded-lg border border-dashed border-border hover:border-accent/50 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-text-muted" />
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted mt-1">
                    Usa <span className="text-accent">@{el.name || 'nombre'}</span> en el prompt
                  </p>
                </div>
              ))}
              {klingElements.length < 3 && (
                <button
                  onClick={() => setKlingElements([...klingElements, { name: '', description: '', images: [] }])}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs text-accent hover:bg-accent/10 rounded-lg border border-dashed border-accent/30 transition-colors w-full justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar elemento de referencia
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || (isVeoModel && !validateVeoImages())}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200',
              isGenerating || !prompt.trim() || (isVeoModel && !validateVeoImages())
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 hover:shadow-accent/40'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {generatingStatus || 'Generando...'}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generar Video
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel - Gallery */}
      <div className="flex-1 bg-surface rounded-2xl border border-border p-5 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Galería ({generatedVideos.length})
          </h3>
        </div>

        {generatedVideos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-border/50 flex items-center justify-center">
                <Video className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-text-secondary">
                Tus videos generados aparecerán aquí
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {generatedVideos.map((video) => (
                <div
                  key={video.id}
                  className="group relative rounded-xl overflow-hidden bg-surface-elevated"
                  style={{
                    aspectRatio:
                      video.aspectRatio === '16:9'
                        ? '16/9'
                        : video.aspectRatio === '9:16'
                        ? '9/16'
                        : '1/1',
                  }}
                >
                  <video
                    src={video.url}
                    className="w-full h-full object-cover"
                    controls
                    poster=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-xs text-white/80 line-clamp-2">
                        {video.prompt}
                      </p>
                      <p className="text-[10px] text-white/60 mt-1">
                        {video.model} · {video.duration}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = video.url
                      a.download = `video-${video.id}.mp4`
                      a.click()
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
