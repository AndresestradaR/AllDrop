'use client'

import { useState } from 'react'
import { VideoClipSelector } from './VideoClipSelector'
import { VideoEditor } from './VideoEditor'

interface VideoEditorStandaloneProps {
  onBack: () => void
}

export function VideoEditorStandalone({ onBack }: VideoEditorStandaloneProps) {
  const [clips, setClips] = useState<{ url: string; label: string }[] | null>(null)

  if (!clips) {
    return <VideoClipSelector onClipsSelected={setClips} onBack={onBack} />
  }

  return <VideoEditor initialClips={clips} onBack={() => setClips(null)} />
}
