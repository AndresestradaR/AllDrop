'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
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
} from 'lucide-react'

interface DropshippingTool {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  emoji: string
  soon?: boolean
}

const DROPSHIPPING_TOOLS: DropshippingTool[] = [
  {
    id: 'resena-ugc',
    name: 'Resena UGC',
    description: 'Genera resenas realistas con IA',
    icon: Star,
    color: 'from-yellow-500 to-amber-500',
    emoji: '⭐',
  },
  {
    id: 'deep-face',
    name: 'Deep Face',
    description: 'Cambia cara y voz de videos',
    icon: Drama,
    color: 'from-purple-500 to-pink-500',
    emoji: '🎭',
  },
  {
    id: 'clonar-viral',
    name: 'Clonar Viral',
    description: 'Recrea videos virales para tu producto',
    icon: RefreshCw,
    color: 'from-blue-500 to-cyan-500',
    emoji: '🔄',
  },
  {
    id: 'video-producto',
    name: 'Video Producto',
    description: 'Crea videos de tu producto con IA',
    icon: Video,
    color: 'from-red-500 to-orange-500',
    emoji: '🎥',
  },
  {
    id: 'mi-influencer',
    name: 'Mi Influencer',
    description: 'Crea y guarda personajes consistentes',
    icon: UserCircle,
    color: 'from-green-500 to-emerald-500',
    emoji: '👤',
  },
]

type ActiveTool = typeof DROPSHIPPING_TOOLS[number]['id'] | null

