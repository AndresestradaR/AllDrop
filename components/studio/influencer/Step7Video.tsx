'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

import { Video, Loader2, Sparkles, RefreshCw, Copy, Check, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Step7VideoProps {
  influencerId: string
  influencerName: string
  promptDescriptor: string
  realisticImageUrl: string
  onBack: () => void
}

const VIDEO_MODELS = [
  { id: 'kling-2.1-master', name: 'Kling 2.1 Master', description: 'Alta calidad, lento' },
  { id: 'kling-3.0-standard', name: 'Kling 3.0 Standard', description: 'Rapido, buena calidad' },
  { id: 'kling-3.0-pro', name: 'Kling 3.0 Pro', description: 'Mejor calidad Kling' },
  { id: 'veo-3.0-generate', name: 'Veo 3.0', description: 'Google, con audio' },
  { id: 'veo-3.1-generate', name: 'Veo 3.1', description: 'Ultima version Google' },
  { id: 'sora-2', name: 'Sora 2', description: 'OpenAI' },
]

const PROMPT_OPTIMIZER_SYSTEM = `You are an expert video prompt optimizer for AI video generation models. Your job is to take a character description and a user's video idea, and produce a highly detailed, model-optimized prompt.

MODEL-SPECIFIC GUIDES:

For Kling models (kling-*):
- Focus on camera movement descriptions: "slow dolly in", "tracking shot", "panning left to right"
- Describe actions step by step in temporal order
- Include lighting: "soft golden hour light", "dramatic rim lighting"
- Mention clothing movement: "hair flowing in the wind", "fabric swaying gently"

For Veo models (veo-*):
- Use cinematic language: "establishing shot", "close-up", "medium shot"
- Describe the audio atmosphere: "ambient cafe sounds", "birds chirping", "soft music playing"
- Include emotional tone: "warm and inviting", "mysterious and moody"
- Reference film styles: "documentary style", "Instagram reel aesthetic"

For Sora (sora-*):
- Be very specific about physics and movement
- Describe camera angles precisely: "low angle looking up", "bird's eye view"
- Include environmental details: "dust particles in the light", "steam rising"
- Mention temporal progression: "starting with..., then transitioning to..."

RULES:
- Output ONLY the optimized prompt, nothing else
- Keep it under 500 characters for Kling, 1000 for Veo/Sora
- Always maintain the character's appearance consistency
- Write in English for best results
- Do NOT include any headers, explanations, or formatting — just the prompt text`

export function Step7Video({
  influencerId,
  influencerName,
  promptDescriptor,
  realisticImageUrl,
  onBack,
}: Step7VideoProps) {
  const [videoModelId, setVideoModelId] = useState('kling-3.0-standard')
  const [prompt, setPrompt] = useState('')
  const [userIdea, setUserIdea] = useState('')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [duration, setDuration] = useState(5)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16')

  const handleOptimizePrompt = async () => {
    if (!userIdea.trim()) {
      toast.error('Escribe una idea para el video')
      return
    }

    setIsOptimizing(true)
    setError(null)

    try {
      // Use Gemini to optimize the prompt
      const res = await fetch('/api/studio/influencer/visual-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          optimizeVideoPrompt: true,
          videoModelId,
          userIdea: userIdea.trim(),
          promptDescriptor,
        }),
      })

      const data = await res.json()

      if (data.optimized_prompt) {
        setPrompt(data.optimized_prompt)
        toast.success('Prompt optimizado')
      } else {
        // Fallback: build a basic prompt
        const basic = `A hyperrealistic video of ${promptDescriptor}. ${userIdea.trim()}. Shot on iPhone 14 Pro, cinematic, natural lighting.`
        setPrompt(basic)
        toast.success('Prompt generado')
      }
    } catch (err: any) {
      // Fallback prompt
      const basic = `A hyperrealistic video of ${promptDescriptor}. ${userIdea.trim()}. Shot on iPhone 14 Pro, cinematic, natural lighting.`
      setPrompt(basic)
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Genera o escribe un prompt primero')
      return
    }

    setIsGenerating(true)
    setError(null)
    setVideoUrl(null)

    try {
      // Convert realistic image to base64 for image-to-video
      let imageBase64: string | undefined
      try {
        const imgRes = await fetch(realisticImageUrl)
        if (imgRes.ok) {
          const blob = await imgRes.blob()
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          imageBase64 = dataUrl
        }
      } catch {
        // Continue without image
      }

      const res = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: videoModelId,
          prompt: prompt.trim(),
          duration,
          aspectRatio,
          enableAudio: true,
          imageBase64,
        }),
      })

      const data = await res.json()

      if (!res.ok || (!data.success && !data.taskId)) {
        throw new Error(data.error || 'Error al generar video')
      }

      if (data.videoUrl) {
        setVideoUrl(data.videoUrl)
        toast.success('Video generado')
      } else if (data.taskId) {
        setTaskId(data.taskId)
        toast.success('Video en proceso. Revisa el tab de Video principal para ver el resultado.')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(true)
      toast.success('Prompt copiado')
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch {
      toast.error('Error al copiar')
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
          <p className="text-xs text-text-secondary line-clamp-1">{promptDescriptor?.substring(0, 80)}...</p>
        </div>
      </div>

      {/* Video model selector */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Modelo de Video</label>
        <select
          value={videoModelId}
          onChange={(e) => setVideoModelId(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {VIDEO_MODELS.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.description}
            </option>
          ))}
        </select>
      </div>

      {/* Duration and aspect ratio */}
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

      {/* User idea input */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Tu idea para el video</label>
        <textarea
          value={userIdea}
          onChange={(e) => setUserIdea(e.target.value)}
          placeholder="Ej: El influencer caminando por la playa al atardecer, mirando a camara y sonriendo..."
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
          Optimizar prompt con IA
        </button>
      </div>

      {/* Optimized prompt */}
      {prompt && (
        <div className="mb-4 p-4 bg-accent/5 border border-accent/30 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-accent uppercase tracking-wide">Prompt optimizado</h4>
            <button
              onClick={handleCopyPrompt}
              className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-background border border-accent/20 rounded-lg text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      )}

      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Video result */}
      {videoUrl && (
        <div className="mb-4 rounded-xl overflow-hidden bg-surface-elevated border border-border">
          <video
            src={videoUrl}
            controls
            className="w-full"
            autoPlay
            loop
          />
        </div>
      )}

      {taskId && !videoUrl && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-sm text-amber-400 font-medium">Video en proceso</p>
          <p className="text-xs text-text-secondary mt-1">
            El video se esta generando. Puedes ver el progreso en el tab de Video principal.
          </p>
          <p className="text-[10px] text-text-muted mt-1 font-mono">Task ID: {taskId}</p>
        </div>
      )}

      {/* Generate video button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all',
          isGenerating || !prompt.trim()
            ? 'bg-border text-text-secondary cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generando video...
          </>
        ) : (
          <>
            <Video className="w-5 h-5" />
            Generar Video
          </>
        )}
      </button>
    </div>
  )
}
