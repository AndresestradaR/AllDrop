'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Sparkles, Zap, Image as ImageIcon, Cpu, Star, Lock, Flame, Clock, Crown, Type, FileText } from 'lucide-react'
import {
  ImageModelId,
  ImageProviderCompany,
  IMAGE_MODELS,
  IMAGE_COMPANY_GROUPS,
  LANDING_COMPANY_GROUPS,
  LANDING_MODELS,
  STUDIO_COMPANY_GROUPS,
  ModelTag,
} from '@/lib/image-providers/types'

interface ApiKeyStatus {
  google: boolean
  openai: boolean
  bytedance: boolean
  bfl: boolean
  fal: boolean
}

interface ModelSelectorProps {
  value: ImageModelId
  onChange: (modelId: ImageModelId) => void
  disabled?: boolean
  availableProviders?: ImageProviderCompany[]
  apiKeyStatus?: ApiKeyStatus
  // Which context: 'landing' shows only models good for landings, 'studio' shows all
  context?: 'landing' | 'studio'
}

const COMPANY_ICONS: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Image: <ImageIcon className="w-4 h-4" />,
  Cpu: <Cpu className="w-4 h-4" />,
}

const TAG_CONFIG: Record<ModelTag, { label: string; color: string; icon: React.ReactNode }> = {
  NEW: { label: 'NEW', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Sparkles className="w-2.5 h-2.5" /> },
  TRENDING: { label: 'TRENDING', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: <Flame className="w-2.5 h-2.5" /> },
  FAST: { label: 'FAST', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Clock className="w-2.5 h-2.5" /> },
  PREMIUM: { label: 'PREMIUM', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Crown className="w-2.5 h-2.5" /> },
  BEST_TEXT: { label: 'BEST TEXT', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: <Type className="w-2.5 h-2.5" /> },
  HD: { label: 'HD', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', icon: <Sparkles className="w-2.5 h-2.5" /> },
  '4K': { label: '4K', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Crown className="w-2.5 h-2.5" /> },
  RECOMENDADO: { label: 'RECOMENDADO', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', icon: <Star className="w-2.5 h-2.5 fill-yellow-500" /> },
  TEXT_ONLY: { label: 'SOLO TEXTO', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <FileText className="w-2.5 h-2.5" /> },
}

export default function ModelSelector({
  value,
  onChange,
  disabled,
  availableProviders,
  apiKeyStatus,
  context = 'landing', // Default to landing (filtered models)
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedModel = IMAGE_MODELS[value]

  // Use appropriate groups based on context
  const baseGroups = context === 'studio' ? STUDIO_COMPANY_GROUPS : LANDING_COMPANY_GROUPS

  // Filter companies based on available providers
  const filteredGroups = availableProviders
    ? baseGroups.filter((g) => availableProviders.includes(g.id))
    : baseGroups

  const handleModelSelect = (modelId: ImageModelId) => {
    const model = IMAGE_MODELS[modelId]
    // Check if API key is configured for this provider
    if (apiKeyStatus && !apiKeyStatus[model.company]) {
      return // Don't select if no API key
    }
    onChange(modelId)
    setIsOpen(false)
  }

  const hasApiKey = (company: ImageProviderCompany): boolean => {
    if (!apiKeyStatus) return true // Assume available if not checking
    return apiKeyStatus[company]
  }

  return (
    <div className="relative">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
        <Sparkles className="w-4 h-4 text-accent" />
        Modelo de IA
      </label>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 bg-background border border-border rounded-xl
          text-left flex items-center justify-between
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent/50 cursor-pointer'}
          ${isOpen ? 'ring-2 ring-accent/50 border-accent' : ''}
        `}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg bg-gradient-to-br ${
              IMAGE_COMPANY_GROUPS.find((g) => g.id === selectedModel.company)?.color
            } text-white`}
          >
            {COMPANY_ICONS[IMAGE_COMPANY_GROUPS.find((g) => g.id === selectedModel.company)?.icon || 'Sparkles']}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-text-primary font-medium">{selectedModel.name}</p>
              {selectedModel.recommended && (
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              )}
              {context === 'studio' && selectedModel.tags?.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border ${TAG_CONFIG[tag].color}`}
                >
                  {TAG_CONFIG[tag].icon}
                  {TAG_CONFIG[tag].label}
                </span>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              {selectedModel.pricePerImage}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-xl shadow-xl overflow-hidden max-h-[500px] overflow-y-auto">
            {context === 'landing' ? (
              /* Landing: flat list, no company headers */
              <div className="bg-surface py-1">
                {LANDING_MODELS.map((model) => {
                  const isSelected = value === model.id
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleModelSelect(model.id)}
                      className={`
                        w-full px-4 py-3 flex items-center gap-3 transition-colors
                        ${isSelected ? 'bg-accent/10' : 'hover:bg-background/50'}
                      `}
                    >
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-text-primary">{model.name}</p>
                          {model.recommended && (
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">{model.description}</p>
                      </div>
                      <span className="text-xs text-text-secondary whitespace-nowrap">{model.pricePerImage}</span>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Studio: grouped by company with headers */
              filteredGroups.map((group) => {
                const companyHasKey = hasApiKey(group.id)

                return (
                  <div key={group.id} className="border-b border-border/50 last:border-b-0">
                    {/* Company Header */}
                    <div className="px-4 py-2.5 bg-background/50 flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg bg-gradient-to-br ${group.color} text-white`}>
                        {COMPANY_ICONS[group.icon]}
                      </div>
                      <div className="flex-1">
                        <p className="text-text-primary font-semibold text-sm">{group.name}</p>
                      </div>
                      {!companyHasKey && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-medium rounded-full border border-amber-500/20">
                          <Lock className="w-3 h-3" />
                          API Key requerida
                        </span>
                      )}
                    </div>

                    {/* Models List */}
                    <div className="bg-surface">
                      {group.models.map((model) => {
                        const isSelected = value === model.id
                        const isDisabled = !companyHasKey

                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => !isDisabled && handleModelSelect(model.id)}
                            disabled={isDisabled}
                            className={`
                              w-full px-4 py-2.5 pl-12 flex items-center gap-3 transition-colors
                              ${isSelected ? 'bg-accent/10' : isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-background/50'}
                            `}
                          >
                            <div className="text-left flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-medium text-sm ${isDisabled ? 'text-text-secondary' : 'text-text-primary'}`}>
                                  {model.name}
                                </p>
                                {model.recommended && (
                                  <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 text-[9px] font-bold rounded border border-yellow-500/30">
                                    RECOMENDADO
                                  </span>
                                )}
                                {model.tags?.map((tag) => (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded border ${TAG_CONFIG[tag].color}`}
                                  >
                                    {TAG_CONFIG[tag].icon}
                                    {TAG_CONFIG[tag].label}
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs text-text-secondary">{model.description}</p>
                            </div>
                            <span className="text-xs text-text-secondary whitespace-nowrap">{model.pricePerImage}</span>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Model features */}
      <div className="flex flex-wrap gap-2 mt-2">
        {selectedModel.supportsImageInput && (
          <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
            Soporta imágenes
          </span>
        )}
        {selectedModel.supportsAspectRatio && (
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs rounded-full">
            Aspect ratio
          </span>
        )}
        {selectedModel.requiresPolling && (
          <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-xs rounded-full">
            Async
          </span>
        )}
      </div>
    </div>
  )
}

// Compact grid version
export function ModelSelectorGrid({
  value,
  onChange,
  disabled,
  availableProviders,
  apiKeyStatus,
  context = 'landing', // Default to landing
}: ModelSelectorProps) {
  // Use appropriate groups based on context
  const baseGroups = context === 'studio' ? STUDIO_COMPANY_GROUPS : LANDING_COMPANY_GROUPS

  const filteredGroups = availableProviders
    ? baseGroups.filter((g) => availableProviders.includes(g.id))
    : baseGroups

  const hasApiKey = (company: ImageProviderCompany): boolean => {
    if (!apiKeyStatus) return true
    return apiKeyStatus[company]
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Sparkles className="w-4 h-4 text-accent" />
        Modelo de IA
      </label>

      {filteredGroups.map((group) => {
        const companyHasKey = hasApiKey(group.id)

        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${group.color} text-white`}>
                {COMPANY_ICONS[group.icon]}
              </div>
              <span className="text-sm font-medium text-text-primary">{group.name}</span>
              {!companyHasKey && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-medium rounded-full">
                  <Lock className="w-3 h-3" />
                  API Key requerida
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
              {group.models.map((model) => {
                const isDisabled = disabled || !companyHasKey

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => !isDisabled && onChange(model.id)}
                    disabled={isDisabled}
                    className={`
                      p-3 rounded-xl border transition-all text-left
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      ${
                        value === model.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-accent/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-primary">{model.name}</span>
                      {model.recommended && (
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      )}
                      {model.tags?.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[8px] font-bold rounded ${TAG_CONFIG[tag].color}`}
                        >
                          {TAG_CONFIG[tag].label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{model.description}</p>
                    <p className="text-xs text-accent mt-1">{model.pricePerImage}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
