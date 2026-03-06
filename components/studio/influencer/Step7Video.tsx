'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { VIDEO_MODELS, VIDEO_COMPANY_GROUPS, type VideoModelId } from '@/lib/video-providers/types'
import { Video, Loader2, Copy, Check, Wand2, Image as ImageIcon, Heart, X, Package, Info, Plus, Trash2, ChevronDown, ChevronUp, Volume2, VolumeX, Film, Share2, FastForward, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { PublisherModal } from '@/components/studio/PublisherModal'
import { SceneScriptGenerator, type SceneData } from './SceneScriptGenerator'
import { ParallelVideoManager } from './ParallelVideoManager'
import { VideoEditor } from '@/components/studio/video-prompt/VideoEditor'

interface Step7VideoProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
  onBack: () => void
  onSendToEditor?: (clips: { url: string; label: string }[]) => void
  onGoToBoard?: () => void
}

interface MultiPromptScene {
  prompt: string
  duration: number
}

interface ConstructorResult {
  startFramePrompt: string
  endFramePrompt: string
  scenes: MultiPromptScene[]
}

export function Step7Video({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
  onBack,
  onSendToEditor,
  onGoToBoard,
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

  // Influencer selector
  const [allInfluencers, setAllInfluencers] = useState<any[]>([])
  const [selectedInfluencerId, setSelectedInfluencerId] = useState(influencerId)
  const [selectedInfluencerName, setSelectedInfluencerName] = useState(influencerName)
  const [selectedInfluencerImage, setSelectedInfluencerImage] = useState(realisticImageUrl)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/studio/influencer')
        const data = await res.json()
        if (data.influencers) setAllInfluencers(data.influencers)
      } catch {}
    }
    load()
  }, [])

  const handleInfluencerChange = (inf: any) => {
    setSelectedInfluencerId(inf.id)
    setSelectedInfluencerName(inf.name)
    setSelectedInfluencerImage(inf.realistic_image_url || inf.base_image_url || '')
    setStartImageUrl(inf.realistic_image_url || inf.base_image_url || null)
    if (inf.prompt_descriptor) setResolvedDescriptor(inf.prompt_descriptor)
    setPrompt('')
    setVideoUrl(null)
    setError(null)
    // Reset chain state
    setChainScenes(null)
    setChainCurrentIndex(0)
    setChainCompletedVideos([])
    setShowChainEditor(false)
  }

  // Model & config
  const [videoModelId, setVideoModelId] = useState<VideoModelId>('kling-3.0')
  const selectedModel = VIDEO_MODELS[videoModelId]
  const isSora = videoModelId === 'sora-2'
  const isKling30 = videoModelId === 'kling-3.0'

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

  // Script Generator + Parallel Manager
  const [showScriptGenerator, setShowScriptGenerator] = useState(false)
  const [scriptScenes, setScriptScenes] = useState<SceneData[] | null>(null)
  const [showParallelManager, setShowParallelManager] = useState(false)

  // Extend, Publer, navigation
  const [isExtending, setIsExtending] = useState(false)
  const [publishVideoUrl, setPublishVideoUrl] = useState<string | null>(null)
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null)

  // Scene chain state (sequential extend-based generation)
  const [chainScenes, setChainScenes] = useState<SceneData[] | null>(null)
  const [chainCurrentIndex, setChainCurrentIndex] = useState(0)
  const [chainCompletedVideos, setChainCompletedVideos] = useState<
    { url: string; taskId: string; sceneIndex: number; label: string }[]
  >([])
  const [showChainEditor, setShowChainEditor] = useState(false)

  // === Kling 3.0 specific state ===
  const [isMultiShot, setIsMultiShot] = useState(false)
  const [enableAudio, setEnableAudio] = useState(true)
  const [multiPrompts, setMultiPrompts] = useState<MultiPromptScene[]>([
    { prompt: '', duration: 4 },
    { prompt: '', duration: 4 },
    { prompt: '', duration: 3 },
  ])
  const [showConstructor, setShowConstructor] = useState(false)
  const [constructorProduct, setConstructorProduct] = useState('')
  const [constructorAngles, setConstructorAngles] = useState('')
  const [constructorScenario, setConstructorScenario] = useState('')
  const [constructorResults, setConstructorResults] = useState<ConstructorResult | null>(null)
  const [isConstructing, setIsConstructing] = useState(false)

  // Computed: total duration of multi-shot scenes
  const multiShotTotalDuration = multiPrompts.reduce((sum, s) => sum + s.duration, 0)

  // Cargar galería
  useEffect(() => {
    if (!selectedInfluencerId) return
    const loadGallery = async () => {
      setIsLoadingGallery(true)
      try {
        const res = await fetch(`/api/studio/influencer/gallery?influencerId=${selectedInfluencerId}`)
        const data = await res.json()
        if (data.items) setGalleryImages(data.items)
      } catch (err) {
        console.error('Error loading gallery:', err)
      } finally {
        setIsLoadingGallery(false)
      }
    }
    loadGallery()
  }, [selectedInfluencerId])

  const refreshGallery = async () => {
    if (!selectedInfluencerId) return
    try {
      const res = await fetch(`/api/studio/influencer/gallery?influencerId=${selectedInfluencerId}`)
      const data = await res.json()
      if (data.items) setGalleryImages(data.items)
    } catch {}
  }

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

  // Reset Kling 3.0 state when switching away
  useEffect(() => {
    if (!isKling30) {
      setIsMultiShot(false)
      setEnableAudio(true)
      setMultiPrompts([
        { prompt: '', duration: 4 },
        { prompt: '', duration: 4 },
        { prompt: '', duration: 3 },
      ])
      setConstructorResults(null)
      setShowConstructor(false)
      // Reset duration to standard 5s/10s
      if (duration !== 5 && duration !== 10) {
        setDuration(5)
      }
    }
  }, [isKling30])

  // When multi-shot is toggled on, force audio and restrict video mode
  useEffect(() => {
    if (isMultiShot) {
      setEnableAudio(true)
      // Multi-shot: only "Imagen Inicial" mode (no end frame)
      if (videoMode === 'start_end') {
        setVideoMode('image')
      }
    }
  }, [isMultiShot])

  // Polling for video status
  useEffect(() => {
    if (!taskId || videoUrl) return // No poll si no hay task o ya tenemos video

    let cancelled = false
    let pollCount = 0
    const MAX_POLLS = 60 // 5 minutos máximo (60 * 5s)

    const poll = async () => {
      if (cancelled || pollCount >= MAX_POLLS) {
        if (pollCount >= MAX_POLLS) {
          setError(chainScenes
            ? 'La escena tardó demasiado. Usa el botón Reintentar.'
            : 'El video está tardando demasiado. Puedes verificar en el tab de Video principal.')
          setIsGenerating(false)
          setTaskId(null)
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
          setCompletedTaskId(taskId)
          setIsGenerating(false)
          toast.success('¡Video generado!')

          // Si estamos en modo chain, acumular video completado
          if (chainScenes) {
            setChainCompletedVideos(prev => [
              ...prev,
              {
                url: data.videoUrl,
                taskId: taskId,
                sceneIndex: chainCurrentIndex,
                label: `Escena ${chainScenes[chainCurrentIndex]?.sceneNumber || chainCurrentIndex + 1}`,
              },
            ])
          }

          // Guardar video en la galería del influencer
          try {
            const saveBody = {
              influencerId: selectedInfluencerId,
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
          setTaskId(null)
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
          influencerId: selectedInfluencerId,
          optimizeVideoPrompt: true,
          videoModelId,
          userIdea: userIdea.trim(),
          promptDescriptor: resolvedDescriptor,
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

  // === Constructor Inteligente handler ===
  const handleConstructor = async () => {
    if (!constructorProduct.trim()) {
      toast.error('Describe el producto')
      return
    }

    setIsConstructing(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/video-constructor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: selectedInfluencerId,
          productDescription: constructorProduct.trim(),
          salesAngles: constructorAngles.trim(),
          scenario: constructorScenario.trim(),
          promptDescriptor: resolvedDescriptor,
          influencerName: selectedInfluencerName,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar prompts')
      }

      setConstructorResults(data.result)
      toast.success(`${data.result.scenes.length} escenas generadas`)
    } catch (err: any) {
      console.error('[Step7Video] Constructor error:', err)
      setError(err.message)
      toast.error('Error al generar prompts')
    } finally {
      setIsConstructing(false)
    }
  }

  const handleApplyConstructorResults = () => {
    if (!constructorResults) return
    setMultiPrompts(constructorResults.scenes.map(s => ({ prompt: s.prompt, duration: s.duration })))
    setIsMultiShot(true)
    setShowConstructor(false)
    toast.success('Escenas aplicadas al editor')
  }

  // === Multi-shot scene handlers ===
  const updateScene = (index: number, field: 'prompt' | 'duration', value: string | number) => {
    setMultiPrompts(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const addScene = () => {
    const remaining = 15 - multiShotTotalDuration
    if (remaining < 1) {
      toast.error('No queda duración disponible (máx 15s)')
      return
    }
    setMultiPrompts(prev => [...prev, { prompt: '', duration: Math.min(3, remaining) }])
  }

  const removeScene = (index: number) => {
    if (multiPrompts.length <= 2) {
      toast.error('Mínimo 2 escenas')
      return
    }
    setMultiPrompts(prev => prev.filter((_, i) => i !== index))
  }

  // (presets removed — direct model selection)

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

    // === Multi-shot mode (Kling 3.0) ===
    if (isKling30 && isMultiShot) {
      const validScenes = multiPrompts.filter(s => s.prompt.trim())
      if (validScenes.length < 2) {
        toast.error('Escribe al menos 2 escenas para multi-shot')
        return
      }
      if (multiShotTotalDuration < 3 || multiShotTotalDuration > 15) {
        toast.error(`La duración total debe ser entre 3 y 15 segundos (actual: ${multiShotTotalDuration}s)`)
        return
      }

      // Use first scene prompt as the main prompt
      const mainPrompt = validScenes[0].prompt

      setIsGenerating(true)
      setError(null)
      setVideoUrl(null)
      setTaskId(null)

      try {
        let imageBase64: string | undefined
        if ((videoMode === 'image' || videoMode === 'start_end') && startImageUrl) {
          imageBase64 = await getBase64FromUrl(startImageUrl)
        }

        console.log('[Step7Video] Generating multi-shot video:', {
          modelId: videoModelId,
          scenes: validScenes.length,
          totalDuration: multiShotTotalDuration,
          hasStartImage: !!imageBase64,
        })

        const res = await fetch('/api/studio/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: videoModelId,
            prompt: mainPrompt,
            duration: multiShotTotalDuration,
            aspectRatio,
            enableAudio: true,
            imageBase64,
            multiShots: true,
            multiPrompt: validScenes,
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
          toast.success('Video multi-shot en proceso...')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsGenerating(false)
      }
      return
    }

    // === Standard single-shot mode ===
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
          enableAudio: isKling30 ? enableAudio : (model?.supportsAudio ? true : false),
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

  // Determine if generate button should be enabled
  const canGenerate = isKling30 && isMultiShot
    ? multiPrompts.filter(s => s.prompt.trim()).length >= 2 && multiShotTotalDuration >= 3 && multiShotTotalDuration <= 15
    : !!(prompt.trim() || userIdea.trim())

  // Check if current model is Veo (for extend button)
  const isVeoModel = videoModelId.startsWith('veo-')

  const handleExtend = async () => {
    if (!completedTaskId || isExtending) return

    setIsExtending(true)
    setError(null)

    try {
      const veoModel = videoModelId.includes('fast') ? 'veo3_fast' : 'veo3'
      const extendPrompt = prompt.trim() || userIdea.trim() || 'Continue the scene naturally'

      const res = await fetch('/api/studio/extend-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: completedTaskId,
          prompt: extendPrompt,
          model: veoModel,
        }),
      })

      const data = await res.json()

      if (!data.success || !data.taskId) {
        throw new Error(data.error || 'No se pudo extender el video')
      }

      // Set new taskId to trigger polling for extended video
      setVideoUrl(null)
      setCompletedTaskId(null)
      setTaskId(data.taskId)
      setIsGenerating(true)
      toast.success('Extendiendo video...')
    } catch (err: any) {
      setError(err.message || 'Error al extender video')
    } finally {
      setIsExtending(false)
    }
  }

  // === CHAIN: Generate next scene via Veo Extend ===
  const handleNextScene = async () => {
    if (!completedTaskId || !chainScenes || isExtending) return

    const nextIndex = chainCurrentIndex + 1
    if (nextIndex >= chainScenes.length) return

    setIsExtending(true)
    setError(null)

    try {
      const veoModel = videoModelId.includes('fast') ? 'veo3_fast' : 'veo3'
      const nextPrompt = chainScenes[nextIndex].veoPrompt

      const res = await fetch('/api/studio/extend-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: completedTaskId,
          prompt: nextPrompt,
          model: veoModel,
        }),
      })

      const data = await res.json()
      if (!data.success || !data.taskId) {
        throw new Error(data.error || 'No se pudo generar siguiente escena')
      }

      setChainCurrentIndex(nextIndex)
      setPrompt(nextPrompt)
      setVideoUrl(null)
      setCompletedTaskId(null)
      setTaskId(data.taskId)
      setIsGenerating(true)
      toast.success(`Generando escena ${nextIndex + 1}/${chainScenes.length}...`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsExtending(false)
    }
  }

  // === CHAIN: Retry failed scene using last completed video's taskId ===
  const handleRetryScene = async () => {
    if (!chainScenes || !chainCompletedVideos.length || isExtending) return

    const lastCompleted = chainCompletedVideos[chainCompletedVideos.length - 1]

    setIsExtending(true)
    setError(null)

    try {
      const veoModel = videoModelId.includes('fast') ? 'veo3_fast' : 'veo3'
      const retryPrompt = chainScenes[chainCurrentIndex].veoPrompt

      const res = await fetch('/api/studio/extend-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: lastCompleted.taskId,
          prompt: retryPrompt,
          model: veoModel,
        }),
      })

      const data = await res.json()
      if (!data.success || !data.taskId) {
        throw new Error(data.error || 'No se pudo reintentar la escena')
      }

      setPrompt(retryPrompt)
      setVideoUrl(null)
      setCompletedTaskId(null)
      setTaskId(data.taskId)
      setIsGenerating(true)
      toast.success(`Reintentando escena ${chainCurrentIndex + 1}/${chainScenes.length}...`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsExtending(false)
    }
  }

  const isChainComplete = chainScenes && chainCompletedVideos.length === chainScenes.length
  const hasNextScene = chainScenes && chainCurrentIndex < chainScenes.length - 1
  const canRetryChainScene = chainScenes && !isGenerating && !completedTaskId && chainCompletedVideos.length > 0 && !isChainComplete

  // VideoEditor mode: show editor when all chain scenes complete and user clicks "Enviar al Editor"
  if (showChainEditor && chainCompletedVideos.length > 0) {
    return (
      <VideoEditor
        initialClips={chainCompletedVideos.map(cv => ({
          url: cv.url,
          label: cv.label,
        }))}
        onBack={() => setShowChainEditor(false)}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        Genera videos con tu influencer. Describe tu idea y optimizaremos el prompt para el modelo elegido.
      </p>

      {/* ============ INFLUENCER SELECTOR ============ */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Influencer</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {allInfluencers.map((inf: any) => (
            <button
              key={inf.id}
              onClick={() => handleInfluencerChange(inf)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
                selectedInfluencerId === inf.id
                  ? 'bg-accent/15 border-accent shadow-md'
                  : 'bg-surface-elevated border-border hover:border-text-muted'
              )}
            >
              <img
                src={inf.realistic_image_url || inf.base_image_url || ''}
                alt={inf.name}
                className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
              />
              <div className="text-left">
                <p className={cn('text-xs font-semibold', selectedInfluencerId === inf.id ? 'text-accent' : 'text-text-primary')}>
                  {inf.name}
                </p>
              </div>
            </button>
          ))}
          {allInfluencers.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated rounded-xl border border-border">
              <img src={realisticImageUrl} alt={influencerName} className="w-9 h-9 rounded-lg object-cover" />
              <p className="text-xs font-semibold text-text-primary">{influencerName}</p>
            </div>
          )}
        </div>
      </div>

      {/* ============ MODELO DE VIDEO ============ */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Modelo de IA</label>
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
                detallada de tu influencer ({selectedInfluencerName}) como prompt para que Sora genere al personaje.
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
              onClick={() => { setVideoMode('image'); setEndImageUrl(null); if (!startImageUrl) setStartImageUrl(selectedInfluencerImage) }}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                videoMode === 'image'
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
              )}
            >
              Imagen Inicial
            </button>
            {selectedModel?.supportsStartEndFrames && !isMultiShot && (
              <button
                onClick={() => { setVideoMode('start_end'); if (!startImageUrl) setStartImageUrl(selectedInfluencerImage) }}
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

          {/* Imagen final (solo start_end, no multi-shot) */}
          {videoMode === 'start_end' && !isMultiShot && (
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
            Sora creara al personaje ({selectedInfluencerName}) desde su descripcion y mostrara este producto en el video
          </p>
        </div>
      )}

      {/* ============ KLING 3.0 SECTION ============ */}
      {isKling30 && (
        <div className="mb-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Film className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wide">Kling 3.0</h3>
          </div>

          {/* Shot Mode Toggle */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Shot</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMultiShot(false)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                  !isMultiShot
                    ? 'bg-purple-500/15 border-purple-500 text-purple-400'
                    : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                )}
              >
                Single Shot
              </button>
              <button
                onClick={() => setIsMultiShot(true)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border',
                  isMultiShot
                    ? 'bg-purple-500/15 border-purple-500 text-purple-400'
                    : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                )}
              >
                Multi-Shot
              </button>
            </div>
          </div>

          {/* Audio Toggle */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Audio</label>
            <button
              onClick={() => { if (!isMultiShot) setEnableAudio(!enableAudio) }}
              disabled={isMultiShot}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all border',
                enableAudio
                  ? 'bg-blue-500/15 border-blue-500/50 text-blue-400'
                  : 'bg-surface-elevated border-border text-text-secondary',
                isMultiShot && 'opacity-70 cursor-not-allowed'
              )}
            >
              {enableAudio ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {enableAudio ? 'Audio ON' : 'Audio OFF'}
              {isMultiShot && <span className="text-[9px] text-text-muted ml-1">(requerido en multi-shot)</span>}
            </button>
          </div>

          {/* Duration: Slider for single-shot, hidden for multi-shot (total computed from scenes) */}
          {!isMultiShot && (
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Duracion: {duration}s
              </label>
              <input
                type="range"
                min={3}
                max={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[9px] text-text-muted mt-1">
                <span>3s</span>
                <span>15s</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ DURACION Y ASPECTO (non-Kling 3.0) ============ */}
      {!isKling30 && (
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
      )}

      {/* ============ KLING 3.0: CONSTRUCTOR INTELIGENTE (only multi-shot) ============ */}
      {isKling30 && isMultiShot && (
        <div className="mb-4">
          <button
            onClick={() => setShowConstructor(!showConstructor)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl text-sm font-semibold text-purple-400 hover:from-purple-500/15 hover:to-blue-500/15 transition-all"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Constructor Inteligente
            </div>
            {showConstructor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showConstructor && (
            <div className="mt-3 p-4 bg-surface-elevated border border-border rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Descripcion del producto</label>
                <textarea
                  value={constructorProduct}
                  onChange={(e) => setConstructorProduct(e.target.value)}
                  placeholder="Ej: Suplemento de magnesio en polvo, sabor limón, ayuda a dormir mejor..."
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Angulos de venta / puntos de dolor</label>
                <textarea
                  value={constructorAngles}
                  onChange={(e) => setConstructorAngles(e.target.value)}
                  placeholder="Ej: Mejora el sueño, reduce estrés, alivia dolor muscular, más energía..."
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Escenario</label>
                <input
                  value={constructorScenario}
                  onChange={(e) => setConstructorScenario(e.target.value)}
                  placeholder="Ej: en la cocina, en un parque, en el gimnasio..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <button
                onClick={handleConstructor}
                disabled={isConstructing || !constructorProduct.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all',
                  isConstructing || !constructorProduct.trim()
                    ? 'bg-border text-text-muted cursor-not-allowed'
                    : 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30'
                )}
              >
                {isConstructing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                Generar prompts con IA
              </button>

              {/* Constructor Results */}
              {constructorResults && (
                <div className="mt-3 space-y-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Resultados generados</p>

                  {/* Start Frame Prompt */}
                  <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ImageIcon className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] font-semibold text-green-400 uppercase">Imagen Inicial</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{constructorResults.startFramePrompt}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(constructorResults.startFramePrompt)
                        toast.success('Prompt de imagen inicial copiado')
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[9px] text-green-400 hover:text-green-300"
                    >
                      <Copy className="w-2.5 h-2.5" /> Copiar para generar foto en galeria
                    </button>
                  </div>

                  {/* End Frame Prompt */}
                  <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ImageIcon className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] font-semibold text-blue-400 uppercase">Imagen Final</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{constructorResults.endFramePrompt}</p>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(constructorResults.endFramePrompt)
                        toast.success('Prompt de imagen final copiado')
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300"
                    >
                      <Copy className="w-2.5 h-2.5" /> Copiar para generar foto en galeria
                    </button>
                  </div>

                  {/* Scene Previews */}
                  {constructorResults.scenes.map((scene, i) => (
                    <div key={i} className="p-3 bg-purple-500/5 border border-purple-500/15 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-purple-400">Escena {i + 1}</span>
                        <span className="text-[9px] text-text-muted">{scene.duration}s</span>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">{scene.prompt}</p>
                    </div>
                  ))}

                  {/* Apply button */}
                  <button
                    onClick={handleApplyConstructorResults}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/20 text-purple-400 rounded-xl text-xs font-semibold hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aplicar al video
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ GUION POR ESCENAS (Veo 3.1) ============ */}
      <div className="mb-4">
        <button
          onClick={() => setShowScriptGenerator(!showScriptGenerator)}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border',
            showScriptGenerator
              ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
              : 'bg-teal-500/10 text-teal-500 border-teal-500/20 hover:bg-teal-500/15'
          )}
        >
          <Film className="w-4 h-4" />
          Guion por Escenas
        </button>
        {showScriptGenerator && (
          <SceneScriptGenerator
            influencerId={selectedInfluencerId}
            influencerName={selectedInfluencerName}
            promptDescriptor={resolvedDescriptor}
            realisticImageUrl={startImageUrl || selectedInfluencerImage}
            onFillVeoPrompt={(prompt, _index) => {
              setVideoModelId('veo-3.1' as any)
              setPrompt(prompt)
              setShowScriptGenerator(false)
            }}
            onStartSequential={(scenes) => {
              setChainScenes(scenes)
              setChainCurrentIndex(0)
              setChainCompletedVideos([])
              setShowChainEditor(false)
              setScriptScenes(scenes)
              setVideoModelId('veo-3.1' as any)
              setPrompt(scenes[0].veoPrompt)
              setShowScriptGenerator(false)
            }}
            onGenerateAll={(scenes) => {
              setScriptScenes(scenes)
              setShowParallelManager(true)
              setShowScriptGenerator(false)
            }}
          />
        )}
      </div>

      {showParallelManager && scriptScenes && (
        <ParallelVideoManager
          scenes={scriptScenes}
          influencerId={selectedInfluencerId}
          influencerName={selectedInfluencerName}
          realisticImageUrl={startImageUrl || selectedInfluencerImage}
          aspectRatio={aspectRatio}
          modelId={videoModelId}
          onComplete={() => {
            setShowParallelManager(false)
            setScriptScenes(null)
            refreshGallery()
          }}
          onClose={() => {
            setShowParallelManager(false)
            refreshGallery()
          }}
          onSendToEditor={onSendToEditor}
          onGoToBoard={onGoToBoard}
        />
      )}

      {/* ============ KLING 3.0: SCENE EDITOR (multi-shot) ============ */}
      {isKling30 && isMultiShot && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Editor de Escenas</label>
            <span className={cn(
              'text-xs font-mono font-semibold px-2 py-0.5 rounded-full',
              multiShotTotalDuration > 15 || multiShotTotalDuration < 3
                ? 'bg-red-500/15 text-red-400'
                : 'bg-green-500/15 text-green-400'
            )}>
              {multiShotTotalDuration}s / 15s
            </span>
          </div>

          <div className="space-y-3">
            {multiPrompts.map((scene, index) => (
              <div key={index} className="p-3 bg-surface-elevated border border-border rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-primary">Escena {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">{scene.duration}s</span>
                    {multiPrompts.length > 2 && (
                      <button
                        onClick={() => removeScene(index)}
                        className="p-1 hover:bg-red-500/10 rounded-lg text-text-muted hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={scene.prompt}
                  onChange={(e) => updateScene(index, 'prompt', e.target.value)}
                  placeholder={`Describe la escena ${index + 1}... (máx 500 caracteres)`}
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 mb-2"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-text-muted">{scene.prompt.length}/500</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">Duracion:</span>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={scene.duration}
                      onChange={(e) => updateScene(index, 'duration', Number(e.target.value))}
                      className="w-24 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <span className="text-xs font-mono text-purple-400 w-6 text-right">{scene.duration}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add scene button */}
          <button
            onClick={addScene}
            disabled={multiShotTotalDuration >= 15}
            className={cn(
              'mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border border-dashed',
              multiShotTotalDuration >= 15
                ? 'border-border text-text-muted cursor-not-allowed'
                : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar escena
          </button>

          {/* Total duration warning */}
          {(multiShotTotalDuration > 15 || multiShotTotalDuration < 3) && (
            <p className="text-[10px] text-red-400 mt-1.5">
              {multiShotTotalDuration > 15
                ? `La duración total excede 15s. Reduce la duración de las escenas.`
                : `La duración total debe ser al menos 3s.`}
            </p>
          )}
        </div>
      )}

      {/* ============ ASPECT RATIO (Kling 3.0 — shown after scene editor for multi-shot, or after duration for single) ============ */}
      {isKling30 && (
        <div className="mb-4">
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
      )}

      {/* ============ IDEA + OPTIMIZADOR (hidden in multi-shot mode) ============ */}
      {!(isKling30 && isMultiShot) && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Tu idea para el video</label>
          <textarea
            value={userIdea}
            onChange={(e) => setUserIdea(e.target.value)}
            placeholder={isSora
              ? `Ej: ${selectedInfluencerName} sosteniendo el producto en la mano, caminando por la playa al atardecer, mirando a camara y sonriendo...`
              : `Ej: ${selectedInfluencerName} caminando por la playa al atardecer, mirando a camara y sonriendo...`
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
      )}

      {/* ============ PROMPT OPTIMIZADO (hidden in multi-shot mode) ============ */}
      {prompt && !(isKling30 && isMultiShot) && (
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
              Este prompt incluye la descripcion detallada de {selectedInfluencerName} para que Sora recree al personaje
            </p>
          )}
        </div>
      )}

      {/* ============ ERRORES Y RESULTADOS ============ */}
      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error.length > 150 ? 'Error del servidor al generar video. Reintenta.' : error}</p>
          {/* Reintentar escena en modo chain */}
          {canRetryChainScene && (
            <button
              onClick={handleRetryScene}
              disabled={isExtending}
              className="mt-2 flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/30 transition-all border border-amber-500/30"
            >
              {isExtending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5" />}
              Reintentar Escena {chainCurrentIndex + 1}/{chainScenes?.length}
            </button>
          )}
        </div>
      )}

      {videoUrl && (
        <div className="mb-4 flex flex-col items-center">
          <div className={cn(
            'rounded-xl overflow-hidden bg-black border border-border',
            aspectRatio === '9:16' ? 'w-[45%] max-w-[220px]' : aspectRatio === '1:1' ? 'w-[50%] max-w-[300px]' : 'w-full max-w-lg'
          )}>
            <div
              className="relative"
              style={{ aspectRatio: aspectRatio === '16:9' ? '16/9' : aspectRatio === '9:16' ? '9/16' : '1/1' }}
            >
              <video src={videoUrl} controls className="w-full h-full object-contain bg-black" autoPlay loop />
            </div>
          </div>
          {/* Action buttons below video */}
          <div className="flex items-center gap-2 mt-3">
            {/* Siguiente Escena (modo chain) */}
            {chainScenes && hasNextScene && completedTaskId && !isGenerating && (
              <button
                onClick={handleNextScene}
                disabled={isExtending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                  isExtending ? 'text-teal-400 animate-pulse border-teal-500/30' : 'text-teal-400 border-teal-500/30 hover:bg-teal-500/10'
                )}
              >
                {isExtending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5" />}
                Siguiente Escena ({chainCurrentIndex + 2}/{chainScenes.length})
              </button>
            )}
            {/* Extend normal (sin chain) */}
            {!chainScenes && isVeoModel && completedTaskId && (
              <button
                onClick={handleExtend}
                disabled={isExtending || isGenerating}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border',
                  isExtending ? 'text-accent animate-pulse border-accent/30' : 'text-text-secondary border-border hover:text-accent hover:border-accent/30'
                )}
                title="Extender video (+segundos)"
              >
                {isExtending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5" />}
                Extender
              </button>
            )}
            {/* Publicar */}
            <button
              onClick={() => setPublishVideoUrl(videoUrl)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary border border-border hover:text-accent hover:border-accent/30 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Compartir
            </button>
            {/* Volver a pizarra */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary border border-border hover:text-accent hover:border-accent/30 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Pizarra
            </button>
          </div>
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

      {/* ============ ESCENAS COMPLETADAS (chain mode) ============ */}
      {chainCompletedVideos.length > 0 && (
        <div className="mt-4 mb-4 space-y-2">
          <h4 className="text-xs font-bold text-[#e5e5e5] uppercase tracking-wide">
            Escenas Completadas ({chainCompletedVideos.length}/{chainScenes?.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {chainCompletedVideos.map((cv) => (
              <div key={cv.sceneIndex} className="rounded-xl border border-green-500/30 bg-green-500/5 p-2">
                <video
                  src={cv.url}
                  controls
                  muted
                  playsInline
                  className="w-full rounded-lg aspect-video object-contain bg-black"
                />
                <p className="text-[10px] text-green-400 font-medium mt-1">{cv.label}</p>
              </div>
            ))}
          </div>

          {/* Botón Enviar al Editor — cuando todas las escenas están completas */}
          {isChainComplete && (
            <button
              onClick={() => setShowChainEditor(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-sm font-bold hover:from-pink-500 hover:to-rose-500 transition-all shadow-lg shadow-pink-500/25 mt-3"
            >
              <Film className="w-4 h-4" />
              Enviar al Editor ({chainCompletedVideos.length} clips)
            </button>
          )}
        </div>
      )}

      {/* ============ BOTON GENERAR ============ */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !canGenerate}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all',
          isGenerating || !canGenerate
            ? 'bg-border text-text-secondary cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
        )}
      >
        {isGenerating ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Generando video...</>
        ) : (
          <><Video className="w-5 h-5" /> {isKling30 && isMultiShot ? `Generar Video Multi-Shot (${multiShotTotalDuration}s)` : 'Generar Video'}</>
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
                    if (showImagePicker === 'start') setStartImageUrl(selectedInfluencerImage)
                    else setEndImageUrl(selectedInfluencerImage)
                    setShowImagePicker(null)
                  }}
                  className={cn(
                    'relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all aspect-[9/16]',
                    (showImagePicker === 'start' ? startImageUrl : endImageUrl) === selectedInfluencerImage
                      ? 'border-accent shadow-lg shadow-accent/25'
                      : 'border-transparent hover:border-accent/30'
                  )}
                >
                  <img src={selectedInfluencerImage} alt="Realista" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <p className="text-[8px] text-white text-center">Foto realista</p>
                  </div>
                </div>
              </div>

              {/* Galería */}
              {galleryImages.filter((item: any) => item.content_type !== 'video').length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                    Galeria ({galleryImages.filter((item: any) => item.content_type !== 'video').length})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {galleryImages.filter((item: any) => item.content_type !== 'video').map((item: any) => (
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
      {/* Publisher modal (Publer) */}
      <PublisherModal
        isOpen={publishVideoUrl !== null}
        onClose={() => setPublishVideoUrl(null)}
        mediaUrl={publishVideoUrl ?? undefined}
        contentType="video"
        defaultCaption={userIdea || prompt.substring(0, 200) || `Video de ${selectedInfluencerName} generado con IA`}
      />
    </div>
  )
}
