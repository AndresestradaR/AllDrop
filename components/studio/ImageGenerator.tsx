'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  IMAGE_COMPANY_GROUPS,
  IMAGE_MODELS,
  ImageModelId,
} from '@/lib/image-providers/types'
import {
  Sparkles,
  Zap,
  ImageIcon,
  Cpu,
  ChevronDown,
  Upload,
  User,
  Palette,
  Download,
  Heart,
  Copy,
  Share2,
  Loader2,
  X,
  Check,
  Type,
  Image as ImageLucide,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PublisherModal } from './PublisherModal'

const COMPANY_ICONS: Record<string, React.ElementType> = {
  Sparkles,
  Zap,
  Image: ImageIcon,
  Cpu,
}

type AspectRatio = '9:16' | '16:9' | '1:1'
type Quality = '1k' | '2k'
type GenerationMode = 'text' | 'image'

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  model: string
  timestamp: Date
  isFavorite: boolean
  aspectRatio: AspectRatio // Store the aspect ratio used
}

// Get CSS aspect ratio class based on ratio
function getAspectRatioClass(ratio: AspectRatio): string {
  switch (ratio) {
    case '9:16':
      return 'aspect-[9/16]'
    case '16:9':
      return 'aspect-[16/9]'
    case '1:1':
    default:
      return 'aspect-square'
  }
}

