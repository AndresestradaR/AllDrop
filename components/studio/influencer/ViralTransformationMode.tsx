'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { VIDEO_COMPANY_GROUPS, type VideoModelId } from '@/lib/video-providers/types'
import { Loader2, Upload, Sparkles, Film, Trash2, ChevronDown, ChevronUp, Copy, Check, Play, AlertCircle, RefreshCw, Zap, Scissors } from 'lucide-react'
import toast from 'react-hot-toast'
import { createBrowserClient } from '@supabase/ssr'

interface ViralTransformationModeProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
  onSendToEditor?: (clips: { url: string; label: string }[]) => void
}

interface ViralScene {
  sceneNumber: number
  sceneType: 'transformation' | 'influencer' | 'beauty-shot' | 'product-demo'
  sceneDescription: string
  imagePrompt: string
  imagePromptEnd?: string | null // Last frame for transformation scenes (first-last-frame video)
  animationPrompt: string
  influencerDialogue: string | null
  duration: number
  static: boolean
  complexity: string
  usesInfluencer: boolean
  usesProductPhoto: boolean
  startsAtSecond?: number
}

interface ViralScriptResult {
  videoTitle: string
  videoConcept: string
  detectedStyle?: string
  referenceAnalysis: string
  fullScript?: string
  totalDuration: number
  scenes: ViralScene[]
  productionNotes: string
}

