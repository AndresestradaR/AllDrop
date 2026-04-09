'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { ArrowLeft, Sparkles, Loader2, UserCircle, Trash2, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'
import { StepperHeader } from './StepperHeader'
import { Step1Design } from './Step1Design'
import { Step2Realism } from './Step2Realism'
import { Step3Angles } from './Step3Angles'
import { Step4Body } from './Step4Body'
import { Step4Analysis } from './Step4Analysis'
import { Step6Gallery } from './Step6Gallery'
import { Step7Video } from './Step7Video'
import { InfluencerSummary } from './InfluencerSummary'
import { InfluencerBoard } from './InfluencerBoard'
import { VideoEditor } from '@/components/studio/video-prompt/VideoEditor'
import type { ImageModelId } from '@/lib/image-providers/types'

interface Influencer {
  id: string
  name: string
  description?: string
  image_url?: string
  character_profile: any
  gender?: string
  age_range?: string
  skin_tone?: string
  hair_color?: string
  hair_style?: string
  eye_color?: string
  build?: string
  style_vibe?: string
  accessories?: string[]
  custom_details?: string
  base_image_url?: string
  base_prompt?: string
  realistic_image_url?: string
  angles_grid_url?: string
  body_grid_url?: string
  visual_dna?: string
  prompt_descriptor?: string
  current_step?: number
  voice_id?: string
  voice_name?: string
  created_at: string
}

type WizardView = 'list' | 'wizard' | 'summary' | 'board' | 'editor'

