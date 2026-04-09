'use client'

import { useState, useRef } from 'react'
import { Check, Upload, X, Palette } from 'lucide-react'
import { TEMPLATE_LIST } from '@/lib/ebook/templates'
import { useI18n } from '@/lib/i18n'
import type { EbookTemplate, EbookCategory } from '@/lib/ebook/types'

interface TemplateSelectorProps {
  suggestedTemplate: EbookCategory
  onSelect: (template: EbookTemplate, logoUrl?: string) => void
}

export default function TemplateSelector({ suggestedTemplate, onSelect }: TemplateSelectorProps) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [selected, setSelected] = useState<EbookCategory>(suggestedTemplate)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleContinue = () => {
    const template = TEMPLATE_LIST.find((t) => t.id === selected)!
    onSelect(template, logoPreview || undefined)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{te.chooseStyle}</h3>
        <p className="text-sm text-zinc-400">
          {te.chooseStyleDesc}
        </p>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TEMPLATE_LIST.map((t) => {
          const isSelected = selected === t.id
          const isSuggested = suggestedTemplate === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
              }`}
            >
              {isSuggested && (
                <span className="absolute -top-2 left-3 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                  {te.suggested}
                </span>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Color preview */}
              <div className="flex gap-1.5 mb-3">
                <div
                  className="w-8 h-8 rounded-md"
                  style={{ backgroundColor: t.colors.primary }}
                />
                <div
                  className="w-8 h-8 rounded-md"
                  style={{ backgroundColor: t.colors.secondary }}
                />
                <div
                  className="w-8 h-8 rounded-md"
                  style={{ backgroundColor: t.colors.accent }}
                />
              </div>

              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{t.description}</p>
            </button>
          )
        })}
      </div>

      {/* Logo upload */}
      <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{te.yourLogo}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{te.logoHint}</p>
          </div>
          {logoPreview ? (
            <div className="flex items-center gap-3">
              <img src={logoPreview} alt="Logo" className="w-10 h-10 object-contain rounded" />
              <button
                onClick={() => {
                  setLogoPreview(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="p-1 hover:bg-zinc-700 rounded transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-white flex items-center gap-2 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {te.upload}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />
      </div>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors"
      >
        <Palette className="w-4 h-4" />
        {te.continueTemplate}
      </button>
    </div>
  )
}
