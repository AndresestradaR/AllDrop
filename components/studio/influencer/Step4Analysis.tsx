'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, ChevronDown, ChevronRight, Copy, Check, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'

interface Step4AnalysisProps {
  influencerId: string
  realisticImageUrl: string
  anglesGridUrl: string
  bodyGridUrl: string
  onComplete: (visualDna: string, promptDescriptor: string) => void
  onBack: () => void
}

export function Step4Analysis({
  influencerId,
  realisticImageUrl,
  anglesGridUrl,
  bodyGridUrl,
  onComplete,
  onBack,
}: Step4AnalysisProps) {
  const { t } = useI18n()
  const s = t.studio.influencer.step4analysis

  const LOADING_MESSAGES = [
    s.analyzingFace,
    s.analyzingSkin,
    s.analyzingHair,
    s.generatingDna,
  ]

  const SECTION_LABELS: Record<string, string> = {
    face: s.sectionFace,
    hair: s.sectionHair,
    expression_and_body_language: s.sectionExpression,
    clothing: s.sectionClothing,
    accessories: s.sectionAccessories,
    immediate_visual_context: s.sectionContext,
  }

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [visualDna, setVisualDna] = useState<string | null>(null)
  const [promptDescriptor, setPromptDescriptor] = useState<string>('')
  const [characterProfile, setCharacterProfile] = useState<Record<string, string>>({})
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['face', 'hair']))
  const [isEditing, setIsEditing] = useState(false)
  const [editableDescriptor, setEditableDescriptor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Rotate loading messages
  useEffect(() => {
    if (!isAnalyzing) return
    const interval = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isAnalyzing])

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    setLoadingMsgIdx(0)

    try {
      const res = await fetch('/api/studio/influencer/visual-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          realisticImageUrl,
          anglesGridUrl,
          bodyGridUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al analizar')
      }

      setVisualDna(data.visual_dna)
      setPromptDescriptor(data.prompt_descriptor || '')
      setEditableDescriptor(data.prompt_descriptor || '')
      setCharacterProfile(data.character_profile || {})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(s.copiedToClipboard)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error(s.copyError)
    }
  }

  const handleSave = () => {
    const finalDescriptor = isEditing ? editableDescriptor : promptDescriptor
    onComplete(visualDna || '', finalDescriptor)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-sm text-text-secondary mb-5">
        {s.description}
      </p>

      {/* Reference thumbnails */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-xl border border-border flex-1">
          <img src={realisticImageUrl} alt="Realistic" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          <p className="text-xs text-text-secondary">{s.realisticPhoto}</p>
        </div>
        <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-xl border border-border flex-1">
          <img src={anglesGridUrl} alt="Angles" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
          <p className="text-xs text-text-secondary">{s.anglesGrid}</p>
        </div>
        {bodyGridUrl && (
          <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-xl border border-border flex-1">
            <img src={bodyGridUrl} alt="Body" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
            <p className="text-xs text-text-secondary">{s.bodyGrid}</p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-16 bg-surface-elevated rounded-xl border border-border mb-4">
          <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
          <p className="text-sm text-text-primary font-medium">{LOADING_MESSAGES[loadingMsgIdx]}</p>
          <p className="text-xs text-text-muted mt-2">{s.analyzingWith}</p>
        </div>
      )}

      {/* Results */}
      {visualDna && !isAnalyzing && (
        <div className="space-y-3 mb-5">
          {/* PROMPT DESCRIPTOR — highlighted */}
          <div className="p-4 bg-accent/5 border border-accent/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-accent uppercase tracking-wide">Prompt Descriptor</h4>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (isEditing) {
                      setPromptDescriptor(editableDescriptor)
                      setIsEditing(false)
                    } else {
                      setIsEditing(true)
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
                  title={isEditing ? s.saveEdit : s.editLabel}
                >
                  {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleCopy(isEditing ? editableDescriptor : promptDescriptor, 'descriptor')}
                  className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
                  title={s.copy}
                >
                  {copiedField === 'descriptor' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {isEditing ? (
              <textarea
                value={editableDescriptor}
                onChange={(e) => setEditableDescriptor(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 bg-background border border-accent/20 rounded-lg text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            ) : (
              <p className="text-sm text-text-primary leading-relaxed">{promptDescriptor}</p>
            )}
          </div>

          {/* Collapsible sections */}
          {Object.entries(characterProfile).map(([key, value]) => {
            if (!value || !SECTION_LABELS[key]) return null
            const isExpanded = expandedSections.has(key)
            return (
              <div key={key} className="bg-surface-elevated rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-border/30 transition-colors"
                >
                  <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                    {SECTION_LABELS[key]}
                  </h4>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border/50">
                    <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed pt-2">{value}</p>
                  </div>
                )}
              </div>
            )
          })}

          {/* Copy full analysis */}
          <button
            onClick={() => handleCopy(visualDna || '', 'full')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-elevated border border-border text-text-secondary hover:text-text-primary transition-all"
          >
            {copiedField === 'full' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {s.copyFullAnalysis}
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-error/10 border border-error/20 rounded-xl mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      {visualDna && !isAnalyzing ? (
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 transition-all"
        >
          <Check className="w-5 h-5" />
          {s.saveAndContinue}
        </button>
      ) : !isAnalyzing ? (
        <button
          onClick={handleAnalyze}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          {s.analyzeInDepth}
        </button>
      ) : null}
    </div>
  )
}
