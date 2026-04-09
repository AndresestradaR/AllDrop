'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { ArrowLeft, Upload, Loader2, Copy, Check, ChevronDown, ChevronUp, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'

interface PersonDescriptorProps {
  onBack: () => void
}

export function PersonDescriptor({ onBack }: PersonDescriptorProps) {
  const { t } = useI18n()
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  // Technique 1
  const [t1Descriptor, setT1Descriptor] = useState('')
  const [t1FullAnalysis, setT1FullAnalysis] = useState('')
  // Technique 2
  const [t2Descriptor8k, setT2Descriptor8k] = useState('')
  const [t2FullProfile, setT2FullProfile] = useState('')
  // UI
  const [showT1Full, setShowT1Full] = useState(false)
  const [showT2Full, setShowT2Full] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'t1' | 't2'>('t1')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      setImagePreview(URL.createObjectURL(file))
      // Reset results
      setT1Descriptor('')
      setT1FullAnalysis('')
      setT2Descriptor8k('')
      setT2FullProfile('')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file)
      setImagePreview(URL.createObjectURL(file))
      setT1Descriptor('')
      setT1FullAnalysis('')
      setT2Descriptor8k('')
      setT2FullProfile('')
    }
  }

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(t.studio.descriptor.copiedClipboard)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error(t.studio.descriptor.copyError)
    }
  }

  const handleAnalyze = async () => {
    if (!uploadedImage) return
    setIsAnalyzing(true)
    setT1Descriptor('')
    setT1FullAnalysis('')
    setT2Descriptor8k('')
    setT2FullProfile('')
    try {
      const formData = new FormData()
      formData.append('image', uploadedImage)
      const res = await fetch('/api/studio/tools/describe-person', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.studio.descriptor.analyzeError)
      // Technique 1
      setT1Descriptor(data.technique1?.prompt_descriptor || '')
      setT1FullAnalysis(data.technique1?.visual_dna || '')
      // Technique 2
      setT2Descriptor8k(data.technique2?.prompt_descriptor_8k || '')
      setT2FullProfile(data.technique2?.facial_profile || '')
      toast.success(t.studio.descriptor.analysisComplete)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const hasResults = !!(t1Descriptor || t2Descriptor8k)

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{t.studio.descriptor.title}</h2>
              <p className="text-sm text-text-secondary">{t.studio.descriptor.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {/* Upload zone */}
            <div className="mb-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              {uploadedImage && imagePreview ? (
                <div className="relative">
                  <div className="rounded-xl overflow-hidden bg-surface-elevated border border-border">
                    <img
                      src={imagePreview}
                      alt="Uploaded"
                      className="w-full max-h-80 object-contain"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setUploadedImage(null)
                      setImagePreview(null)
                      setT1Descriptor('')
                      setT1FullAnalysis('')
                      setT2Descriptor8k('')
                      setT2FullProfile('')
                    }}
                    className="absolute top-3 right-3 p-2 bg-error/80 hover:bg-error rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors bg-surface-elevated"
                >
                  <Upload className="w-10 h-10 text-text-secondary mb-3" />
                  <p className="text-text-primary font-medium text-sm">{t.studio.descriptor.dragOrClick}</p>
                  <p className="text-xs text-text-secondary mt-1">{t.studio.descriptor.fileLimit}</p>
                </div>
              )}

              {/* Analyze button */}
              <button
                onClick={handleAnalyze}
                disabled={!uploadedImage || isAnalyzing}
                className={cn(
                  'w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                  !uploadedImage || isAnalyzing
                    ? 'bg-border text-text-secondary cursor-not-allowed'
                    : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.studio.descriptor.analyzing}
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    {t.studio.descriptor.analyzeBtn}
                  </>
                )}
              </button>
            </div>

            {/* Results */}
            {hasResults && (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveTab('t1')}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border',
                      activeTab === 't1'
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    {t.studio.descriptor.technique1}
                  </button>
                  <button
                    onClick={() => setActiveTab('t2')}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border',
                      activeTab === 't2'
                        ? 'bg-purple-500/15 border-purple-500 text-purple-400'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    {t.studio.descriptor.technique2}
                  </button>
                </div>

                {/* Tab Technique 1 */}
                {activeTab === 't1' && (
                  <div>
                    {t1Descriptor ? (
                      <div className="p-4 bg-accent/5 border border-accent/30 rounded-xl mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-accent uppercase tracking-wide">PROMPT DESCRIPTOR</p>
                          <button
                            onClick={() => handleCopy(t1Descriptor, 't1-desc')}
                            className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"
                          >
                            {copiedField === 't1-desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-sm text-text-primary leading-relaxed">{t1Descriptor}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-surface-elevated border border-border rounded-xl mb-4">
                        <p className="text-sm text-text-muted">{t.studio.descriptor.noDescriptor}</p>
                      </div>
                    )}

                    {t1FullAnalysis && (
                      <div className="mb-4">
                        <button
                          onClick={() => setShowT1Full(!showT1Full)}
                          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary font-medium transition-colors"
                        >
                          {showT1Full ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {showT1Full ? t.studio.descriptor.hideVisualAnalysis : t.studio.descriptor.showVisualAnalysis}
                        </button>
                        {showT1Full && (
                          <div className="mt-3 p-4 bg-surface-elevated border border-border rounded-xl">
                            <div className="flex justify-end mb-2">
                              <button
                                onClick={() => handleCopy(t1FullAnalysis, 't1-full')}
                                className="p-1.5 rounded-lg hover:bg-border/50 text-text-muted transition-colors"
                              >
                                {copiedField === 't1-full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{t1FullAnalysis}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3 bg-accent/5 rounded-lg">
                      <p className="text-[11px] text-accent/70">
                        {t.studio.descriptor.t1Hint}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab Technique 2 */}
                {activeTab === 't2' && (
                  <div>
                    {t2Descriptor8k ? (
                      <div className="p-4 bg-purple-500/5 border border-purple-500/30 rounded-xl mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-purple-400 uppercase tracking-wide">8K CHARACTER DESCRIPTOR</p>
                          <button
                            onClick={() => handleCopy(t2Descriptor8k, 't2-desc')}
                            className="p-1.5 rounded-lg hover:bg-purple-500/10 text-purple-400 transition-colors"
                          >
                            {copiedField === 't2-desc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <p className="text-sm text-text-primary leading-relaxed">{t2Descriptor8k}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-surface-elevated border border-border rounded-xl mb-4">
                        <p className="text-sm text-text-muted">{t.studio.descriptor.noDescriptor8k}</p>
                      </div>
                    )}

                    {t2FullProfile && (
                      <div className="mb-4">
                        <button
                          onClick={() => setShowT2Full(!showT2Full)}
                          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary font-medium transition-colors"
                        >
                          {showT2Full ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {showT2Full ? t.studio.descriptor.hideFacialProfile : t.studio.descriptor.showFacialProfile}
                        </button>
                        {showT2Full && (
                          <div className="mt-3 p-4 bg-surface-elevated border border-border rounded-xl">
                            <div className="flex justify-end mb-2">
                              <button
                                onClick={() => handleCopy(t2FullProfile, 't2-full')}
                                className="p-1.5 rounded-lg hover:bg-border/50 text-text-muted transition-colors"
                              >
                                {copiedField === 't2-full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{t2FullProfile}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3 bg-purple-500/5 rounded-lg">
                      <p className="text-[11px] text-purple-400/70">
                        {t.studio.descriptor.t2Hint}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
