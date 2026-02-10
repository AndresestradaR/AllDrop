'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Card } from '@/components/ui'
import { 
  LayoutTemplate, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mic,
  ArrowLeft,
  Check,
  Download,
  Eye,
  Edit3,
  Trash2,
  Share2,
  MessageCircle,
  ImagePlus,
  ExternalLink,
  Send
} from 'lucide-react'
import toast from 'react-hot-toast'
import ModelSelector from '@/components/generator/ModelSelector'
import CountrySelector from '@/components/generator/CountrySelector'
import PricingControls, { PricingData, getDefaultPricingData } from '@/components/generator/PricingControls'
import { ImageModelId, modelIdToProviderType } from '@/lib/image-providers/types'
import { Country, getDefaultCountry } from '@/lib/constants/countries'

export const dynamic = 'force-dynamic'

const TEMPLATE_CATEGORIES = [
  { id: 'hero', name: 'Hero' },
  { id: 'oferta', name: 'Oferta' },
  { id: 'antes-despues', name: 'Antes/Después' },
  { id: 'beneficios', name: 'Beneficios' },
  { id: 'tabla-comparativa', name: 'Tabla Comparativa' },
  { id: 'autoridad', name: 'Prueba de Autoridad' },
  { id: 'testimonios', name: 'Testimonios' },
  { id: 'modo-uso', name: 'Modo de Uso' },
  { id: 'logistica', name: 'Logística' },
  { id: 'faq', name: 'Preguntas Frecuentes' },
]

const OUTPUT_SIZES = [
  { id: '1080x1920', name: 'Vertical (9:16)', dimensions: '1080 x 1920 px' },
  { id: '1080x1080', name: 'Cuadrada (1:1)', dimensions: '1080 x 1080 px' },
  { id: '1920x1080', name: 'Horizontal (16:9)', dimensions: '1920 x 1080 px' },
  { id: '1080x1350', name: 'Retrato (4:5)', dimensions: '1080 x 1350 px' },
]

interface Product {
  id: string
  name: string
  description?: string
}

interface Template {
  id: string
  name: string
  image_url: string
  category: string
  dimensions?: string
}

interface GeneratedSection {
  id: string
  template_id?: string
  generated_image_url: string
  prompt_used: string
  output_size: string
  status: string
  created_at: string
  template?: Template
}

