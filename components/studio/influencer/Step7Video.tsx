'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { VIDEO_MODELS, VIDEO_COMPANY_GROUPS, type VideoModelId } from '@/lib/video-providers/types'
import { Video, Loader2, Copy, Check, Wand2, Image as ImageIcon, Heart, X, Package, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface Step7VideoProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
  onBack: () => void
}

export function Step7Video({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
  onBack,
}: Step7VideoProps) {
  console.log('[Step7Video] Props received:', { promptDescriptor: promptDescriptor?.substring(0, 30), influencerId, realisticImageUrl: !!realisticImageUrl })

  // Resolved descriptor (loads from DB if prop is empty)
  const [resolvedDescriptor, setResolvedDescriptor] = useState(promptDescriptor)

  useEffect(() => {
    if (promptDescriptor && promptDescriptor.length > 20) {
      setResolvedDescriptor(promptDescriptor)
      console.log('[Step7Video] Using prop descriptor, length:', promptDescriptor.length)
      return
    }

    // Prop vacía o muy corta — cargar de la BD
    if (influencerId) {
      const loadDescriptor = async () => {
        try {
          const res = await fetch(`/api/studio/influencer`)
          const data = await res.json()
          const inf = data.influencers?.find((i: any) => i.id === influencerId)
          if (inf?.prompt_descriptor && inf.prompt_descriptor.length > 20) {
            setResolvedDescriptor(inf.prompt_descriptor)
            console.log('[Step7Video] Loaded descriptor from DB, length:', inf.prompt_descriptor.length)
          } else {
            console.warn('[Step7Video] No descriptor in DB. Sora will use basic name only.')
            setResolvedDescriptor(`a young woman called ${influencerName}, natural appearance, casual style`)
          }
        } catch (err) {
          console.error('[Step7Video] Error loading descriptor:', err)
          setResolvedDescriptor(`a young woman called ${influencerName}, natural appearance, casual style`)
        }
      }
      loadDescriptor()
    }
  }, [promptDescriptor, influencerId, influencerName])

  // Presets
  type VideoPreset = 'producto' | 'rapido' | 'premium'

  interface PresetConfig {
    id: VideoPreset
    label: string
    emoji: string
    description: string
    modelId: VideoModelId
    duration: number
    aspectRatio: '9:16' | '16:9' | '1:1'
    videoMode: 'text' | 'image'
    badge: string
    color: string
  }

  const VIDEO_PRESETS: PresetConfig[] = [
    {
      id: 'producto',
      label: 'Producto',
      emoji: '🎯',
      description: 'Solo con imagen del producto. Sora genera al personaje desde su descripción.',
      modelId: 'sora-2',
      duration: 10,
      aspectRatio: '9:16',
      videoMode: 'text',
      badge: '~$0.45',
      color: 'from-emerald-500/15 to-emerald-600/15 border-emerald-500/30',
    },
    {
      id: 'rapido',
      label: 'Rápido',
      emoji: '⚡',
      description: 'Usa foto del influencer como frame. Rápido y con audio.',
      modelId: 'veo-3-fast',
      duration: 8,
      aspectRatio: '9:16',
      videoMode: 'image',
      badge: '~$0.40',
      color: 'from-blue-500/15 to-blue-600/15 border-blue-500/30',
    },
    {
      id: 'premium',
      label: 'Premium',
      emoji: '💎',
      description: 'Videos largos con Kling 3.0. Mejor calidad y consistencia.',
      modelId: 'kling-3.0',
      duration: 10,
      aspectRatio: '9:16',
      videoMode: 'image',
      badge: '~$0.42',
      color: 'from-purple-500/15 to-purple-600/15 border-purple-500/30',
    },
  ]

  const [selectedPreset, setSelectedPreset] = useState<VideoPreset | null>(null)
  const [isCustomMode, setIsCustomMode] = useState(false)

  // Model & config
  const [videoModelId, setVideoModelId] = useState<VideoModelId>('kling-3.0')
  const selectedModel = VIDEO_MODELS[videoModelId]
  const isSora = videoModelId === 'sora-2'

  // Mode: text (solo prompt), image (1 imagen inicio), start_end (inicio + final)
  const [videoMode, setVideoMode] = useState<'text' | 'image' | 'start_end'>('image')

  // Images
  const [galleryImages, setGalleryImages] = useState<any[]>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(true)
  const [startImageUrl, setStartImageUrl] = useState<string | null>(realisticImageUrl || null)
  const [endImageUrl, setEndImageUrl] = useState<string | null>(null)
  const [showImagePicker, setShowImagePicker] = useState<'start' | 'end' | 'product' | null>(null)

  // Sora product mode
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null)
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  // Prompt
  const [prompt, setPrompt] = useState('')
  const [userIdea, setUserIdea] = useState('')
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [duration, setDuration] = useState(5)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16')

  // Cargar galería
  useEffect(() => {
    const loadGallery = async () => {
      setIsLoadingGallery(true)
      try {
        const res = await fetch(`/api/studio/influencer/gallery?influencerId=${influencerId}`)
        const data = await res.json()
        if (data.items) setGalleryImages(data.items)
      } catch (err) {
        console.error('Error loading gallery:', err)
      } finally {
        setIsLoadingGallery(false)
      }
    }
    loadGallery()
  }, [influencerId])

  // Ajustar modo cuando cambia el modelo
  useEffect(() => {
    const model = VIDEO_MODELS[videoModelId]
    if (model?.requiresImage && videoMode === 'text') {
      setVideoMode('image')
    }
    // Sora: forzar modo texto (no acepta imágenes de personas)
    if (videoModelId === 'sora-2') {
      setVideoMode('text')
    }
  }, [videoModelId])

  // Polling for video status
  useEffect(() => {
    if (!taskId || videoUrl) return // No poll si no hay task o ya tenemos video

    let cancelled = false
    let pollCount = 0
    const MAX_POLLS = 60 // 5 minutos máximo (60 * 5s)

    const poll = async () => {
      if (cancelled || pollCount >= MAX_POLLS) {
        if (pollCount >= MAX_POLLS) {
          setError('El video está tardando demasiado. Puedes verificar en el tab de Video principal.')
          setIsGenerating(false)
        }
        return
      }

      pollCount++
      console.log(`[Step7Video] Polling status #${pollCount} for task: ${taskId}`)

      try {
        const res = await fetch(`/api/studio/video-status?taskId=${taskId}`)
        const data = await res.json()

        if (cancelled) return

        if (data.status === 'completed' && data.videoUrl) {
          console.log('[Step7Video] Video completed:', data.videoUrl)
          setVideoUrl(data.videoUrl)
          setIsGenerating(false)
          toast.success('¡Video generado!')

          // Guardar video en la galería del influencer
          try {
            const saveBody = {
              influencerId,
              image_url: data.videoUrl, // CRITICAL: usar video URL como image_url para evitar NOT NULL constraint
              video_url: data.videoUrl,
              content_type: 'video',
              type: 'solo',
              situation: userIdea || prompt.substring(0, 200),
              prompt_used: prompt,
            }
            console.log('[Step7Video] Saving video to gallery:', { influencerId, videoUrl: data.videoUrl?.substring(0, 60) })
            const saveRes = await fetch('/api/studio/influencer/gallery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(saveBody),
            })
            const saveData = await saveRes.json()
            if (saveRes.ok && saveData.success) {
              console.log('[Step7Video] Video saved to gallery successfully, id:', saveData.id)
            } else {
              console.error('[Step7Video] Gallery save failed:', saveData.error)
            }
          } catch (saveErr) {
            console.error('[Step7Video] Error saving video to gallery:', saveErr)
          }

          return // Stop polling
        }

        if (data.status === 'failed') {
          console.error('[Step7Video] Video failed:', data.error)
          setError(data.error || 'Error al generar el video')
          setIsGenerating(false)
          return // Stop polling
        }

        // Still processing — poll again in 5 seconds
        setTimeout(poll, 5000)
      } catch (err) {
        console.error('[Step7Video] Polling error:', err)
        // Don't stop on network error, retry
        setTimeout(poll, 8000)
      }
    }

    // Start polling after 3 seconds (give KIE time to register the task)
    const initialDelay = setTimeout(poll, 3000)

    return () => {
      cancelled = true
      clearTimeout(initialDelay)
    }
  }, [taskId, videoUrl])

  const handleOptimizePrompt = async () => {
    console.log('[Step7Video] handleOptimizePrompt called, resolvedDescriptor:', resolvedDescriptor?.substring(0, 50))
    if (!userIdea.trim()) {
      toast.error('Escribe una idea para el video')
      return
    }

    setIsOptimizing(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/visual-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          optimizeVideoPrompt: true,
          videoModelId,
          userIdea: userIdea.trim(),
          promptDescriptor: resolvedDescriptor,
          presetId: selectedPreset || undefined,
        }),
      })

      const data = await res.json()
      console.log('[Step7Video] Optimize response:', { status: res.status, hasPrompt: !!data.optimized_prompt, error: data.error })

      if (!res.ok) {
        console.warn('[Step7Video] API returned error:', data.error)
        // No throw, caer al else para usar fallback
      }

      if (data.optimized_prompt) {
        if (isSora) {
          const soraFinal = `${resolvedDescriptor}\n\n${data.optimized_prompt}`
          console.log('[Step7Video] SORA PROMPT - descriptor included:', resolvedDescriptor?.length > 20 ? 'YES' : 'NO/SHORT')
          console.log('[Step7Video] SORA PROMPT - total length:', soraFinal.length)
          setPrompt(soraFinal)
        } else {
          // Asegurar que incluya instrucción de español
          const optimized = data.optimized_prompt
          const hasSpanish = optimized.toLowerCase().includes('español') || optimized.toLowerCase().includes('spanish') || optimized.toLowerCase().includes('latino')
          setPrompt(hasSpanish ? optimized : `${optimized}, habla en español con acento latino`)
        }
        toast.success('Prompt optimizado')
      } else {
        if (isSora) {
          const desc = resolvedDescriptor || `a person called ${influencerName}`
          setPrompt(`${desc}\n\n${userIdea.trim()}. Habla en español con acento latino.`)
        } else {
          setPrompt(`${userIdea.trim()}. Habla en español con acento latino.`)
        }
        toast.success('Prompt generado')
      }
    } catch (err: any) {
      console.error('[Step7Video] Optimize error:', err)
      if (isSora) {
        const desc = resolvedDescriptor || `a person called ${influencerName}`
        setPrompt(`${desc}\n\n${userIdea.trim()}. Habla en español con acento latino.`)
      } else {
        setPrompt(`${userIdea.trim()}. Habla en español con acento latino.`)
      }
      toast.success('Prompt generado (modo fallback)')
    } finally {
      setIsOptimizing(false)
    }
  }

  const handlePresetSelect = (preset: PresetConfig) => {
    setSelectedPreset(preset.id)
    setVideoModelId(preset.modelId)
    setDuration(preset.duration)
    setAspectRatio(preset.aspectRatio)
    setVideoMode(preset.videoMode)
    setIsCustomMode(false)
    setPrompt('')
    setError(null)

    // Si es image mode y no hay imagen seleccionada, usar la realista
    if (preset.videoMode === 'image' && !startImageUrl) {
      setStartImageUrl(realisticImageUrl)
    }
  }

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProductImageFile(file)
    const url = URL.createObjectURL(file)
    setProductImageUrl(url)
  }

  const getBase64FromUrl = async (url: string): Promise<string | undefined> => {
    if (!url) {
      console.warn('[Step7Video] getBase64FromUrl: no URL provided')
      return undefined
    }
    try {
      console.log('[Step7Video] Fetching image:', url.substring(0, 80) + '...')
      const res = await fetch(url)
      if (!res.ok) {
        console.error('[Step7Video] Image fetch failed:', res.status, res.statusText)
        toast.error(`Error al cargar imagen: ${res.status}`)
        return undefined
      }
      const blob = await res.blob()
      console.log('[Step7Video] Image loaded, size:', blob.size, 'type:', blob.type)
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => {
          console.error('[Step7Video] FileReader error')
          reject(new Error('FileReader error'))
        }
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      console.error('[Step7Video] getBase64FromUrl error:', err)
      toast.error('No se pudo cargar la imagen de referencia')
      return undefined
    }
  }

  const getBase64FromFile = async (file: File): Promise<string> => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })
  }

  const handleGenerate = async () => {
    console.log('[Step7Video] handleGenerate called, resolvedDescriptor:', resolvedDescriptor?.substring(0, 50))
    // Si no hay prompt optimizado, construir uno automático desde userIdea
    let finalPrompt = prompt.trim()
    if (!finalPrompt && userIdea.trim()) {
      if (isSora) {
        finalPrompt = `${resolvedDescriptor || 'A person'}.\n\n${userIdea.trim()}. Habla en español con acento latino.`
      } else {
        // Agregar instrucción de español para TODOS los modelos
        finalPrompt = `${userIdea.trim()}, habla en español con acento latino`
      }
      setPrompt(finalPrompt)
    }

    if (!finalPrompt) {
      toast.error('Escribe una idea o un prompt para el video')
      return
    }

    console.log('[Step7Video] handleGenerate called, finalPrompt:', finalPrompt?.substring(0, 50))

    // Log para debug Sora descriptor
    if (isSora) {
      console.log('[Step7Video] SORA DEBUG - resolvedDescriptor length:', resolvedDescriptor?.length || 0)
      console.log('[Step7Video] SORA DEBUG - first 100 chars:', resolvedDescriptor?.substring(0, 100))
      console.log('[Step7Video] SORA DEBUG - finalPrompt first 200 chars:', finalPrompt?.substring(0, 200))
    }

    const model = VIDEO_MODELS[videoModelId]

    if (model?.requiresImage && !startImageUrl) {
      toast.error('Este modelo requiere una imagen de inicio')
      return
    }

    setIsGenerating(true)
    setError(null)
    setVideoUrl(null)
    setTaskId(null)

    try {
      let imageBase64: string | undefined
      let imageBase64End: string | undefined
      let veoGenerationType: string | undefined
      let veoImages: string[] | undefined

      const isVeo = videoModelId.startsWith('veo')

      if (isSora) {
        // =============== MODO SORA ===============
        // NO enviar imagen de la persona (Sora la rechaza)
        // El prompt ya contiene el promptDescriptor
        // Solo enviar imagen del producto si existe
        if (productImageFile) {
          imageBase64 = await getBase64FromFile(productImageFile)
        } else if (productImageUrl && !productImageUrl.startsWith('blob:')) {
          imageBase64 = await getBase64FromUrl(productImageUrl)
        }
      } else if (isVeo) {
        // =============== MODO VEO ===============
        if (videoMode === 'start_end' && startImageUrl && endImageUrl) {
          veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
          const startB64 = await getBase64FromUrl(startImageUrl)
          const endB64 = await getBase64FromUrl(endImageUrl)
          if (startB64 && endB64) veoImages = [startB64, endB64]
          else if (startB64) {
            veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
            veoImages = [startB64]
          } else {
            veoGenerationType = 'TEXT_2_VIDEO'
          }
        } else if (videoMode === 'image' && startImageUrl) {
          veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
          const startB64 = await getBase64FromUrl(startImageUrl)
          if (startB64) veoImages = [startB64]
          else {
            veoGenerationType = 'TEXT_2_VIDEO'
            toast('Imagen no disponible, generando desde texto', { icon: '⚠️' })
          }
        } else {
          veoGenerationType = 'TEXT_2_VIDEO'
        }
      } else {
        // =============== OTROS MODELOS (Kling, Hailuo, Seedance, Wan) ===============
        if ((videoMode === 'image' || videoMode === 'start_end') && startImageUrl) {
          imageBase64 = await getBase64FromUrl(startImageUrl)
          if (!imageBase64) {
            console.warn('[Step7Video] Start image failed to load, falling back to text-to-video')
            if (model?.requiresImage) {
              setError('Este modelo requiere imagen pero no se pudo cargar. Intenta con otro modelo.')
              setIsGenerating(false)
              return
            }
            toast('Imagen no disponible, generando desde texto', { icon: '⚠️' })
          }
        }
        if (videoMode === 'start_end' && endImageUrl) {
          imageBase64End = await getBase64FromUrl(endImageUrl)
          if (!imageBase64End) {
            console.warn('[Step7Video] End image failed to load')
            toast('Imagen final no disponible', { icon: '⚠️' })
          }
        }
      }

      // Debug: mostrar exactamente qué se envía
      console.log('[Step7Video] Generating video:', {
        modelId: videoModelId,
        promptLength: finalPrompt.length,
        duration,
        aspectRatio,
        hasStartImage: !!imageBase64,
        hasEndImage: !!imageBase64End,
        veoGenerationType,
        hasVeoImages: veoImages?.length || 0,
        isSora,
        hasProductImage: isSora && !!imageBase64,
      })

      const res = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: videoModelId,
          prompt: finalPrompt,
          duration,
          aspectRatio,
          enableAudio: model?.supportsAudio ? true : false,
          imageBase64,
          imageBase64End,
          veoGenerationType,
          veoImages,
          ...(isVeo ? { resolution: '720p', veoSeed: Math.floor(Math.random() * 1000000) } : {}),
        }),
      })

      const data = await res.json()
      console.log('[Step7Video] Generate response:', { status: res.status, success: data.success, taskId: data.taskId, error: data.error })

      if (!res.ok || (!data.success && !data.taskId)) {
        throw new Error(data.error || 'Error al generar video')
      }

      if (data.videoUrl) {
        setVideoUrl(data.videoUrl)
        toast.success('Video generado!')
      } else if (data.taskId) {
        setTaskId(data.taskId)
        toast.success('Video en proceso. Revisa el tab de Video para ver el resultado.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        Genera videos con tu influencer. Describe tu idea y optimizaremos el prompt para el modelo elegido.
      </p>

      {/* Reference */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-surface-elevated rounded-xl border border-border">
        <img
          src={realisticImageUrl}
          alt={influencerName}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
        <div>
          <p className="text-sm font-medium text-text-primary">{influencerName}</p>
          <p className="text-xs text-text-secondary line-clamp-1">{resolvedDescriptor?.substring(0, 80)}...</p>
        </div>
      </div>

      {/* ============ PRESETS ============ */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">
            Tipo de video
          </label>
          <button
            onClick={() => { setIsCustomMode(!isCustomMode); setSelectedPreset(null) }}
            className="text-[10px] text-accent hover:underline"
          >
            {isCustomMode ? 'Usar presets' : 'Configuración manual'}
          </button>
        </div>

        {!isCustomMode && (
          <div className="grid grid-cols-3 gap-2">
            {VIDEO_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  'relative p-3 rounded-xl border text-left transition-all',
                  selectedPreset === preset.id
                    ? `bg-gradient-to-br ${preset.color} border-2 shadow-lg`
                    : 'bg-surface-elevated border-border hover:border-text-muted'
                )}
              >
                <div className="text-lg mb-1">{preset.emoji}</div>
                <p className="text-xs font-semibold text-text-primary">{preset.label}</p>
                <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">{preset.description}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[9px] px-1.5 py-0.5 bg-black/20 rounded-full text-text-muted">
                    {VIDEO_MODELS[preset.modelId].name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-black/20 rounded-full text-text-muted">
                    {preset.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ============ CONTROLES MANUALES (solo si modo custom) ============ */}
      {isCustomMode && (
        <>
          {/* ============ MODELO DE VIDEO ============ */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Modelo de Video</label>
            <select
              value={videoModelId}
              onChange={(e) => setVideoModelId(e.target.value as VideoModelId)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {VIDEO_COMPANY_GROUPS.map(group => (
                <optgroup key={group.id} label={group.name}>
                  {group.models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description} {m.tags?.includes('AUDIO') ? '🔊' : ''} {m.requiresImage ? '📷' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Model capabilities badges */}
            {selectedModel && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedModel.supportsAudio && (
                  <span className="text-[9px] px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full">🔊 Audio</span>
                )}
                {selectedModel.supportsStartEndFrames && (
                  <span className="text-[9px] px-2 py-0.5 bg-purple-500/15 text-purple-400 rounded-full">🖼️ Start/End</span>
                )}
                {selectedModel.requiresImage && (
                  <span className="text-[9px] px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded-full">📷 Requiere imagen</span>
                )}
                {selectedModel.supportsMultiShots && (
                  <span className="text-[9px] px-2 py-0.5 bg-green-500/15 text-green-400 rounded-full">🎬 Multi-shot</span>
                )}
                <span className="text-[9px] px-2 py-0.5 bg-text-muted/10 text-text-muted rounded-full">
                  {selectedModel.durationRange} | {selectedModel.priceRange}
                </span>
              </div>
            )}
          </div>

          {/* ============ ALERTA SORA ============ */}
          {isSora && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-400 mb-1">Modo Sora — Texto + Producto</p>
                  <p className="text-[11px] text-blue-300/80">
                    Sora no permite crear videos a partir de imagenes de personas. En su lugar, usamos la descripcion
                    detallada de tu influencer ({influencerName}) como prompt para que Sora genere al personaje.
                    Opcionalmente puedes subir la imagen de un <strong>producto</strong> para que aparezca en el video.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============ MODO DE GENERACION (NO para Sora) ============ */}
          {!isSora && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Modo de generacion
              </label>
              <div className="flex gap-2">
                {selectedModel?.apiModelIdText && !selectedModel?.requiresImage && (
                  <button
                    onClick={() => { setVideoMode('text'); setStartImageUrl(null); setEndImageUrl(null) }}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                      videoMode === 'text'
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    Solo Texto
                  </button>
                )}
                <button
                  onClick={() => { setVideoMode('image'); setEndImageUrl(null); if (!startImageUrl) setStartImageUrl(realisticImageUrl) }}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                    videoMode === 'image'
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                  )}
                >
                  Imagen Inicial
                </button>
                {selectedModel?.supportsStartEndFrames && (
                  <button
                    onClick={() => { setVideoMode('start_end'); if (!startImageUrl) setStartImageUrl(realisticImageUrl) }}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                      videoMode === 'start_end'
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    Inicio + Final
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============ SELECTOR DE IMAGENES (NO Sora) ============ */}
          {!isSora && (videoMode === 'image' || videoMode === 'start_end') && (
            <>
              {/* Imagen de inicio */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                  {videoMode === 'start_end' ? 'Frame inicial' : 'Imagen de referencia'}
                </label>
                <div
                  onClick={() => setShowImagePicker('start')}
                  className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-border cursor-pointer hover:border-accent/30 transition-colors"
                >
                  {startImageUrl ? (
                    <>
                      <img src={startImageUrl} alt="Start" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-text-primary font-medium">Imagen seleccionada</p>
                        <p className="text-[10px] text-accent">Click para cambiar</p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 py-3">
                      <ImageIcon className="w-5 h-5 text-text-muted" />
                      <p className="text-sm text-text-secondary">Seleccionar de la galeria</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Imagen final (solo start_end) */}
              {videoMode === 'start_end' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                    Frame final
                  </label>
                  <div
                    onClick={() => setShowImagePicker('end')}
                    className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-border cursor-pointer hover:border-accent/30 transition-colors"
                  >
                    {endImageUrl ? (
                      <>
                        <img src={endImageUrl} alt="End" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-text-primary font-medium">Imagen final seleccionada</p>
                          <p className="text-[10px] text-accent">Click para cambiar</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 py-3">
                        <ImageIcon className="w-5 h-5 text-text-muted" />
                        <p className="text-sm text-text-secondary">Seleccionar imagen final (opcional)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============ PRODUCTO PARA SORA ============ */}
          {isSora && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Imagen del producto (opcional)
              </label>
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                onChange={handleProductImageUpload}
                className="hidden"
              />
              <div
                onClick={() => productInputRef.current?.click()}
                className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-dashed border-border cursor-pointer hover:border-accent/30 transition-colors"
              >
                {productImageUrl ? (
                  <>
                    <img src={productImageUrl} alt="Producto" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary font-medium">Producto seleccionado</p>
                      <p className="text-[10px] text-accent">Click para cambiar</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setProductImageUrl(null); setProductImageFile(null) }}
                      className="p-1.5 hover:bg-border/50 rounded-lg"
                    >
                      <X className="w-4 h-4 text-text-muted" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-3 w-full justify-center">
                    <Package className="w-5 h-5 text-text-muted" />
                    <p className="text-sm text-text-secondary">Subir imagen del producto</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                Sora creara al personaje ({influencerName}) desde su descripcion y mostrara este producto en el video
              </p>
            </div>
          )}

          {/* ============ DURACION Y ASPECTO ============ */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Duracion</label>
              <div className="flex gap-2">
                {[5, 10].map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all border',
                      duration === d
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Aspecto</label>
              <div className="flex gap-2">
                {(['9:16', '16:9', '1:1'] as const).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all border',
                      aspectRatio === ar
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============ CONTROLES DE PRESET (solo si no es custom y hay preset seleccionado) ============ */}
      {!isCustomMode && selectedPreset && (
        <>
          {/* Preset 'producto' → mostrar upload producto (como Sora) */}
          {selectedPreset === 'producto' && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Imagen del producto (opcional)
              </label>
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                onChange={handleProductImageUpload}
                className="hidden"
              />
              <div
                onClick={() => productInputRef.current?.click()}
                className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-dashed border-border cursor-pointer hover:border-accent/30 transition-colors"
              >
                {productImageUrl ? (
                  <>
                    <img src={productImageUrl} alt="Producto" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary font-medium">Producto seleccionado</p>
                      <p className="text-[10px] text-accent">Click para cambiar</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setProductImageUrl(null); setProductImageFile(null) }}
                      className="p-1.5 hover:bg-border/50 rounded-lg"
                    >
                      <X className="w-4 h-4 text-text-muted" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-3 w-full justify-center">
                    <Package className="w-5 h-5 text-text-muted" />
                    <p className="text-sm text-text-secondary">Subir imagen del producto</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                Sora creará al personaje ({influencerName}) desde su descripción y mostrará este producto en el video
              </p>
            </div>
          )}

          {/* Preset 'rapido' o 'premium' → mostrar imagen de referencia */}
          {(selectedPreset === 'rapido' || selectedPreset === 'premium') && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Imagen de referencia
              </label>
              <div
                onClick={() => setShowImagePicker('start')}
                className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl border border-border cursor-pointer hover:border-accent/30 transition-colors"
              >
                {startImageUrl ? (
                  <>
                    <img src={startImageUrl} alt="Start" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary font-medium">Imagen seleccionada</p>
                      <p className="text-[10px] text-accent">Click para cambiar</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 py-3">
                    <ImageIcon className="w-5 h-5 text-text-muted" />
                    <p className="text-sm text-text-secondary">Seleccionar de la galería</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ IDEA + OPTIMIZADOR ============ */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Tu idea para el video</label>
        <textarea
          value={userIdea}
          onChange={(e) => setUserIdea(e.target.value)}
          placeholder={isSora
            ? `Ej: ${influencerName} sosteniendo el producto en la mano, caminando por la playa al atardecer, mirando a camara y sonriendo...`
            : `Ej: ${influencerName} caminando por la playa al atardecer, mirando a camara y sonriendo...`
          }
          rows={3}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          onClick={handleOptimizePrompt}
          disabled={isOptimizing || !userIdea.trim()}
          className={cn(
            'mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all',
            isOptimizing || !userIdea.trim()
              ? 'bg-border text-text-muted cursor-not-allowed'
              : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/30'
          )}
        >
          {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {isSora ? 'Optimizar prompt (incluye descripcion del personaje)' : 'Optimizar prompt con IA'}
        </button>
      </div>

      {/* ============ PROMPT OPTIMIZADO ============ */}
      {prompt && (
        <div className="mb-4 p-4 bg-accent/5 border border-accent/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-accent uppercase tracking-wide">Prompt optimizado</h4>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(prompt)
                setCopiedPrompt(true)
                toast.success('Copiado')
                setTimeout(() => setCopiedPrompt(false), 2000)
              }}
              className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 bg-background border border-accent/20 rounded-lg text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {isSora && (
            <p className="text-[10px] text-accent/60 mt-1">
              Este prompt incluye la descripcion detallada de {influencerName} para que Sora recree al personaje
            </p>
          )}
        </div>
      )}

      {/* ============ ERRORES Y RESULTADOS ============ */}
      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {videoUrl && (
        <div className="mb-4 rounded-xl overflow-hidden bg-surface-elevated border border-border">
          <video src={videoUrl} controls className="w-full" autoPlay loop />
        </div>
      )}

      {taskId && !videoUrl && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <p className="text-sm text-amber-400 font-medium">Video en proceso...</p>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Verificando estado automaticamente. Esto puede tardar 1-3 minutos.
          </p>
          <p className="text-[10px] text-text-muted mt-1 font-mono">Task ID: {taskId}</p>
        </div>
      )}

      {/* ============ BOTON GENERAR ============ */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || (!prompt.trim() && !userIdea.trim())}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all',
          isGenerating || (!prompt.trim() && !userIdea.trim())
            ? 'bg-border text-text-secondary cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
        )}
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Generando video...</>
        ) : (
          <><Video className="w-5 h-5" /> Generar Video</>
        )}
      </button>

      {/* ============ IMAGE PICKER MODAL ============ */}
      {showImagePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImagePicker(null)}
        >
          <div
            className="bg-surface rounded-2xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">
                Seleccionar {showImagePicker === 'start' ? 'imagen de inicio' : 'imagen final'}
              </h3>
              <button
                onClick={() => setShowImagePicker(null)}
                className="p-1.5 hover:bg-border/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Foto principal del influencer */}
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">Foto principal</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div
                  onClick={() => {
                    if (showImagePicker === 'start') setStartImageUrl(realisticImageUrl)
                    else setEndImageUrl(realisticImageUrl)
                    setShowImagePicker(null)
                  }}
                  className={cn(
                    'relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all aspect-[9/16]',
                    (showImagePicker === 'start' ? startImageUrl : endImageUrl) === realisticImageUrl
                      ? 'border-accent shadow-lg shadow-accent/25'
                      : 'border-transparent hover:border-accent/30'
                  )}
                >
                  <img src={realisticImageUrl} alt="Realista" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <p className="text-[8px] text-white text-center">Foto realista</p>
                  </div>
                </div>
              </div>

              {/* Galería */}
              {galleryImages.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                    Galeria ({galleryImages.length})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {galleryImages.map((item: any) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (showImagePicker === 'start') setStartImageUrl(item.image_url)
                          else setEndImageUrl(item.image_url)
                          setShowImagePicker(null)
                        }}
                        className={cn(
                          'relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all aspect-[9/16]',
                          (showImagePicker === 'start' ? startImageUrl : endImageUrl) === item.image_url
                            ? 'border-accent shadow-lg shadow-accent/25'
                            : 'border-transparent hover:border-accent/30'
                        )}
                      >
                        <img src={item.image_url} alt={item.situation || ''} className="w-full h-full object-cover" />
                        {item.is_favorite && (
                          <div className="absolute top-1 right-1">
                            <Heart className="w-2.5 h-2.5 text-amber-400 fill-current" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isLoadingGallery && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              )}
              {!isLoadingGallery && galleryImages.length === 0 && (
                <p className="text-xs text-text-muted text-center py-4">
                  No hay imagenes en la galeria. Genera contenido primero en el paso 6.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