export function ViralTransformationMode({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
  onSendToEditor,
}: ViralTransformationModeProps) {
  // Product context (loaded from persisted data)
  const [productDescription, setProductDescription] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [isLoadingContext, setIsLoadingContext] = useState(false)

  // Products list for selector
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  // Sales angles
  const [savedAngles, setSavedAngles] = useState<Array<{ id: string; product_name: string; angle_data: any }>>([])
  const [selectedAngle, setSelectedAngle] = useState<any>(null)

  // Reference video
  const [referenceVideoFile, setReferenceVideoFile] = useState<File | null>(null)
  const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Product images
  const [productImageUrls, setProductImageUrls] = useState<string[]>([])

  // Script generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [scriptResult, setScriptResult] = useState<ViralScriptResult | null>(null)
  const [sceneCount, setSceneCount] = useState(5)
  const [error, setError] = useState<string | null>(null)

  // Scene editing
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Video model for generation
  const [videoModelId, setVideoModelId] = useState<VideoModelId>('veo-3.1-fast')
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16')

  // Per-scene video generation state
  // Pipeline: 'idle' → 'generating-image' → 'generating-video' → 'polling' → 'completed'
  type SceneVideoStatus = 'idle' | 'generating-image' | 'generating-video' | 'polling' | 'completed' | 'error'
  const [sceneVideoStates, setSceneVideoStates] = useState<Map<number, {
    status: SceneVideoStatus
    taskId: string | null
    videoUrl: string | null
    imagePreview: string | null // base64 of generated first frame
    error: string | null
    pollCount: number
  }>>(new Map())
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const activeGenerationsRef = useRef(0)
  const cancelledRef = useRef(false)
  // Image model for first frame generation
  const [imageModelId, setImageModelId] = useState<string>('nano-banana-2')
  const MAX_CONCURRENT = 2 // Lower: 2 steps per scene (image + video)
  const MAX_POLLS = 60
  const POLL_INTERVAL = 5000

  const updateSceneVideo = useCallback((index: number, update: Partial<{
    status: SceneVideoStatus
    taskId: string | null
    videoUrl: string | null
    imagePreview: string | null
    error: string | null
    pollCount: number
  }>) => {
    setSceneVideoStates(prev => {
      const next = new Map(prev)
      const current = next.get(index) || { status: 'idle' as SceneVideoStatus, taskId: null, videoUrl: null, imagePreview: null, error: null, pollCount: 0 }
      next.set(index, { ...current, ...update })
      return next
    })
  }, [])

  // Poll a scene's video status
  const pollSceneVideo = useCallback(async (index: number, taskId: string): Promise<void> => {
    let pollCount = 0
    const poll = async (): Promise<void> => {
      if (cancelledRef.current || pollCount >= MAX_POLLS) {
        if (pollCount >= MAX_POLLS) {
          updateSceneVideo(index, { status: 'error', error: 'Timeout: el video tardó demasiado' })
        }
        activeGenerationsRef.current--
        return
      }
      pollCount++
      updateSceneVideo(index, { pollCount })
      try {
        const res = await fetch(`/api/studio/video-status?taskId=${taskId}`)
        const data = await res.json()
        if (cancelledRef.current) { activeGenerationsRef.current--; return }
        if (data.status === 'completed' && data.videoUrl) {
          updateSceneVideo(index, { status: 'completed', videoUrl: data.videoUrl })
          // Save to gallery
          try {
            await fetch('/api/studio/influencer/gallery', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                influencerId,
                image_url: data.videoUrl,
                video_url: data.videoUrl,
                content_type: 'video',
                type: 'solo',
                situation: `Viral Escena ${index + 1}`,
                prompt_used: scriptResult?.scenes[index]?.animationPrompt || '',
              }),
            })
          } catch {} // silent
          activeGenerationsRef.current--
          return
        }
        if (data.status === 'failed') {
          updateSceneVideo(index, { status: 'error', error: data.error || 'Video falló' })
          activeGenerationsRef.current--
          return
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL))
        return poll()
      } catch {
        await new Promise(r => setTimeout(r, 8000))
        return poll()
      }
    }
    await new Promise(r => setTimeout(r, 3000))
    return poll()
  }, [updateSceneVideo, influencerId, scriptResult])

  // ═══════════════════════════════════════════════════════════════════
  // 2-STEP PIPELINE: Get/Generate first frame → Animate with video model
  //
  // Strategy: ALWAYS generate a new image for every scene using imagePrompt
  // (which contains the scene/setting from the reference video analysis).
  // Pass the influencer photo + product photo as REFERENCES so the AI
  // keeps the right face and product, but creates the new scene/setting.
  // ═══════════════════════════════════════════════════════════════════

  // Helper: fetch an image URL and return base64
  const fetchImageAsBase64 = useCallback(async (url: string): Promise<{ data: string; mimeType: string } | null> => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const blob = await res.blob()
      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      return { data: base64, mimeType: blob.type || 'image/jpeg' }
    } catch {
      return null
    }
  }, [])

  // Cache fetched reference images (base64) so we don't re-download for every scene
  const referenceImagesCache = useRef<{
    influencer: { data: string; mimeType: string } | null
    products: { data: string; mimeType: string }[]
  } | null>(null)

  const loadReferenceImagesCache = useCallback(async () => {
    if (referenceImagesCache.current) return referenceImagesCache.current

    let influencerRef: { data: string; mimeType: string } | null = null
    const productRefs: { data: string; mimeType: string }[] = []

    // Load influencer image
    if (realisticImageUrl) {
      influencerRef = await fetchImageAsBase64(realisticImageUrl)
    }
    // Load ALL product images (up to 3)
    for (const url of productImageUrls.slice(0, 3)) {
      const img = await fetchImageAsBase64(url)
      if (img) productRefs.push(img)
    }

    const cache = { influencer: influencerRef, products: productRefs }
    referenceImagesCache.current = cache
    return cache
  }, [realisticImageUrl, productImageUrls, fetchImageAsBase64])

  const generateSceneVideo = useCallback(async (index: number, scene: ViralScene) => {
    if (cancelledRef.current) return
    activeGenerationsRef.current++
    updateSceneVideo(index, { status: 'generating-image', taskId: null, videoUrl: null, imagePreview: null, error: null, pollCount: 0 })

    try {
      // ── STEP 1: Generate scene image using imagePrompt + SCENE-SPECIFIC references ──
      // imagePrompt has the setting/scenario from the reference video analysis.
      // We only pass the references that THIS scene actually needs:
      //   usesInfluencer → influencer photo as reference
      //   usesProductPhoto → product photos as reference
      //   both → both
      //   neither → no references (pure scene generation from prompt)
      const cache = await loadReferenceImagesCache()
      const sceneRefs: { data: string; mimeType: string }[] = []

      if (scene.usesInfluencer && cache.influencer) {
        sceneRefs.push(cache.influencer)
      }
      if (scene.usesProductPhoto && cache.products.length > 0) {
        sceneRefs.push(...cache.products)
      }
      // If scene doesn't specify, but we have product images, still pass them
      // for visual context (the product should be recognizable across scenes)
      if (!scene.usesInfluencer && !scene.usesProductPhoto && cache.products.length > 0) {
        sceneRefs.push(cache.products[0]) // Just the main product photo for context
      }

      // Build prompt: imagePrompt (scene setting from reference video) + descriptors
      let fullImagePrompt = scene.imagePrompt
      if (scene.usesInfluencer && promptDescriptor) {
        fullImagePrompt += `. The person in this scene must look exactly like the reference person: ${promptDescriptor}`
      }
      if (scene.usesProductPhoto && productImageUrls.length > 0) {
        fullImagePrompt += `. The product shown must match the reference product photo exactly.`
      }

      const imgRes = await fetch('/api/studio/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: imageModelId,
          prompt: fullImagePrompt,
          aspectRatio,
          ...(sceneRefs.length > 0 ? { referenceImages: sceneRefs } : {}),
        }),
      })
      const imgData = await imgRes.json()

      if (cancelledRef.current) { activeGenerationsRef.current--; return }

      if (!imgData.success || !imgData.imageBase64) {
        throw new Error(imgData.error || 'Error al generar imagen de la escena')
      }

      const imageBase64ForVideo = imgData.imageBase64
      const imagePreviewUrl = `data:${imgData.mimeType || 'image/png'};base64,${imgData.imageBase64}`

      // Show image preview
      updateSceneVideo(index, { status: 'generating-video', imagePreview: imagePreviewUrl })

      if (cancelledRef.current) { activeGenerationsRef.current--; return }

      // ── STEP 1.5: For transformation scenes, generate the END frame (last frame) ──
      let imageBase64End: string | undefined
      if (scene.imagePromptEnd && scene.sceneType === 'transformation') {
        let fullEndPrompt = scene.imagePromptEnd
        if (scene.usesProductPhoto && productImageUrls.length > 0) {
          fullEndPrompt += `. The product shown must match the reference product photo exactly.`
        }

        const endImgRes = await fetch('/api/studio/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: imageModelId,
            prompt: fullEndPrompt,
            aspectRatio,
            ...(sceneRefs.length > 0 ? { referenceImages: sceneRefs } : {}),
          }),
        })
        const endImgData = await endImgRes.json()

        if (cancelledRef.current) { activeGenerationsRef.current--; return }

        if (endImgData.success && endImgData.imageBase64) {
          imageBase64End = endImgData.imageBase64
        }
        // If end frame fails, continue with just the start frame (graceful fallback)
      }

      // ── STEP 2: Animate using the video model ──
      // For transformation: first-last-frame mode (interpolates between before/after)
      // For other scenes: standard image-to-video (animates the first frame)

      // Duration per model: Veo accepts 4/6/8, Kling accepts 5/10, Sora accepts 10/15
      const isVeo = videoModelId.startsWith('veo')
      const isKling = videoModelId.startsWith('kling')
      const isSora = videoModelId === 'sora-2'
      const sceneDuration = isVeo ? 8 : isKling ? 10 : isSora ? 10 : 8

      let videoPrompt = scene.animationPrompt
      // Inject duration into prompt so the model knows the target length
      if (!isVeo) {
        videoPrompt += ` ${sceneDuration} seconds.`
      }
      if (scene.influencerDialogue) {
        if (isVeo) {
          // Veo handles multilingual dialogue well with English instruction
          videoPrompt += ` The person speaks to camera saying: "${scene.influencerDialogue}"`
        } else {
          // Kling/Sora: force Spanish audio — use Spanish instruction + explicit language directive
          videoPrompt += ` La persona habla a cámara diciendo en español latino con voz femenina joven: "${scene.influencerDialogue}". Audio must be in Latin American Spanish, female voice.`
        }
      }

      const videoBody: any = {
        modelId: videoModelId,
        prompt: videoPrompt,
        duration: sceneDuration,
        aspectRatio,
        enableAudio: true,
        resolution: '720p',
        imageBase64: imageBase64ForVideo,
      }

      // Use first-last-frame mode for transformation scenes with end frame (Veo only)
      if (imageBase64End && isVeo) {
        videoBody.imageBase64End = imageBase64End
        videoBody.veoGenerationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'
      }

      const videoRes = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoBody),
      })
      const videoData = await videoRes.json()

      if (cancelledRef.current) { activeGenerationsRef.current--; return }

      if (!videoRes.ok || (!videoData.success && !videoData.taskId)) {
        throw new Error(videoData.error || 'Error al generar video')
      }

      if (videoData.taskId) {
        updateSceneVideo(index, { status: 'polling', taskId: videoData.taskId })
        await pollSceneVideo(index, videoData.taskId)
      } else if (videoData.videoUrl) {
        updateSceneVideo(index, { status: 'completed', videoUrl: videoData.videoUrl })
        activeGenerationsRef.current--
      }
    } catch (err: any) {
      updateSceneVideo(index, { status: 'error', error: err.message || 'Error desconocido' })
      activeGenerationsRef.current--
    }
  }, [videoModelId, imageModelId, aspectRatio, productImageUrls, promptDescriptor, updateSceneVideo, pollSceneVideo, loadReferenceImagesCache])

  // Generate ALL scenes in parallel with semaphore
  const generateAllParallel = useCallback(async () => {
    if (!scriptResult) return
    cancelledRef.current = false
    setIsGeneratingAll(true)
    activeGenerationsRef.current = 0

    // Initialize all scenes
    const newStates = new Map<number, { status: SceneVideoStatus; taskId: string | null; videoUrl: string | null; imagePreview: string | null; error: string | null; pollCount: number }>()
    scriptResult.scenes.forEach((_, i) => {
      newStates.set(i, { status: 'idle', taskId: null, videoUrl: null, imagePreview: null, error: null, pollCount: 0 })
    })
    setSceneVideoStates(newStates)

    // Queue-based parallel generation
    const queue = scriptResult.scenes.map((scene, i) => ({ scene, index: i }))

    const runNext = async (): Promise<void> => {
      if (cancelledRef.current || queue.length === 0) return
      const item = queue.shift()
      if (!item) return
      await generateSceneVideo(item.index, item.scene)
      return runNext()
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, () => runNext())
    await Promise.all(workers)
    setIsGeneratingAll(false)
    toast.success('Generación completada')
  }, [scriptResult, generateSceneVideo])

  // Cancel all generations
  const cancelAll = useCallback(() => {
    cancelledRef.current = true
    setIsGeneratingAll(false)
  }, [])

  // Load products list
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        if (data.products) setProducts(data.products)
      })
      .catch(() => {})
  }, [])

  // Load saved angles from Supabase directly
  useEffect(() => {
    const loadAngles = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('saved_angles')
          .select('id, product_name, angle_data')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (data) setSavedAngles(data)
      } catch {} // Table might not exist yet — silent fail
    }
    loadAngles()
  }, [])

  // Load product context when product is selected
  useEffect(() => {
    if (!selectedProductId) return
    setIsLoadingContext(true)
    fetch(`/api/products/context?productId=${selectedProductId}`)
      .then(r => r.json())
      .then(data => {
        if (data.context) {
          const ctx = data.context
          const parts = [
            ctx.description && `DESCRIPCIÓN: ${ctx.description}`,
            ctx.benefits && `BENEFICIOS: ${ctx.benefits}`,
            ctx.problems && `PROBLEMAS QUE RESUELVE: ${ctx.problems}`,
            ctx.ingredients && `INGREDIENTES/MATERIALES: ${ctx.ingredients}`,
            ctx.differentiator && `DIFERENCIADOR: ${ctx.differentiator}`,
          ].filter(Boolean)
          setProductDescription(parts.join('\n\n'))
        } else {
          setProductDescription('')
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingContext(false))

    // Load product images
    fetch(`/api/products/${selectedProductId}`)
      .then(r => r.json())
      .then(data => {
        if (data.product?.image_url) {
          setProductImageUrls([data.product.image_url])
        }
      })
      .catch(() => {})

    // Filter angles for this product
  }, [selectedProductId])

  // Handle video upload
  const handleVideoUpload = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error('El video debe ser menor a 100MB')
      return
    }

    const duration = await getVideoDuration(file)
    if (duration > 60) {
      toast.error('El video debe ser de máximo 60 segundos')
      return
    }

    setReferenceVideoFile(file)
    setIsUploadingVideo(true)
    setError(null)

    try {
      // Upload directly from browser to Supabase Storage (bypasses Vercel 4.5MB limit)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autorizado')

      const ext = file.name.split('.').pop() || 'mp4'
      const fileName = `${Date.now()}-${crypto.randomUUID().substring(0, 8)}.${ext}`
      const storagePath = `temp/${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('landing-images')
        .upload(storagePath, file, {
          contentType: file.type || 'video/mp4',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Get signed URL (1 hour — enough for Gemini to download)
      const { data: signedData } = await supabase.storage
        .from('landing-images')
        .createSignedUrl(storagePath, 3600)

      const url = signedData?.signedUrl
      if (url) {
        setReferenceVideoUrl(url)
        toast.success('Video de referencia subido')
      } else {
        throw new Error('No se obtuvo URL del video')
      }
    } catch (err: any) {
      console.error('[ViralMode] Upload error:', err)
      setError('Error al subir el video. Intenta de nuevo.')
      toast.error('Error al subir el video')
    } finally {
      setIsUploadingVideo(false)
    }
  }

  // Get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      video.onerror = () => resolve(0)
      video.src = URL.createObjectURL(file)
    })
  }

  // Generate viral script
  const handleGenerate = async () => {
    if (!productDescription.trim()) {
      toast.error('Selecciona un producto o escribe la descripción')
      return
    }

    setIsGenerating(true)
    setError(null)
    setScriptResult(null)

    try {
      const body: any = {
        influencerId,
        influencerName,
        promptDescriptor,
        productDescription: productDescription.trim(),
        sceneCount,
      }

      if (referenceVideoUrl) {
        body.referenceVideoUrl = referenceVideoUrl
      }
      if (selectedAngle) {
        body.salesAngle = `${selectedAngle.angle_data?.name || ''}: ${selectedAngle.angle_data?.salesAngle || selectedAngle.angle_data?.description || ''}`
      }
      if (productImageUrls.length > 0) {
        body.productImageUrls = productImageUrls
      }
      if (extraContext.trim()) {
        body.extraContext = extraContext.trim()
      }

      const res = await fetch('/api/studio/influencer/generate-viral-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar el guión')
      }

      setScriptResult(data.result)
      setExpandedScene(0)
      toast.success(`¡Guión viral generado! ${data.result.scenes.length} escenas`)
    } catch (err: any) {
      console.error('[ViralMode] Generate error:', err)
      setError(err.message)
      toast.error(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // Update scene field
  const updateScene = (index: number, field: keyof ViralScene, value: any) => {
    if (!scriptResult) return
    const updated = { ...scriptResult }
    updated.scenes = [...updated.scenes]
    updated.scenes[index] = { ...updated.scenes[index], [field]: value }
    setScriptResult(updated)
  }

  // Copy to clipboard
  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Scene type badge colors
  const sceneTypeBadge = (type: string) => {
    switch (type) {
      case 'transformation': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      case 'influencer': return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      case 'product-demo': return 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      case 'beauty-shot': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      default: return 'bg-text-muted/10 text-text-muted border-border'
    }
  }

  const sceneTypeLabel = (type: string) => {
    switch (type) {
      case 'transformation': return 'Transformación'
      case 'influencer': return 'Influencer'
      case 'product-demo': return 'Demo Producto'
      case 'beauty-shot': return 'Beauty Shot'
      default: return type
    }
  }

  // Filtered angles for selected product
  const filteredAngles = selectedProductId
    ? savedAngles.filter(a => {
        const product = products.find(p => p.id === selectedProductId)
        return product && a.product_name === product.name
      })
    : savedAngles

  return (
    <div className="space-y-5">
      {/* ============ PRODUCTO ============ */}
      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
          Producto
        </label>
        {products.length > 0 ? (
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">Selecciona un producto...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-text-muted">No hay productos. Crea uno en el Banner Generator.</p>
        )}

        {isLoadingContext && (
          <div className="flex items-center gap-2 mt-2">
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
            <span className="text-xs text-text-muted">Cargando contexto del producto...</span>
          </div>
        )}
      </div>

      {/* Descripción del producto (pre-llenada o manual) */}
      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
          Descripción del Producto {productDescription ? '(del Banner Generator)' : ''}
        </label>
        <textarea
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          placeholder="Describe tu producto: qué es, qué hace, beneficios, puntos de dolor que resuelve..."
          rows={4}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {/* Contexto extra (opcional) */}
      <div>
        <button
          onClick={() => setExtraContext(prev => prev ? '' : ' ')}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          {extraContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Agregar más contexto (opcional)
        </button>
        {extraContext !== '' && (
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="Contexto adicional: competidores, público objetivo específico, estilo deseado..."
            rows={2}
            className="w-full mt-2 px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        )}
      </div>

      {/* ============ ÁNGULO DE VENTA ============ */}
      {filteredAngles.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
            Ángulo de Venta
          </label>
          <div className="flex flex-wrap gap-2">
            {filteredAngles.map((angle) => (
              <button
                key={angle.id}
                onClick={() => setSelectedAngle(selectedAngle?.id === angle.id ? null : angle)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs transition-all',
                  selectedAngle?.id === angle.id
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                )}
              >
                {angle.angle_data?.name || 'Ángulo'}
              </button>
            ))}
          </div>
          {selectedAngle && (
            <p className="mt-1.5 text-[11px] text-text-muted">
              {selectedAngle.angle_data?.salesAngle || selectedAngle.angle_data?.description || ''}
            </p>
          )}
        </div>
      )}

      {/* ============ VIDEO DE REFERENCIA ============ */}
      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
          Video de Referencia (opcional, max 60s)
        </label>
        <p className="text-[11px] text-text-muted mb-2">
          Sube un video viral de TikTok como referencia de estilo. La IA analizará su estructura, transiciones y ritmo para crear algo similar con tu producto.
        </p>

        {!referenceVideoUrl ? (
          <div
            onClick={() => videoInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              isUploadingVideo
                ? 'border-accent/50 bg-accent/5'
                : 'border-border hover:border-accent/50 hover:bg-accent/5'
            )}
          >
            {isUploadingVideo ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <span className="text-xs text-text-muted">Subiendo video...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-text-muted" />
                <span className="text-xs text-text-muted">Arrastra o haz clic para subir</span>
                <span className="text-[10px] text-text-muted/60">MP4, MOV, AVI — máx 100MB, 60 segundos</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black/50">
            <video
              src={referenceVideoUrl}
              controls
              className="w-full max-h-48 object-contain"
            />
            <button
              onClick={() => {
                setReferenceVideoUrl(null)
                setReferenceVideoFile(null)
              }}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg hover:bg-red-500/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/avi,video/webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleVideoUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* ============ FOTOS DEL PRODUCTO ============ */}
      <div>
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
          Fotos del Producto (para referencia visual)
        </label>
        <p className="text-[11px] text-text-muted mb-2">
          Sube fotos reales del producto. Se usarán como referencia visual para que el AI genere escenas con el producto correcto.
        </p>

        <div className="flex flex-wrap gap-2 mb-2">
          {productImageUrls.map((url, i) => (
            <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border">
              <img src={url} alt={`Producto ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => {
                  setProductImageUrls(prev => prev.filter((_, idx) => idx !== i))
                  referenceImagesCache.current = null // Invalidate cache
                }}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}

          {productImageUrls.length < 3 && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-text-muted" />
              <span className="text-[9px] text-text-muted mt-0.5">Agregar</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  e.target.value = ''
                  try {
                    const supabase = createBrowserClient(
                      process.env.NEXT_PUBLIC_SUPABASE_URL!,
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    )
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    const ext = file.name.split('.').pop() || 'jpg'
                    const path = `temp/${user.id}/product-${Date.now()}.${ext}`
                    await supabase.storage.from('landing-images').upload(path, file, { contentType: file.type, upsert: false })
                    const { data: signedData } = await supabase.storage.from('landing-images').createSignedUrl(path, 7200)
                    if (signedData?.signedUrl) {
                      setProductImageUrls(prev => [...prev, signedData.signedUrl])
                      referenceImagesCache.current = null // Invalidate cache
                      toast.success('Foto del producto agregada')
                    }
                  } catch {
                    toast.error('Error al subir la imagen')
                  }
                }}
              />
            </label>
          )}
        </div>

        {productImageUrls.length === 0 && (
          <p className="text-[10px] text-amber-400/70">
            Sin fotos del producto. Las escenas se generarán solo con el prompt de texto.
          </p>
        )}
      </div>

      {/* ============ MODELO + ESCENAS ============ */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
            Modelo de Video
          </label>
          <select
            value={videoModelId}
            onChange={(e) => setVideoModelId(e.target.value as VideoModelId)}
            className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {VIDEO_COMPANY_GROUPS.filter(g => ['google', 'kuaishou', 'openai'].includes(g.id)).map(group => (
              <optgroup key={group.id} label={group.name}>
                {group.models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.tags?.includes('AUDIO') ? '🔊' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
            Escenas ({sceneCount})
          </label>
          <input
            type="range"
            min={3}
            max={6}
            value={sceneCount}
            onChange={(e) => setSceneCount(Number(e.target.value))}
            className="w-full mt-2 accent-accent"
          />
          <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
            <span>3</span>
            <span>6</span>
          </div>
        </div>
      </div>

      {/* ============ GENERAR GUIÓN ============ */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !productDescription.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all',
          isGenerating || !productDescription.trim()
            ? 'bg-accent/30 text-white/50 cursor-not-allowed'
            : 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/25'
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analizando video y generando guión viral...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generar Guión Viral ({sceneCount} escenas)
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ============ RESULTADO: ESCENAS ============ */}
      {scriptResult && (
        <div className="space-y-4">
          {/* Header */}
          <div className="p-4 bg-surface-elevated border border-border rounded-xl">
            <h3 className="text-sm font-bold text-text-primary mb-1">{scriptResult.videoTitle}</h3>
            <p className="text-xs text-text-secondary">{scriptResult.videoConcept}</p>
            {scriptResult.detectedStyle && (
              <p className="text-[11px] text-accent mt-1">Estilo detectado: <strong>{scriptResult.detectedStyle}</strong></p>
            )}
            {scriptResult.referenceAnalysis && (
              <details className="mt-2 pt-2 border-t border-border">
                <summary className="text-[11px] text-text-muted cursor-pointer hover:text-text-secondary">
                  Ver análisis del video de referencia
                </summary>
                <p className="text-[11px] text-text-muted mt-1 whitespace-pre-wrap">
                  {scriptResult.referenceAnalysis}
                </p>
              </details>
            )}
            {scriptResult.fullScript && (
              <details className="mt-2 pt-2 border-t border-border">
                <summary className="text-[11px] text-text-muted cursor-pointer hover:text-text-secondary">
                  Ver guión completo
                </summary>
                <p className="text-[11px] text-text-primary mt-1 whitespace-pre-wrap">
                  {scriptResult.fullScript}
                </p>
              </details>
            )}
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 bg-accent/15 text-accent rounded-full">
                {scriptResult.scenes.length} escenas
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-text-muted/10 text-text-muted rounded-full">
                {scriptResult.totalDuration}s total
              </span>
            </div>
          </div>

          {/* Scene cards */}
          {scriptResult.scenes.map((scene, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              {/* Scene header */}
              <button
                onClick={() => setExpandedScene(expandedScene === i ? null : i)}
                className="w-full flex items-center justify-between p-3 bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-primary">Escena {scene.sceneNumber}</span>
                  {scene.startsAtSecond != null && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface border border-border rounded text-text-muted font-mono">
                      {scene.startsAtSecond}s–{scene.startsAtSecond + scene.duration}s
                    </span>
                  )}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', sceneTypeBadge(scene.sceneType))}>
                    {sceneTypeLabel(scene.sceneType)}
                  </span>
                  {scene.complexity === 'high' && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-500/15 text-red-400 rounded-full border border-red-500/30">
                      Compleja
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted">{scene.duration}s</span>
                </div>
                {expandedScene === i ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </button>

              {/* Scene body (expanded) */}
              {expandedScene === i && (
                <div className="p-3 space-y-3 bg-surface">
                  {/* Scene description */}
                  <div>
                    <p className="text-xs text-text-secondary">{scene.sceneDescription}</p>
                  </div>

                  {/* Influencer dialogue */}
                  {scene.influencerDialogue && (
                    <div>
                      <label className="block text-[10px] font-medium text-blue-400 uppercase tracking-wide mb-1">
                        Diálogo del Influencer (Español)
                      </label>
                      <textarea
                        value={scene.influencerDialogue}
                        onChange={(e) => updateScene(i, 'influencerDialogue', e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1.5 bg-surface-elevated border border-blue-500/30 rounded-lg text-xs text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                    </div>
                  )}

                  {/* Image prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                        Image Prompt (Inglés)
                      </label>
                      <button
                        onClick={() => handleCopy(scene.imagePrompt, `img-${i}`)}
                        className="text-text-muted hover:text-accent transition-colors"
                      >
                        {copiedField === `img-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <textarea
                      value={scene.imagePrompt}
                      onChange={(e) => updateScene(i, 'imagePrompt', e.target.value.substring(0, 500))}
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-surface-elevated border border-emerald-500/30 rounded-lg text-xs text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                    <p className="text-[10px] text-text-muted text-right mt-0.5">{scene.imagePrompt.length}/500</p>
                  </div>

                  {/* End frame prompt (transformation scenes only) */}
                  {scene.imagePromptEnd && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-medium text-rose-400 uppercase tracking-wide">
                          Last Frame (Resultado Final)
                        </label>
                        <button
                          onClick={() => handleCopy(scene.imagePromptEnd!, `imgend-${i}`)}
                          className="text-text-muted hover:text-accent transition-colors"
                        >
                          {copiedField === `imgend-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <textarea
                        value={scene.imagePromptEnd}
                        onChange={(e) => updateScene(i, 'imagePromptEnd', e.target.value.substring(0, 500))}
                        rows={3}
                        className="w-full px-2.5 py-1.5 bg-surface-elevated border border-rose-500/30 rounded-lg text-xs text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                      />
                      <p className="text-[10px] text-rose-400/60 mt-0.5">Se generará un video que interpola del primer al último frame (sucio→limpio)</p>
                    </div>
                  )}

                  {/* Animation prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium text-amber-400 uppercase tracking-wide">
                        Animation Prompt (Inglés, max 400)
                      </label>
                      <button
                        onClick={() => handleCopy(scene.animationPrompt, `anim-${i}`)}
                        className="text-text-muted hover:text-accent transition-colors"
                      >
                        {copiedField === `anim-${i}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <textarea
                      value={scene.animationPrompt}
                      onChange={(e) => updateScene(i, 'animationPrompt', e.target.value.substring(0, 400))}
                      rows={3}
                      className="w-full px-2.5 py-1.5 bg-surface-elevated border border-amber-500/30 rounded-lg text-xs text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                    <p className="text-[10px] text-text-muted text-right mt-0.5">{scene.animationPrompt.length}/400</p>
                  </div>

                  {/* Scene metadata */}
                  <div className="flex flex-wrap gap-1.5">
                    {scene.usesInfluencer && (
                      <span className="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">Con influencer</span>
                    )}
                    {scene.usesProductPhoto && (
                      <span className="text-[9px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full">Usa foto producto</span>
                    )}
                    {scene.static && (
                      <span className="text-[9px] px-2 py-0.5 bg-text-muted/10 text-text-muted rounded-full">Escena estática</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Production notes */}
          {scriptResult.productionNotes && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <p className="text-[11px] text-amber-400/80">
                <strong>Notas de producción:</strong> {scriptResult.productionNotes}
              </p>
            </div>
          )}

          {/* ============ VIDEO GENERATION (2-step: Image → Video) ============ */}
          <div className="p-4 bg-surface-elevated border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-accent" />
                Generar Videos (Imagen + Animación)
              </h4>
              <div className="flex items-center gap-1.5">
                {(['9:16', '16:9', '1:1'] as const).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] border transition-colors',
                      aspectRatio === ar
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface border-border text-text-muted hover:border-text-muted'
                    )}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-text-muted">
              Cada escena genera una imagen nueva del escenario (del video de referencia) usando tu influencer y producto como referencia visual. Luego anima esa imagen.
            </p>

            {/* Model selectors: Image + Video side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Modelo Imagen (fotograma)</label>
                <select
                  value={imageModelId}
                  onChange={(e) => setImageModelId(e.target.value)}
                  className="w-full px-2 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  <option value="nano-banana-2">Nano Banana 2 (rápido)</option>
                  <option value="gemini-3-pro">Gemini 3 Pro</option>
                  <option value="gpt-image-1.5">GPT Image 1.5</option>
                  <option value="seedream-5">Seedream 5</option>
                  <option value="flux-2-pro">Flux 2 Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1">Modelo Video (animación)</label>
                <select
                  value={videoModelId}
                  onChange={(e) => setVideoModelId(e.target.value as VideoModelId)}
                  className="w-full px-2 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  {VIDEO_COMPANY_GROUPS.filter(g => ['google', 'kuaishou', 'openai'].includes(g.id)).map(group => (
                    <optgroup key={group.id} label={group.name}>
                      {group.models.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Per-scene status grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {scriptResult.scenes.map((scene, i) => {
                const state = sceneVideoStates.get(i)
                const status = state?.status || 'idle'
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-xl border p-3 transition-all',
                      status === 'idle' && 'border-border bg-surface',
                      status === 'generating-image' && 'border-purple-500/40 bg-purple-500/5',
                      status === 'generating-video' && 'border-amber-500/40 bg-amber-500/5',
                      status === 'polling' && 'border-blue-500/40 bg-blue-500/5',
                      status === 'completed' && 'border-green-500/40 bg-green-500/5',
                      status === 'error' && 'border-red-500/40 bg-red-500/5',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-text-primary">
                        Escena {scene.sceneNumber}
                        {scene.startsAtSecond != null && <span className="font-mono text-text-muted ml-1">({scene.startsAtSecond}s–{scene.startsAtSecond + scene.duration}s)</span>}
                      </span>
                      {status === 'generating-image' && (
                        <div className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                          <span className="text-[9px] text-purple-400">Imagen...</span>
                        </div>
                      )}
                      {status === 'generating-video' && (
                        <div className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                          <span className="text-[9px] text-amber-400">Video...</span>
                        </div>
                      )}
                      {status === 'polling' && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          <span className="text-[9px] text-blue-400">Procesando #{state?.pollCount}</span>
                        </div>
                      )}
                      {status === 'completed' && <Check className="w-3.5 h-3.5 text-green-400" />}
                      {status === 'error' && <AlertCircle className="w-3 h-3 text-red-400" />}
                    </div>

                    <p className="text-[10px] text-text-muted line-clamp-2 mb-2">{scene.sceneDescription}</p>

                    {/* Image preview (generated first frame) */}
                    {state?.imagePreview && status !== 'completed' && (
                      <div className="mb-2">
                        <p className="text-[9px] text-purple-400 mb-1">Fotograma generado:</p>
                        <img
                          src={state.imagePreview}
                          alt={`Escena ${scene.sceneNumber} frame`}
                          className="w-full rounded-lg object-cover"
                        />
                      </div>
                    )}

                    {/* Completed: show video + dialogue */}
                    {status === 'completed' && state?.videoUrl && (
                      <>
                        <video
                          src={state.videoUrl}
                          className={cn(
                            'w-full rounded-lg object-contain bg-black mt-1',
                            aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[300px]' : 'aspect-video'
                          )}
                          controls
                          muted
                          playsInline
                        />
                        {scene.influencerDialogue && (
                          <div className="mt-1.5 p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                            <p className="text-[9px] text-blue-400 font-medium mb-0.5">Diálogo:</p>
                            <p className="text-[10px] text-text-secondary italic">&ldquo;{scene.influencerDialogue}&rdquo;</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Error: show message + retry */}
                    {status === 'error' && (
                      <div className="mt-1">
                        <p className="text-[9px] text-red-400 line-clamp-3 mb-1">{state?.error}</p>
                        <button
                          onClick={() => generateSceneVideo(i, scene)}
                          className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Reintentar
                        </button>
                      </div>
                    )}

                    {/* Idle: show generate button */}
                    {status === 'idle' && !isGeneratingAll && (
                      <button
                        onClick={() => generateSceneVideo(i, scene)}
                        className="mt-1 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-medium transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Generar (Imagen + Video)
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {!isGeneratingAll ? (
                <button
                  onClick={generateAllParallel}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Generar Todo en Paralelo
                </button>
              ) : (
                <button
                  onClick={cancelAll}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              )}
              {/* Send completed videos to editor — in scene order */}
              {onSendToEditor && Array.from(sceneVideoStates.values()).some(s => s.status === 'completed') && (
                <button
                  onClick={() => {
                    const clips: { url: string; label: string }[] = []
                    scriptResult.scenes.forEach((scene, i) => {
                      const state = sceneVideoStates.get(i)
                      if (state?.status === 'completed' && state.videoUrl) {
                        clips.push({ url: state.videoUrl, label: `Escena ${scene.sceneNumber} (${scene.startsAtSecond ?? 0}s–${(scene.startsAtSecond ?? 0) + scene.duration}s)` })
                      }
                    })
                    if (clips.length > 0) onSendToEditor(clips)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Enviar al Editor ({Array.from(sceneVideoStates.values()).filter(s => s.status === 'completed').length})
                </button>
              )}
            </div>

            {/* Progress summary */}
            {Array.from(sceneVideoStates.values()).some(s => s.status !== 'idle') && (
              <div className="text-center space-y-0.5">
                <p className="text-[10px] text-green-400">
                  {Array.from(sceneVideoStates.values()).filter(s => s.status === 'completed').length} / {scriptResult.scenes.length} videos completados
                </p>
                {Array.from(sceneVideoStates.values()).some(s => s.status === 'generating-image') && (
                  <p className="text-[10px] text-purple-400">Generando imágenes de fotograma...</p>
                )}
                {Array.from(sceneVideoStates.values()).some(s => s.status === 'generating-video' || s.status === 'polling') && (
                  <p className="text-[10px] text-blue-400">Animando escenas...</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
