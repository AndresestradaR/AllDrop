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
  Send,
  Palette,
  FileText,
  Lightbulb,
  Target,
  RefreshCw,
  Plus,
  Bookmark
} from 'lucide-react'
import toast from 'react-hot-toast'
import ModelSelector from '@/components/generator/ModelSelector'
import { SavedAnglesPanel } from '@/components/studio/SavedAnglesPanel'
import CountrySelector from '@/components/generator/CountrySelector'
import PricingControls, { PricingData, getDefaultPricingData } from '@/components/generator/PricingControls'
import { ImageModelId, modelIdToProviderType } from '@/lib/image-providers/types'
import { Country, getDefaultCountry } from '@/lib/constants/countries'

export const dynamic = 'force-dynamic'

const TEMPLATE_CATEGORIES = [
  { id: 'hero', name: 'Hero', icon: '🏠', description: 'Banner principal con headline impactante' },
  { id: 'oferta', name: 'Oferta', icon: '🏷️', description: 'Precios, descuentos, combos' },
  { id: 'antes-despues', name: 'Antes/Después', icon: '🔄', description: 'Transformacion visual del resultado' },
  { id: 'beneficios', name: 'Beneficios', icon: '✅', description: '3-4 beneficios con iconos' },
  { id: 'tabla-comparativa', name: 'Comparativa', icon: '📊', description: 'Tu producto vs competencia' },
  { id: 'autoridad', name: 'Autoridad', icon: '🏆', description: 'Certificaciones, estudios, respaldo' },
  { id: 'testimonios', name: 'Testimonios', icon: '💬', description: 'Reviews y opiniones de clientes' },
  { id: 'ingredientes', name: 'Ingredientes', icon: '🧪', description: 'Componentes, materiales, formula' },
  { id: 'modo-uso', name: 'Modo de Uso', icon: '📋', description: 'Pasos 1-2-3 de como usar' },
  { id: 'logistica', name: 'Logística', icon: '🚚', description: 'Envio gratis, contraentrega, tiempos' },
  { id: 'faq', name: 'FAQ', icon: '❓', description: 'Preguntas frecuentes' },
  { id: 'casos-uso', name: 'Casos de Uso', icon: '💡', description: 'Situaciones reales donde se usa el producto' },
  { id: 'caracteristicas', name: 'Características', icon: '⚙️', description: 'Especificaciones y features del producto' },
  { id: 'comunidad', name: 'Comunidad', icon: '👥', description: 'Social proof, comunidad de usuarios' },
]

const OUTPUT_SIZES = [
  { id: '1080x1920', name: 'Vertical (9:16)', dimensions: '1080 x 1920 px' },
  { id: '1080x1080', name: 'Cuadrada (1:1)', dimensions: '1080 x 1080 px' },
  { id: '1920x1080', name: 'Horizontal (16:9)', dimensions: '1920 x 1080 px' },
  { id: '1080x1350', name: 'Retrato (4:5)', dimensions: '1080 x 1350 px' },
]