// ============================================
// RESENA UGC COMPONENT (Video Version)
// ============================================
function ResenaUGCTool({ onBack }: { onBack: () => void }) {
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

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'resena-ugc')!

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      setImageSource('upload')
    }
  }

  const handleGenerate = async () => {
    if (!productName.trim()) return
    if (imageSource === 'upload' && !uploadedImage) return

    setIsGenerating(true)
    setResultVideoUrl(null)

    // TODO: Implement full API flow
    // Step 1: Generate face if needed
    setGenerationStep('Generando cara...')
    await new Promise(r => setTimeout(r, 1500))

    // Step 2: Create character profile
    setGenerationStep('Creando perfil de personaje...')
    await new Promise(r => setTimeout(r, 1500))

    // Step 3: Generate script if needed
    if (!useCustomScript) {
      setGenerationStep('Generando guion...')
      await new Promise(r => setTimeout(r, 1000))
    }

    // Step 4: Generate video
    setGenerationStep('Generando video con dialogo...')
    await new Promise(r => setTimeout(r, 3000))

    // Step 5: Done (placeholder)
    setGenerationStep('')
    setIsGenerating(false)
    // setResultVideoUrl would be set here with actual URL
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
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">Genera videos de resenas UGC con IA</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section - Scrollable */}
          <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Product Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Producto</h3>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nombre del producto *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ej: Serum facial, Faja reductora..."
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Beneficio principal</label>
                <input
                  type="text"
                  value={productBenefit}
                  onChange={(e) => setProductBenefit(e.target.value)}
                  placeholder="Ej: Reduce arrugas en 2 semanas..."
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">Imagen de la Persona</h3>

              {/* Image Source Toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setImageSource('generate')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    imageSource === 'generate' ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  )}
                >
                  Generar con IA
                </button>
                <button
                  onClick={() => setImageSource('upload')}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    imageSource === 'upload' ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  )}
                >
                  Subir imagen
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
                      <p className="text-sm text-text-secondary">Subir foto de la persona</p>
                      <p className="text-xs text-text-secondary/70">Cara frontal, buena iluminacion</p>
                    </label>
                  )}
                </div>
              ) : (
                <>
                  {/* Image Model */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Modelo de imagen</label>
                    <div className="space-y-1.5">
                      {[
                        { id: 'nano-banana', label: 'Nano Banana Pro', desc: 'Recomendado para caras realistas' },
                        { id: 'gemini', label: 'Gemini 2.5 Flash Image', desc: 'Buena calidad general' },
                        { id: 'imagen3', label: 'Imagen 3', desc: 'Alta calidad, mas lento' },
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
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Persona del reviewer</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'mujer-joven', label: 'Mujer joven (18-30)' },
                        { id: 'mujer-adulta', label: 'Mujer adulta (30-50)' },
                        { id: 'hombre-joven', label: 'Hombre joven (18-30)' },
                        { id: 'hombre-adulto', label: 'Hombre adulto (30-50)' },
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
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-3">Video</h3>

              {/* Video Model */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Modelo de video *</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'kling', label: 'Kling 2.6 Pro', desc: 'Recomendado - mejor para personas hablando' },
                    { id: 'veo', label: 'Veo 3.1', desc: 'Alta calidad cinematografica' },
                    { id: 'sora', label: 'Sora 2', desc: 'Bueno para creatividad' },
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
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tono de la resena</label>
                <div className="flex gap-1.5">
                  {[
                    { id: 'casual', label: 'Casual' },
                    { id: 'entusiasta', label: 'Entusiasta' },
                    { id: 'esceptico-convencido', label: 'Esceptico convencido' },
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
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Duracion</label>
                <div className="flex gap-1.5">
                  {[
                    { id: '15', label: '15 seg' },
                    { id: '30', label: '30 seg' },
                    { id: '60', label: '60 seg' },
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
                  Escribir guion personalizado
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
                  El guion se generara automaticamente basado en el producto, beneficio, tono y persona seleccionados.
                </p>
              )}
            </div>
          </div>

          {/* Output Section */}
          <div className="w-1/2 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">Video generado</label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {resultVideoUrl ? (
                <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
              ) : (
                <div className="text-center p-8">
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">{generationStep}</p>
                      <p className="text-sm text-text-secondary mt-1">Esto puede tardar varios minutos</p>
                    </>
                  ) : (
                    <>
                      <Video className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">El video de la resena aparecera aqui</p>
                      <p className="text-xs text-text-secondary/70 mt-2">
                        Persona hablando a camara con tu guion
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
          <p className="text-xs text-text-secondary">
            {videoModel === 'kling' && 'Kling 2.6 Pro - Mejor calidad para personas hablando'}
            {videoModel === 'veo' && 'Veo 3.1 - Cinematografia de alta calidad'}
            {videoModel === 'sora' && 'Sora 2 - Bueno para estilos creativos'}
          </p>
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
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// DEEP FACE COMPONENT
// ============================================
function DeepFaceTool({ onBack }: { onBack: () => void }) {
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [targetFace, setTargetFace] = useState<File | null>(null)
  const [voiceAudio, setVoiceAudio] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'deep-face')!

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSourceVideo(file)
      setResultVideoUrl(null)
    }
  }

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setTargetFace(file)
      setResultVideoUrl(null)
    }
  }

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setVoiceAudio(file)
  }

  const handleProcess = async () => {
    if (!sourceVideo || !targetFace) return
    setIsProcessing(true)
    // TODO: Implement API call
    setTimeout(() => {
      setIsProcessing(false)
      // Placeholder: would set resultVideoUrl here
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
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-1/3 flex flex-col gap-4">
            {/* Video Upload */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Video original *
              </label>
              {sourceVideo ? (
                <div className="relative bg-surface-elevated rounded-xl overflow-hidden h-32">
                  <video
                    src={URL.createObjectURL(sourceVideo)}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setSourceVideo(null)}
                    className="absolute top-2 right-2 p-1.5 bg-error/80 hover:bg-error rounded-lg"
                  >
                    <span className="text-white text-xs">X</span>
                  </button>
                  <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                    {sourceVideo.name}
                  </span>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  <Video className="w-8 h-8 text-text-secondary mb-2" />
                  <p className="text-sm text-text-secondary">Subir video</p>
                </label>
              )}
            </div>

            {/* Face Upload */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Cara destino *
              </label>
              {targetFace ? (
                <div className="relative bg-surface-elevated rounded-xl overflow-hidden h-32">
                  <img
                    src={URL.createObjectURL(targetFace)}
                    alt="Target face"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setTargetFace(null)}
                    className="absolute top-2 right-2 p-1.5 bg-error/80 hover:bg-error rounded-lg"
                  >
                    <span className="text-white text-xs">X</span>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleFaceUpload} />
                  <UserCircle className="w-8 h-8 text-text-secondary mb-2" />
                  <p className="text-sm text-text-secondary">Subir imagen de cara</p>
                </label>
              )}
            </div>

            {/* Audio Upload (Optional) */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Audio de voz (opcional)
              </label>
              {voiceAudio ? (
                <div className="relative bg-surface-elevated rounded-xl p-3 flex items-center gap-2">
                  <span className="text-sm text-text-primary truncate flex-1">{voiceAudio.name}</span>
                  <button onClick={() => setVoiceAudio(null)} className="text-error text-xs">X</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-12 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                  <span className="text-sm text-text-secondary">Subir audio para cambiar voz</span>
                </label>
              )}
            </div>
          </div>

          {/* Output Section */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Video resultado
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {resultVideoUrl ? (
                <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
              ) : (
                <div className="text-center p-8">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">Procesando video...</p>
                      <p className="text-sm text-text-secondary mt-1">Esto puede tardar varios minutos</p>
                    </>
                  ) : (
                    <>
                      <Drama className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">El video procesado aparecera aqui</p>
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
            disabled={!sourceVideo || !targetFace || isProcessing}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
              !sourceVideo || !targetFace || isProcessing
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
                Procesar Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// CLONAR VIRAL COMPONENT
// ============================================
function ClonarViralTool({ onBack }: { onBack: () => void }) {
  const [viralUrl, setViralUrl] = useState('')
  const [productImages, setProductImages] = useState<File[]>([])
  const [productDescription, setProductDescription] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'clonar-viral')!

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setProductImages(prev => [...prev, ...files].slice(0, 5))
      setResultVideoUrl(null)
    }
  }

  const removeImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcess = async () => {
    if (!viralUrl.trim() || productImages.length === 0) return
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
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-1/2 flex flex-col gap-4">
            {/* Viral URL */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                URL del video viral *
              </label>
              <input
                type="url"
                value={viralUrl}
                onChange={(e) => setViralUrl(e.target.value)}
                placeholder="https://tiktok.com/... o https://instagram.com/..."
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-text-secondary mt-1">TikTok, Instagram Reels, YouTube Shorts</p>
            </div>

            {/* Product Images */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Imagenes de tu producto * (max 5)
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
                {productImages.length < 5 && (
                  <label className="aspect-square border-2 border-dashed border-border hover:border-accent/50 rounded-lg cursor-pointer flex items-center justify-center transition-colors">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImagesUpload} />
                    <span className="text-2xl text-text-secondary">+</span>
                  </label>
                )}
              </div>
            </div>

            {/* Product Description */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Descripcion del producto (opcional)
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe brevemente tu producto y sus beneficios..."
                rows={3}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </div>

          {/* Output Section */}
          <div className="w-1/2 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Video clonado
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {resultVideoUrl ? (
                <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
              ) : (
                <div className="text-center p-8">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">Clonando video viral...</p>
                      <p className="text-sm text-text-secondary mt-1">Analizando estilo y creando version</p>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">El video clonado aparecera aqui</p>
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
            disabled={!viralUrl.trim() || productImages.length === 0 || isProcessing}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
              !viralUrl.trim() || productImages.length === 0 || isProcessing
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Clonando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Clonar Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// VIDEO PRODUCTO COMPONENT
// ============================================
function VideoProductoTool({ onBack }: { onBack: () => void }) {
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
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
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
                Imagenes del producto * (max 6)
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
                Nombre del producto *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Serum Vitamina C, Faja Colombiana..."
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Product Description */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Descripcion y beneficios
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Describe las caracteristicas principales y beneficios..."
                rows={3}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent resize-none"
              />
            </div>

            {/* Video Style */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Estilo del video
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'promocional', label: 'Promocional', desc: 'Enfoque en beneficios' },
                  { id: 'unboxing', label: 'Unboxing', desc: 'Abriendo el paquete' },
                  { id: 'lifestyle', label: 'Lifestyle', desc: 'Uso en la vida real' },
                  { id: 'testimonial', label: 'Testimonial', desc: 'Estilo resena' },
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
                Duracion
              </label>
              <div className="flex gap-2">
                {[
                  { id: '15', label: '15 seg' },
                  { id: '30', label: '30 seg' },
                  { id: '60', label: '60 seg' },
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
              Video generado
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {resultVideoUrl ? (
                <video src={resultVideoUrl} controls className="w-full h-full object-contain" autoPlay />
              ) : (
                <div className="text-center p-8">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">Generando video...</p>
                      <p className="text-sm text-text-secondary mt-1">Creando escenas y transiciones</p>
                    </>
                  ) : (
                    <>
                      <Video className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">El video generado aparecera aqui</p>
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
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MI INFLUENCER COMPONENT
// ============================================
function MiInfluencerTool({ onBack }: { onBack: () => void }) {
  const [characterName, setCharacterName] = useState('')
  const [gender, setGender] = useState<'mujer' | 'hombre'>('mujer')
  const [ageRange, setAgeRange] = useState<'18-25' | '25-35' | '35-45'>('25-35')
  const [skinTone, setSkinTone] = useState<'clara' | 'media' | 'morena' | 'oscura'>('media')
  const [hairStyle, setHairStyle] = useState<'corto' | 'largo' | 'ondulado' | 'rizado'>('largo')
  const [style, setStyle] = useState<'casual' | 'elegante' | 'fitness' | 'profesional'>('casual')
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [savedCharacters] = useState<{name: string; thumbnail: string}[]>([])

  const tool = DROPSHIPPING_TOOLS.find(t => t.id === 'mi-influencer')!

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setReferenceImage(file)
  }

  const handleGenerate = async () => {
    if (!characterName.trim()) return
    setIsGenerating(true)
    // TODO: Implement API call
    setTimeout(() => {
      setIsGenerating(false)
      // Placeholder: would set generatedImages here
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
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Character Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Nombre del personaje *
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Ej: Sofia, Carlos, Maria..."
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Genero</label>
              <div className="flex gap-2">
                {[
                  { id: 'mujer', label: 'Mujer' },
                  { id: 'hombre', label: 'Hombre' },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id as typeof gender)}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      gender === g.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Rango de edad</label>
              <div className="flex gap-2">
                {[
                  { id: '18-25', label: '18-25' },
                  { id: '25-35', label: '25-35' },
                  { id: '35-45', label: '35-45' },
                ].map((age) => (
                  <button
                    key={age.id}
                    onClick={() => setAgeRange(age.id as typeof ageRange)}
                    className={cn(
                      'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      ageRange === age.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {age.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Skin Tone */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Tono de piel</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'clara', label: 'Clara' },
                  { id: 'media', label: 'Media' },
                  { id: 'morena', label: 'Morena' },
                  { id: 'oscura', label: 'Oscura' },
                ].map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => setSkinTone(tone.id as typeof skinTone)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      skinTone === tone.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hair Style */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Estilo de cabello</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'corto', label: 'Corto' },
                  { id: 'largo', label: 'Largo' },
                  { id: 'ondulado', label: 'Ondulado' },
                  { id: 'rizado', label: 'Rizado' },
                ].map((hair) => (
                  <button
                    key={hair.id}
                    onClick={() => setHairStyle(hair.id as typeof hairStyle)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      hairStyle === hair.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {hair.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Estilo personal</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'casual', label: 'Casual', desc: 'Ropa comoda, natural' },
                  { id: 'elegante', label: 'Elegante', desc: 'Sofisticado, formal' },
                  { id: 'fitness', label: 'Fitness', desc: 'Deportivo, atletico' },
                  { id: 'profesional', label: 'Profesional', desc: 'Ejecutivo, serio' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id as typeof style)}
                    className={cn(
                      'p-3 rounded-lg text-left transition-colors',
                      style === s.id ? 'bg-accent text-background' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    <span className="text-sm font-medium block">{s.label}</span>
                    <span className={cn('text-xs', style === s.id ? 'text-background/70' : 'text-text-secondary/70')}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Image */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Imagen de referencia (opcional)
              </label>
              {referenceImage ? (
                <div className="relative h-24 bg-surface-elevated rounded-xl overflow-hidden">
                  <img src={URL.createObjectURL(referenceImage)} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setReferenceImage(null)}
                    className="absolute top-2 right-2 w-6 h-6 bg-error/80 hover:bg-error rounded-full flex items-center justify-center"
                  >
                    <span className="text-white text-xs">X</span>
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center h-20 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />
                  <span className="text-sm text-text-secondary">Subir imagen de referencia</span>
                </label>
              )}
            </div>

            {/* Saved Characters */}
            {savedCharacters.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Personajes guardados
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {savedCharacters.map((char, i) => (
                    <button
                      key={i}
                      className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-border hover:border-accent transition-colors"
                    >
                      <img src={char.thumbnail} alt={char.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="w-1/2 flex flex-col">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Imagenes generadas
            </label>
            <div className="flex-1 bg-surface-elevated rounded-xl overflow-hidden flex items-center justify-center">
              {generatedImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 p-4 w-full h-full">
                  {generatedImages.map((img, i) => (
                    <img key={i} src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="text-center p-8">
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-12 h-12 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-text-primary font-medium">Creando personaje...</p>
                      <p className="text-sm text-text-secondary mt-1">Generando variaciones</p>
                    </>
                  ) : (
                    <>
                      <UserCircle className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                      <p className="text-text-secondary">Las imagenes del personaje apareceran aqui</p>
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
            disabled={generatedImages.length === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              generatedImages.length === 0 ? 'text-text-secondary cursor-not-allowed' : 'text-accent hover:bg-accent/10'
            )}
          >
            Guardar personaje
          </button>
          <button
            onClick={handleGenerate}
            disabled={!characterName.trim() || isGenerating}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
              !characterName.trim() || isGenerating
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Crear Personaje
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PLACEHOLDER TOOL COMPONENT
// ============================================
function PlaceholderTool({ toolId, onBack }: { toolId: string; onBack: () => void }) {
  const tool = DROPSHIPPING_TOOLS.find(t => t.id === toolId)!

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
              <h2 className="text-lg font-semibold text-text-primary">{tool.name}</h2>
              <p className="text-sm text-text-secondary">{tool.description}</p>
            </div>
          </div>
        </div>

        {/* Content - Placeholder */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="text-center">
            <span className="text-6xl mb-4 block">{tool.emoji}</span>
            <h3 className="text-xl font-semibold text-text-primary mb-2">{tool.name}</h3>
            <p className="text-text-secondary max-w-md">
              Esta herramienta esta en desarrollo. Pronto podras {tool.description.toLowerCase()}.
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
export function DropshippingGrid() {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)

  const handleBack = () => setActiveTool(null)

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
    return <MiInfluencerTool onBack={handleBack} />
  }

  if (activeTool) {
    return <PlaceholderTool toolId={activeTool} onBack={handleBack} />
  }

  // Grid view
  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Herramientas Dropshipping</h2>
        <p className="text-text-secondary">
          Herramientas de IA especializadas para crear contenido de ventas
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
                Pronto
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
              {tool.name}
            </h3>
            <p className="text-sm text-text-secondary">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