export function ImageGenerator() {
  // Model selection
  const [selectedModel, setSelectedModel] = useState<ImageModelId>('gemini-3-pro-image')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  // Generation mode (text-only or with image references)
  const [generationMode, setGenerationMode] = useState<GenerationMode>('text')

  // References
  const [styleRef, setStyleRef] = useState<File | null>(null)
  const [characterRef, setCharacterRef] = useState<File | null>(null)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])

  // Generation options
  const [prompt, setPrompt] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [quality, setQuality] = useState<Quality>('1k')

  // State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [publishImage, setPublishImage] = useState<GeneratedImage | null>(null)

  // Refs for file inputs
  const styleInputRef = useRef<HTMLInputElement>(null)
  const characterInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Load previously generated images from database on mount
  useEffect(() => {
    const loadSavedImages = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('generations')
          .select('id, product_name, original_prompt, generated_image_url, created_at')
          .like('product_name', 'Studio:%')
          .not('generated_image_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50)

        if (data?.length) {
          // Resolve Supabase Storage URLs to signed URLs (public URLs may not work)
          const saved: GeneratedImage[] = await Promise.all(
            data.map(async (gen) => {
              let url = gen.generated_image_url
              // If it's a Supabase Storage URL, create a signed URL that works
              if (url?.includes('/landing-images/')) {
                const path = url.split('/landing-images/')[1]
                if (path) {
                  const { data: signed } = await supabase.storage
                    .from('landing-images')
                    .createSignedUrl(path, 86400) // 24h — refreshed on each page load
                  if (signed?.signedUrl) url = signed.signedUrl
                }
              }
              return {
                id: gen.id,
                url,
                prompt: gen.original_prompt || '',
                model: gen.product_name?.replace('Studio: ', '') || 'Unknown',
                timestamp: new Date(gen.created_at),
                isFavorite: false,
                aspectRatio: '1:1' as AspectRatio,
              }
            })
          )
          setGeneratedImages(saved)
        }
      } catch (err) {
        console.warn('[Studio] Failed to load saved images:', err)
      }
    }
    loadSavedImages()
  }, [])

  const currentModel = IMAGE_MODELS[selectedModel]
  
  // Check if current model supports image input
  const supportsImageInput = currentModel.supportsImageInput

  // When model changes, reset mode if needed
  const handleModelChange = (modelId: ImageModelId) => {
    setSelectedModel(modelId)
    setIsModelDropdownOpen(false)
    
    // If new model doesn't support images, switch to text mode and clear refs
    if (!IMAGE_MODELS[modelId].supportsImageInput) {
      setGenerationMode('text')
      setStyleRef(null)
      setCharacterRef(null)
      setUploadedImages([])
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Escribe un prompt para generar')
      return
    }

    setIsGenerating(true)

    try {
      // Convert reference images to base64 (only if mode is 'image' and model supports it)
      const referenceImages: { data: string; mimeType: string }[] = []

      const toBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            resolve({ data: base64, mimeType: file.type })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      if (generationMode === 'image' && supportsImageInput) {
        if (styleRef) {
          referenceImages.push(await toBase64(styleRef))
        }
        if (characterRef) {
          referenceImages.push(await toBase64(characterRef))
        }
        for (const img of uploadedImages) {
          referenceImages.push(await toBase64(img))
        }
      }

      const response = await fetch('/api/studio/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel,
          prompt,
          aspectRatio,
          quality,
          quantity,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error generando imagen')
      }

      // Check for API-level errors (success: false with status 200)
      if (data.success === false) {
        throw new Error(data.error || 'Error generando imagen')
      }

      if (data.success && data.imageBase64) {
        // Always use base64 for immediate display (guaranteed to work)
        // persistedUrl is only used when loading saved images from DB on mount
        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`,
          prompt,
          model: currentModel.name,
          timestamp: new Date(),
          isFavorite: false,
          aspectRatio, // Save the aspect ratio used
        }
        setGeneratedImages((prev) => [newImage, ...prev])
        toast.success('Imagen generada exitosamente')
      } else if (data.taskId) {
        // Handle async providers (polling)
        toast('Generando imagen...', { icon: '⏳' })
        pollForResult(data.taskId, data.provider)
      }
    } catch (error) {
      console.error('Generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Error generando imagen')
    } finally {
      setIsGenerating(false)
    }
  }

  const pollForResult = async (taskId: string, provider: string) => {
    const maxAttempts = 60
    const interval = 2000

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, interval))

      try {
        const response = await fetch(`/api/studio/generate-image/status?taskId=${taskId}&provider=${provider}`)
        const data = await response.json()

        if (data.status === 'completed' && data.imageBase64) {
          const newImage: GeneratedImage = {
            id: crypto.randomUUID(),
            url: `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`,
            prompt,
            model: currentModel.name,
            timestamp: new Date(),
            isFavorite: false,
            aspectRatio, // Save the aspect ratio used
          }
          setGeneratedImages((prev) => [newImage, ...prev])
          toast.success('Imagen generada exitosamente')
          return
        }

        if (data.status === 'failed') {
          toast.error(data.error || 'Error en la generacion')
          return
        }
      } catch {
        // Continue polling
      }
    }

    toast.error('Tiempo de espera agotado')
  }

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement('a')
    link.href = image.url
    link.download = `estudio-ia-${Date.now()}.png`
    link.click()
  }

  const toggleFavorite = (id: string) => {
    setGeneratedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, isFavorite: !img.isFavorite } : img))
    )
  }

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      setter(file)
    }
  }

  const handleMultipleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setUploadedImages((prev) => [...prev, ...Array.from(files)])
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel - Controls */}
      <div className="w-[380px] flex-shrink-0 bg-surface rounded-2xl border border-border p-5 overflow-y-auto">
        <div className="space-y-6">
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
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br',
                      IMAGE_COMPANY_GROUPS.find((g) =>
                        g.models.some((m) => m.id === selectedModel)
                      )?.color
                    )}
                  >
                    {(() => {
                      const group = IMAGE_COMPANY_GROUPS.find((g) =>
                        g.models.some((m) => m.id === selectedModel)
                      )
                      const Icon = COMPANY_ICONS[group?.icon || 'Sparkles']
                      return <Icon className="w-4 h-4 text-white" />
                    })()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-text-primary">
                      {currentModel.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {currentModel.companyName} · {currentModel.pricePerImage}
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl z-50 max-h-[400px] overflow-y-auto">
                  {IMAGE_COMPANY_GROUPS.map((group) => (
                    <div key={group.id} className="p-2">
                      <p className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">
                        {group.name}
                      </p>
                      {group.models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleModelChange(model.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                            selectedModel === model.id
                              ? 'bg-accent/10 text-accent'
                              : 'hover:bg-border/50 text-text-primary'
                          )}
                        >
                          <div
                            className={cn(
                              'w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br',
                              group.color
                            )}
                          >
                            {(() => {
                              const Icon = COMPANY_ICONS[group.icon]
                              return <Icon className="w-3 h-3 text-white" />
                            })()}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{model.name}</span>
                              {model.tags?.map((tag) => (
                                <span
                                  key={tag}
                                  className={cn(
                                    'px-1.5 py-0.5 text-[10px] font-bold rounded',
                                    tag === 'RECOMENDADO' && 'bg-accent/20 text-accent',
                                    tag === 'NEW' && 'bg-blue-500/20 text-blue-400',
                                    tag === 'FAST' && 'bg-yellow-500/20 text-yellow-400',
                                    tag === 'PREMIUM' && 'bg-purple-500/20 text-purple-400',
                                    tag === 'TEXT_ONLY' && 'bg-gray-500/20 text-gray-400'
                                  )}
                                >
                                  {tag === 'TEXT_ONLY' ? 'SOLO TEXTO' : tag}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-text-secondary">{model.pricePerImage}</p>
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

          {/* Generation Mode Tabs - Only show if model supports image input */}
          {supportsImageInput && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Modo de generacion
              </label>
              <div className="flex gap-2 p-1 bg-surface-elevated rounded-xl border border-border">
                <button
                  onClick={() => setGenerationMode('text')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    generationMode === 'text'
                      ? 'bg-accent text-background'
                      : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
                  )}
                >
                  <Type className="w-4 h-4" />
                  Texto a Imagen
                </button>
                <button
                  onClick={() => setGenerationMode('image')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    generationMode === 'image'
                      ? 'bg-accent text-background'
                      : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
                  )}
                >
                  <ImageLucide className="w-4 h-4" />
                  Imagen a Imagen
                </button>
              </div>
            </div>
          )}

          {/* References - Only show if model supports image input AND mode is 'image' */}
          {supportsImageInput && generationMode === 'image' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Referencias
              </label>
              <div className="flex gap-2">
                <input
                  ref={styleInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, setStyleRef)}
                />
                <input
                  ref={characterInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, setCharacterRef)}
                />
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleMultipleFileSelect}
                />

                <button
                  onClick={() => styleInputRef.current?.click()}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed transition-colors',
                    styleRef
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                  )}
                >
                  <Palette className="w-4 h-4" />
                  <span className="text-sm">Estilo</span>
                  {styleRef && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setStyleRef(null)
                      }}
                      className="ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </button>

                <button
                  onClick={() => characterInputRef.current?.click()}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed transition-colors',
                    characterRef
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                  )}
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm">Personaje</span>
                  {characterRef && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setCharacterRef(null)
                      }}
                      className="ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </button>

                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed transition-colors',
                    uploadedImages.length > 0
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">
                    {uploadedImages.length > 0 ? `(${uploadedImages.length})` : 'Subir'}
                  </span>
                </button>
              </div>

              {/* Preview uploaded images */}
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {uploadedImages.map((file, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Upload ${i + 1}`}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <button
                        onClick={() =>
                          setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              placeholder="Describe la imagen que quieres generar..."
              rows={5}
              className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-3 gap-3">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Cantidad
              </label>
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
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
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
              </select>
            </div>

            {/* Quality */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Calidad
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="1k">1K</option>
                <option value="2k">2K</option>
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200',
              isGenerating || !prompt.trim()
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 hover:shadow-accent/40'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel - Gallery */}
      <div className="flex-1 bg-surface rounded-2xl border border-border p-5 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            Galeria ({generatedImages.length})
          </h3>
        </div>

        {generatedImages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-border/50 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-text-secondary">
                Tus imagenes generadas apareceran aqui
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedImages.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    'group relative rounded-xl overflow-hidden bg-surface-elevated',
                    getAspectRatioClass(image.aspectRatio)
                  )}
                >
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images — show placeholder instead
                      const target = e.currentTarget
                      target.style.display = 'none'
                      const placeholder = target.nextElementSibling as HTMLElement
                      if (placeholder?.dataset.placeholder) placeholder.style.display = 'flex'
                    }}
                  />
                  <div
                    data-placeholder="true"
                    className="w-full h-full items-center justify-center bg-surface-elevated text-text-secondary text-xs text-center p-2"
                    style={{ display: 'none' }}
                  >
                    <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                    <span>Imagen no disponible</span>
                  </div>
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-xs text-white/80 line-clamp-2 mb-2">
                        {image.prompt}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPublishImage(image)}
                          className="p-2 bg-indigo-500/80 hover:bg-indigo-500 rounded-lg transition-colors"
                          title="Publicar en redes"
                        >
                          <Share2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => handleDownload(image)}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Descargar"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => toggleFavorite(image.id)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            image.isFavorite
                              ? 'bg-red-500 text-white'
                              : 'bg-white/20 hover:bg-white/30 text-white'
                          )}
                          title="Favorito"
                        >
                          <Heart
                            className={cn('w-4 h-4', image.isFavorite && 'fill-current')}
                          />
                        </button>
                        <button
                          onClick={() => setPrompt(image.prompt)}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          title="Usar prompt"
                        >
                          <Copy className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Publisher Modal */}
      <PublisherModal
        isOpen={!!publishImage}
        onClose={() => setPublishImage(null)}
        mediaBase64={publishImage?.url.split(',')[1]}
        mediaContentType={publishImage?.url.split(';')[0]?.split(':')[1] || 'image/png'}
        contentType="photo"
        defaultCaption={publishImage?.prompt || ''}
        previewUrl={publishImage?.url}
      />
    </div>
  )
}
