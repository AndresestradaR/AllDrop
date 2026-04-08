'use client'

import { cn } from '@/lib/utils/cn'
import { ImageIcon, Video, AudioLines, Wrench } from 'lucide-react'

export type StudioTab = 'imagen' | 'video' | 'audio' | 'herramientas'

interface StudioTabsProps {
  activeTab: StudioTab
  onTabChange: (tab: StudioTab) => void
}

const tabs: { id: StudioTab; label: string; icon: React.ElementType }[] = [
  { id: 'imagen', label: 'Imagen', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'herramientas', label: 'Herramientas', icon: Wrench },
]

export function StudioTabs({ activeTab, onTabChange }: StudioTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-accent text-background shadow-lg shadow-accent/25'
                : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
            )}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