export default function ProductGeneratePage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isOpeningCanva, setIsOpeningCanva] = useState(false)
  
  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [uploadedTemplate, setUploadedTemplate] = useState<string | null>(null)
  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [activeCategory, setActiveCategory] = useState('hero')
  const [selectedInGallery, setSelectedInGallery] = useState<Template | null>(null)
  
  // Product photos
  const [productPhotos, setProductPhotos] = useState<(string | null)[]>([null, null, null])
  
  // Output settings
  const [selectedSize, setSelectedSize] = useState(OUTPUT_SIZES[0])

  // AI Model selection
  const [selectedModel, setSelectedModel] = useState<ImageModelId>('gemini-3-pro-image')
  const [apiKeyStatus, setApiKeyStatus] = useState({
    google: false,
    openai: false,
    bytedance: false,
    bfl: false,
  })

  // Country selection
  const [selectedCountry, setSelectedCountry] = useState<Country>(getDefaultCountry())

  // Pricing controls
  const [pricing, setPricing] = useState<PricingData>(getDefaultPricingData())

  // Creative controls
  const [showCreativeControls, setShowCreativeControls] = useState(false)
  const [creativeControls, setCreativeControls] = useState({
    productDetails: '',
    salesAngle: '',
    targetAvatar: '',
    additionalInstructions: '',
  })

  // Generated sections history
  const [generatedSections, setGeneratedSections] = useState<GeneratedSection[]>([])
  const [isLoadingSections, setIsLoadingSections] = useState(true)

  // Section detail modal
  const [selectedSection, setSelectedSection] = useState<GeneratedSection | null>(null)
  const [showSectionModal, setShowSectionModal] = useState(false)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [editReferenceImage, setEditReferenceImage] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Export to MiniShop editor
  const [selectedForExport, setSelectedForExport] = useState<Map<string, number>>(new Map())
  const [isSendingToEditor, setIsSendingToEditor] = useState(false)

  const templateInputRef = useRef<HTMLInputElement>(null)
  const photoInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const editImageRef = useRef<HTMLInputElement>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchProduct()
    fetchTemplates()
    fetchGeneratedSections()
    fetchApiKeyStatus()
  }, [productId])

  const fetchApiKeyStatus = async () => {
    try {
      const response = await fetch('/api/keys')
      const data = await response.json()
      setApiKeyStatus({
        google: data.hasGoogleApiKey || false,
        openai: data.hasOpenaiApiKey || false,
        bytedance: data.hasKieApiKey || false,
        bfl: data.hasBflApiKey || false,
      })
    } catch (error) {
      console.error('Error fetching API key status:', error)
    }
  }

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      const data = await response.json()
      if (data.product) {
        setProduct(data.product)
      } else {
        toast.error('Producto no encontrado')
        router.push('/dashboard/landing')
      }
    } catch (error) {
      toast.error('Error al cargar producto')
      router.push('/dashboard/landing')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      if (data.templates) {
        setTemplates(data.templates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchGeneratedSections = async () => {
    try {
      const response = await fetch(`/api/products/${productId}/sections`)
      const data = await response.json()
      if (data.sections) {
        setGeneratedSections(data.sections)
      }
    } catch (error) {
      console.error('Error fetching sections:', error)
    } finally {
      setIsLoadingSections(false)
    }
  }

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedTemplate(reader.result as string)
        setSelectedTemplate(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePhotoUpload = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const newPhotos = [...productPhotos]
        newPhotos[index] = reader.result as string
        setProductPhotos(newPhotos)
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = (index: number) => {
    const newPhotos = [...productPhotos]
    newPhotos[index] = null
    setProductPhotos(newPhotos)
  }

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 200
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const filteredTemplates = templates.filter(t => t.category === activeCategory)

  const handleGenerate = async () => {
    if (!selectedTemplate && !uploadedTemplate) {
      toast.error('Selecciona o sube una plantilla')
      return
    }

    if (!productPhotos.some(p => p !== null)) {
      toast.error('Sube al menos una foto del producto')
      return
    }

    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/generate-landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productName: product?.name,
          templateId: selectedTemplate?.id,
          templateUrl: selectedTemplate?.image_url || uploadedTemplate,
          productPhotos: productPhotos.filter(p => p !== null),
          outputSize: selectedSize.id,
          modelId: selectedModel, // Selected AI model ID
          provider: modelIdToProviderType(selectedModel), // Legacy provider type
          // Country
          targetCountry: selectedCountry.code,
          // Pricing (all optional)
          currencySymbol: pricing.currencySymbol,
          priceAfter: pricing.priceAfter,
          priceBefore: pricing.priceBefore,
          priceCombo2: pricing.priceCombo2,
          priceCombo3: pricing.priceCombo3,
          creativeControls: showCreativeControls ? {
            productDetails: creativeControls.productDetails,
            salesAngle: creativeControls.salesAngle,
            targetAvatar: creativeControls.targetAvatar,
            additionalInstructions: creativeControls.additionalInstructions,
          } : {},
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar')
      }

      if (data.success && data.imageUrl) {
        toast.success('¡Sección generada!')
        // Refresh sections list
        fetchGeneratedSections()
      } else {
        // Show error with tip if available
        const errorMsg = data.error || 'No se pudo generar la imagen'
        toast.error(errorMsg, { duration: 5000 })
        if (data.tip) {
          console.log('Tip:', data.tip)
          toast(data.tip, { icon: '💡', duration: 7000 })
        }
        if (data.enhancedPrompt) {
          console.log('Enhanced prompt:', data.enhancedPrompt)
        }
        // If image was generated but not saved, still refresh in case it partially worked
        if (data.imageUrl) {
          fetchGeneratedSections()
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al generar sección')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEnhanceWithAI = async () => {
    if (!selectedTemplate && !uploadedTemplate) {
      toast.error('Primero selecciona una plantilla')
      return
    }
    if (!productPhotos.some(p => p !== null)) {
      toast.error('Primero sube al menos una foto del producto')
      return
    }

    setIsEnhancing(true)
    toast.loading('Analizando con IA...', { id: 'enhance' })

    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUrl: selectedTemplate?.image_url || uploadedTemplate,
          productPhotos: productPhotos.filter(p => p !== null),
          productName: product?.name,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al mejorar')
      }

      // Auto-fill creative controls
      setCreativeControls({
        productDetails: data.suggestions.productDetails || '',
        salesAngle: data.suggestions.salesAngle || '',
        targetAvatar: data.suggestions.targetAvatar || '',
        additionalInstructions: data.suggestions.additionalInstructions || '',
      })
      setShowCreativeControls(true)

      toast.success('¡Campos completados con IA!', { id: 'enhance' })
    } catch (error: any) {
      toast.error(error.message || 'Error al mejorar', { id: 'enhance' })
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleDownload = async (imageUrl: string, quality: '2k' | 'optimized') => {
    try {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `${product?.name}-${quality === '2k' ? '2K' : 'optimized'}-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success(`Descargando en calidad ${quality === '2k' ? '2K' : 'optimizada'}`)
    } catch (error) {
      toast.error('Error al descargar')
    }
  }

  const handleShareWhatsApp = async (section: GeneratedSection) => {
    setIsSharing(true)
    toast.loading('Preparando imagen para WhatsApp...', { id: 'share' })
    
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: section.id,
          imageBase64: section.generated_image_url,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al subir imagen')
      }

      const message = encodeURIComponent(
        `🚀 ¡Mira este banner que generé con IA!\n\n` +
        `📦 Producto: ${product?.name}\n` +
        `🎨 Creado con Estrategas IA\n\n` +
        `${data.publicUrl}`
      )
      
      window.open(`https://wa.me/?text=${message}`, '_blank')
      toast.success('¡Abriendo WhatsApp!', { id: 'share' })
    } catch (error: any) {
      console.error('Share error:', error)
      toast.error(error.message || 'Error al compartir', { id: 'share' })
    } finally {
      setIsSharing(false)
    }
  }

  const handleOpenInCanva = async (section: GeneratedSection) => {
    setIsOpeningCanva(true)
    toast.loading('Conectando con Canva...', { id: 'canva' })

    try {
      // Try to upload directly if we have a token
      const response = await fetch('/api/canva/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: section.generated_image_url,
          sectionId: section.id,
          productName: product?.name,
        }),
      })

      const data = await response.json()

      if (data.needsAuth) {
        // Need to authenticate - redirect to OAuth flow
        toast.loading('Autenticando con Canva...', { id: 'canva' })

        // Store image data in sessionStorage for after OAuth
        sessionStorage.setItem('canva_pending_image', section.generated_image_url)
        sessionStorage.setItem('canva_pending_section', section.id)

        // Redirect to OAuth
        window.location.href = '/api/canva/auth'
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error al conectar con Canva')
      }

      // Success - open Canva editor
      toast.success('¡Abriendo Canva!', { id: 'canva' })
      window.open(data.editUrl, '_blank')
    } catch (error: any) {
      console.error('Canva error:', error)
      toast.error('Error con Canva. Descargando imagen...', { id: 'canva' })

      // Fallback: Download image and open Canva manually
      const link = document.createElement('a')
      link.href = section.generated_image_url
      link.download = `${product?.name || 'banner'}-canva-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.open('https://www.canva.com/create/custom-size', '_blank')

      toast.success('Imagen descargada. Sube la imagen en Canva.', {
        duration: 5000,
        icon: '🎨'
      })
    } finally {
      setIsOpeningCanva(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedSection || !editInstruction.trim()) {
      toast.error('Escribe una instrucción de edición')
      return
    }

    setIsEditing(true)
    
    try {
      const response = await fetch('/api/edit-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: selectedSection.id,
          originalImageUrl: selectedSection.generated_image_url,
          editInstruction,
          referenceImageUrl: editReferenceImage,
          productName: product?.name,
        }),
      })

      const data = await response.json()

      if (data.success && data.imageUrl) {
        toast.success('¡Sección editada!')
        setShowEditModal(false)
        setShowSectionModal(false)
        setEditInstruction('')
        setEditReferenceImage(null)
        fetchGeneratedSections()
      } else {
        throw new Error(data.error || 'Error al editar')
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al editar sección')
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeleteSection = async (sectionId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    if (!confirm('¿Eliminar esta sección?')) return

    // Save previous state for rollback
    const previousSections = generatedSections

    // Optimistic update - remove from UI immediately
    setGeneratedSections(sections => sections.filter(s => s.id !== sectionId))
    setShowSectionModal(false)
    toast.success('Sección eliminada')

    try {
      const response = await fetch(`/api/sections/${sectionId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      console.log('[Frontend] Delete response:', data)

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al eliminar')
      }
    } catch (error: any) {
      // Rollback on error
      console.error('[Frontend] Delete failed, rolling back:', error)
      setGeneratedSections(previousSections)
      toast.error(error.message || 'Error al eliminar sección')
    }
  }

  // Toggle section selection for export
  const toggleSectionExport = (section: GeneratedSection) => {
    setSelectedForExport(prev => {
      const next = new Map(prev)
      if (next.has(section.id)) {
        // Remove and recompute order numbers
        next.delete(section.id)
        let order = 1
        const sorted = [...next.entries()].sort((a, b) => a[1] - b[1])
        const reordered = new Map<string, number>()
        for (const [id] of sorted) {
          reordered.set(id, order++)
        }
        return reordered
      } else {
        next.set(section.id, next.size + 1)
        return next
      }
    })
  }

  const handleSendToEditor = async () => {
    if (selectedForExport.size === 0) return
    setIsSendingToEditor(true)
    try {
      const sections = [...selectedForExport.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([sectionId, order]) => {
          const section = generatedSections.find(s => s.id === sectionId)
          return {
            url: section?.generated_image_url || '',
            category: section?.template?.category || 'sin categoria',
            order,
          }
        })
        .filter(s => s.url)

      const response = await fetch('/api/minishop/import-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al enviar')
      }

      const data = await response.json()
      toast.success('Secciones enviadas al editor')
      setSelectedForExport(new Map())

      // Open MiniShop constructor in new tab
      window.open(data.redirect_url, '_blank')
    } catch (error: any) {
      console.error('Error sending to editor:', error)
      toast.error(error.message || 'Error al enviar secciones')
    } finally {
      setIsSendingToEditor(false)
    }
  }

  // Group sections by category
  const sectionsByCategory = generatedSections.reduce((acc, section) => {
    const category = section.template?.category || 'hero'
    if (!acc[category]) acc[category] = []
    acc[category].push(section)
    return acc
  }, {} as Record<string, GeneratedSection[]>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/landing')}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-sm text-text-secondary flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" />
            Generador de Landings
          </p>
          <h1 className="text-xl font-bold text-text-primary">{product?.name}</h1>
        </div>
      </div>

      {/* Main Content */}
      <Card className="p-6 mb-6">
        {/* Product Photos and Template Row - Horizontal Layout */}
        <div className="flex gap-6 mb-6">
          {/* Product Photos - Left side, horizontal */}
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-text-primary">
                Fotos del Producto
              </label>
              <span className="text-xs text-text-secondary">(1-3 fotos)</span>
            </div>

            <div className="flex gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="w-28 h-28 relative">
                  {productPhotos[index] ? (
                    <div className="w-full h-full rounded-xl overflow-hidden border border-border bg-surface">
                      <img
                        src={productPhotos[index]!}
                        alt={`Producto ${index + 1}`}
                        className="w-full h-full object-contain"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-background/80 rounded-lg hover:bg-error/20 hover:text-error transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => photoInputRefs[index].current?.click()}
                      className="w-full h-full rounded-xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent/5 transition-colors flex flex-col items-center justify-center"
                    >
                      <ImageIcon className="w-6 h-6 text-text-secondary/40 mb-1" />
                      <span className="text-xs text-text-secondary">{index + 1}</span>
                    </button>
                  )}
                  <input
                    ref={photoInputRefs[index]}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload(index)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Template Selector - Right side, takes remaining space */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-text-primary">
                Plantilla de Referencia
              </label>
            </div>

            <div className="relative h-28 bg-gradient-to-br from-surface to-background rounded-xl border border-border overflow-hidden">
              {selectedTemplate || uploadedTemplate ? (
                <>
                  {/* Dimensions badge */}
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white">
                    {selectedTemplate?.dimensions || 'Custom'}
                  </div>

                  <img
                    src={uploadedTemplate || selectedTemplate?.image_url}
                    alt="Template"
                    className="w-full h-full object-contain"
                  />

                  {/* Change template button */}
                  <button
                    onClick={() => setShowTemplateGallery(true)}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-accent hover:bg-accent-hover text-background px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cambiar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowTemplateGallery(true)}
                  className="w-full h-full flex items-center justify-center gap-3 hover:bg-accent/5 transition-colors"
                >
                  <LayoutTemplate className="w-8 h-8 text-accent/40" />
                  <div className="text-left">
                    <p className="text-text-primary font-medium text-sm">Seleccionar Plantilla</p>
                    <p className="text-xs text-text-secondary">de la Galería de Diseños</p>
                  </div>
                </button>
              )}
            </div>

            {/* Upload Reference Image Button - Zepol gradient style */}
            <button
              onClick={() => templateInputRef.current?.click()}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500"
            >
              <Upload className="w-4 h-4" />
              Subir imagen de referencia
            </button>
            <input
              ref={templateInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTemplateUpload}
            />
          </div>
        </div>

        {/* AI Model Selection */}
        <div className="mb-6">
          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={isGenerating}
            apiKeyStatus={apiKeyStatus}
          />
        </div>

        {/* Country Selector */}
        <div className="mb-6">
          <CountrySelector
            value={selectedCountry.code}
            onChange={(country) => {
              setSelectedCountry(country)
              // Update currency symbol when country changes
              setPricing(prev => ({ ...prev, currencySymbol: country.currencySymbol }))
            }}
            disabled={isGenerating}
          />
        </div>

        {/* Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Output Size */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              📐 Tamaño de Salida
            </label>
            <div className="relative">
              <select
                value={selectedSize.id}
                onChange={(e) => setSelectedSize(OUTPUT_SIZES.find(s => s.id === e.target.value) || OUTPUT_SIZES[0])}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              >
                {OUTPUT_SIZES.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
            </div>
            <p className="text-xs text-text-secondary mt-1">{selectedSize.dimensions}</p>
          </div>

          {/* Language */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              🌐 Idioma de Salida
            </label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                defaultValue="es"
              >
                <option value="es">Español</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Creative Controls */}
        <div className="border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-text-primary">
                Controles Creativos <span className="text-text-secondary font-normal">(Opcional)</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnhanceWithAI}
                disabled={isEnhancing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isEnhancing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Mejorar con IA
              </button>
              <button
                onClick={() => setShowCreativeControls(!showCreativeControls)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  showCreativeControls ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  showCreativeControls ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          {showCreativeControls && (
            <div className="mt-6 space-y-4">
              {/* Product Details */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                    📄 Detalles del Producto
                  </label>
                  <span className="text-xs text-text-secondary">Máx. 500 caracteres</span>
                </div>
                <textarea
                  placeholder="Describe las características, beneficios y detalles importantes del producto..."
                  value={creativeControls.productDetails}
                  onChange={(e) => setCreativeControls({ ...creativeControls, productDetails: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Sales Angle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                    📈 Ángulo de Venta
                  </label>
                </div>
                <textarea
                  placeholder="Ejemplo: Potenciador de testosterona para hombres fitness"
                  value={creativeControls.salesAngle}
                  onChange={(e) => setCreativeControls({ ...creativeControls, salesAngle: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Target Avatar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                    🎯 Avatar de Cliente Ideal
                  </label>
                </div>
                <textarea
                  placeholder="Ejemplo: Hombres 25-45 años, van al gimnasio, quieren aumentar masa muscular"
                  value={creativeControls.targetAvatar}
                  onChange={(e) => setCreativeControls({ ...creativeControls, targetAvatar: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Additional Instructions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                    💬 Instrucciones Adicionales
                  </label>
                </div>
                <textarea
                  placeholder="Cualquier instrucción específica para la generación..."
                  value={creativeControls.additionalInstructions}
                  onChange={(e) => setCreativeControls({ ...creativeControls, additionalInstructions: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pricing Controls */}
        <div className="border border-accent/30 bg-accent/5 rounded-xl p-4 mb-6">
          <PricingControls
            value={pricing}
            onChange={setPricing}
            disabled={isGenerating}
          />
        </div>

        {/* Generate Button */}
        <Button
          className="w-full gap-2 py-4 text-base"
          onClick={handleGenerate}
          isLoading={isGenerating}
        >
          <Sparkles className="w-5 h-5" />
          Generar Sección
        </Button>

        <p className="text-center text-sm text-text-secondary mt-3">
          {generatedSections.length} de 5 secciones utilizadas este periodo
        </p>
      </Card>

      {/* Generated Sections History */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">Secciones Generadas</h2>
        
        {isLoadingSections ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : generatedSections.length === 0 ? (
          <Card className="p-8 text-center">
            <ImageIcon className="w-12 h-12 text-accent/30 mx-auto mb-3" />
            <p className="text-text-secondary">Aún no has generado secciones</p>
            <p className="text-sm text-text-secondary/70">Selecciona una plantilla y genera tu primera sección</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(sectionsByCategory).map(([category, sections]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-text-primary capitalize">{category}</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {sections.map((section) => {
                    const exportOrder = selectedForExport.get(section.id)
                    const isSelected = exportOrder !== undefined
                    return (
                    <div key={section.id} className="flex flex-col">
                      {/* Thumbnail - Clickable to open modal */}
                      <div
                        className="relative cursor-pointer aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all bg-surface"
                        style={{
                          borderColor: isSelected ? 'var(--color-accent, #7c3aed)' : 'transparent',
                        }}
                      >
                        <div
                          onClick={() => {
                            setSelectedSection(section)
                            setShowSectionModal(true)
                          }}
                        >
                          <img
                            src={section.generated_image_url}
                            alt="Seccion generada"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* Selection badge */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSectionExport(section)
                          }}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-accent text-white shadow-lg'
                              : 'bg-black/40 text-white/80 hover:bg-black/60'
                          }`}
                        >
                          {isSelected ? exportOrder : <Check className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Action buttons below thumbnail */}
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <button
                          onClick={() => {
                            setSelectedSection(section)
                            setShowSectionModal(true)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg hover:border-accent/50 hover:bg-accent/5 transition-colors text-sm text-text-secondary hover:text-text-primary"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Ver Banner</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteSection(section.id, e)}
                          className="p-1.5 bg-surface border border-border rounded-lg hover:border-error/50 hover:bg-error/10 hover:text-error transition-colors text-text-secondary"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowTemplateGallery(false)}
          />
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-surface rounded-2xl overflow-hidden z-10 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <LayoutTemplate className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-text-primary">Galería de Diseños</h2>
              </div>
              <button
                onClick={() => setShowTemplateGallery(false)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="relative border-b border-border shrink-0">
              <button
                onClick={() => scrollCategories('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-surface text-text-secondary hover:text-text-primary"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div 
                ref={categoryScrollRef}
                className="flex gap-1 overflow-x-auto scrollbar-hide px-10 py-2"
              >
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-accent text-background'
                        : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <button
                onClick={() => scrollCategories('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-surface text-text-secondary hover:text-text-primary"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <LayoutTemplate className="w-12 h-12 text-accent/30 mx-auto mb-3" />
                  <p className="text-text-secondary">No hay plantillas en esta categoría aún</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedInGallery(template)}
                      className={`group relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                        selectedInGallery?.id === template.id
                          ? 'border-accent ring-2 ring-accent/30'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <img
                        src={template.image_url}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedInGallery?.id === template.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-background" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between shrink-0">
              <p className="text-sm text-text-secondary">
                Haz clic en un template para seleccionarlo
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowTemplateGallery(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (selectedInGallery) {
                      setSelectedTemplate(selectedInGallery)
                      setUploadedTemplate(null)
                      setShowTemplateGallery(false)
                    }
                  }}
                  disabled={!selectedInGallery}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  Usar Este Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Detail Modal */}
      {showSectionModal && selectedSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSectionModal(false)}
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-surface rounded-2xl overflow-hidden z-10 flex">
            {/* Left side - Options */}
            <div className="w-80 border-r border-border p-6 flex flex-col shrink-0">
              <h2 className="text-xl font-bold text-text-primary mb-6">Sección generada</h2>
              
              <div className="space-y-3 flex-1">
                {/* Download 2K */}
                <button
                  onClick={() => handleDownload(selectedSection.generated_image_url, '2k')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <Download className="w-5 h-5 text-text-secondary" />
                  <span className="text-text-primary">Descargar en 2K</span>
                </button>

                {/* Download Optimized */}
                <button
                  onClick={() => handleDownload(selectedSection.generated_image_url, 'optimized')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <Download className="w-5 h-5 text-text-secondary" />
                  <span className="text-text-primary">Descargar optimizada</span>
                </button>

                {/* Edit Section */}
                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <Edit3 className="w-5 h-5 text-text-secondary" />
                  <span className="text-text-primary">Editar Sección</span>
                </button>

                {/* Edit in Canva */}
                <button
                  onClick={() => handleOpenInCanva(selectedSection)}
                  disabled={isOpeningCanva}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl hover:from-purple-500/20 hover:to-pink-500/20 transition-colors disabled:opacity-50"
                >
                  {isOpeningCanva ? (
                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                  ) : (
                    <ExternalLink className="w-5 h-5 text-purple-500" />
                  )}
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent font-medium">
                    {isOpeningCanva ? 'Conectando...' : 'Editar en Canva'}
                  </span>
                </button>

                {/* Share WhatsApp */}
                <button
                  onClick={() => handleShareWhatsApp(selectedSection)}
                  disabled={isSharing}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500">Compartir por WhatsApp</span>
                </button>
              </div>

              {/* Reference Template */}
              {selectedSection.template && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-sm text-text-secondary mb-2">Referencia</p>
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border">
                    <img
                      src={selectedSection.template.image_url}
                      alt="Template"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Image Preview */}
            <div className="flex-1 p-6 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium capitalize">
                  {selectedSection.template?.category || 'Hero'} Section
                </span>
                <button
                  onClick={() => setShowSectionModal(false)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 flex items-center justify-center bg-background rounded-xl overflow-hidden">
                <img
                  src={selectedSection.generated_image_url}
                  alt="Sección generada"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom bar — Send to Editor */}
      {selectedForExport.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-64">
          <div className="mx-auto max-w-4xl px-4 pb-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-surface/95 px-6 py-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10">
                  <Send className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {selectedForExport.size} {selectedForExport.size === 1 ? 'seccion seleccionada' : 'secciones seleccionadas'}
                  </p>
                  <p className="text-xs text-text-secondary">Se enviaran a tu editor MiniShop</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedForExport(new Map())}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendToEditor}
                  disabled={isSendingToEditor}
                  className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isSendingToEditor ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar a mi editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-surface rounded-2xl overflow-hidden z-10 flex">
            {/* Left side - Edit Form */}
            <div className="w-80 border-r border-border p-6 flex flex-col shrink-0">
              <h2 className="text-xl font-bold text-text-primary mb-2">Editar Sección</h2>
              
              {/* Edit Instruction */}
              <div className="mb-4">
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  Instrucción de edición:
                </label>
                <textarea
                  placeholder="Describe cómo quieres editar la sección..."
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={4}
                />
              </div>

              {/* Reference Image Upload */}
              <div className="mb-6">
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  Imagen de referencia (opcional):
                </label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center">
                  {editReferenceImage ? (
                    <div className="relative">
                      <img
                        src={editReferenceImage}
                        alt="Referencia"
                        className="w-full aspect-video object-contain rounded-lg"
                      />
                      <button
                        onClick={() => setEditReferenceImage(null)}
                        className="absolute top-2 right-2 p-1 bg-background/80 rounded hover:bg-error/20 hover:text-error"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => editImageRef.current?.click()}
                      className="flex flex-col items-center py-4 hover:text-accent transition-colors"
                    >
                      <Upload className="w-8 h-8 text-text-secondary/40 mb-2" />
                      <span className="text-sm text-text-secondary">Subir una imagen</span>
                    </button>
                  )}
                  <input
                    ref={editImageRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setEditReferenceImage(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-auto">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEdit}
                  isLoading={isEditing}
                >
                  Aplicar Edición
                </Button>
              </div>
            </div>

            {/* Right side - Image Preview */}
            <div className="flex-1 p-6 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm font-medium capitalize">
                  {selectedSection.template?.category || 'Hero'} Section
                </span>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 flex items-center justify-center bg-background rounded-xl overflow-hidden">
                <img
                  src={selectedSection.generated_image_url}
                  alt="Sección generada"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
