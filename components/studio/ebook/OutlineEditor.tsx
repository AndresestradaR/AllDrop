'use client'

import { useState } from 'react'
import { GripVertical, Edit3, Check, X, BookOpen } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { EbookOutline, EbookChapter } from '@/lib/ebook/types'

interface OutlineEditorProps {
  outline: EbookOutline
  onConfirm: (outline: EbookOutline) => void
  onBack: () => void
}

export default function OutlineEditor({ outline, onConfirm, onBack }: OutlineEditorProps) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [chapters, setChapters] = useState<EbookChapter[]>(outline.chapters)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx)
    setEditTitle(chapters[idx].title)
  }

  const handleEditSave = () => {
    if (editingIdx === null || !editTitle.trim()) return
    setChapters((prev) =>
      prev.map((ch, i) => (i === editingIdx ? { ...ch, title: editTitle.trim() } : ch))
    )
    setEditingIdx(null)
  }

  const handleRemove = (idx: number) => {
    if (chapters.length <= 3) return // min 3 chapters
    setChapters((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((ch, i) => ({ ...ch, number: i + 1 }))
    )
  }

  const handleConfirm = () => {
    onConfirm({ ...outline, chapters })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{te.ebookStructure}</h3>
        <p className="text-sm text-zinc-400">
          {te.editChaptersDesc}
        </p>
      </div>

      {/* Ebook title preview */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
        <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider mb-1">Ebook</p>
        <h4 className="text-xl font-bold text-white">{outline.title}</h4>
        {outline.subtitle && (
          <p className="text-sm text-zinc-400 mt-1">{outline.subtitle}</p>
        )}
      </div>

      {/* Chapters list */}
      <div className="space-y-2">
        {chapters.map((ch, idx) => (
          <div
            key={ch.number}
            className="flex items-center gap-3 p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-lg group hover:border-zinc-600 transition-colors"
          >
            {/* Number */}
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-emerald-400">{idx + 1}</span>
            </div>

            {/* Title */}
            {editingIdx === idx ? (
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                  className="flex-1 px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-sm outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  onClick={handleEditSave}
                  className="p-1.5 bg-emerald-600 rounded text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingIdx(null)}
                  className="p-1.5 bg-zinc-600 rounded text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{ch.title}</p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{ch.summary}</p>
              </div>
            )}

            {/* Actions */}
            {editingIdx !== idx && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEditStart(idx)}
                  className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
                  title={te.editTitle}
                >
                  <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                </button>
                {chapters.length > 3 && (
                  <button
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                    title={te.deleteChapter}
                  >
                    <X className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <p className="text-xs text-zinc-500">
        {te.chaptersEstimate.replace('{count}', String(chapters.length)).replace('{pages}', String(Math.max(20, chapters.length * 4 + 6)))}
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white text-sm transition-colors"
        >
          {te.back}
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          {te.generateEbook.replace('{count}', String(chapters.length))}
        </button>
      </div>
    </div>
  )
}
