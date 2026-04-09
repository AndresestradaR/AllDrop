'use client'

import { useState } from 'react'
import { Sparkles, Edit3, Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { EbookIdea, EbookCategory } from '@/lib/ebook/types'

interface IdeaSelectorProps {
  ideas: EbookIdea[]
  analysis: string
  onSelect: (idea: EbookIdea) => void
}

export default function IdeaSelector({ ideas, analysis, onSelect }: IdeaSelectorProps) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [customMode, setCustomMode] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customDescription, setCustomDescription] = useState('')

  const handleCustom = () => {
    if (!customTitle.trim()) return
    onSelect({
      id: 'custom',
      title: customTitle.trim(),
      subtitle: '',
      description: customDescription.trim() || customTitle.trim(),
      category: 'universal' as EbookCategory,
      targetAudience: '',
    })
  }

  const categoryColors: Record<string, string> = {
    'salud-bienestar': 'bg-emerald-500/20 text-emerald-400',
    'belleza-cuidado': 'bg-pink-500/20 text-pink-400',
    'tecnologia': 'bg-blue-500/20 text-blue-400',
    'hogar-cocina': 'bg-amber-500/20 text-amber-400',
    'moda-estilo': 'bg-purple-500/20 text-purple-400',
    'universal': 'bg-indigo-500/20 text-indigo-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{te.chooseIdea}</h3>
        <p className="text-sm text-zinc-400">{te.aiSuggested}</p>
      </div>

      {/* Analysis summary */}
      {analysis && (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
          <p className="text-sm text-zinc-300 leading-relaxed">{analysis}</p>
        </div>
      )}

      {/* Idea cards */}
      <div className="grid gap-3">
        {ideas.map((idea) => (
          <button
            key={idea.id}
            onClick={() => onSelect(idea)}
            className="group text-left p-4 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-emerald-500/50 rounded-xl transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[idea.category] || categoryColors.universal}`}>
                    {idea.category}
                  </span>
                </div>
                <h4 className="text-white font-semibold text-base mb-1 group-hover:text-emerald-400 transition-colors">
                  {idea.title}
                </h4>
                {idea.subtitle && (
                  <p className="text-sm text-zinc-400 mb-2">{idea.subtitle}</p>
                )}
                <p className="text-sm text-zinc-300 leading-relaxed">{idea.description}</p>
                {idea.targetAudience && (
                  <p className="text-xs text-zinc-500 mt-2">{te.audience}: {idea.targetAudience}</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600/40 transition-colors">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom idea */}
      <div className="border-t border-zinc-700 pt-4">
        {!customMode ? (
          <button
            onClick={() => setCustomMode(true)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {te.ownIdea}
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={te.ebookTitlePh}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
            />
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={te.ebookDescPh}
              rows={2}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCustom}
                disabled={!customTitle.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                {te.useIdea}
              </button>
              <button
                onClick={() => setCustomMode(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white text-sm transition-colors"
              >
                {te.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
