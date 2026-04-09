'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { Sparkles, Loader2, RefreshCw, Check, Upload, Pencil } from 'lucide-react'
import { IMAGE_MODELS, STUDIO_COMPANY_GROUPS, type ImageModelId } from '@/lib/image-providers/types'
import { useI18n } from '@/lib/i18n'

interface FormData {
  gender: string
  age_range: string
  skin_tone: string
  hair_color: string
  hair_style: string
  eye_color: string
  build: string
  style_vibe: string
  accessories: string[]
  custom_details: string
}

interface Step1DesignProps {
  influencerId: string | null
  initialData?: Partial<FormData>
  initialBaseImage?: string | null
  modelId: ImageModelId
  onModelChange: (id: ImageModelId) => void
  onComplete: (influencer: any, imageBase64: string, mimeType: string) => void
  onUploadComplete: (influencer: any, imageUrl: string) => void
}

const TOGGLE_CLASS = 'px-3 py-2 rounded-lg text-xs font-medium transition-all border'
const ACTIVE_TOGGLE = 'bg-accent/15 border-accent text-accent'
const INACTIVE_TOGGLE = 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'

export function Step1Design({
  influencerId,
  initialData,
  initialBaseImage,
  modelId,
  onModelChange,
  onComplete,
  onUploadComplete,
}: Step1DesignProps) {
  const { t } = useI18n()
  const s = t.studio.influencer.step1

  const [tab, setTab] = useState<'create' | 'upload'>('create')

  // Form state
  const [form, setForm] = useState<FormData>({
    gender: initialData?.gender || '',
    age_range: initialData?.age_range || '',
    skin_tone: initialData?.skin_tone || '',
    hair_color: initialData?.hair_color || '',
    hair_style: initialData?.hair_style || '',
    eye_color: initialData?.eye_color || '',
    build: initialData?.build || '',
    style_vibe: initialData?.style_vibe || '',
    accessories: initialData?.accessories || [],
    custom_details: initialData?.custom_details || '',
  })

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(initialBaseImage || null)
  const [generatedBase64, setGeneratedBase64] = useState<string | null>(null)
  const [generatedMime, setGeneratedMime] = useState<string>('image/png')
  const [savedInfluencer, setSavedInfluencer] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateField = (field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleAccessory = (acc: string) => {
    setForm(prev => ({
      ...prev,
      accessories: prev.accessories.includes(acc)
        ? prev.accessories.filter(a => a !== acc)
        : [...prev.accessories, acc],
    }))
  }

  const isFormValid = form.gender && form.age_range && form.skin_tone && form.hair_color && form.hair_style

  const handleGenerate = async () => {
    if (!isFormValid) return

    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/studio/influencer/generate-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: form,
          modelId,
          influencerId: influencerId || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al generar imagen')
      }

      setGeneratedImage(`data:${data.mimeType};base64,${data.imageBase64}`)
      setGeneratedBase64(data.imageBase64)
      setGeneratedMime(data.mimeType || 'image/png')
      setSavedInfluencer(data.influencer)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = () => {
    if (savedInfluencer && generatedBase64) {
      onComplete(savedInfluencer, generatedBase64, generatedMime)
    }
  }

  const handleRegenerate = () => {
    setGeneratedImage(null)
    setGeneratedBase64(null)
    setSavedInfluencer(null)
    handleGenerate()
  }

  const handleEditForm = () => {
    setGeneratedImage(null)
    setGeneratedBase64(null)
    setSavedInfluencer(null)
  }

  // Upload tab handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setUploadPreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleUploadAndContinue = async () => {
    if (!uploadFile) return

    setIsUploading(true)
    setError(null)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autorizado')

      // Upload to storage
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const storagePath = `influencers/${user.id}/${Date.now()}_uploaded.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('landing-images')
        .upload(storagePath, uploadFile, { contentType: uploadFile.type, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from('landing-images')
        .getPublicUrl(storagePath)

      // Create or update influencer
      let inf
      if (influencerId) {
        const res = await fetch('/api/studio/influencer', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: influencerId,
            base_image_url: publicUrl,
            image_url: publicUrl,
            current_step: 2,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        inf = data.influencer
      } else {
        const res = await fetch('/api/studio/influencer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Mi Influencer',
            image_url: publicUrl,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        inf = data.influencer

        // Update with base_image_url and step
        await fetch('/api/studio/influencer', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: inf.id,
            base_image_url: publicUrl,
            current_step: 2,
          }),
        })
        inf.base_image_url = publicUrl
        inf.current_step = 2
      }

      onUploadComplete(inf, publicUrl)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  // Model selector (simple dropdown)
  const currentModel = IMAGE_MODELS[modelId]
  const availableModels = STUDIO_COMPANY_GROUPS.flatMap(g => g.models).filter(m => m.supportsImageInput || tab === 'create')

  // If generated image exists, show result
  if (generatedImage && savedInfluencer) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden bg-surface-elevated border border-border">
          <img
            src={generatedImage}
            alt={s.generatedAlt}
            className="w-full max-h-[500px] object-contain"
          />
        </div>

        {error && (
          <div className="mt-3 p-3 bg-error/10 border border-error/20 rounded-xl">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 transition-all"
          >
            <Check className="w-5 h-5" />
            {s.iLikeContinue}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-surface-elevated border border-border text-text-secondary hover:text-text-primary hover:border-text-muted transition-all"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {s.regenerate}
          </button>
          <button
            onClick={handleEditForm}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-surface-elevated border border-border text-text-secondary hover:text-text-primary hover:border-text-muted transition-all"
          >
            <Pencil className="w-4 h-4" />
            {s.edit}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('create')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
            tab === 'create' ? 'bg-accent text-background shadow-lg shadow-accent/25' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          )}
        >
          {s.createFromScratch}
        </button>
        <button
          onClick={() => setTab('upload')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
            tab === 'upload' ? 'bg-accent text-background shadow-lg shadow-accent/25' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
          )}
        >
          {s.uploadExisting}
        </button>
      </div>

      {/* CREATE TAB */}
      {tab === 'create' && (
        <div className="space-y-4">
          {/* Gender */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.gender}</label>
            <div className="flex gap-2">
              {[
                { value: 'female', label: s.female },
                { value: 'male', label: s.male },
                { value: 'non-binary', label: s.nonBinary },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateField('gender', opt.value)}
                  className={cn(TOGGLE_CLASS, form.gender === opt.value ? ACTIVE_TOGGLE : INACTIVE_TOGGLE)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age Range */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.age}</label>
            <div className="flex gap-2">
              {['18-25', '25-30', '30-40', '40-50'].map(age => (
                <button
                  key={age}
                  onClick={() => updateField('age_range', age)}
                  className={cn(TOGGLE_CLASS, form.age_range === age ? ACTIVE_TOGGLE : INACTIVE_TOGGLE)}
                >
                  {age}
                </button>
              ))}
            </div>
          </div>

          {/* Skin Tone + Hair Color + Hair Style */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.skinTone}</label>
              <select
                value={form.skin_tone}
                onChange={(e) => updateField('skin_tone', e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">{s.select}</option>
                {[
                  { v: 'fair', l: s.skinFair },
                  { v: 'light', l: s.skinLight },
                  { v: 'olive', l: s.skinOlive },
                  { v: 'medium', l: s.skinMedium },
                  { v: 'tan', l: s.skinTan },
                  { v: 'dark', l: s.skinDark },
                  { v: 'deep', l: s.skinDeep },
                ].map(t => (
                  <option key={t.v} value={t.v}>{t.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.hairColor}</label>
              <select
                value={form.hair_color}
                onChange={(e) => updateField('hair_color', e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">{s.select}</option>
                {[
                  { v: 'black', l: s.hairBlack },
                  { v: 'dark brown', l: s.hairDarkBrown },
                  { v: 'light brown', l: s.hairLightBrown },
                  { v: 'blonde', l: s.hairBlonde },
                  { v: 'red', l: s.hairRed },
                  { v: 'gray', l: s.hairGray },
                ].map(h => (
                  <option key={h.v} value={h.v}>{h.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.hairStyle}</label>
              <select
                value={form.hair_style}
                onChange={(e) => updateField('hair_style', e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">{s.select}</option>
                {[
                  { v: 'short straight', l: s.hairShortStraight },
                  { v: 'long straight', l: s.hairLongStraight },
                  { v: 'wavy', l: s.hairWavy },
                  { v: 'curly', l: s.hairCurly },
                  { v: 'afro', l: s.hairAfro },
                  { v: 'buzzcut', l: s.hairBuzzcut },
                  { v: 'messy', l: s.hairMessy },
                ].map(h => (
                  <option key={h.v} value={h.v}>{h.l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Eye Color + Build */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.eyeColor}</label>
              <select
                value={form.eye_color}
                onChange={(e) => updateField('eye_color', e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">{s.select}</option>
                {[
                  { v: 'brown', l: s.eyeBrown },
                  { v: 'green', l: s.eyeGreen },
                  { v: 'blue', l: s.eyeBlue },
                  { v: 'gray', l: s.eyeGray },
                  { v: 'hazel', l: s.eyeHazel },
                ].map(e => (
                  <option key={e.v} value={e.v}>{e.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.bodyType}</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: 'delgada', l: s.slim },
                  { v: 'atletica', l: s.athletic },
                  { v: 'media', l: s.medium },
                  { v: 'robusta', l: s.robust },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => updateField('build', opt.v)}
                    className={cn(TOGGLE_CLASS, 'text-[11px]', form.build === opt.v ? ACTIVE_TOGGLE : INACTIVE_TOGGLE)}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Style Vibe */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.style}</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'casual', label: s.casual },
                { value: 'profesional', label: s.professional },
                { value: 'bohemio', label: s.bohemian },
                { value: 'deportivo', label: s.sporty },
                { value: 'elegante', label: s.elegant },
                { value: 'streetwear', label: s.streetwear },
              ].map(st => (
                <button
                  key={st.value}
                  onClick={() => updateField('style_vibe', st.value)}
                  className={cn(TOGGLE_CLASS, form.style_vibe === st.value ? ACTIVE_TOGGLE : INACTIVE_TOGGLE)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.accessories}</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { v: 'piercing_nariz', l: s.nosePiercing },
                { v: 'aretes', l: s.earrings },
                { v: 'gafas', l: s.glasses },
                { v: 'tatuajes', l: s.tattoos },
                { v: 'panuelo', l: s.bandana },
              ].map(acc => (
                <button
                  key={acc.v}
                  onClick={() => toggleAccessory(acc.v)}
                  className={cn(TOGGLE_CLASS, form.accessories.includes(acc.v) ? ACTIVE_TOGGLE : INACTIVE_TOGGLE)}
                >
                  {acc.l}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Details */}
          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">{s.extraDetails}</label>
            <textarea
              value={form.custom_details}
              onChange={(e) => updateField('custom_details', e.target.value)}
              placeholder={s.extraDetailsPlaceholder}
              rows={2}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!isFormValid || isGenerating}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all',
              !isFormValid || isGenerating
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {s.generatingImage}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {s.generateBaseImage}
              </>
            )}
          </button>
        </div>
      )}

      {/* UPLOAD TAB */}
      {tab === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {s.uploadDescription}
          </p>

          {uploadPreview ? (
            <div className="relative rounded-2xl overflow-hidden bg-surface-elevated border border-border">
              <img src={uploadPreview} alt="Preview" className="w-full max-h-[400px] object-contain" />
              <button
                onClick={() => { setUploadFile(null); setUploadPreview(null) }}
                className="absolute top-3 right-3 p-2 bg-error/80 hover:bg-error rounded-lg text-white text-sm"
              >
                X
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border hover:border-accent/50 rounded-xl cursor-pointer transition-colors">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <Upload className="w-12 h-12 text-text-secondary mb-3" />
              <p className="text-text-primary font-medium">{s.uploadReference}</p>
              <p className="text-xs text-text-secondary mt-1">{s.uploadHint}</p>
            </label>
          )}

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <button
            onClick={handleUploadAndContinue}
            disabled={!uploadFile || isUploading}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all',
              !uploadFile || isUploading
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {s.uploading}
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {s.uploadAndContinue}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
