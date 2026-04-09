'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { useI18n } from '@/lib/i18n'
import {
  Star,
  Drama,
  RefreshCw,
  Video,
  UserCircle,
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Download,
  AlertCircle,
  Zap,
  BookOpen,
  Calculator,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { InfluencerWizard } from './influencer/InfluencerWizard'
import { AutoPublisherTool } from './AutoPublisherTool'
import EbookGenerator from './ebook/EbookGenerator'
import CosteoCalculator from './CosteoCalculator'

interface DropshippingTool {
  id: string
  nameKey: string
  descKey: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  emoji: string
  soon?: boolean
}

const DROPSHIPPING_TOOLS: DropshippingTool[] = [
  { id: 'resena-ugc', nameKey: 'resenaUgc', descKey: 'resenaUgc', name: 'Resena UGC', description: 'Genera resenas realistas con IA', icon: Star, color: 'from-yellow-500 to-amber-500', emoji: '⭐' },
  { id: 'deep-face', nameKey: 'deepFace', descKey: 'deepFace', name: 'Deep Face', description: 'Cambia cara y voz de videos', icon: Drama, color: 'from-purple-500 to-pink-500', emoji: '🎭' },
  { id: 'clonar-viral', nameKey: 'clonarViral', descKey: 'clonarViral', name: 'Clonar Viral', description: 'Recrea videos virales para tu producto', icon: RefreshCw, color: 'from-blue-500 to-cyan-500', emoji: '🔄' },
  { id: 'video-producto', nameKey: 'videoProducto', descKey: 'videoProducto', name: 'Video Producto', description: 'Crea videos de tu producto con IA', icon: Video, color: 'from-red-500 to-orange-500', emoji: '🎥' },
  { id: 'mi-influencer', nameKey: 'miInfluencer', descKey: 'miInfluencer', name: 'Mi Influencer', description: 'Crea y guarda personajes consistentes', icon: UserCircle, color: 'from-green-500 to-emerald-500', emoji: '👤' },
  { id: 'auto-publicar', nameKey: 'autoPublicar', descKey: 'autoPublicar', name: 'Auto Publicar', description: 'Automatiza generacion y publicacion de videos', icon: Zap, color: 'from-orange-500 to-red-500', emoji: '🚀' },
  { id: 'ebook-generator', nameKey: 'ebookGenerator', descKey: 'ebookGenerator', name: 'Ebook Generator', description: 'Crea ebooks profesionales para tus productos', icon: BookOpen, color: 'from-teal-500 to-cyan-500', emoji: '📚' },
  { id: 'costeo-calculator', nameKey: 'costeoCalculator', descKey: 'costeoCalculator', name: 'Calculadora Costeo', description: 'Rentabilidad, CPA y simulación de ventas COD', icon: Calculator, color: 'from-amber-500 to-yellow-500', emoji: '📊' },
]

type ActiveTool = typeof DROPSHIPPING_TOOLS[number]['id'] | null

// ============================================
// RESENA UGC COMPONENT (Video Version)
// ============================================
function ResenaUGCTool({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const sr = t.studio.resena
  // Product info
  const [productName, setProductName] = useState('')
  const [productBenefit, setProductBenefit] = useState('')

  // Image/Person
  const [imageSource, setImageSource] = useState<'upload' | 'generate'>('generate')
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imageModel, setImageModel] = useState<'nano-banana' | 'gemini' | 'imagen3'>('nano-banana')
  const [persona, setPersona] = useState<'mujer-joven' | 'mujer-adulta' | 'hombre-joven' | 'hombre-adulto'>('mujer-joven')

  // Video
  const [videoModel, setVideoModel] = useState<'kling' | 'veo' | 'sora'>('kling')
  const [tone, setTone] = useState<'casual' | 'entusiasta' | 'esceptico-convencido'>('casual')
  const [duration, setDuration] = useState<'15' | '30' | '60'>('30')

  // Script
  const [useCustomScript, setUseCustomScript] = useState(false)
  const [customScript, setCustomScript] = useState('')

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState('')
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)
  const [generatedScript, setGeneratedScript] = useState('')
  const [generatedFaceUrl, setGeneratedFaceUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'resena-ugc')!

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      setImageSource('upload')
    }
  }

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
    })
  }

  // Poll for video status
  const pollVideoStatus = async (taskId: string) => {
    let attempts = 0
    const maxAttempts = 200 // ~10 minutes with 3s interval

    pollingRef.current = setInterval(async () => {
      attempts++

      if (attempts > maxAttempts) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setIsGenerating(false)
        setGenerationStep('')
        setError(sr.timeout)
        toast.error(sr.timeout)
        return
      }

      try {
        const response = await fetch(`/api/studio/video-status?taskId=${taskId}`)
        const data = await response.json()

        console.log('[ResenaUGC] Poll status:', data.status)

        if (data.status === 'completed' && data.videoUrl) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setResultVideoUrl(data.videoUrl)
          setIsGenerating(false)
          setGenerationStep('')
          toast.success(sr.genSuccess)
        } else if (data.status === 'failed' || (!data.success && data.error)) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setIsGenerating(false)
          setGenerationStep('')
          setError(data.error || sr.genError)
          toast.error(data.error || sr.genError)
        } else {
          // Still processing - update progress
          const progress = Math.min(Math.round((attempts / maxAttempts) * 100), 95)
          setGenerationStep(`${sr.generateVideo}... ${progress}%`)
        }
      } catch (err) {
        console.error('[ResenaUGC] Polling error:', err)
      }
    }, 3000)
  }

  const handleGenerate = async () => {
    if (!productName.trim()) return
    if (imageSource === 'upload' && !uploadedImage) return

    setIsGenerating(true)
    setResultVideoUrl(null)
    setError(null)
    setGeneratedScript('')
    setGeneratedFaceUrl(null)

    try {
      // Prepare image if uploaded
      let imageBase64: string | undefined
      if (imageSource === 'upload' && uploadedImage) {
        setGenerationStep(sr.preparingImage)
        imageBase64 = await fileToBase64(uploadedImage)
      } else {
        setGenerationStep(sr.startingGen)
      }

      // Call the API
      const response = await fetch('/api/studio/resena-ugc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          productBenefit,
          imageSource,
          imageBase64,
          imageModel,
          persona,
          videoModel,
          tone,
          duration,
          customScript: useCustomScript ? customScript : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || sr.genError)
      }

      // Save generated data
      if (data.script) setGeneratedScript(data.script)
      if (data.faceImageUrl) setGeneratedFaceUrl(data.faceImageUrl)

      // Start polling for video result
      if (data.taskId) {
        setGenerationStep(sr.startingGen)
        toast.success(sr.processStarted)
        pollVideoStatus(data.taskId)
      } else {
        throw new Error(sr.noTaskId)
      }

    } catch (err: any) {
      console.error('[ResenaUGC] Error:', err)
      setIsGenerating(false)
      setGenerationStep('')
      setError(err.message || sr.unknownError)
      toast.error(err.message || sr.genError)
    }
  }

  const handleDownload = () => {
    if (resultVideoUrl) {
      const link = document.createElement('a')
      link.href = resultVideoUrl
      link.download = `resena-ugc-${Date.now()}.mp4`
      link.click()
    }
  }

  const handleReset = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIsGenerating(false)
    setGenerationStep('')
    setResultVideoUrl(null)
    setError(null)
    setGeneratedScript('')
    setGeneratedFaceUrl(null)
  }

  const canGenerate = productName.trim() && (imageSource === 'generate' || uploadedImage)

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{sr.title}</h2>
              <p className="text-sm text-text-secondary">{sr.desc}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section - Scrollable */}
          <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Product Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">{sr.product}</h3>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.productName} *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder={sr.productNamePh}
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.mainBenefit}</label>
                <input
                  type="text"
                  value={productBenefit}
                  onChange={(e) => setProductBenefit(e.target.value)}
                  placeholder={sr.mainBenefitPh}
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">{sr.personImage}</h3>

              {/* Image Source Toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setImageSource('generate')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    imageSource === 'generate' ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  )}
                >
                  {sr.generateAI}
                </button>
                <button
                  onClick={() => setImageSource('upload')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    imageSource === 'upload' ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  )}
                >
                  {sr.uploadImage}
                </button>
              </div>

              {imageSource === 'upload' ? (
                <div>
                  {uploadedImage ? (
                    <div className="relative h-32 bg-surface-elevated rounded-xl overflow-hidden">
                      <img src={URL.createObjectURL(uploadedImage)} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setUploadedImage(null)}
                        className="absolute top-2 right-2 w-6 h-6 bg-error/80 hover:bg-error rounded-full flex items-center justify-center"
                      >
                        <span className="text-white text-xs">X</span>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <UserCircle className="w-8 h-8 text-text-secondary mb-2" />
                      <p className="text-sm text-text-secondary">{sr.uploadFace}</p>
                      <p className="text-xs text-text-secondary/70">{sr.faceHint}</p>
                    </label>
                  )}
                </div>
              ) : (
                <>
                  {/* Image Model */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.imageModel}</label>
                    <div className="space-y-1.5">
                      {[
                        { id: 'nano-banana', label: 'Nano Banana Pro', desc: sr.recommended },
                        { id: 'gemini', label: 'Gemini 2.5 Flash Image', desc: sr.goodQuality },
                        { id: 'imagen3', label: 'Imagen 3', desc: sr.highQuality },
                      ].map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setImageModel(model.id as typeof imageModel)}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between',
                            imageModel === model.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                          )}
                        >
                          <span className="text-sm font-medium">{model.label}</span>
                          <span className={cn('text-xs', imageModel === model.id ? 'text-background/70' : 'text-text-secondary/70')}>{model.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Persona */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.reviewerPerson}</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'mujer-joven', label: sr.youngWoman },
                        { id: 'mujer-adulta', label: sr.adultWoman },
                        { id: 'hombre-joven', label: sr.youngMan },
                        { id: 'hombre-adulto', label: sr.adultMan },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setPersona(option.id as typeof persona)}
                          className={cn(
                            'px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                            persona === option.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Video Section */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">{sr.video}</h3>

              {/* Video Model */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.videoModel} *</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'kling', label: 'Kling 2.6 Pro', desc: sr.recommended },
                    { id: 'veo', label: 'Veo 3.1', desc: sr.highQuality },
                    { id: 'sora', label: 'Sora 2', desc: sr.goodQuality },
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setVideoModel(model.id as typeof videoModel)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between',
                        videoModel === model.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                      )}
                    >
                      <span className="text-sm font-medium">{model.label}</span>
                      <span className={cn('text-xs', videoModel === model.id ? 'text-background/70' : 'text-text-secondary/70')}>{model.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.toneLabel}</label>
                <div className="flex gap-1.5">
                  {[
                    { id: 'casual', label: sr.casual },
                    { id: 'entusiasta', label: sr.enthusiastic },
                    { id: 'esceptico-convencido', label: sr.skepticConvinced },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTone(option.id as typeof tone)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        tone === option.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{sr.durationLabel}</label>
                <div className="flex gap-1.5">
                  {[
                    { id: '15', label: sr.sec15 },
                    { id: '30', label: sr.sec30 },
                    { id: '60', label: sr.sec60 },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      onClick={() => setDuration(dur.id as typeof duration)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        duration === dur.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Script Section */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="customScript"
                  checked={useCustomScript}
                  onChange={(e) => setUseCustomScript(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="customScript" className="text-sm font-medium text-text-primary cursor-pointer">
                  {sr.customScript}
                </label>
              </div>

              {useCustomScript && (
                <textarea
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder={`Ej: "Hola! Les quiero contar mi experiencia con este ${productName || 'producto'}. Al principio no lo creia, pero mis piernas ya no se me duermen en la noche. 100% recomendado."`}
                  rows={4}
                  className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent text-sm resize-none"
                />
              )}

              {!useCustomScript && (
                <p className="text-xs text-text-secondary/70">
                  {sr.autoScriptHint}
                </p>
              )}
            </div>
          </div>

          {/* Output Section */}
          <div className="w-1/2 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">{sr.videoGenerated}</label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex flex-col">
              {/* Video/Preview Area */}
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                {resultVideoUrl ? (
                  <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
                ) : error ? (
                  <div className="text-center p-8">
                    <AlertCircle className="w-12 h-12 text-error mx-auto mb-3" />
                    <p className="text-error font-medium">{sr.error}</p>
                    <p className="text-sm text-text-secondary mt-1 max-w-xs">{error}</p>
                    <button
                      onClick={handleReset}
                      className="mt-4 px-4 py-2 text-sm text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    >
                      {sr.tryAgain}
                    </button>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center p-8">
                    <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-text-primary font-medium">{generationStep}</p>
                    <p className="text-sm text-text-secondary mt-1">{sr.processing}</p>
                    {generatedFaceUrl && (
                      <div className="mt-4">
                        <p className="text-xs text-text-secondary mb-2">{sr.faceGenerated}</p>
                        <img src={generatedFaceUrl} alt={sr.faceGenerated} className="w-20 h-20 rounded-lg mx-auto object-cover" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Video className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                    <p className="text-text-secondary">{sr.videoPlaceholder}</p>
                    <p className="text-xs text-text-secondary/70 mt-2">
                      {sr.videoPlaceholderSub}
                    </p>
                  </div>
                )}
              </div>

              {/* Generated Script Preview */}
              {generatedScript && (
                <div className="border-t border-border p-4">
                  <p className="text-xs font-medium text-text-secondary mb-1">{sr.scriptGenerated}</p>
                  <p className="text-sm text-text-primary line-clamp-3">{generatedScript}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-xs text-text-secondary">
              {videoModel === 'kling' && `Kling 2.6 Pro - ${sr.recommended}`}
              {videoModel === 'veo' && `Veo 3.1 - ${sr.highQuality}`}
              {videoModel === 'sora' && `Sora 2 - ${sr.goodQuality}`}
            </p>
            {isGenerating && (
              <button
                onClick={handleReset}
                className="text-xs text-error hover:text-error/80 transition-colors"
              >
                {sr.cancel}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {resultVideoUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-border/50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {sr.download}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
                !canGenerate || isGenerating
                  ? 'bg-border text-text-secondary cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-background'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {sr.generateVideo}...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {sr.generateVideo}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// DEEP FACE COMPONENT
// ============================================
function DeepFaceTool({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const df = t.studio.deepFace
  // File states (for preview)
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)

  // URL states (after upload to Supabase)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [faceUrl, setFaceUrl] = useState<string | null>(null)

  // Upload progress states
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [isUploadingFace, setIsUploadingFace] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  // Other states
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState<'video' | 'image'>('video')
  const [mode, setMode] = useState<'720p' | '1080p'>('1080p')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'deep-face')!

  // Upload file directly to Supabase Storage (bypasses Vercel 4.5MB limit)
  const uploadToSupabase = async (file: File, folder: string): Promise<string> => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    // Get file extension and ensure it's valid for KIE
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

    // IMPORTANT: Pass contentType so Supabase sets correct MIME type
    // KIE validates files by Content-Type header
    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type, // Critical for KIE to recognize file type
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Error al subir archivo: ${uploadError.message}`)
    }

    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(fileName)

    console.log(`[DeepFace] Uploaded ${file.name} (${file.type}) -> ${publicUrl}`)
    return publicUrl
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate video format (KIE supports .mp4/.mov)
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska']
    if (!validVideoTypes.includes(file.type)) {
      toast.error(df.formatError)
      setError(df.formatError)
      return
    }

    // Validate size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error(df.videoTooLarge)
      setError(df.videoTooLarge)
      return
    }

    setSourceVideo(file)
    setVideoUrl(null)
    setResultVideoUrl(null)
    setError(null)
    setIsUploadingVideo(true)
    setUploadProgress(df.uploadingVideo)

    try {
      const url = await uploadToSupabase(file, 'deep-face/videos')
      setVideoUrl(url)
      setUploadProgress('')
      toast.success(df.videoUploaded)
    } catch (err: any) {
      setError(err.message || df.uploadError)
      setSourceVideo(null)
      toast.error(df.uploadError)
    } finally {
      setIsUploadingVideo(false)
    }
  }

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate image format (KIE supports .jpg/.jpeg/.png)
    const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg']
    if (!validImageTypes.includes(file.type)) {
      toast.error(df.imgFormatError)
      setError(df.imgFormatError)
      return
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(df.imgTooLarge)
      setError(df.imgTooLarge)
      return
    }

    setTargetFace(file)
    setFaceUrl(null)
    setResultVideoUrl(null)
    setError(null)
    setIsUploadingFace(true)
    setUploadProgress(df.uploadingImage)

    try {
      const url = await uploadToSupabase(file, 'deep-face/faces')
      setFaceUrl(url)
      setUploadProgress('')
      toast.success(df.imgUploaded)
    } catch (err: any) {
      setError(err.message || df.imgUploadError)
      setTargetFace(null)
      toast.error(df.imgUploadError)
    } finally {
      setIsUploadingFace(false)
    }
  }

  const clearVideo = () => {
    setSourceVideo(null)
    setVideoUrl(null)
  }

  const clearFace = () => {
    setTargetFace(null)
    setFaceUrl(null)
  }

  const pollStatus = async (taskId: string) => {
    const maxAttempts = 120 // 10 minutes (5 seconds * 120)
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/studio/tools?taskId=${taskId}&type=deep-face`)
        const data = await res.json()

        if (data.status === 'completed' && data.videoUrl) {
          setResultVideoUrl(data.videoUrl)
          setIsProcessing(false)
          setProcessingStatus('')
          return
        }

        if (data.error || data.status === 'failed') {
          setError(data.error || df.processError)
          setIsProcessing(false)
          setProcessingStatus('')
          return
        }

        setProcessingStatus(`${df.processingVideo} (${Math.floor(attempts * 5 / 60)}:${String((attempts * 5) % 60).padStart(2, '0')})`)
        await new Promise(r => setTimeout(r, 5000))
        attempts++
      } catch (err) {
        console.error('Poll error:', err)
        await new Promise(r => setTimeout(r, 5000))
        attempts++
      }
    }

    setError(df.timeoutError)
    setIsProcessing(false)
    setProcessingStatus('')
  }

  const handleProcess = async () => {
    // Verify URLs are ready (files uploaded to Supabase)
    if (!videoUrl || !faceUrl) {
      setError(df.waitUpload)
      return
    }

    setIsProcessing(true)
    setError(null)
    setResultVideoUrl(null)
    setProcessingStatus(df.startingProcess)

    try {
      // Send only URLs to backend (small JSON payload, no file data)
      const res = await fetch('/api/studio/tools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'deep-face',
          videoUrl,
          imageUrl: faceUrl,
          orientation,
          mode,
          prompt: prompt.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || df.processError)
      }

      if (data.taskId) {
        setProcessingStatus(df.processingVideo)
        await pollStatus(data.taskId)
      }
    } catch (err: any) {
      setError(err.message || df.processError)
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  // Check if ready to process
  const isReadyToProcess = videoUrl && faceUrl && !isUploadingVideo && !isUploadingFace

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{df.title}</h2>
              <p className="text-sm text-text-secondary">{df.title}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Video Upload */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {df.videoOriginal} *
                {videoUrl && <Check className="inline w-4 h-4 text-green-500 ml-2" />}
              </label>
              {sourceVideo ? (
                <div className="relative bg-surface-elevated rounded-xl overflow-hidden h-32">
                  <video
                    src={URL.createObjectURL(sourceVideo)}
                    className="w-full h-full object-cover"
                  />
                  {isUploadingVideo && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                      <span className="text-white text-xs">{df.uploadingVideo}</span>
                    </div>
                  )}
                  {!isUploadingVideo && (
                    <button
                      onClick={clearVideo}
                      className="absolute top-2 right-2 p-1.5 bg-error/80 hover:bg-error rounded-lg"
                    >
                      <span className="text-white text-xs">X</span>
                    </button>
                  )}
                  <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                    {sourceVideo.name}
                  </span>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  <Video className="w-8 h-8 text-text-secondary mb-2" />
                  <p className="text-sm text-text-secondary">{df.uploadVideo}</p>
                </label>
              )}
            </div>

            {/* Face Upload */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {df.targetFace} *
                {faceUrl && <Check className="inline w-4 h-4 text-green-500 ml-2" />}
              </label>
              {targetFace ? (
                <div className="relative bg-surface-elevated rounded-xl overflow-hidden h-32">
                  <img
                    src={URL.createObjectURL(targetFace)}
                    alt="Target face"
                    className="w-full h-full object-cover"
                  />
                  {isUploadingFace && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                      <span className="text-white text-xs">{df.uploadingImage}</span>
                    </div>
                  )}
                  {!isUploadingFace && (
                    <button
                      onClick={clearFace}
                      className="absolute top-2 right-2 p-1.5 bg-error/80 hover:bg-error rounded-lg"
                    >
                      <span className="text-white text-xs">X</span>
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFaceUpload} />
                  <UserCircle className="w-8 h-8 text-text-secondary mb-2" />
                  <p className="text-sm text-text-secondary">{df.uploadFaceImage}</p>
                </label>
              )}
            </div>

            {/* Orientation Selector */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {df.orientation}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrientation('video')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    orientation === 'video'
                      ? 'bg-accent text-background'
                      : 'bg-surface-elevated text-text-secondary hover:bg-border/50'
                  )}
                >
                  {df.fromVideo}
                </button>
                <button
                  onClick={() => setOrientation('image')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    orientation === 'image'
                      ? 'bg-accent text-background'
                      : 'bg-surface-elevated text-text-secondary hover:bg-border/50'
                  )}
                >
                  {df.fromImage}
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {orientation === 'video' ? df.orientVideoHint : df.orientImageHint}
              </p>
            </div>

            {/* Quality Selector */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {df.outputQuality}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('720p')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    mode === '720p'
                      ? 'bg-accent text-background'
                      : 'bg-surface-elevated text-text-secondary hover:bg-border/50'
                  )}
                >
                  720p
                </button>
                <button
                  onClick={() => setMode('1080p')}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    mode === '1080p'
                      ? 'bg-accent text-background'
                      : 'bg-surface-elevated text-text-secondary hover:bg-border/50'
                  )}
                >
                  1080p
                </button>
              </div>
            </div>

            {/* Prompt (Optional) */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {df.promptOptional}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 2500))}
                placeholder={df.promptPh}
                className="w-full h-20 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-text-secondary mt-1">
                {prompt.length}/2500 {df.chars}
              </p>
            </div>
          </div>

          {/* Output Section */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {df.videoResult}
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {resultVideoUrl ? (
                <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
              ) : (
                <div className="text-center p-8">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">{df.processingVideo}</p>
                      <p className="text-sm text-text-secondary mt-1">{processingStatus || df.processingHint}</p>
                    </>
                  ) : error ? (
                    <>
                      <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-3">
                        <span className="text-error text-xl">✕</span>
                      </div>
                      <p className="text-error font-medium">Error</p>
                      <p className="text-sm text-text-secondary mt-1">{error}</p>
                    </>
                  ) : (
                    <>
                      <Drama className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">{df.resultPlaceholder}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          {/* Upload status hint */}
          <div className="text-sm text-text-secondary">
            {(isUploadingVideo || isUploadingFace) && (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadProgress || df.uploadingVideo}
              </span>
            )}
            {!isUploadingVideo && !isUploadingFace && sourceVideo && targetFace && !videoUrl && !faceUrl && (
              <span className="text-amber-500">{df.waitUpload}</span>
            )}
          </div>

          <button
            onClick={handleProcess}
            disabled={!isReadyToProcess || isProcessing}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
              !isReadyToProcess || isProcessing
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {processingStatus || df.processingVideo}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {df.processVideo}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// CLONAR VIRAL COMPONENT (5-step pipeline)
// ============================================
type CloneStep = 'upload' | 'transcribe' | 'translate' | 'generate' | 'result'

interface CloneInfluencer {
  id: string
  name: string
  image_url?: string
  realistic_image_url?: string
  prompt_descriptor?: string
  character_profile: any
}

function ClonarViralTool({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const cv = t.studio.clonarViral
  const [step, setStep] = useState<CloneStep>('upload')
  const [error, setError] = useState<string | null>(null)

  // Step 1: Upload
  const [viralVideo, setViralVideo] = useState<File | null>(null)
  const [viralVideoUrl, setViralVideoUrl] = useState<string | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [productName, setProductName] = useState('')

  // Step 2: Transcribe
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [detectedLanguage, setDetectedLanguage] = useState('')

  // Step 3: Translate
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedScript, setTranslatedScript] = useState('')

  // Step 4: Prompt generation (Kling 3.0 multi-shot)
  const [influencers, setInfluencers] = useState<CloneInfluencer[]>([])
  const [selectedInfluencer, setSelectedInfluencer] = useState<string>('')
  const [targetDuration, setTargetDuration] = useState<14 | 28 | 42>(14)
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false)
  const [generatedSections, setGeneratedSections] = useState<Array<{
    title: string
    startImagePrompt: string
    scenes: Array<{ prompt: string; duration: number }>
  }>>([])

  // Step 5: Video generation per section
  const [generatingVideoIdx, setGeneratingVideoIdx] = useState<number | null>(null)
  const [sectionVideos, setSectionVideos] = useState<(string | null)[]>([])
  const [generationStatus, setGenerationStatus] = useState('')

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'clonar-viral')!
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // Fetch influencers
  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        const res = await fetch('/api/studio/influencer')
        const data = await res.json()
        if (data.influencers) setInfluencers(data.influencers)
      } catch (err) {
        console.error('Error fetching influencers:', err)
      }
    }
    fetchInfluencers()
  }, [])

  const uploadToSupabase = async (file: File, folder: string): Promise<string> => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('landing-images')
      .upload(filename, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw new Error(`Error al subir: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('landing-images')
      .getPublicUrl(filename)

    return publicUrl
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setViralVideo(file)
    setViralVideoUrl(null)
    setError(null)
    setIsUploadingVideo(true)

    try {
      const url = await uploadToSupabase(file, 'clone-viral/source')
      setViralVideoUrl(url)
      toast.success(cv.videoUploaded)
    } catch (err: any) {
      setError(err.message)
      setViralVideo(null)
    } finally {
      setIsUploadingVideo(false)
    }
  }

  const handleTranscribe = async () => {
    if (!viralVideoUrl) return

    setIsTranscribing(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/clone-viral/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: viralVideoUrl }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || cv.transcribeError)

      setTranscript(data.transcript || '')
      setDetectedLanguage(data.language || '')
      setStep('transcribe')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleTranslate = async () => {
    if (!transcript) return

    setIsTranslating(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/clone-viral/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          product_name: productName || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || cv.translateError)

      setTranslatedScript(data.translated_script || transcript)
      setStep('translate')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsTranslating(false)
    }
  }

  const pollKieTask = async (taskId: string, statusPrefix?: string): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 180 // 15 minutes (5s * 180)
      const startTime = Date.now()

      pollingRef.current = setInterval(async () => {
        attempts++
        if (attempts > maxAttempts) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          reject(new Error(cv.taskTimeout))
          return
        }

        // Show elapsed time
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        const mins = Math.floor(elapsed / 60)
        const secs = elapsed % 60
        const timeStr = `${mins}:${String(secs).padStart(2, '0')}`
        try {
          const res = await fetch(`/api/studio/video-status?taskId=${taskId}`)
          const data = await res.json()

          const stateLabel = data.taskState || 'sin estado'
          if (statusPrefix) {
            setGenerationStatus(`${statusPrefix} (${timeStr}) [${stateLabel}]`)
          }

          console.log(`[CloneViral] Poll #${attempts} taskState=${data.taskState || '-'} status=${data.status} raw:`, data)

          if (data.status === 'completed') {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            resolve(data.videoUrl || data.audioUrl || data.imageUrl || null)
          } else if (data.status === 'failed' || (data.success === false && data.error)) {
            clearInterval(pollingRef.current!)
            pollingRef.current = null
            reject(new Error(data.error || cv.taskFailed))
          }
        } catch (err) {
          // Keep polling on network errors
        }
      }, 5000)
    })
  }

  const handleGeneratePrompts = async () => {
    const influencer = influencers.find(i => i.id === selectedInfluencer)
    if (!influencer || !translatedScript) return

    setIsGeneratingPrompts(true)
    setError(null)
    setGeneratedSections([])
    setSectionVideos([])

    const sectionCount = targetDuration === 14 ? 1 : targetDuration === 28 ? 2 : 3

    try {
      const res = await fetch('/api/studio/clone-viral/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: translatedScript,
          productName,
          sectionCount,
          promptDescriptor: influencer.prompt_descriptor || influencer.character_profile?.prompt_descriptor,
          influencerName: influencer.name,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || cv.taskFailed)

      if (data.sections && data.sections.length > 0) {
        setGeneratedSections(data.sections)
        setSectionVideos(new Array(data.sections.length).fill(null))
        toast.success(`${data.sections.length} ${cv.sectionsGenerated}`)
      } else {
        throw new Error(cv.noSections)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGeneratingPrompts(false)
    }
  }

  const handleGenerateVideo = async (sectionIdx: number) => {
    const section = generatedSections[sectionIdx]
    const influencer = influencers.find(i => i.id === selectedInfluencer)
    if (!section || !influencer) return

    setGeneratingVideoIdx(sectionIdx)
    setGenerationStatus('')
    setError(null)

    try {
      const imageUrl = influencer.realistic_image_url || influencer.image_url
      const totalDuration = section.scenes.reduce((s, sc) => s + sc.duration, 0)

      const res = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'kling-3.0',
          prompt: section.scenes[0].prompt,
          duration: totalDuration,
          aspectRatio: '9:16',
          enableAudio: true,
          imageUrl,
          multiShots: true,
          multiPrompt: section.scenes,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || cv.taskFailed)

      if (data.taskId) {
        const videoUrl = await pollKieTask(data.taskId, `${cv.section} ${sectionIdx + 1} — Kling 3.0`)
        if (videoUrl) {
          setSectionVideos(prev => {
            const next = [...prev]
            next[sectionIdx] = videoUrl
            return next
          })
          toast.success(cv.videoSectionReady)
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingVideoIdx(null)
      setGenerationStatus('')
    }
  }

  const STEPS: { id: CloneStep; label: string; num: number }[] = [
    { id: 'upload', label: cv.stepUpload, num: 1 },
    { id: 'transcribe', label: cv.stepTranscribe, num: 2 },
    { id: 'translate', label: cv.stepTranslate, num: 3 },
    { id: 'generate', label: cv.stepGenerate, num: 4 },
    { id: 'result', label: cv.stepResult, num: 5 },
  ]

  const currentStepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{cv.title}</h2>
              <p className="text-sm text-text-secondary">{cv.desc}</p>
            </div>
          </div>
        </div>

        {/* Step Progress */}
        <div className="px-6 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => i <= currentStepIndex && setStep(s.id)}
                  disabled={i > currentStepIndex}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    i === currentStepIndex
                      ? 'bg-accent text-background'
                      : i < currentStepIndex
                        ? 'bg-accent/20 text-accent cursor-pointer'
                        : 'bg-border/50 text-text-muted cursor-not-allowed'
                  )}
                >
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-current/20">
                    {i < currentStepIndex ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      s.num
                    )}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn('w-4 h-0.5 rounded', i < currentStepIndex ? 'bg-accent' : 'bg-border')} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="max-w-lg mx-auto space-y-4">
              <p className="text-sm text-text-secondary">{cv.uploadHint}</p>

              {viralVideo ? (
                <div className="relative bg-surface-elevated rounded-xl overflow-hidden">
                  <video src={URL.createObjectURL(viralVideo)} controls className="w-full max-h-[300px] object-contain" />
                  {isUploadingVideo && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                  {viralVideoUrl && (
                    <div className="absolute top-2 right-2 p-1 bg-green-500 rounded-full">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  <Video className="w-10 h-10 text-text-secondary mb-3" />
                  <p className="text-text-primary font-medium">{cv.uploadBtn}</p>
                  <p className="text-xs text-text-secondary mt-1">{cv.uploadFormat}</p>
                </label>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  {cv.productNameLabel}
                </label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder={cv.productNamePh}
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              </div>

              <button
                onClick={handleTranscribe}
                disabled={!viralVideoUrl || isTranscribing}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                  !viralVideoUrl || isTranscribing
                    ? 'bg-border text-text-secondary cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
                )}
              >
                {isTranscribing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {cv.transcribing}</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> {cv.transcribeBtn}</>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: Transcribe result */}
          {step === 'transcribe' && (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-secondary">{cv.transcription}</p>
                {detectedLanguage && (
                  <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-lg">
                    {cv.detectedLang}: {detectedLanguage}
                  </span>
                )}
              </div>

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />

              <button
                onClick={handleTranslate}
                disabled={!transcript.trim() || isTranslating}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                  !transcript.trim() || isTranslating
                    ? 'bg-border text-text-secondary cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
                )}
              >
                {isTranslating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {cv.translating}</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> {cv.translateBtn}</>
                )}
              </button>
            </div>
          )}

          {/* STEP 3: Translate result */}
          {step === 'translate' && (
            <div className="max-w-lg mx-auto space-y-4">
              <p className="text-sm text-text-secondary">{cv.translatedHint}</p>

              <textarea
                value={translatedScript}
                onChange={(e) => setTranslatedScript(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />

              <button
                onClick={() => setStep('generate')}
                disabled={!translatedScript.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                  !translatedScript.trim()
                    ? 'bg-border text-text-secondary cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
                )}
              >
                {cv.continueToGen}
              </button>
            </div>
          )}

          {/* STEP 4: Generate prompts + videos */}
          {step === 'generate' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-sm text-text-secondary">{cv.genHint}</p>

              {influencers.length === 0 ? (
                <div className="text-center py-8">
                  <UserCircle className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                  <p className="text-text-secondary mb-2">{cv.noInfluencers}</p>
                  <p className="text-xs text-text-muted">
                    {cv.goToInfluencer}
                  </p>
                </div>
              ) : (
                <>
                  {/* Influencer grid */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">{cv.selectInfluencer}</label>
                    <div className="grid grid-cols-3 gap-3">
                      {influencers.map((inf) => (
                        <button
                          key={inf.id}
                          onClick={() => setSelectedInfluencer(inf.id)}
                          className={cn(
                            'p-3 rounded-xl border text-center transition-all',
                            selectedInfluencer === inf.id
                              ? 'border-accent bg-accent/10'
                              : 'border-border bg-surface-elevated hover:border-accent/50'
                          )}
                        >
                          {(inf.realistic_image_url || inf.image_url) ? (
                            <img src={inf.realistic_image_url || inf.image_url} alt={inf.name} className="w-16 h-16 mx-auto rounded-lg object-cover mb-2" />
                          ) : (
                            <div className="w-16 h-16 mx-auto rounded-lg bg-border/50 flex items-center justify-center mb-2">
                              <UserCircle className="w-8 h-8 text-text-muted" />
                            </div>
                          )}
                          <p className={cn('text-xs font-medium', selectedInfluencer === inf.id ? 'text-accent' : 'text-text-primary')}>
                            {inf.name}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration selector */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">{cv.cloneDuration}</label>
                    <div className="flex gap-3">
                      {([14, 28, 42] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setTargetDuration(d)}
                          className={cn(
                            'flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                            targetDuration === d
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border bg-surface-elevated text-text-secondary hover:border-accent/50'
                          )}
                        >
                          ~{d}s ({d === 14 ? `1 ${cv.section}` : d === 28 ? `2 ${cv.section}s` : `3 ${cv.section}s`})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate prompts button */}
                  <button
                    onClick={handleGeneratePrompts}
                    disabled={!selectedInfluencer || isGeneratingPrompts}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                      !selectedInfluencer || isGeneratingPrompts
                        ? 'bg-border text-text-secondary cursor-not-allowed'
                        : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
                    )}
                  >
                    {isGeneratingPrompts ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> {cv.generatingPrompts}</>
                    ) : (
                      <><Sparkles className="w-5 h-5" /> {cv.generatePrompts}</>
                    )}
                  </button>

                  {/* Generated sections */}
                  {generatedSections.length > 0 && (
                    <div className="space-y-6 pt-4 border-t border-border">
                      {generatedSections.map((section, sIdx) => {
                        const totalSec = section.scenes.reduce((s, sc) => s + sc.duration, 0)
                        return (
                          <div key={sIdx} className="border border-border rounded-xl overflow-hidden">
                            {/* Section header */}
                            <div className="px-4 py-3 bg-surface-elevated border-b border-border">
                              <h4 className="text-sm font-semibold text-text-primary">
                                {cv.section} {sIdx + 1}: {section.title}
                              </h4>
                              <p className="text-xs text-text-muted mt-0.5">{cv.total}: {totalSec}s</p>
                            </div>

                            <div className="p-4 space-y-3">
                              {/* Start image prompt */}
                              <div>
                                <label className="block text-xs font-medium text-text-muted uppercase mb-1">{cv.initialImagePrompt}</label>
                                <textarea
                                  value={section.startImagePrompt}
                                  onChange={(e) => {
                                    setGeneratedSections(prev => {
                                      const next = [...prev]
                                      next[sIdx] = { ...next[sIdx], startImagePrompt: e.target.value }
                                      return next
                                    })
                                  }}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-xs"
                                />
                              </div>

                              {/* Scenes */}
                              <div>
                                <label className="block text-xs font-medium text-text-muted uppercase mb-1">{cv.multiShot}</label>
                                <div className="space-y-2">
                                  {section.scenes.map((scene, scIdx) => (
                                    <div key={scIdx} className="flex gap-2">
                                      <textarea
                                        value={scene.prompt}
                                        onChange={(e) => {
                                          setGeneratedSections(prev => {
                                            const next = [...prev]
                                            const scenes = [...next[sIdx].scenes]
                                            scenes[scIdx] = { ...scenes[scIdx], prompt: e.target.value }
                                            next[sIdx] = { ...next[sIdx], scenes }
                                            return next
                                          })
                                        }}
                                        rows={2}
                                        className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-xs"
                                      />
                                      <div className="flex flex-col items-center justify-center min-w-[50px]">
                                        <input
                                          type="number"
                                          min={2}
                                          max={5}
                                          value={scene.duration}
                                          onChange={(e) => {
                                            setGeneratedSections(prev => {
                                              const next = [...prev]
                                              const scenes = [...next[sIdx].scenes]
                                              scenes[scIdx] = { ...scenes[scIdx], duration: Math.max(2, Math.min(5, Number(e.target.value) || 2)) }
                                              next[sIdx] = { ...next[sIdx], scenes }
                                              return next
                                            })
                                          }}
                                          className="w-12 px-1 py-1 bg-surface-elevated border border-border rounded-lg text-text-primary text-center text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
                                        />
                                        <span className="text-[10px] text-text-muted">{cv.sec}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Generate video button / player */}
                              {sectionVideos[sIdx] ? (
                                <div className="space-y-2">
                                  <video src={sectionVideos[sIdx]!} controls className="w-full rounded-lg aspect-[9/16] object-contain bg-black" />
                                  <a
                                    href={sectionVideos[sIdx]!}
                                    download={`clone-viral-s${sIdx + 1}-${Date.now()}.mp4`}
                                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 font-medium text-xs transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    {cv.download}
                                  </a>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGenerateVideo(sIdx)}
                                  disabled={generatingVideoIdx !== null}
                                  className={cn(
                                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all',
                                    generatingVideoIdx !== null
                                      ? 'bg-border text-text-secondary cursor-not-allowed'
                                      : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
                                  )}
                                >
                                  {generatingVideoIdx === sIdx ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> {generationStatus || `${cv.generateKling}...`}</>
                                  ) : (
                                    <>{cv.generateKling}</>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 5: Result */}
          {step === 'result' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <p className="text-sm text-text-secondary">{cv.resultHint}</p>

              <div className={cn('grid gap-4', generatedSections.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : generatedSections.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
                {generatedSections.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      {cv.section} {sIdx + 1}: {section.title}
                    </label>
                    <div className="bg-surface-elevated rounded-xl overflow-hidden aspect-[9/16] flex items-center justify-center">
                      {sectionVideos[sIdx] ? (
                        <video src={sectionVideos[sIdx]!} controls className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-center p-4">
                          <Video className="w-8 h-8 text-text-muted mx-auto mb-2" />
                          <p className="text-xs text-text-muted">{cv.pending}</p>
                        </div>
                      )}
                    </div>
                    {sectionVideos[sIdx] && (
                      <a
                        href={sectionVideos[sIdx]!}
                        download={`clone-viral-s${sIdx + 1}-${Date.now()}.mp4`}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 font-medium text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        {cv.download}
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Script */}
              <div className="p-4 bg-surface-elevated rounded-xl">
                <label className="block text-xs font-medium text-text-muted uppercase mb-2">{cv.scriptUsed}</label>
                <p className="text-sm text-text-secondary">{translatedScript}</p>
              </div>

              {/* Back to edit prompts */}
              <button
                onClick={() => setStep('generate')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-text-secondary hover:bg-border/30 font-medium text-sm transition-colors"
              >
                {cv.backToEdit}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// VIDEO PRODUCTO COMPONENT
// ============================================
function VideoProductoTool({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const vp = t.studio.videoProd
  const [productImages, setProductImages] = useState<File[]>([])
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [videoStyle, setVideoStyle] = useState<'promocional' | 'unboxing' | 'lifestyle' | 'testimonial'>('promocional')
  const [duration, setDuration] = useState<'15' | '30' | '60'>('30')
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'video-producto')!

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setProductImages(prev => [...prev, ...files].slice(0, 6))
      setResultVideoUrl(null)
    }
  }

  const removeImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcess = async () => {
    if (productImages.length === 0 || !productName.trim()) return
    setIsProcessing(true)
    // TODO: Implement API call
    setTimeout(() => {
      setIsProcessing(false)
    }, 2000)
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{vp.title}</h2>
              <p className="text-sm text-text-secondary">{vp.title}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-1/2 flex flex-col gap-4 overflow-y-auto">
            {/* Product Images */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {vp.productImages} * {vp.maxImages}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {productImages.map((file, index) => (
                  <div key={index} className="relative aspect-square bg-surface-elevated rounded-lg overflow-hidden">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-5 h-5 bg-error/80 hover:bg-error rounded-full flex items-center justify-center"
                    >
                      <span className="text-white text-xs">X</span>
                    </button>
                  </div>
                ))}
                {productImages.length < 6 && (
                  <label className="aspect-square border-2 border-dashed border-border hover:border-accent/50 rounded-lg cursor-pointer flex items-center justify-center transition-colors">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagesUpload} />
                    <span className="text-2xl text-text-secondary">+</span>
                  </label>
                )}
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {vp.productName} *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={vp.productNamePh}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Product Description */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {vp.descBenefits}
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder={vp.descBenefitsPh}
                rows={3}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent resize-none"
              />
            </div>

            {/* Video Style */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {vp.videoStyle}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'promocional', label: vp.promotional, desc: vp.promotionalDesc },
                  { id: 'unboxing', label: vp.unboxing, desc: vp.unboxingDesc },
                  { id: 'lifestyle', label: vp.lifestyle, desc: vp.lifestyleDesc },
                  { id: 'testimonial', label: vp.testimonial, desc: vp.testimonialDesc },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setVideoStyle(style.id as typeof videoStyle)}
                    className={cn(
                      'p-3 rounded-lg text-left transition-colors',
                      videoStyle === style.id
                        ? 'bg-accent text-background'
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <span className="text-sm font-medium block">{style.label}</span>
                    <span className={cn('text-xs', videoStyle === style.id ? 'text-background/70' : 'text-text-secondary/70')}>{style.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {vp.duration}
              </label>
              <div className="flex gap-2">
                {[
                  { id: '15', label: vp.sec15 },
                  { id: '30', label: vp.sec30 },
                  { id: '60', label: vp.sec60 },
                ].map((dur) => (
                  <button
                    key={dur.id}
                    onClick={() => setDuration(dur.id as typeof duration)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      duration === dur.id
                        ? 'bg-accent text-background'
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="w-1/2 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {vp.videoGenerated}
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {resultVideoUrl ? (
                <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
              ) : (
                <div className="text-center p-8">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">{vp.generateVideo}...</p>
                      <p className="text-sm text-text-secondary mt-1">{vp.creatingScenes}</p>
                    </>
                  ) : (
                    <>
                      <Video className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">{vp.videoPlaceholder}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end">
          <button
            onClick={handleProcess}
            disabled={productImages.length === 0 || !productName.trim() || isProcessing}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
              productImages.length === 0 || !productName.trim() || isProcessing
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {vp.generateVideo}...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {vp.generateVideo}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// MiInfluencerTool replaced by InfluencerWizard (components/studio/influencer/InfluencerWizard.tsx)

// ============================================
// PLACEHOLDER TOOL COMPONENT
// ============================================
function PlaceholderTool({ toolId, onBack }: { toolId: string; onBack: () => void }) {
  const { t } = useI18n()
  const tn = t.studio.toolNames as Record<string, string>
  const td = t.studio.toolDescs as Record<string, string>
  const tool = DROPSHIPPING_TOOLS.find(t => t.id === toolId)!
  const toolName = tn[tool.nameKey] || tool.name
  const toolDesc = td[tool.descKey] || tool.description

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button
            onClick={onBack}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', tool.color)}>
              <span className="text-xl">{tool.emoji}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{toolName}</h2>
              <p className="text-sm text-text-secondary">{toolDesc}</p>
            </div>
          </div>
        </div>

        {/* Content - Placeholder */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <span className="text-6xl mb-4 block">{tool.emoji}</span>
            <h3 className="text-xl font-semibold text-text-primary mb-2">{toolName}</h3>
            <p className="text-text-secondary max-w-md">
              {t.studio.videoProd?.toolInDev || 'This tool is in development.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN GRID COMPONENT
// ============================================
interface DropshippingGridProps {
  initialTool?: string | null
  onBack?: () => void
}

export function DropshippingGrid({ initialTool, onBack: onBackProp }: DropshippingGridProps = {}) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(initialTool || null)
  const { t } = useI18n()
  const tn = t.studio.toolNames as Record<string, string>
  const td = t.studio.toolDescs as Record<string, string>

  const handleBack = () => {
    if (onBackProp) {
      onBackProp()
    } else {
      setActiveTool(null)
    }
  }

  // Render specific tool UI
  if (activeTool === 'resena-ugc') {
    return <ResenaUGCTool onBack={handleBack} />
  }

  if (activeTool === 'deep-face') {
    return <DeepFaceTool onBack={handleBack} />
  }

  if (activeTool === 'clonar-viral') {
    return <ClonarViralTool onBack={handleBack} />
  }

  if (activeTool === 'video-producto') {
    return <VideoProductoTool onBack={handleBack} />
  }

  if (activeTool === 'mi-influencer') {
    return <InfluencerWizard onBack={handleBack} />
  }

  if (activeTool === 'auto-publicar') {
    return <AutoPublisherTool onBack={handleBack} />
  }

  if (activeTool === 'ebook-generator') {
    return <EbookGenerator onBack={handleBack} />
  }

  if (activeTool === 'costeo-calculator') {
    return <CosteoCalculator onBack={handleBack} />
  }

  if (activeTool) {
    return <PlaceholderTool toolId={activeTool} onBack={handleBack} />
  }

  // Grid view
  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">{t.studio.toolsHeading}</h2>
        <p className="text-text-secondary">
          {t.studio.toolsSubheading}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {DROPSHIPPING_TOOLS.map((tool) => (
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
                {t.nav.soon}
              </span>
            )}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4',
                tool.color
              )}
            >
              <span className="text-2xl">{tool.emoji}</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {tn[tool.nameKey] || tool.nameKey}
            </h3>
            <p className="text-sm text-text-secondary">{td[tool.descKey] || tool.descKey}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
