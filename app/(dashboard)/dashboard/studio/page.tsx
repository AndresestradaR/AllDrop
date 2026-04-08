'use client'

import { useState } from 'react'
import { StudioTabs, type StudioTab } from '@/components/studio/StudioTabs'
import { ImageGenerator } from '@/components/studio/ImageGenerator'
import { VideoGenerator } from '@/components/studio/VideoGenerator'
import { UnifiedToolsGrid } from '@/components/studio/UnifiedToolsGrid'
import { useI18n } from '@/lib/i18n'
import { Wand2 } from 'lucide-react'

export default function StudioPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<StudioTab>('imagen')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{t.studio.title}</h1>
            <p className="text-sm text-text-secondary">
              {t.studio.subtitle}
            </p>
          </div>
        </div>
        <StudioTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Content */}
      <div>
        {activeTab === 'imagen' && <ImageGenerator />}
        {activeTab === 'video' && <VideoGenerator />}
        {activeTab === 'herramientas' && <UnifiedToolsGrid />}
      </div>
    </div>
  )
}
