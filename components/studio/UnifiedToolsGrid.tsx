'use client'

import { useState } from 'react'
import { ToolsGrid } from './ToolsGrid'
import { DropshippingGrid } from './DropshippingGrid'
import { cn } from '@/lib/utils/cn'
import { useI18n } from '@/lib/i18n'
import {
  Calculator,
  BookOpen,
  UserCircle,
  Maximize2,
  Eraser,
  Smartphone,
  Mic2,
  Film,
} from 'lucide-react'

type ToolSource = 'tools' | 'dropshipping'

interface ToolDef {
  id: string
  nameKey: string
  descKey: string
  icon: React.ElementType
  color: string
  source: ToolSource
  outputsVideo?: boolean
}

const UNIFIED_TOOLS: ToolDef[] = [
  { id: 'costeo-calculator', nameKey: 'costeoCalculator', descKey: 'costeoCalculator', icon: Calculator, color: 'from-amber-500 to-yellow-500', source: 'dropshipping' },
  { id: 'ebook-generator', nameKey: 'ebookGenerator', descKey: 'ebookGenerator', icon: BookOpen, color: 'from-teal-500 to-cyan-500', source: 'dropshipping' },
  { id: 'mi-influencer', nameKey: 'miInfluencer', descKey: 'miInfluencer', icon: UserCircle, color: 'from-green-500 to-emerald-500', source: 'dropshipping' },
  { id: 'upscale', nameKey: 'upscale', descKey: 'upscale', icon: Maximize2, color: 'from-green-500 to-emerald-500', source: 'tools' },
  { id: 'remove-bg', nameKey: 'removeBg', descKey: 'removeBg', icon: Eraser, color: 'from-purple-500 to-pink-500', source: 'tools' },
  { id: 'mockup', nameKey: 'mockup', descKey: 'mockup', icon: Smartphone, color: 'from-indigo-500 to-violet-500', source: 'tools' },
  { id: 'lip-sync', nameKey: 'lipSync', descKey: 'lipSync', icon: Mic2, color: 'from-rose-500 to-pink-500', source: 'tools', outputsVideo: true },
  { id: 'video-editor', nameKey: 'videoEditor', descKey: 'videoEditor', icon: Film, color: 'from-pink-500 to-rose-500', source: 'tools', outputsVideo: true },
]

export function UnifiedToolsGrid() {
  const [activeTool, setActiveTool] = useState<{ id: string; source: ToolSource } | null>(null)
  const { t } = useI18n()

  if (activeTool?.source === 'tools') {
    return (
      <ToolsGrid
        initialTool={activeTool.id}
        onBack={() => setActiveTool(null)}
      />
    )
  }

  if (activeTool?.source === 'dropshipping') {
    return (
      <DropshippingGrid
        initialTool={activeTool.id}
        onBack={() => setActiveTool(null)}
      />
    )
  }

  const tn = t.studio.toolNames as Record<string, string>
  const td = t.studio.toolDescs as Record<string, string>

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary mb-2">{t.studio.toolsHeading}</h2>
        <p className="text-text-secondary">
          {t.studio.toolsSubheading}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {UNIFIED_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool({ id: tool.id, source: tool.source })}
            className="relative p-6 bg-surface rounded-2xl border border-border text-left transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-1"
          >
            {tool.outputsVideo && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded">
                Video
              </span>
            )}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4',
                tool.color
              )}
            >
              <tool.icon className="w-6 h-6 text-white" />
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
