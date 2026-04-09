'use client'

import { useState } from 'react'
import { ArrowLeft, Film, Check, Sparkles } from 'lucide-react'
import { StandaloneScriptGenerator, type SceneData } from './StandaloneScriptGenerator'
import { StandaloneVideoManager } from './StandaloneVideoManager'
import { VideoEditor } from './VideoEditor'
import { VIDEO_MODELS, VIDEO_COMPANY_GROUPS } from '@/lib/video-providers/types'
import type { VideoModelId } from '@/lib/video-providers/types'
import { useI18n } from '@/lib/i18n'

type Step = 'script' | 'configure' | 'generate' | 'edit'

interface VideoPromptStudioProps {
  onBack: () => void
}

export function VideoPromptStudio({ onBack }: VideoPromptStudioProps) {
  const { t } = useI18n()
  const [step, setStep] = useState<Step>('script')
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [modelId, setModelId] = useState<VideoModelId>('veo-3.1')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9')
  const [enableAudio, setEnableAudio] = useState(true)
  const [completedClipUrls, setCompletedClipUrls] = useState<Map<number, string>>(new Map())

  const handleScenesGenerated = (generatedScenes: SceneData[]) => {
    setScenes(generatedScenes)
    setStep('configure')
  }

  const handleStartGeneration = () => {
    setStep('generate')
  }

  const selectedModel = VIDEO_MODELS[modelId]

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={step === 'script' ? onBack : () => setStep(step === 'edit' ? 'generate' : step === 'generate' ? 'configure' : 'script')}
          className="p-2 hover:bg-border/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-500">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{t.studio.videoPrompt.title}</h2>
            <p className="text-sm text-text-secondary">
              {step === 'script' && t.studio.videoPrompt.stepScript}
              {step === 'configure' && t.studio.videoPrompt.stepConfigure}
              {step === 'generate' && t.studio.videoPrompt.stepGenerate}
              {step === 'edit' && t.studio.videoPrompt.stepEdit}
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="ml-auto flex items-center gap-2">
          {(['script', 'configure', 'generate', 'edit'] as Step[]).map((s, i) => {
            const allSteps: Step[] = ['script', 'configure', 'generate', 'edit']
            const currentIdx = allSteps.indexOf(step)
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s
                    ? 'bg-accent text-background'
                    : currentIdx > i
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-border text-text-muted'
                }`}>
                  {currentIdx > i ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && <div className="w-6 h-0.5 bg-border rounded" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {step === 'script' && (
          <StandaloneScriptGenerator onScenesGenerated={handleScenesGenerated} />
        )}

        {step === 'configure' && (
          <div className="space-y-6 max-w-3xl">
            {/* Model selector */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">{t.studio.videoPrompt.videoModel}</h3>
              <div className="space-y-4">
                {VIDEO_COMPANY_GROUPS.map(group => (
                  <div key={group.id}>
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">{group.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.models.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setModelId(model.id)
                            setEnableAudio(model.supportsAudio)
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            modelId === model.id
                              ? 'border-accent bg-accent/10'
                              : 'border-border hover:border-accent/50 bg-surface-elevated'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${modelId === model.id ? 'text-accent' : 'text-text-primary'}`}>
                              {model.name}
                            </span>
                            {modelId === model.id && <Check className="w-4 h-4 text-accent" />}
                          </div>
                          <p className="text-[10px] text-text-muted mt-0.5">{model.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] text-text-muted">{model.priceRange}</span>
                            <span className="text-[9px] text-text-muted">{model.durationRange}</span>
                            {model.supportsAudio && <span className="text-[9px] text-blue-400">Audio</span>}
                            {model.supportsExtend && <span className="text-[9px] text-violet-400">Extend</span>}
                          </div>
                          {model.tags && model.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {model.tags.map(tag => (
                                <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-border text-text-muted">{tag}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Aspect ratio & audio */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4">{t.studio.videoPrompt.configuration}</h3>
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-text-secondary mb-2">{t.studio.videoPrompt.aspectRatio}</label>
                  <div className="flex gap-2">
                    {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          aspectRatio === ratio
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-surface-elevated text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-text-secondary mb-2">{t.studio.videoPrompt.audio}</label>
                  <button
                    onClick={() => setEnableAudio(!enableAudio)}
                    disabled={!selectedModel?.supportsAudio}
                    className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      !selectedModel?.supportsAudio
                        ? 'border-border bg-border/50 text-text-muted cursor-not-allowed'
                        : enableAudio
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface-elevated text-text-secondary hover:border-accent/50'
                    }`}
                  >
                    {!selectedModel?.supportsAudio ? t.studio.videoPrompt.notSupported : enableAudio ? t.studio.videoPrompt.enabled : t.studio.videoPrompt.disabled}
                  </button>
                </div>
              </div>
            </div>

            {/* Summary & Generate */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{t.studio.videoPrompt.summary}</h3>
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="p-2.5 bg-surface-elevated rounded-lg">
                  <span className="text-text-muted">{t.studio.videoPrompt.scenes}</span>
                  <p className="text-text-primary font-medium">{t.studio.videoPrompt.scenesTime.replace('{count}', String(scenes.length)).replace('{seconds}', String(scenes.length * 8))}</p>
                </div>
                <div className="p-2.5 bg-surface-elevated rounded-lg">
                  <span className="text-text-muted">{t.studio.videoPrompt.model}</span>
                  <p className="text-text-primary font-medium">{selectedModel?.name || modelId}</p>
                </div>
                <div className="p-2.5 bg-surface-elevated rounded-lg">
                  <span className="text-text-muted">{t.studio.videoPrompt.aspectRatio}</span>
                  <p className="text-text-primary font-medium">{aspectRatio}</p>
                </div>
                <div className="p-2.5 bg-surface-elevated rounded-lg">
                  <span className="text-text-muted">{t.studio.videoPrompt.audio}</span>
                  <p className="text-text-primary font-medium">{enableAudio ? t.studio.videoPrompt.yes : t.studio.videoPrompt.no}</p>
                </div>
              </div>
              <button
                onClick={handleStartGeneration}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25"
              >
                <Sparkles className="w-4 h-4" />
                {t.studio.videoPrompt.generateAll.replace('{count}', String(scenes.length))}
              </button>
            </div>
          </div>
        )}

        {step === 'generate' && (
          <div className="space-y-4">
            <StandaloneVideoManager
              scenes={scenes}
              modelId={modelId}
              aspectRatio={aspectRatio}
              enableAudio={enableAudio}
              onBack={() => setStep('configure')}
            />
            {/* Edit button — shown when videos exist */}
            <button
              onClick={() => {
                // Collect video URLs from the rendered video elements
                const videoEls = document.querySelectorAll<HTMLVideoElement>(
                  '[data-scene-video]'
                )
                const clips: { url: string; label: string }[] = []
                videoEls.forEach((el, i) => {
                  if (el.src) {
                    clips.push({
                      url: el.src,
                      label: `${t.studio.videoPrompt.scene} ${scenes[i]?.sceneNumber || i + 1}`,
                    })
                  }
                })
                // Also try from all video elements in the generate step
                if (clips.length === 0) {
                  const allVideos = document.querySelectorAll<HTMLVideoElement>(
                    'video[src]'
                  )
                  allVideos.forEach((el, i) => {
                    if (el.src && !el.closest('[data-export-result]')) {
                      clips.push({
                        url: el.src,
                        label: `${t.studio.videoPrompt.clip} ${i + 1}`,
                      })
                    }
                  })
                }
                if (clips.length === 0) {
                  return
                }
                setCompletedClipUrls(new Map(clips.map((c, i) => [i, c.url])))
                setStep('edit')
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-sm font-bold hover:from-pink-500 hover:to-rose-500 transition-all shadow-lg shadow-pink-500/25"
            >
              <Film className="w-4 h-4" />
              {t.studio.videoPrompt.editFinalVideo}
            </button>
          </div>
        )}

        {step === 'edit' && (
          <VideoEditor
            initialClips={Array.from(completedClipUrls.entries()).map(([i, url]) => ({
              url,
              label: `${t.studio.videoPrompt.scene} ${scenes[i]?.sceneNumber || i + 1}`,
            }))}
            onBack={() => setStep('generate')}
          />
        )}
      </div>
    </div>
  )
}
