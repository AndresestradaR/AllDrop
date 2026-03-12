'use client'

import { useState, useRef } from 'react'
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import ProductSelector from './ProductSelector'
import IdeaSelector from './IdeaSelector'
import TemplateSelector from './TemplateSelector'
import OutlineEditor from './OutlineEditor'
import GenerationProgress from './GenerationProgress'
import EbookPreview from './EbookPreview'
import { suggestTemplate } from '@/lib/ebook/templates'
import type {
  ProductInput,
  EbookIdea,
  EbookTemplate,
  EbookOutline,
  EbookCategory,
  GenerationStep,
} from '@/lib/ebook/types'

type WizardStep = 'product' | 'idea' | 'template' | 'outline' | 'generating' | 'done'

interface EbookGeneratorProps {
  onBack: () => void
}

export default function EbookGenerator({ onBack }: EbookGeneratorProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('product')
  const [loading, setLoading] = useState(false)

  // Data
  const [product, setProduct] = useState<ProductInput | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [ideas, setIdeas] = useState<EbookIdea[]>([])
  const [selectedIdea, setSelectedIdea] = useState<EbookIdea | null>(null)
  const [suggestedTemplateCat, setSuggestedTemplateCat] = useState<EbookCategory>('universal')
  const [selectedTemplate, setSelectedTemplate] = useState<EbookTemplate | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | undefined>()
  const [outline, setOutline] = useState<EbookOutline | null>(null)

  // Generation
  const [genSteps, setGenSteps] = useState<GenerationStep[]>([])
  const [currentGenStep, setCurrentGenStep] = useState<GenerationStep | null>(null)

  // Result
  const [ebookId, setEbookId] = useState<string | null>(null)
  const [ebookTitle, setEbookTitle] = useState('')
  const [ebookChapters, setEbookChapters] = useState(0)
  const [ebookPages, setEbookPages] = useState(0)
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>()

  // Abort controller for SSE
  const abortRef = useRef<AbortController | null>(null)

  // ============================================
  // Step 1: Product selected → Analyze
  // ============================================
  const handleProductSelect = async (p: ProductInput) => {
    setProduct(p)
    setLoading(true)

    try {
      // Extract base64 from first image if it's a data URL
      const images: string[] = []
      if (p.images[0]?.startsWith('data:')) {
        images.push(p.images[0].split(',')[1])
      }

      const res = await fetch('/api/studio/ebook/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: p.name,
          productDescription: p.description,
          productImages: images.length > 0 ? images : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al analizar producto')
      }

      const data = await res.json()
      setAnalysis(data.analysis || '')
      setIdeas(data.ideas || [])
      setSuggestedTemplateCat(data.suggestedTemplate || suggestTemplate(p.name))
      setStep('idea')
    } catch (err: any) {
      toast.error(err.message || 'Error al analizar producto')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // Step 2: Idea selected → Template
  // ============================================
  const handleIdeaSelect = (idea: EbookIdea) => {
    setSelectedIdea(idea)
    // If idea has a category, use it for template suggestion
    if (idea.category) setSuggestedTemplateCat(idea.category)
    setStep('template')
  }

  // ============================================
  // Step 3: Template selected → Generate Outline
  // ============================================
  const handleTemplateSelect = async (template: EbookTemplate, logo?: string) => {
    setSelectedTemplate(template)
    setLogoUrl(logo)
    setLoading(true)

    try {
      const res = await fetch('/api/studio/ebook/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product!.name,
          productDescription: product!.description,
          selectedIdea: selectedIdea,
          chaptersCount: 5,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al generar estructura')
      }

      const data = await res.json()
      setOutline(data)
      setStep('outline')
    } catch (err: any) {
      toast.error(err.message || 'Error al generar estructura')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // Step 4: Outline confirmed → Generate Ebook
  // ============================================
  const handleOutlineConfirm = async (confirmedOutline: EbookOutline) => {
    setOutline(confirmedOutline)
    setStep('generating')
    setGenSteps([])
    setCurrentGenStep(null)

    try {
      abortRef.current = new AbortController()

      const res = await fetch('/api/studio/ebook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: confirmedOutline,
          template: selectedTemplate,
          logoUrl,
          productName: product!.name,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error('Error al iniciar generacion')
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No se pudo leer la respuesta')

      const decoder = new TextDecoder()
      let buffer = ''
      let gotResult = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'result') {
              gotResult = true
              setEbookId(event.id)
              setEbookTitle(event.title)
              setEbookChapters(event.chaptersCount)
              setEbookPages(event.pagesEstimate)
              setCoverImageUrl(event.coverImageUrl || undefined)
              setStep('done')
            } else {
              // Progress step
              setCurrentGenStep(event)
              setGenSteps((prev) => [...prev, event])

              if (event.type === 'error') {
                toast.error(event.message)
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Stream ended without result — server likely timed out
      if (!gotResult) {
        toast.error('La generacion tardo demasiado. Intenta con menos capitulos.')
        setCurrentGenStep({
          type: 'error',
          message: 'El servidor agoto el tiempo. Intenta con menos capitulos (5-6).',
          progress: 0,
        })
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      toast.error(err.message || 'Error en la generacion')
      setCurrentGenStep({
        type: 'error',
        message: err.message || 'Error en la generacion',
        progress: 0,
      })
    }
  }

  // ============================================
  // Reset
  // ============================================
  const handleNewEbook = () => {
    setStep('product')
    setProduct(null)
    setAnalysis('')
    setIdeas([])
    setSelectedIdea(null)
    setSelectedTemplate(null)
    setLogoUrl(undefined)
    setOutline(null)
    setGenSteps([])
    setCurrentGenStep(null)
    setEbookId(null)
  }

  // ============================================
  // Step indicator
  // ============================================
  const stepLabels: Record<WizardStep, string> = {
    product: 'Producto',
    idea: 'Idea',
    template: 'Estilo',
    outline: 'Estructura',
    generating: 'Generando',
    done: 'Listo',
  }
  const stepOrder: WizardStep[] = ['product', 'idea', 'template', 'outline', 'generating', 'done']
  const currentIdx = stepOrder.indexOf(step)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={step === 'product' ? onBack : () => {
            if (step === 'generating') return // can't go back while generating
            const prevStep = stepOrder[Math.max(0, currentIdx - 1)]
            setStep(prevStep)
          }}
          disabled={step === 'generating'}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            Generador de Ebooks
          </h2>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 mb-8">
        {stepOrder.slice(0, -1).map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full transition-colors ${
              i <= currentIdx ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          />
        ))}
      </div>

      {/* Loading overlay */}
      {loading && step !== 'generating' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-sm text-zinc-400">
            {step === 'product' ? 'Analizando producto...' : 'Generando estructura...'}
          </p>
        </div>
      )}

      {/* Steps */}
      {!loading && step === 'product' && <ProductSelector onSelect={handleProductSelect} />}

      {!loading && step === 'idea' && (
        <IdeaSelector ideas={ideas} analysis={analysis} onSelect={handleIdeaSelect} />
      )}

      {!loading && step === 'template' && (
        <TemplateSelector
          suggestedTemplate={suggestedTemplateCat}
          onSelect={handleTemplateSelect}
        />
      )}

      {!loading && step === 'outline' && outline && (
        <OutlineEditor
          outline={outline}
          onConfirm={handleOutlineConfirm}
          onBack={() => setStep('template')}
        />
      )}

      {step === 'generating' && (
        <GenerationProgress steps={genSteps} currentStep={currentGenStep} />
      )}

      {step === 'done' && (
        <EbookPreview
          ebookId={ebookId}
          title={ebookTitle}
          chaptersCount={ebookChapters}
          pagesEstimate={ebookPages}
          coverImageUrl={coverImageUrl}
          onNewEbook={handleNewEbook}
        />
      )}
    </div>
  )
}
