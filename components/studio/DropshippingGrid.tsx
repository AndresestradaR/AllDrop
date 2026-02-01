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

export function DropshippingGrid() {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)

  const currentTool = DROPSHIPPING_TOOLS.find((t) => t.id === activeTool)

  // Tool interface view (placeholder for now)
  if (activeTool && currentTool) {
    return (
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
            <button
              onClick={() => setActiveTool(null)}
              className="p-2 hover:bg-border/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br',
                  currentTool.color
                )}
              >
                <span className="text-xl">{currentTool.emoji}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {currentTool.name}
                </h2>
                <p className="text-sm text-text-secondary">{currentTool.description}</p>
              </div>
            </div>
          </div>

          {/* Content - Placeholder */}
          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl mb-4 block">{currentTool.emoji}</span>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                {currentTool.name}
              </h3>
              <p className="text-text-secondary max-w-md">
                Esta herramienta esta en desarrollo. Pronto podras {currentTool.description.toLowerCase()}.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
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
