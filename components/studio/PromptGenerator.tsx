'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  ArrowLeft,
  Video,
  Lightbulb,
  ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'

interface PromptResult {
  prompt: string
  tips: string[]
  model_specific_notes: string
  negative_prompt?: string
}

const VIDEO_MODELS = [
  { id: 'kling', label: 'Kling 2.6 / 3.0' },
  { id: 'veo', label: 'Veo 3.1' },
  { id: 'sora', label: 'Sora 2' },
  { id: 'wan', label: 'Wan 2.6' },
  { id: 'luma', label: 'Luma Dream Machine' },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'hunyuan', label: 'Hunyuan' },
]

// Style keys mapped to translation keys
const STYLE_IDS = ['ugc_tiktok', 'professional', 'product_showcase', 'testimonial', 'asmr', 'cinematic'] as const

export function PromptGenerator({ onBack, onUseInVideo }: {
  onBack: () => void
  onUseInVideo?: (prompt: string) => void
}) {
  const { t } = useI18n()

  const STYLES = [
    { id: 'ugc_tiktok', label: t.studio.promptGen.styleUgc, desc: t.studio.promptGen.styleUgcDesc },
    { id: 'professional', label: t.studio.promptGen.styleProfessional, desc: t.studio.promptGen.styleProfessionalDesc },
    { id: 'product_showcase', label: t.studio.promptGen.styleProduct, desc: t.studio.promptGen.styleProductDesc },
    { id: 'testimonial', label: t.studio.promptGen.styleTestimonial, desc: t.studio.promptGen.styleTestimonialDesc },
    { id: 'asmr', label: t.studio.promptGen.styleAsmr, desc: t.studio.promptGen.styleAsmrDesc },
    { id: 'cinematic', label: t.studio.promptGen.styleCinematic, desc: t.studio.promptGen.styleCinematicDesc },
  ]
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('kling')
  const [style, setStyle] = useState('cinematic')
  const [duration, setDuration] = useState(5)
  const [withAudio, setWithAudio] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<PromptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!description.trim()) return

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/studio/prompt-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          model,
          style,
          duration,
          with_audio: withAudio,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar prompt')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    toast.success(t.studio.promptGen.copied)
    setTimeout(() => setCopiedField(null), 2000)
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-500">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t.studio.promptGen.title}</h2>
              <p className="text-sm text-text-secondary">{t.studio.promptGen.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-[380px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t.studio.promptGen.describeVideo}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.studio.promptGen.describeVideoPh}
                rows={4}
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all text-sm"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t.studio.promptGen.videoModel}</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t.studio.promptGen.style}</label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      'p-2.5 rounded-xl border text-left transition-all',
                      style === s.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface-elevated hover:border-accent/50'
                    )}
                  >
                    <span className={cn('text-xs font-medium block', style === s.id ? 'text-accent' : 'text-text-primary')}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-text-muted">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration + Audio */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{t.studio.promptGen.duration}</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                >
                  <option value={3}>{t.studio.promptGen.sec3}</option>
                  <option value={5}>{t.studio.promptGen.sec5}</option>
                  <option value={8}>{t.studio.promptGen.sec8}</option>
                  <option value={10}>{t.studio.promptGen.sec10}</option>
                  <option value={15}>{t.studio.promptGen.sec15}</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{t.studio.promptGen.audioLabel}</label>
                <button
                  onClick={() => setWithAudio(!withAudio)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    withAudio
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-elevated text-text-secondary hover:border-accent/50'
                  )}
                >
                  {withAudio ? t.studio.promptGen.withAudio : t.studio.promptGen.withoutAudio}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                isGenerating || !description.trim()
                  ? 'bg-border text-text-secondary cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.studio.promptGen.generatingPrompt}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {t.studio.promptGen.generateBtn}
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!result ? (
              <div className="flex-1 flex items-center justify-center bg-surface-elevated rounded-xl">
                <div className="text-center p-8">
                  <Video className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                  <p className="text-text-secondary">{t.studio.promptGen.placeholder}</p>
                  <p className="text-xs text-text-muted mt-1">{t.studio.promptGen.placeholderDesc}</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Main Prompt */}
                <div className="p-5 bg-surface-elevated rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Prompt (English)</span>
                    <div className="flex items-center gap-2">
                      {onUseInVideo && (
                        <button
                          onClick={() => onUseInVideo(result.prompt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 text-xs font-medium transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          {t.studio.promptGen.useInVideo}
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(result.prompt, 'prompt')}
                        className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        {copiedField === 'prompt' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{result.prompt}</p>
                </div>

                {/* Negative Prompt */}
                {result.negative_prompt && (
                  <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Negative Prompt</span>
                      <button
                        onClick={() => copyToClipboard(result.negative_prompt!, 'negative')}
                        className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        {copiedField === 'negative' ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-text-muted" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-text-secondary">{result.negative_prompt}</p>
                  </div>
                )}

                {/* Tips */}
                {result.tips && result.tips.length > 0 && (
                  <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Tips</span>
                    </div>
                    <ul className="space-y-2">
                      {result.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                          <span className="text-accent mt-0.5 font-bold">{i + 1}.</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Model Notes */}
                {result.model_specific_notes && (
                  <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-2">{t.studio.promptGen.modelNotes}</span>
                    <p className="text-sm text-text-secondary">{result.model_specific_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
