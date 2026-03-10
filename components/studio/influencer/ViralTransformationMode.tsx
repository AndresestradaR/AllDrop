'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { VIDEO_MODELS, VIDEO_COMPANY_GROUPS, type VideoModelId } from '@/lib/video-providers/types'
import { Loader2, Upload, Sparkles, Film, Trash2, ChevronDown, ChevronUp, Copy, Check, Play, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { createBrowserClient } from '@supabase/ssr'

interface ViralTransformationModeProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
}

interface ViralScene {
  sceneNumber: number
  sceneType: 'transformation' | 'influencer' | 'beauty-shot'
  sceneDescription: string
  imagePrompt: string
  animationPrompt: string
  influencerDialogue: string | null
  duration: number
  static: boolean
  complexity: string
  usesInfluencer: boolean
  usesProductPhoto: boolean
}

interface ViralScriptResult {
  videoTitle: string
  videoConcept: string
  referenceAnalysis: string
  totalDuration: number
  scenes: ViralScene[]
  productionNotes: string
}

export function ViralTransformationMode({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
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
  const [videoModelId, setVideoModelId] = useState<VideoModelId>('veo-3.1')

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
      case 'beauty-shot': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      default: return 'bg-text-muted/10 text-text-muted border-border'
    }
  }

  const sceneTypeLabel = (type: string) => {
    switch (type) {
      case 'transformation': return 'Transformación'
      case 'influencer': return 'Influencer'
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
            {VIDEO_COMPANY_GROUPS.map(group => (
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
            {scriptResult.referenceAnalysis && (
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-[11px] text-text-muted">
                  <strong>Análisis de referencia:</strong> {scriptResult.referenceAnalysis}
                </p>
              </div>
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

          {/* TODO: Generation buttons (Parallel / Sequential) will be added in Phase 3 */}
          <div className="p-4 bg-surface-elevated border border-border rounded-xl text-center">
            <p className="text-xs text-text-muted">
              <Film className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              La generación de videos por escena estará disponible próximamente.
              Por ahora, copia los prompts y úsalos en el generador de video principal.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