const FONT_CATALOG = [
  { id: 'montserrat', name: 'Montserrat', category: 'Sans-serif', promptDesc: 'Montserrat: sans-serif geometrica, bold, moderna, trazos limpios y contundentes' },
  { id: 'opensans', name: 'Open Sans', category: 'Sans-serif', promptDesc: 'Open Sans: sans-serif humanista, limpia, muy legible, profesional y neutral' },
  { id: 'poppins', name: 'Poppins', category: 'Sans-serif', promptDesc: 'Poppins: sans-serif geometrica con bordes redondeados, amigable, moderna, juvenil' },
  { id: 'roboto', name: 'Roboto', category: 'Sans-serif', promptDesc: 'Roboto: sans-serif neo-grotesca, mecanica pero amigable, versatil y moderna' },
  { id: 'inter', name: 'Inter', category: 'Sans-serif', promptDesc: 'Inter: sans-serif disenada para pantallas, limpia, neutra, excelente legibilidad' },
  { id: 'lato', name: 'Lato', category: 'Sans-serif', promptDesc: 'Lato: sans-serif semi-redondeada, calida pero estable, profesional y amigable' },
  { id: 'nunito', name: 'Nunito', category: 'Sans-serif', promptDesc: 'Nunito: sans-serif redondeada, suave, amigable, ideal para productos de bienestar' },
  { id: 'oswald', name: 'Oswald', category: 'Sans-serif', promptDesc: 'Oswald: sans-serif condensada, fuerte, deportiva, impactante en titulos grandes' },
  { id: 'raleway', name: 'Raleway', category: 'Sans-serif', promptDesc: 'Raleway: sans-serif elegante con trazos finos, sofisticada y moderna' },
  { id: 'bebas-neue', name: 'Bebas Neue', category: 'Sans-serif', promptDesc: 'Bebas Neue: sans-serif condensada todo mayusculas, dramatica, impactante, estilo poster' },
  { id: 'playfair', name: 'Playfair Display', category: 'Serif', promptDesc: 'Playfair Display: serif con alto contraste, elegante, sofisticada, premium' },
  { id: 'merriweather', name: 'Merriweather', category: 'Serif', promptDesc: 'Merriweather: serif disenada para pantallas, alta legibilidad, seria y profesional' },
  { id: 'lora', name: 'Lora', category: 'Serif', promptDesc: 'Lora: serif caligrafica contemporanea, elegante pero accesible' },
  { id: 'dm-serif', name: 'DM Serif Display', category: 'Serif', promptDesc: 'DM Serif Display: serif con personalidad, moderna pero clasica, excelente para titulos' },
  { id: 'archivo-black', name: 'Archivo Black', category: 'Sans-serif', promptDesc: 'Archivo Black: sans-serif extra bold, contundente, maxima presencia visual en titulos' },
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
  section_type?: string
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
  const [selectedModel, setSelectedModel] = useState<ImageModelId>('nano-banana-2')
  const [apiKeyStatus, setApiKeyStatus] = useState({
    google: false,
    openai: false,
    bytedance: false,
    bfl: false,
    fal: false,
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

  // Product context (Phase 2)
  const [showProductContext, setShowProductContext] = useState(false)
  const [productContext, setProductContext] = useState({
    description: '',
    benefits: '',
    problems: '',
    ingredients: '',
    differentiator: '',
  })

  // AI Angles
  const [isGeneratingAngles, setIsGeneratingAngles] = useState(false)
  const [generatedAngles, setGeneratedAngles] = useState<Array<{
    id: string
    name: string
    hook: string
    description: string
    avatarSuggestion: string
    tone: string
    salesAngle: string
  }>>([])
  const [selectedAngleIds, setSelectedAngleIds] = useState<Set<string>>(new Set())
  const [anglesAiMeta, setAnglesAiMeta] = useState<{ provider: string; fallbacks?: string[] } | null>(null)

  // Saved angles
  const [isSavingAngles, setIsSavingAngles] = useState(false)
  const [showSavedAngles, setShowSavedAngles] = useState(false)

  // Manual angle creation
  const [showAddAngleForm, setShowAddAngleForm] = useState(false)
  const [newAngle, setNewAngle] = useState({
    name: '', hook: '', salesAngle: '', avatarSuggestion: '', tone: 'Emocional' as string
  })

  // Landing sections selection (Phase 3)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(['hero', 'oferta', 'beneficios', 'testimonios', 'logistica'])
  )
  const [sectionTemplates, setSectionTemplates] = useState<Record<string, Template | null>>({})

  // Bulk generation
  const [isBulkGenerating, setIsBulkGenerating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentLabel: '' })

  // Color palette
  const [colorCount, setColorCount] = useState<3 | 4>(3)
  const [colorPalette, setColorPalette] = useState({
    primary: '#0F172A',
    secondary: '#3B82F6',
    accent: '#10B981',
    extra: '#F59E0B',
  })

  // Typography
  const [selectedFonts, setSelectedFonts] = useState({
    headings: 'montserrat',
    subheadings: 'opensans',
    body: 'opensans',
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
    // Load persisted product context
    fetch(`/api/products/context?productId=${productId}`)
      .then(r => r.json())
      .then(data => {
        if (data.context) {
          setProductContext(data.context)
          setShowProductContext(true)
        }
      })
      .catch(() => {}) // Silently fail — column might not exist yet
  }, [productId])

  // Auto-save product context with debounce (1.5s after last change)
  const contextSaveTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    // Skip if all fields are empty (initial state)
    const hasContent = Object.values(productContext).some(v => v.trim() !== '')
    if (!hasContent) return

    if (contextSaveTimer.current) clearTimeout(contextSaveTimer.current)
    contextSaveTimer.current = setTimeout(() => {
      console.log('[ProductContext] Auto-saving...', { productId, context: productContext })
      fetch('/api/products/context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, context: productContext }),
      })
        .then(r => r.json())
        .then(d => console.log('[ProductContext] Save result:', d))
        .catch(e => console.error('[ProductContext] Save error:', e))
    }, 1500)

    return () => { if (contextSaveTimer.current) clearTimeout(contextSaveTimer.current) }
  }, [productContext, productId])

  // Retry Canva upload after OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('canva_success') !== 'true') return

    const pendingUrl = sessionStorage.getItem('canva_pending_url')
    const pendingSectionId = sessionStorage.getItem('canva_pending_section')

    // Clean up URL param
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('canva_success')
    window.history.replaceState({}, '', newUrl.toString())

    if (pendingUrl && pendingSectionId) {
      sessionStorage.removeItem('canva_pending_url')
      sessionStorage.removeItem('canva_pending_section')

      toast.loading('Subiendo imagen a Canva...', { id: 'canva' })
      uploadToCanva(pendingUrl, pendingSectionId, product?.name)
        .then((editUrl) => {
          if (editUrl) {
            // Can't window.open here (popup blocker), so copy to clipboard
            navigator.clipboard?.writeText(editUrl).catch(() => {})
            toast.success('Canva listo! Haz clic en "Editar en Canva" de nuevo.', { id: 'canva', duration: 5000 })
          }
        })
        .catch(() => {
          toast.error('No se pudo subir a Canva. Intenta de nuevo.', { id: 'canva' })
        })
    } else {
      toast.success('Canva conectado. Haz clic en "Editar en Canva" de nuevo.', { id: 'canva', duration: 4000 })
    }
  }, [])

  // Load Google Fonts for typography preview
  useEffect(() => {
    const fontFamilies = FONT_CATALOG.map(f => f.name.replace(/ /g, '+')).join('&family=')
    const link = document.createElement('link')
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const fetchApiKeyStatus = async () => {
    try {
      const response = await fetch('/api/keys')
      const data = await response.json()
      setApiKeyStatus({
        google: data.hasGoogleApiKey || false,
        openai: data.hasOpenaiApiKey || false,
        bytedance: data.hasKieApiKey || false,
        bfl: data.hasBflApiKey || false,
        fal: data.hasFalApiKey || false,
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
          colorPalette: {
            ...colorPalette,
            extra: colorCount === 4 ? colorPalette.extra : undefined,
          },
          typography: {
            headings: FONT_CATALOG.find(f => f.id === selectedFonts.headings)?.promptDesc || '',
            subheadings: FONT_CATALOG.find(f => f.id === selectedFonts.subheadings)?.promptDesc || '',
            body: FONT_CATALOG.find(f => f.id === selectedFonts.body)?.promptDesc || '',
          },
          productContext: showProductContext ? productContext : {},
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
          productContext: showProductContext ? productContext : {},
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

      // Auto-save product context if empty — so video tools can reuse it
      const hasExistingContext = Object.values(productContext).some(v => v.trim() !== '')
      if (!hasExistingContext && data.suggestions.productDetails) {
        const autoContext = {
          description: data.suggestions.productDetails || '',
          benefits: '',
          problems: '',
          ingredients: '',
          differentiator: '',
        }
        setProductContext(autoContext)
        setShowProductContext(true)
      }

      toast.success('¡Campos completados con IA!', { id: 'enhance' })
    } catch (error: any) {
      toast.error(error.message || 'Error al mejorar', { id: 'enhance' })
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleBulkGenerate = async () => {
    if (selectedAngleIds.size === 0) {
      toast.error('Selecciona al menos un angulo')
      return
    }
    if (selectedSections.size === 0) {
      toast.error('Selecciona al menos una seccion')
      return
    }
    if (!productPhotos.some(p => p !== null)) {
      toast.error('Sube al menos una foto del producto')
      return
    }

    const mainTemplate = selectedTemplate?.image_url || uploadedTemplate
    const sectionsWithoutTemplate = Array.from(selectedSections).filter(
      sectionId => !sectionTemplates[sectionId] && !mainTemplate
    )
    if (sectionsWithoutTemplate.length > 0) {
      toast.error('Asigna una plantilla a cada seccion o sube una imagen de referencia principal')
      return
    }

    setIsBulkGenerating(true)
    const selectedAngles = generatedAngles.filter(a => selectedAngleIds.has(a.id))
    const sections = Array.from(selectedSections)
    const totalBanners = selectedAngles.length * sections.length
    setBulkProgress({ current: 0, total: totalBanners, currentLabel: 'Preparando...' })

    let completed = 0
    let failed = 0

    const CONCURRENT_LIMIT = 1 // Sequential: KIE rate limits concurrent requests
    const tasks: Array<{ angle: typeof selectedAngles[0]; sectionId: string }> = []

    for (const angle of selectedAngles) {
      for (const sectionId of sections) {
        tasks.push({ angle, sectionId })
      }
    }

    for (let i = 0; i < tasks.length; i += CONCURRENT_LIMIT) {
      const chunk = tasks.slice(i, i + CONCURRENT_LIMIT)

      const promises = chunk.map(async ({ angle, sectionId }) => {
        const sectionName = TEMPLATE_CATEGORIES.find(c => c.id === sectionId)?.name || sectionId
        setBulkProgress(prev => ({
          ...prev,
          currentLabel: `${angle.name} — ${sectionName}`,
        }))

        try {
          const sectionTemplate = sectionTemplates[sectionId]
          const templateUrl = sectionTemplate?.image_url || mainTemplate

          const response = await fetch('/api/generate-landing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId,
              productName: product?.name,
              templateId: sectionTemplate?.id || selectedTemplate?.id,
              templateUrl,
              productPhotos: productPhotos.filter(p => p !== null),
              outputSize: selectedSize.id,
              modelId: selectedModel,
              provider: modelIdToProviderType(selectedModel),
              targetCountry: selectedCountry.code,
              currencySymbol: pricing.currencySymbol,
              priceAfter: pricing.priceAfter,
              priceBefore: pricing.priceBefore,
              priceCombo2: pricing.priceCombo2,
              priceCombo3: pricing.priceCombo3,
              creativeControls: {
                productDetails: creativeControls.productDetails,
                salesAngle: angle.salesAngle,
                targetAvatar: angle.avatarSuggestion,
                additionalInstructions: creativeControls.additionalInstructions,
                sectionType: sectionId,
                angleName: angle.name,
                angleTone: angle.tone,
              },
              colorPalette: {
                ...colorPalette,
                extra: colorCount === 4 ? colorPalette.extra : undefined,
              },
              typography: {
                headings: FONT_CATALOG.find(f => f.id === selectedFonts.headings)?.promptDesc || '',
                subheadings: FONT_CATALOG.find(f => f.id === selectedFonts.subheadings)?.promptDesc || '',
                body: FONT_CATALOG.find(f => f.id === selectedFonts.body)?.promptDesc || '',
              },
              productContext: showProductContext ? productContext : {},
            }),
          })

          const data = await response.json()
          if (data.success) {
            completed++
          } else {
            failed++
            console.error(`[Bulk] Failed: ${angle.name} - ${sectionName}:`, data.error)
          }
        } catch (error: any) {
          failed++
          console.error(`[Bulk] Error: ${angle.name} - ${sectionName}:`, error.message)
        }

        setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }))
      })

      await Promise.allSettled(promises)
    }

    setIsBulkGenerating(false)
    fetchGeneratedSections()

    if (failed === 0) {
      toast.success(`${completed} banners generados exitosamente!`)
    } else {
      toast.success(`${completed} banners generados, ${failed} fallaron`)
    }
  }

  const handleGenerateAngles = async () => {
    if (!productPhotos.some(p => p !== null)) {
      toast.error('Sube al menos una foto del producto')
      return
    }

    // Force-save product context before generating angles
    const ctxToSave = showProductContext ? productContext : {}
    const hasCtx = Object.values(ctxToSave).some(v => typeof v === 'string' && v.trim() !== '')
    if (hasCtx) {
      try {
        await fetch('/api/products/context', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, context: ctxToSave }),
        })
        console.log('[ProductContext] Forced save before angle generation')
      } catch {}
    }

    setIsGeneratingAngles(true)

    try {
      const response = await fetch('/api/generate-angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product?.name,
          productPhotos: productPhotos.filter(p => p !== null),
          productContext: showProductContext ? productContext : {},
          targetCountry: selectedCountry.code,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al generar angulos')
      }

      setGeneratedAngles(data.angles)
      setSelectedAngleIds(new Set())
      setAnglesAiMeta(data._ai || null)
      toast.success(`${data.angles.length} angulos generados!`)
    } catch (error: any) {
      toast.error(error.message || 'Error al generar angulos')
    } finally {
      setIsGeneratingAngles(false)
    }
  }

  const handleSelectAngle = (angle: typeof generatedAngles[0]) => {
    setSelectedAngleIds(prev => {
      const next = new Set(prev)
      if (next.has(angle.id)) {
        next.delete(angle.id)
      } else {
        if (next.size >= 4) {
          toast.error('Maximo 4 angulos')
          return prev
        }
        next.add(angle.id)
      }
      return next
    })

    // Auto-fill creative controls with the LAST selected angle
    setCreativeControls(prev => ({
      ...prev,
      salesAngle: angle.salesAngle,
      targetAvatar: angle.avatarSuggestion,
    }))
    setShowCreativeControls(true)
  }

  const handleAddManualAngle = () => {
    if (!newAngle.name.trim() || !newAngle.salesAngle.trim()) {
      toast.error('Nombre y angulo de venta son requeridos')
      return
    }

    const manualAngle = {
      id: `manual-${Date.now()}`,
      name: newAngle.name.trim(),
      hook: newAngle.hook.trim() || newAngle.salesAngle.trim().substring(0, 60),
      description: `Angulo manual: ${newAngle.salesAngle.trim()}`,
      avatarSuggestion: newAngle.avatarSuggestion.trim() || 'Publico general',
      tone: newAngle.tone,
      salesAngle: newAngle.salesAngle.trim(),
    }

    setGeneratedAngles(prev => [...prev, manualAngle])
    setNewAngle({ name: '', hook: '', salesAngle: '', avatarSuggestion: '', tone: 'Emocional' })
    setShowAddAngleForm(false)
    toast.success(`Angulo "${manualAngle.name}" agregado`)
  }

  const handleSaveAngles = async () => {
    if (generatedAngles.length === 0 || !product?.name) return
    setIsSavingAngles(true)
    try {
      const res = await fetch('/api/studio/saved-angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          angles: generatedAngles,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.count} angulos guardados para "${product.name}"`)
      } else {
        toast.error(data.error || 'Error al guardar angulos')
      }
    } catch {
      toast.error('Error al guardar angulos')
    } finally {
      setIsSavingAngles(false)
    }
  }

  const renderAddAngleForm = () => (
    <div className="p-3 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 space-y-2">
      <input
        type="text"
        placeholder="Nombre del angulo (ej: Urgencia)"
        value={newAngle.name}
        onChange={(e) => setNewAngle(prev => ({ ...prev, name: e.target.value }))}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none"
      />
      <textarea
        placeholder="Angulo de venta / mensaje principal"
        value={newAngle.salesAngle}
        onChange={(e) => setNewAngle(prev => ({ ...prev, salesAngle: e.target.value }))}
        rows={2}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none resize-none"
      />
      <input
        type="text"
        placeholder="Avatar / publico objetivo (opcional)"
        value={newAngle.avatarSuggestion}
        onChange={(e) => setNewAngle(prev => ({ ...prev, avatarSuggestion: e.target.value }))}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none"
      />
      <select
        value={newAngle.tone}
        onChange={(e) => setNewAngle(prev => ({ ...prev, tone: e.target.value }))}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none"
      >
        <option value="Emocional">Emocional</option>
        <option value="Racional">Racional</option>
        <option value="Urgencia">Urgencia</option>
        <option value="Aspiracional">Aspiracional</option>
        <option value="Social Proof">Social Proof</option>
        <option value="Educativo">Educativo</option>
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleAddManualAngle}
          className="flex-1 text-sm py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
        >
          Agregar angulo
        </button>
        <button
          onClick={() => { setShowAddAngleForm(false); setNewAngle({ name: '', hook: '', salesAngle: '', avatarSuggestion: '', tone: 'Emocional' }) }}
          className="px-3 text-sm py-2 rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )

  const handleDownload = async (imageUrl: string, quality: '2k' | 'optimized') => {
    try {
      toast.loading('Preparando descarga...', { id: 'download' })

      // Fetch image as blob to bypass cross-origin download restriction
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error('No se pudo obtener la imagen')
      const blob = await response.blob()

      let downloadBlob = blob
      let extension = 'png'

      if (quality === 'optimized') {
        // Compress using canvas: resize to max 1080px width, convert to JPEG quality 0.82
        try {
          const imageBitmap = await createImageBitmap(blob)
          const MAX_WIDTH = 1080
          let width = imageBitmap.width
          let height = imageBitmap.height

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width)
            width = MAX_WIDTH
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(imageBitmap, 0, 0, width, height)

          downloadBlob = await new Promise<Blob>((resolve) => {
            canvas.toBlob(
              (b) => resolve(b || blob),
              'image/jpeg',
              0.82
            )
          })
          extension = 'jpg'
        } catch {
          // If canvas fails, download original
          downloadBlob = blob
        }
      }

      // Create object URL and trigger download
      const url = URL.createObjectURL(downloadBlob)
      const link = document.createElement('a')
      link.href = url
      const safeName = (product?.name || 'banner').replace(/[^a-zA-Z0-9_-]/g, '_')
      link.download = `${safeName}-${quality === '2k' ? '2K' : 'optimizado'}-${Date.now()}.${extension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const sizeMB = (downloadBlob.size / 1024 / 1024).toFixed(1)
      toast.success(
        quality === '2k'
          ? `Descargado en calidad original (${sizeMB} MB)`
          : `Descargado optimizado (${sizeMB} MB)`,
        { id: 'download' }
      )
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Error al descargar. Intenta de nuevo.', { id: 'download' })
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

  const uploadToCanva = async (imageUrl: string, sectionId: string, name?: string) => {
    let data: any
    try {
      const response = await fetch('/api/canva/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          sectionId,
          productName: name,
        }),
      })

      data = await response.json()
      console.log('[Canva] upload response:', response.status, data)
    } catch (fetchErr) {
      console.error('[Canva] fetch failed:', fetchErr)
      throw new Error('No se pudo conectar con el servidor de Canva')
    }

    if (data.needsAuth) {
      // Store pending data for retry after OAuth
      sessionStorage.setItem('canva_pending_url', imageUrl)
      sessionStorage.setItem('canva_pending_section', sectionId)

      // Redirect to OAuth with return URL
      toast.loading('Autenticando con Canva...', { id: 'canva' })
      window.location.href = `/api/canva/auth?returnUrl=${encodeURIComponent(window.location.pathname)}`
      // Wait for navigation to complete so caller doesn't proceed
      await new Promise(() => {})
    }

    if (!data.success) {
      throw new Error(data.error || 'Error al conectar con Canva')
    }

    return data.editUrl as string
  }

  const handleOpenInCanva = async (section: GeneratedSection) => {
    setIsOpeningCanva(true)
    toast.loading('Subiendo imagen a Canva...', { id: 'canva' })

    // Open window NOW (synchronous with user click) to avoid popup blocker
    const canvaWindow = window.open('about:blank', '_blank')

    try {
      const editUrl = await uploadToCanva(
        section.generated_image_url,
        section.id,
        product?.name
      )

      if (editUrl) {
        toast.success('Abriendo Canva!', { id: 'canva' })
        if (canvaWindow) {
          canvaWindow.location.href = editUrl
        } else {
          window.open(editUrl, '_blank')
        }
      } else {
        // OAuth redirect in progress, close blank tab
        canvaWindow?.close()
      }
    } catch (error: any) {
      console.error('Canva upload error:', error?.message || error)
      canvaWindow?.close()
      toast.error(`Error con Canva: ${error?.message || 'Intenta de nuevo'}`, { id: 'canva', duration: 5000 })
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
        const sorted = Array.from(next).sort((a, b) => a[1] - b[1])
        const reordered = new Map<string, number>()
        for (const entry of sorted) {
          reordered.set(entry[0], order++)
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
      // Send only IDs — backend looks up images and uploads to Storage
      const section_ids = Array.from(selectedForExport)
        .sort((a, b) => a[1] - b[1])
        .map(([sectionId, order]) => ({ id: sectionId, order }))

      // Build product metadata for the constructor's AI content generation
      const selectedAnglesData = generatedAngles.filter(a => selectedAngleIds.has(a.id))
      const metadata = {
        product_name: product?.name || '',
        product_description: product?.description || '',
        country: selectedCountry?.code || '',
        country_name: selectedCountry?.name || '',
        currency: selectedCountry?.currency || '',
        pricing: {
          priceAfter: pricing.priceAfter,
          priceBefore: pricing.priceBefore,
          priceCombo2: pricing.priceCombo2,
          priceCombo3: pricing.priceCombo3,
        },
        product_context: {
          description: productContext.description,
          benefits: productContext.benefits,
          problems: productContext.problems,
          ingredients: productContext.ingredients,
          differentiator: productContext.differentiator,
        },
        angles: selectedAnglesData.map(a => ({
          name: a.name,
          hook: a.hook,
          salesAngle: a.salesAngle,
          tone: a.tone,
        })),
        sections_selected: Array.from(selectedSections),
        colorPalette: {
          primary: colorPalette.primary,
          secondary: colorPalette.secondary,
          accent: colorPalette.accent,
          ...(colorCount === 4 && { extra: colorPalette.extra }),
        },
        product_photos: productPhotos.filter((p): p is string => p !== null),
      }

      const response = await fetch('/api/minishop/import-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_ids, metadata }),
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

  // Group sections by category (prefer section_type, fallback to template category)
  const sectionsByCategory = generatedSections.reduce((acc, section) => {
    const category = section.section_type || section.template?.category || 'hero'
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

        {/* Visual Style: Colors & Typography */}
        <div className="border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-text-primary">
                Estilo Visual
              </span>
            </div>
          </div>

          {/* Color Palette */}
          <div className="mb-5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 block">
              Paleta de Colores
            </label>

            {/* Color count selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-secondary">Cantidad:</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setColorCount(3)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    colorCount === 3
                      ? 'bg-accent text-white'
                      : 'bg-background text-text-secondary hover:text-text-primary'
                  }`}
                >
                  3 colores
                </button>
                <button
                  onClick={() => setColorCount(4)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    colorCount === 4
                      ? 'bg-accent text-white'
                      : 'bg-background text-text-secondary hover:text-text-primary'
                  }`}
                >
                  4 colores
                </button>
              </div>
            </div>

            <div className={`grid gap-3 ${colorCount === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {/* Color 1 - Primary */}
              <div>
                <span className="text-xs text-text-secondary mb-1.5 block">Primario</span>
                <div className="relative">
                  <input
                    type="color"
                    value={colorPalette.primary}
                    onChange={(e) => setColorPalette({ ...colorPalette, primary: e.target.value })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-full h-12 rounded-xl border-2 border-border hover:border-accent/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    style={{ backgroundColor: colorPalette.primary }}
                  >
                    <span
                      className="relative z-10 text-xs font-mono text-white drop-shadow-md bg-black/30 px-2 py-0.5 rounded cursor-copy hover:bg-black/50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(colorPalette.primary.toUpperCase()); toast.success('Copiado ' + colorPalette.primary.toUpperCase()) }}
                    >
                      {colorPalette.primary.toUpperCase()}
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={colorPalette.primary.toUpperCase()}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColorPalette({ ...colorPalette, primary: v }) }}
                  onBlur={(e) => { const v = e.target.value; if (!/^#[0-9A-Fa-f]{6}$/.test(v)) setColorPalette({ ...colorPalette, primary: colorPalette.primary }) }}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs font-mono text-text-primary text-center focus:border-accent focus:outline-none"
                  placeholder="#000000"
                />
              </div>

              {/* Color 2 - Secondary */}
              <div>
                <span className="text-xs text-text-secondary mb-1.5 block">Secundario</span>
                <div className="relative">
                  <input
                    type="color"
                    value={colorPalette.secondary}
                    onChange={(e) => setColorPalette({ ...colorPalette, secondary: e.target.value })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-full h-12 rounded-xl border-2 border-border hover:border-accent/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    style={{ backgroundColor: colorPalette.secondary }}
                  >
                    <span
                      className="relative z-10 text-xs font-mono text-white drop-shadow-md bg-black/30 px-2 py-0.5 rounded cursor-copy hover:bg-black/50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(colorPalette.secondary.toUpperCase()); toast.success('Copiado ' + colorPalette.secondary.toUpperCase()) }}
                    >
                      {colorPalette.secondary.toUpperCase()}
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={colorPalette.secondary.toUpperCase()}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColorPalette({ ...colorPalette, secondary: v }) }}
                  onBlur={(e) => { const v = e.target.value; if (!/^#[0-9A-Fa-f]{6}$/.test(v)) setColorPalette({ ...colorPalette, secondary: colorPalette.secondary }) }}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs font-mono text-text-primary text-center focus:border-accent focus:outline-none"
                  placeholder="#000000"
                />
              </div>

              {/* Color 3 - Accent */}
              <div>
                <span className="text-xs text-text-secondary mb-1.5 block">Acento</span>
                <div className="relative">
                  <input
                    type="color"
                    value={colorPalette.accent}
                    onChange={(e) => setColorPalette({ ...colorPalette, accent: e.target.value })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-full h-12 rounded-xl border-2 border-border hover:border-accent/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    style={{ backgroundColor: colorPalette.accent }}
                  >
                    <span
                      className="relative z-10 text-xs font-mono text-white drop-shadow-md bg-black/30 px-2 py-0.5 rounded cursor-copy hover:bg-black/50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(colorPalette.accent.toUpperCase()); toast.success('Copiado ' + colorPalette.accent.toUpperCase()) }}
                    >
                      {colorPalette.accent.toUpperCase()}
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  value={colorPalette.accent.toUpperCase()}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColorPalette({ ...colorPalette, accent: v }) }}
                  onBlur={(e) => { const v = e.target.value; if (!/^#[0-9A-Fa-f]{6}$/.test(v)) setColorPalette({ ...colorPalette, accent: colorPalette.accent }) }}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs font-mono text-text-primary text-center focus:border-accent focus:outline-none"
                  placeholder="#000000"
                />
              </div>

              {/* Color 4 - Extra (only if 4 colors selected) */}
              {colorCount === 4 && (
                <div>
                  <span className="text-xs text-text-secondary mb-1.5 block">Extra</span>
                  <div className="relative">
                    <input
                      type="color"
                      value={colorPalette.extra}
                      onChange={(e) => setColorPalette({ ...colorPalette, extra: e.target.value })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-full h-12 rounded-xl border-2 border-border hover:border-accent/50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                      style={{ backgroundColor: colorPalette.extra }}
                    >
                      <span
                        className="relative z-10 text-xs font-mono text-white drop-shadow-md bg-black/30 px-2 py-0.5 rounded cursor-copy hover:bg-black/50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigator.clipboard.writeText(colorPalette.extra.toUpperCase()); toast.success('Copiado ' + colorPalette.extra.toUpperCase()) }}
                      >
                        {colorPalette.extra.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={colorPalette.extra.toUpperCase()}
                    onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColorPalette({ ...colorPalette, extra: v }) }}
                    onBlur={(e) => { const v = e.target.value; if (!/^#[0-9A-Fa-f]{6}$/.test(v)) setColorPalette({ ...colorPalette, extra: colorPalette.extra }) }}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs font-mono text-text-primary text-center focus:border-accent focus:outline-none"
                    placeholder="#000000"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-text-secondary/70 mt-2">
              Estos colores se aplicaran en todos los banners generados
            </p>
          </div>

          {/* Typography - 3 independent dropdowns */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 block">
              Tipografia
            </label>

            {/* Titles */}
            <div className="mb-3">
              <span className="text-xs text-text-secondary mb-1.5 block">Titulos</span>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <select
                    value={selectedFonts.headings}
                    onChange={(e) => setSelectedFonts({ ...selectedFonts, headings: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  >
                    <optgroup label="Sans-serif">
                      {FONT_CATALOG.filter(f => f.category === 'Sans-serif').map(font => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Serif">
                      {FONT_CATALOG.filter(f => f.category === 'Serif').map(font => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                </div>
                <div className="w-28 h-12 flex items-center justify-center bg-background border border-border rounded-xl flex-shrink-0">
                  <span className="text-xl text-text-primary" style={{ fontFamily: `'${FONT_CATALOG.find(f => f.id === selectedFonts.headings)?.name}', sans-serif` }}>
                    Ejemplo
                  </span>
                </div>
              </div>
            </div>

            {/* Subtitles */}
            <div className="mb-3">
              <span className="text-xs text-text-secondary mb-1.5 block">Subtitulos</span>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <select
                    value={selectedFonts.subheadings}
                    onChange={(e) => setSelectedFonts({ ...selectedFonts, subheadings: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  >
                    <optgroup label="Sans-serif">
                      {FONT_CATALOG.filter(f => f.category === 'Sans-serif').map(font => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Serif">
                      {FONT_CATALOG.filter(f => f.category === 'Serif').map(font => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                </div>
                <div className="w-28 h-12 flex items-center justify-center bg-background border border-border rounded-xl flex-shrink-0">
                  <span className="text-xl text-text-primary" style={{ fontFamily: `'${FONT_CATALOG.find(f => f.id === selectedFonts.subheadings)?.name}', sans-serif` }}>
                    Ejemplo
                  </span>
                </div>
              </div>
            </div>

            {/* Body text */}
            <div>
              <span className="text-xs text-text-secondary mb-1.5 block">Textos</span>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <select
                    value={selectedFonts.body}
                    onChange={(e) => setSelectedFonts({ ...selectedFonts, body: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  >
                    <optgroup label="Sans-serif">
                      {FONT_CATALOG.filter(f => f.category === 'Sans-serif').map(font => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Serif">
                      {FONT_CATALOG.filter(f => f.category === 'Serif').map(font => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
                </div>
                <div className="w-28 h-12 flex items-center justify-center bg-background border border-border rounded-xl flex-shrink-0">
                  <span className="text-xl text-text-primary" style={{ fontFamily: `'${FONT_CATALOG.find(f => f.id === selectedFonts.body)?.name}', sans-serif` }}>
                    Ejemplo
                  </span>
                </div>
              </div>
            </div>
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

        {/* Pricing Controls */}
        <div className="border border-accent/30 bg-accent/5 rounded-xl p-4 mb-6">
          <PricingControls
            value={pricing}
            onChange={setPricing}
            disabled={isGenerating}
          />
        </div>

        <h2 className="text-xl font-bold text-text-primary mb-2 mt-2">CREA TU LANDING BANNER A BANNER</h2>
        <p className="text-sm text-text-secondary mb-4">Personaliza cada banner individualmente con controles creativos</p>

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
                  <span className="text-xs text-text-secondary">Max. 1500 caracteres</span>
                </div>
                <textarea
                  placeholder="Describe las características, beneficios y detalles importantes del producto..."
                  value={creativeControls.productDetails}
                  onChange={(e) => setCreativeControls({ ...creativeControls, productDetails: e.target.value.slice(0, 1500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={3}
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
                  onChange={(e) => setCreativeControls({ ...creativeControls, salesAngle: e.target.value.slice(0, 1500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={3}
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
                  onChange={(e) => setCreativeControls({ ...creativeControls, targetAvatar: e.target.value.slice(0, 1500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={3}
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
                  onChange={(e) => setCreativeControls({ ...creativeControls, additionalInstructions: e.target.value.slice(0, 1500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold text-text-primary mb-2 mt-2">CREA TUS LANDINGS COMPLETAS A UNOS CLICKS</h2>
        <p className="text-sm text-text-secondary mb-4">Define el contexto, genera angulos de venta y crea landing pages completas</p>

        {/* Product Context (Phase 2) */}
        <div className="border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-text-primary">
                Contexto del Producto
              </span>
              <span className="text-xs text-text-secondary">(Recomendado)</span>
            </div>
            <button
              onClick={() => setShowProductContext(!showProductContext)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                showProductContext ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                showProductContext ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>

          {showProductContext && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-text-secondary">
                Entre mas contexto proporciones, mejores seran los banners y angulos generados.
              </p>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  📦 Descripcion del Producto
                </label>
                <textarea
                  placeholder="Describe el producto en detalle: que es, como funciona, materiales, presentacion, cantidad, etc."
                  value={productContext.description}
                  onChange={(e) => setProductContext({ ...productContext, description: e.target.value.slice(0, 2000) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={3}
                />
                <span className="text-xs text-text-secondary">{productContext.description.length}/2000</span>
              </div>

              {/* Benefits */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  ✅ Beneficios Principales
                </label>
                <textarea
                  placeholder="Lista los beneficios clave. Ej: Reduce arrugas 67% en 28 dias, hidratacion 24h, no grasa..."
                  value={productContext.benefits}
                  onChange={(e) => setProductContext({ ...productContext, benefits: e.target.value.slice(0, 1000) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Problems it solves */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  🎯 Problemas que Resuelve
                </label>
                <textarea
                  placeholder="Que dolor o frustracion tiene el cliente? Ej: Piel seca, arrugas prematuras, productos caros que no funcionan..."
                  value={productContext.problems}
                  onChange={(e) => setProductContext({ ...productContext, problems: e.target.value.slice(0, 1000) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Ingredients/Materials */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  🧪 Ingredientes / Materiales / Componentes
                </label>
                <textarea
                  placeholder="Ej: Acido hialuronico, retinol, vitamina C, extracto de aloe vera..."
                  value={productContext.ingredients}
                  onChange={(e) => setProductContext({ ...productContext, ingredients: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Differentiator */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  💎 Diferenciador
                </label>
                <textarea
                  placeholder="Que lo hace diferente de la competencia? Ej: Unico con 20 ingredientes activos, formula patentada, resultados en 14 dias..."
                  value={productContext.differentiator}
                  onChange={(e) => setProductContext({ ...productContext, differentiator: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Generate Angles Button */}
              <div className="pt-2 border-t border-border">
                <button
                  onClick={handleGenerateAngles}
                  disabled={isGeneratingAngles}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {isGeneratingAngles ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generando angulos...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-5 h-5" />
                      Generar Angulos de Venta con IA
                    </>
                  )}
                </button>
                <p className="text-xs text-text-secondary text-center mt-2">
                  Analiza las fotos del producto + contexto para generar angulos de venta
                </p>
              </div>

              {/* Generated Angles */}
              {generatedAngles.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-500" />
                      Angulos de Venta Generados
                      {anglesAiMeta && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          anglesAiMeta.fallbacks?.length
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`} title={anglesAiMeta.fallbacks?.join('\n') || 'Sin fallbacks'}>
                          {anglesAiMeta.provider}{anglesAiMeta.fallbacks?.length ? ' (fallback)' : ''}
                        </span>
                      )}
                    </label>
                    <button
                      onClick={handleGenerateAngles}
                      disabled={isGeneratingAngles}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-accent transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingAngles ? 'animate-spin' : ''}`} />
                      Regenerar
                    </button>
                  </div>

                  {selectedAngleIds.size > 0 && (
                    <p className="text-xs text-amber-500 font-medium mb-2">
                      {selectedAngleIds.size}/4 angulos seleccionados
                    </p>
                  )}

                  <div className="space-y-2">
                    {generatedAngles.map((angle) => (
                      <button
                        key={angle.id}
                        onClick={() => handleSelectAngle(angle)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedAngleIds.has(angle.id)
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-border hover:border-amber-500/30 bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-text-primary">{angle.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-medium">
                                {angle.tone}
                              </span>
                            </div>
                            <p className="text-xs text-amber-600 font-medium mb-1">&quot;{angle.hook}&quot;</p>
                            <p className="text-xs text-text-secondary line-clamp-2">{angle.description}</p>
                            <p className="text-[10px] text-text-secondary/70 mt-1">👤 {angle.avatarSuggestion}</p>
                          </div>
                          {selectedAngleIds.has(angle.id) && (
                            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-1">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Add manual angle button + form */}
                  {showAddAngleForm ? (
                    <div className="mt-3">
                      {renderAddAngleForm()}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddAngleForm(true)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-border text-sm text-text-secondary hover:border-amber-500/40 hover:text-amber-600 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar angulo manual
                    </button>
                  )}

                  {/* Save angles button */}
                  <button
                    onClick={handleSaveAngles}
                    disabled={isSavingAngles || generatedAngles.length === 0}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-500/15 text-teal-500 text-sm font-medium hover:bg-teal-500/25 border border-teal-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingAngles ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5" />
                    )}
                    {isSavingAngles ? 'Guardando...' : 'Guardar Angulos'}
                  </button>
                </div>
              )}

              {/* Saved Angles Panel */}
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => setShowSavedAngles(!showSavedAngles)}
                  className="w-full flex items-center justify-between text-sm font-medium text-text-primary mb-2"
                >
                  <span className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-teal-500" />
                    Angulos Guardados
                  </span>
                  {showSavedAngles ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                </button>
                {showSavedAngles && (
                  <SavedAnglesPanel selectable={false} filterByProduct={product?.name} />
                )}
              </div>

              {/* Add manual angle when no AI angles exist yet */}
              {generatedAngles.length === 0 && (
                <div className="pt-4 border-t border-border">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-amber-500" />
                    Angulos de Venta
                  </label>
                  <p className="text-xs text-text-secondary mb-3">
                    Genera angulos con IA arriba, o agrega uno manual:
                  </p>
                  {showAddAngleForm ? (
                    renderAddAngleForm()
                  ) : (
                    <button
                      onClick={() => setShowAddAngleForm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-amber-500/30 text-sm text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar angulo manual
                    </button>
                  )}
                </div>
              )}

              {/* Landing Sections Selector — only show when angles are selected */}
              {selectedAngleIds.size > 0 && (
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4 text-accent" />
                      Secciones de tu Landing
                    </label>
                    <span className="text-xs text-text-secondary">
                      {selectedSections.size} secciones seleccionadas
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary mb-3">
                    Selecciona las secciones que quieres en tu landing y asigna una plantilla a cada una.
                  </p>

                  <div className="space-y-2">
                    {TEMPLATE_CATEGORIES.map((category) => {
                      const isSelected = selectedSections.has(category.id)
                      const assignedTemplate = sectionTemplates[category.id]
                      const categoryTemplates = templates.filter(t => t.category === category.id)

                      return (
                        <div
                          key={category.id}
                          className={`rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-accent/50 bg-accent/5'
                              : 'border-border bg-background'
                          }`}
                        >
                          <button
                            onClick={() => {
                              setSelectedSections(prev => {
                                const next = new Set(prev)
                                if (next.has(category.id)) {
                                  next.delete(category.id)
                                } else {
                                  next.add(category.id)
                                }
                                return next
                              })
                            }}
                            className="w-full flex items-center gap-3 p-3"
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-accent border-accent'
                                : 'border-border'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>

                            <span className="text-lg">{category.icon}</span>
                            <div className="text-left flex-1 min-w-0">
                              <span className="text-sm font-medium text-text-primary block">{category.name}</span>
                              <span className="text-xs text-text-secondary block">{category.description}</span>
                            </div>

                            {isSelected && assignedTemplate && (
                              <div className="w-10 h-14 rounded-lg overflow-hidden border border-border flex-shrink-0">
                                <img
                                  src={assignedTemplate.image_url}
                                  alt={assignedTemplate.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </button>

                          {isSelected && (
                            <div className="px-3 pb-3">
                              {categoryTemplates.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                  {categoryTemplates.map((template) => (
                                    <button
                                      key={template.id}
                                      onClick={() => setSectionTemplates(prev => ({
                                        ...prev,
                                        [category.id]: prev[category.id]?.id === template.id ? null : template,
                                      }))}
                                      className={`flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                                        assignedTemplate?.id === template.id
                                          ? 'border-accent ring-1 ring-accent/30'
                                          : 'border-border hover:border-accent/30'
                                      }`}
                                    >
                                      <img
                                        src={template.image_url}
                                        alt={template.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 py-2">
                                  <span className="text-xs text-text-secondary/70">Sin plantillas en galeria —</span>
                                  <button
                                    onClick={() => {
                                      if (uploadedTemplate || selectedTemplate) {
                                        setSectionTemplates(prev => ({
                                          ...prev,
                                          [category.id]: selectedTemplate || { id: 'uploaded', name: 'Subida', image_url: uploadedTemplate!, category: category.id } as Template,
                                        }))
                                        toast.success('Plantilla principal asignada')
                                      } else {
                                        toast.error('Sube una imagen de referencia arriba')
                                      }
                                    }}
                                    className="text-xs text-accent hover:underline"
                                  >
                                    Usar plantilla principal
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {selectedSections.size > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <button
                        onClick={handleBulkGenerate}
                        disabled={isBulkGenerating}
                        className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-gradient-to-r from-accent to-emerald-500 hover:from-accent-hover hover:to-emerald-600 text-white rounded-xl font-bold text-base transition-all disabled:opacity-50 shadow-lg"
                      >
                        {isBulkGenerating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generando... {bulkProgress.current}/{bulkProgress.total}
                            <span className="text-sm font-normal opacity-80">({bulkProgress.currentLabel})</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Generar {selectedAngleIds.size} Landing{selectedAngleIds.size > 1 ? 's' : ''} Completa{selectedAngleIds.size > 1 ? 's' : ''}
                            <span className="text-sm font-normal opacity-80">
                              ({selectedAngleIds.size} x {selectedSections.size} = {selectedAngleIds.size * selectedSections.size} banners)
                            </span>
                          </>
                        )}
                      </button>

                      {isBulkGenerating && bulkProgress.total > 0 && (
                        <div className="mt-3">
                          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-text-secondary text-center mt-1">
                            {bulkProgress.currentLabel}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-text-secondary text-center mt-2">
                        Se generaran {selectedAngleIds.size * selectedSections.size} banners en paralelo (maximo 3 simultaneos)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
                      {/* Thumbnail */}
                      <div
                        className={`relative cursor-pointer aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all bg-surface ${
                          isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-border hover:border-accent/50'
                        }`}
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
                            loading="lazy"
                          />
                        </div>
                        {/* Selection badge — always visible */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSectionExport(section)
                          }}
                          title={isSelected ? `Seccion #${exportOrder} — clic para quitar` : 'Seleccionar para enviar al editor'}
                          className={`absolute top-2 left-2 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all shadow-md ${
                            isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white/90 text-gray-600 hover:bg-emerald-500 hover:text-white border border-gray-200'
                          }`}
                        >
                          {isSelected ? exportOrder : '+'}
                        </button>
                        {/* Dim overlay when selected */}
                        {isSelected && (
                          <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                        )}
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
                        loading="lazy"
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
                  <p className="text-xs text-text-secondary">Se enviaran a tu editor DropPage</p>
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