export function InfluencerWizard({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const sinf = t.studio.influencer

  const [view, setView] = useState<WizardView>('list')
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState(0)

  // Data
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [activeInfluencer, setActiveInfluencer] = useState<Influencer | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)

  // Image data passed between steps (to avoid re-downloading)
  const [baseImageBase64, setBaseImageBase64] = useState<string | null>(null)
  const [baseImageMime, setBaseImageMime] = useState<string>('image/png')
  const [realisticImageBase64, setRealisticImageBase64] = useState<string | null>(null)
  const [realisticImageMime, setRealisticImageMime] = useState<string>('image/png')

  // Model selection (persists across steps)
  const [modelId, setModelId] = useState<ImageModelId>('gemini-3-pro-image')

  // Video editor clips (from gallery selection)
  const [editorClips, setEditorClips] = useState<{ url: string; label: string }[] | null>(null)
  const [editorReturnView, setEditorReturnView] = useState<WizardView>('summary')

  // Fetch influencers on mount
  useEffect(() => {
    fetchInfluencers()
  }, [])

  const fetchInfluencers = async () => {
    setIsLoadingList(true)
    try {
      const res = await fetch('/api/studio/influencer')
      const data = await res.json()
      if (data.influencers) setInfluencers(data.influencers)
    } catch (err) {
      console.error('Error fetching influencers:', err)
    } finally {
      setIsLoadingList(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/studio/influencer?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setInfluencers(prev => prev.filter(i => i.id !== id))
        toast.success(sinf.deleted)
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleCreateNew = () => {
    setActiveInfluencer(null)
    setCurrentStep(1)
    setCompletedSteps(0)
    setBaseImageBase64(null)
    setRealisticImageBase64(null)
    setView('wizard')
  }

  const handleContinue = (inf: Influencer) => {
    setActiveInfluencer(inf)
    // CRITICAL: Reset cached images to prevent bleeding between influencers
    setBaseImageBase64(null)
    setRealisticImageBase64(null)
    const step = inf.current_step || 1

    if (step >= 6) {
      // Analysis complete — all steps accessible
      setCompletedSteps(7)
      setView('summary')
    } else {
      setCompletedSteps(Math.max(0, step - 1))
      setCurrentStep(step)
      setView('wizard')
    }
  }

  const handleStepClick = (step: number) => {
    if (step <= completedSteps + 1 && step <= 7) {
      setCurrentStep(step)
    }
  }

  // Step 1 complete (from form generation)
  const handleStep1Complete = (inf: any, imageBase64: string, mimeType: string) => {
    setActiveInfluencer(inf)
    setBaseImageBase64(imageBase64)
    setBaseImageMime(mimeType)
    setCompletedSteps(1)
    setCurrentStep(2)
  }

  // Step 1 complete (from upload)
  const handleStep1Upload = (inf: any, imageUrl: string) => {
    setActiveInfluencer(inf)
    setBaseImageBase64(null) // no base64 available, backend will download
    setCompletedSteps(1)
    setCurrentStep(2)
  }

  // Step 2 complete
  const handleStep2Complete = (realisticUrl: string, imageBase64: string, mimeType: string) => {
    setActiveInfluencer(prev => prev ? { ...prev, realistic_image_url: realisticUrl } : null)
    setRealisticImageBase64(imageBase64)
    setRealisticImageMime(mimeType)
    setCompletedSteps(2)
    setCurrentStep(3)
  }

  // Step 3 complete (Face angles grid)
  const handleStep3Complete = (anglesGridUrl: string) => {
    setActiveInfluencer(prev => prev ? { ...prev, angles_grid_url: anglesGridUrl } : null)
    setCompletedSteps(3)
    setCurrentStep(4)
  }

  // Step 4 complete (Body grid)
  const handleStep4BodyComplete = (bodyGridUrl: string) => {
    setActiveInfluencer(prev => prev ? { ...prev, body_grid_url: bodyGridUrl } : null)
    setCompletedSteps(4)
    setCurrentStep(5)
  }

  // Step 5 complete (Analysis)
  const handleStep5AnalysisComplete = (visualDna: string, promptDescriptor: string) => {
    setActiveInfluencer(prev => prev ? {
      ...prev,
      visual_dna: visualDna,
      prompt_descriptor: promptDescriptor,
      current_step: 6,
    } : null)
    setCompletedSteps(7) // Pasos 6 y 7 son libres, desbloquear ambos
    setView('summary')
    fetchInfluencers()
  }

  // Summary actions
  const handleEditName = async (newName: string) => {
    if (!activeInfluencer) return
    try {
      await fetch('/api/studio/influencer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeInfluencer.id, name: newName }),
      })
      setActiveInfluencer(prev => prev ? { ...prev, name: newName } : null)
      toast.success(sinf.nameUpdated)
      fetchInfluencers()
    } catch (err) {
      console.error('Error updating name:', err)
    }
  }

  const handleGoToGallery = () => {
    if (!activeInfluencer) return
    setCompletedSteps(7)
    setCurrentStep(6)
    setView('wizard')
  }

  const handleGoToVideo = () => {
    if (!activeInfluencer) return
    setCompletedSteps(7)
    setCurrentStep(7)
    setView('wizard')
  }

  const handleSendToEditor = (clips: { url: string; label: string }[], fromView: WizardView) => {
    setEditorClips(clips)
    setEditorReturnView(fromView)
    setView('editor')
  }

  // HEADER for wizard view
  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return sinf.steps.design
      case 2: return sinf.steps.realism
      case 3: return sinf.steps.faceGrid
      case 4: return sinf.steps.bodyGrid
      case 5: return sinf.steps.analysis
      case 6: return sinf.steps.gallery
      case 7: return sinf.steps.video
      default: return sinf.title
    }
  }

  // ============ LIST VIEW ============
  if (view === 'list') {
    return (
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
            <button
              onClick={onBack}
              className="p-2 hover:bg-border/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-500">
                <span className="text-xl">👤</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{sinf.title}</h2>
                <p className="text-sm text-text-secondary">{sinf.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                {sinf.myInfluencers} ({influencers.length})
              </h3>
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-background rounded-xl text-sm font-semibold transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {sinf.createNew}
              </button>
            </div>

            {isLoadingList ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
            ) : influencers.length === 0 ? (
              <div className="text-center py-16">
                <UserCircle className="w-16 h-16 text-text-secondary mx-auto mb-4" />
                <p className="text-text-secondary mb-2">{sinf.noInfluencers}</p>
                <p className="text-xs text-text-muted mb-4">{sinf.noInfluencersDesc}</p>
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-background rounded-xl font-semibold transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                  {sinf.createInfluencer}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {influencers.map((inf) => {
                  const step = inf.current_step || 1
                  const isComplete = step >= 6
                  const displayImage = inf.realistic_image_url || inf.base_image_url || inf.image_url

                  return (
                    <div
                      key={inf.id}
                      className="relative p-4 bg-surface-elevated rounded-xl border border-border group hover:border-accent/30 transition-all"
                    >
                      <div className="flex gap-4">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt={inf.name}
                            className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-border/50 flex items-center justify-center flex-shrink-0">
                            <UserCircle className="w-10 h-10 text-text-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-text-primary truncate">{inf.name}</h4>
                          {inf.prompt_descriptor && (
                            <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2 italic">
                              {inf.prompt_descriptor}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {isComplete ? (
                              <span className="text-[10px] px-2 py-0.5 bg-accent/15 text-accent rounded-full font-medium">
                                {sinf.complete}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded-full font-medium">
                                Paso {step}/5
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleContinue(inf)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-medium transition-all"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          {isComplete ? sinf.viewSummary : sinf.continue}
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(inf.id)}
                        className="absolute top-2 right-2 p-1.5 bg-error/80 hover:bg-error rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============ SUMMARY VIEW ============
  if (view === 'summary' && activeInfluencer) {
    return (
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
            <button
              onClick={() => { setView('list'); fetchInfluencers() }}
              className="p-2 hover:bg-border/50 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{activeInfluencer.name}</h2>
              <p className="text-sm text-text-secondary">Resumen del influencer</p>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <InfluencerSummary
              influencer={activeInfluencer}
              onCreateContent={handleGoToGallery}
              onCreateVideo={handleGoToVideo}
              onViewBoard={() => setView('board')}
              onEditName={handleEditName}
              onBack={() => { setView('list'); fetchInfluencers() }}
              onSendToEditor={(clips) => handleSendToEditor(clips, 'summary')}
            />
          </div>
        </div>
      </div>
    )
  }

  // ============ BOARD VIEW ============
  if (view === 'board' && activeInfluencer) {
    return (
      <InfluencerBoard
        influencer={activeInfluencer}
        onBack={() => setView('summary')}
        onCreateContent={handleGoToGallery}
        onCreateVideo={handleGoToVideo}
        onSendToEditor={(clips) => handleSendToEditor(clips, 'board')}
      />
    )
  }

  // ============ EDITOR VIEW ============
  if (view === 'editor' && editorClips && editorClips.length > 0) {
    return (
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <VideoEditor
          initialClips={editorClips}
          influencerId={activeInfluencer?.id}
          onBack={() => {
            setEditorClips(null)
            setView(editorReturnView)
          }}
        />
      </div>
    )
  }

  // ============ WIZARD VIEW ============
  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button
            onClick={() => {
              if (currentStep === 6 || currentStep === 7) {
                // Go back to summary from gallery/video
                setView('summary')
              } else if (currentStep > 1) {
                setCurrentStep(prev => prev - 1)
              } else {
                setView('list')
                fetchInfluencers()
              }
            }}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{getStepTitle()}</h2>
            <p className="text-sm text-text-secondary">Paso {currentStep} de 7</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="border-b border-border">
          <StepperHeader
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Step content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {currentStep === 1 && (
            <Step1Design
              influencerId={activeInfluencer?.id || null}
              initialData={activeInfluencer ? {
                gender: activeInfluencer.gender || '',
                age_range: activeInfluencer.age_range || '',
                skin_tone: activeInfluencer.skin_tone || '',
                hair_color: activeInfluencer.hair_color || '',
                hair_style: activeInfluencer.hair_style || '',
                eye_color: activeInfluencer.eye_color || '',
                build: activeInfluencer.build || '',
                style_vibe: activeInfluencer.style_vibe || '',
                accessories: activeInfluencer.accessories || [],
                custom_details: activeInfluencer.custom_details || '',
              } : undefined}
              initialBaseImage={activeInfluencer?.base_image_url || null}
              modelId={modelId}
              onModelChange={setModelId}
              onComplete={handleStep1Complete}
              onUploadComplete={handleStep1Upload}
            />
          )}

          {currentStep === 2 && activeInfluencer && (
            <Step2Realism
              influencerId={activeInfluencer.id}
              baseImageUrl={activeInfluencer.base_image_url || activeInfluencer.image_url || ''}
              baseImageBase64={baseImageBase64}
              baseImageMimeType={baseImageMime}
              modelId={modelId}
              onModelChange={setModelId}
              onComplete={handleStep2Complete}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && activeInfluencer && (
            <Step3Angles
              influencerId={activeInfluencer.id}
              realisticImageUrl={activeInfluencer.realistic_image_url || ''}
              realisticImageBase64={realisticImageBase64}
              realisticImageMimeType={realisticImageMime}
              modelId={modelId}
              onModelChange={setModelId}
              onComplete={handleStep3Complete}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && activeInfluencer && (
            <Step4Body
              influencerId={activeInfluencer.id}
              realisticImageUrl={activeInfluencer.realistic_image_url || ''}
              realisticImageBase64={realisticImageBase64}
              realisticImageMimeType={realisticImageMime}
              modelId={modelId}
              onModelChange={setModelId}
              onComplete={handleStep4BodyComplete}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && activeInfluencer && (
            <Step4Analysis
              influencerId={activeInfluencer.id}
              realisticImageUrl={activeInfluencer.realistic_image_url || ''}
              anglesGridUrl={activeInfluencer.angles_grid_url || ''}
              bodyGridUrl={activeInfluencer.body_grid_url || ''}
              onComplete={handleStep5AnalysisComplete}
              onBack={() => setCurrentStep(4)}
            />
          )}

          {currentStep === 6 && activeInfluencer && (
            <Step6Gallery
              influencerId={activeInfluencer.id}
              influencerName={activeInfluencer.name}
              promptDescriptor={activeInfluencer.prompt_descriptor || ''}
              realisticImageUrl={activeInfluencer.realistic_image_url || ''}
              modelId={modelId}
              onModelChange={setModelId}
              onBack={() => setView('summary')}
            />
          )}

          {currentStep === 7 && activeInfluencer && (
            <Step7Video
              influencerId={activeInfluencer.id}
              influencerName={activeInfluencer.name}
              promptDescriptor={activeInfluencer.prompt_descriptor || ''}
              realisticImageUrl={activeInfluencer.realistic_image_url || ''}
              onBack={() => setView('summary')}
              onSendToEditor={(clips) => handleSendToEditor(clips, 'wizard')}
              onGoToBoard={() => setView('board')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
