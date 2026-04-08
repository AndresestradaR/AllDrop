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
// ModelSelector removed — always use nano-banana-2
import { SavedAnglesPanel } from '@/components/studio/SavedAnglesPanel'
import CountrySelector from '@/components/generator/CountrySelector'
import PricingControls, { PricingData, getDefaultPricingData } from '@/components/generator/PricingControls'
import { ImageModelId, modelIdToProviderType } from '@/lib/image-providers/types'
import { Country, COUNTRIES, getDefaultCountry } from '@/lib/constants/countries'
import { useI18n } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

const TEMPLATE_CATEGORY_IDS = [
  { id: 'hero', icon: '🏠', nameKey: 'catHeroName' as const, descKey: 'catHero' as const },
  { id: 'oferta', icon: '🏷️', nameKey: 'catOfertaName' as const, descKey: 'catOferta' as const },
  { id: 'antes-despues', icon: '🔄', nameKey: 'catAntesDespuesName' as const, descKey: 'catAntesDespues' as const },
  { id: 'beneficios', icon: '✅', nameKey: 'catBeneficiosName' as const, descKey: 'catBeneficios' as const },
  { id: 'tabla-comparativa', icon: '📊', nameKey: 'catComparativaName' as const, descKey: 'catComparativa' as const },
  { id: 'autoridad', icon: '🏆', nameKey: 'catAutoridadName' as const, descKey: 'catAutoridad' as const },
  { id: 'testimonios', icon: '💬', nameKey: 'catTestimoniosName' as const, descKey: 'catTestimonios' as const },
  { id: 'ingredientes', icon: '🧪', nameKey: 'catIngredientesName' as const, descKey: 'catIngredientes' as const },
  { id: 'modo-uso', icon: '📋', nameKey: 'catModoUsoName' as const, descKey: 'catModoUso' as const },
  { id: 'logistica', icon: '🚚', nameKey: 'catLogisticaName' as const, descKey: 'catLogistica' as const },
  { id: 'faq', icon: '❓', nameKey: 'catFaqName' as const, descKey: 'catFaq' as const },
  { id: 'casos-uso', icon: '💡', nameKey: 'catCasosUsoName' as const, descKey: 'catCasosUso' as const },
  { id: 'caracteristicas', icon: '⚙️', nameKey: 'catCaracteristicasName' as const, descKey: 'catCaracteristicas' as const },
  { id: 'comunidad', icon: '👥', nameKey: 'catComunidadName' as const, descKey: 'catComunidad' as const },
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
  const { t, countryName } = useI18n()
  const productId = params.id as string

  // Build translated template categories
  const TEMPLATE_CATEGORIES = TEMPLATE_CATEGORY_IDS.map(cat => ({
    id: cat.id,
    icon: cat.icon,
    name: (t.editor as any)[cat.nameKey] || cat.nameKey,
    description: (t.editor as any)[cat.descKey] || cat.descKey,
  }))

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

  // Country selection + output language
  const COUNTRY_TO_LANG: Record<string, string> = {
    ES: 'es', FR: 'fr', IT: 'it', DE: 'de', PT: 'pt', GB: 'en', US: 'en',
  }
  const OUTPUT_LANGUAGES = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'de', name: 'Deutsch' },
  ]
  const [selectedCountry, setSelectedCountry] = useState<Country>(getDefaultCountry())
  const [outputLanguage, setOutputLanguage] = useState('es')

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
  const [showProductContext, setShowProductContext] = useState(true)
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

  // Template gallery expansion per section
  const [expandedTemplateSection, setExpandedTemplateSection] = useState<string | null>(null)

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
    // Load persisted product context + settings
    fetch(`/api/products/context?productId=${productId}`)
      .then(r => r.json())
      .then(data => {
        if (data.context) {
          setProductContext(data.context)
          setShowProductContext(true)
        }
        if (data.colorPalette) {
          setColorPalette(prev => ({ ...prev, ...data.colorPalette }))
          if (data.colorPalette.extra) setColorCount(4)
        }
        if (data.typography) setSelectedFonts(prev => ({ ...prev, ...data.typography }))
        if (data.pricing) setPricing(prev => ({ ...prev, ...data.pricing }))
        if (data.targetCountry) {
          const found = COUNTRIES.find((c: any) => c.code === data.targetCountry)
          if (found) setSelectedCountry(found)
        }
        if (data.productPhotos && Array.isArray(data.productPhotos)) {
          const photos = [...data.productPhotos]
          while (photos.length < 3) photos.push(null)
          setProductPhotos(photos.slice(0, 3))
        }
      })
      .catch(() => {}) // Silently fail — columns might not exist yet
  }, [productId])

  // Auto-save product context + settings with debounce (1.5s after last change)
  const contextSaveTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    // Skip if all fields are empty (initial state)
    const hasContent = Object.values(productContext).some(v => v.trim() !== '')
    if (!hasContent) return

    if (contextSaveTimer.current) clearTimeout(contextSaveTimer.current)
    contextSaveTimer.current = setTimeout(() => {
      console.log('[ProductContext] Auto-saving...', { productId })
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

  // Auto-save color palette, typography, pricing, country
  const settingsSaveTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current)
    settingsSaveTimer.current = setTimeout(() => {
      fetch('/api/products/context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          colorPalette: colorCount === 4 ? colorPalette : { primary: colorPalette.primary, secondary: colorPalette.secondary, accent: colorPalette.accent },
          typography: selectedFonts,
          pricing,
          targetCountry: selectedCountry?.code || null,
        }),
      }).catch(() => {})
    }, 2000)

    return () => { if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current) }
  }, [colorPalette, colorCount, selectedFonts, pricing, selectedCountry, productId])

  // Auto-save product photos when they change (URLs only, not base64 blobs)
  const photosSaveTimer = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    const photoUrls = productPhotos.filter((p): p is string => p !== null && p.startsWith('http'))
    if (photoUrls.length === 0) return

    if (photosSaveTimer.current) clearTimeout(photosSaveTimer.current)
    photosSaveTimer.current = setTimeout(() => {
      fetch('/api/products/context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, productPhotos: photoUrls }),
      }).catch(() => {})
    }, 2000)

    return () => { if (photosSaveTimer.current) clearTimeout(photosSaveTimer.current) }
  }, [productPhotos, productId])

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
        toast.error(t.editor.productNotFound)
        router.push('/dashboard/landing')
      }
    } catch (error) {
      toast.error(t.editor.loadError)
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

  const handlePhotoUpload = (index: number) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show base64 preview immediately while uploading
    const reader = new FileReader()
    reader.onloadend = () => {
      const newPhotos = [...productPhotos]
      newPhotos[index] = reader.result as string
      setProductPhotos(newPhotos)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage in background, then replace base64 with persistent URL
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('productId', productId)
      formData.append('index', String(index))

      const res = await fetch('/api/products/upload-photo', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.url) {
        setProductPhotos(prev => {
          const updated = [...prev]
          updated[index] = data.url
          return updated
        })
      }
    } catch (err) {
      console.error('[PhotoUpload] Failed to upload to storage:', err)
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
    if (!productPhotos.some(p => p !== null)) {
      toast.error(t.editor.uploadPhoto)
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
          // Country + language
          targetCountry: selectedCountry.code,
          outputLanguage,
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
          productContext,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar')
      }

      if (data.success && data.imageUrl) {
        toast.success(t.editor.sectionCreated)
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
    if (!productPhotos.some(p => p !== null)) {
      toast.error(t.editor.uploadPhotoFirst)
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
          productContext,
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
      toast.error(t.editor.selectAngle)
      return
    }
    if (selectedSections.size === 0) {
      toast.error(t.editor.selectSection)
      return
    }
    if (!productPhotos.some(p => p !== null)) {
      toast.error(t.editor.uploadPhoto)
      return
    }

    const mainTemplate = selectedTemplate?.image_url || uploadedTemplate || null

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
              outputLanguage,
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
              productContext,
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
      toast.error(t.editor.uploadPhoto)
      return
    }

    // Force-save product context before generating angles
    const hasCtx = Object.values(productContext).some(v => typeof v === 'string' && v.trim() !== '')
    if (hasCtx) {
      try {
        await fetch('/api/products/context', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, context: productContext }),
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
          productContext,
          targetCountry: selectedCountry.code,
          outputLanguage,
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
          toast.error(t.editor.maxAngles)
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
      toast.error(t.editor.nameAngleRequired)
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
        toast.error(data.error || t.editor.saveAnglesError)
      }
    } catch {
      toast.error(t.editor.saveAnglesError)
    } finally {
      setIsSavingAngles(false)
    }
  }

  const renderAddAngleForm = () => (
    <div className="p-3 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 space-y-2">
      <input
        type="text"
        placeholder={t.editor.angleNamePlaceholder}
        value={newAngle.name}
        onChange={(e) => setNewAngle(prev => ({ ...prev, name: e.target.value }))}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none"
      />
      <textarea
        placeholder={t.editor.mainMessage}
        value={newAngle.salesAngle}
        onChange={(e) => setNewAngle(prev => ({ ...prev, salesAngle: e.target.value }))}
        rows={2}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none resize-none"
      />
      <input
        type="text"
        placeholder={t.editor.avatarOptional}
        value={newAngle.avatarSuggestion}
        onChange={(e) => setNewAngle(prev => ({ ...prev, avatarSuggestion: e.target.value }))}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none"
      />
      <select
        value={newAngle.tone}
        onChange={(e) => setNewAngle(prev => ({ ...prev, tone: e.target.value }))}
        className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 outline-none"
      >
        <option value="Emocional">{t.editor.emotional}</option>
        <option value="Racional">{t.editor.rational}</option>
        <option value="Urgencia">{t.editor.urgency}</option>
        <option value="Aspiracional">{t.editor.aspirational}</option>
        <option value="Social Proof">{t.editor.socialProof}</option>
        <option value="Educativo">{t.editor.educational}</option>
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleAddManualAngle}
          className="flex-1 text-sm py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
        >
          {t.editor.addAngle}
        </button>
        <button
          onClick={() => { setShowAddAngleForm(false); setNewAngle({ name: '', hook: '', salesAngle: '', avatarSuggestion: '', tone: 'Emocional' }) }}
          className="px-3 text-sm py-2 rounded-lg border border-border text-text-secondary hover:bg-background-secondary transition-colors"
        >
          {t.editor.cancel}
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
      toast.error(t.editor.writeInstruction)
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
        toast.success(t.editor.sectionEdited)
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
    if (!confirm(t.editor.deleteConfirm)) return

    // Save previous state for rollback
    const previousSections = generatedSections

    // Optimistic update - remove from UI immediately
    setGeneratedSections(sections => sections.filter(s => s.id !== sectionId))
    setShowSectionModal(false)
    toast.success(t.editor.sectionDeleted)

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

      // Auto-detect existing landing in DropPage — send there without asking
      let existingDesignId: string | null = null
      try {
        const designsRes = await fetch('/api/minishop/import-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section_ids, metadata, check_existing: true, product_name: product?.name }),
        })
        if (designsRes.ok) {
          const designsData = await designsRes.json()
          if (designsData.existing_design_id) {
            existingDesignId = designsData.existing_design_id
          }
        }
      } catch { /* ignore — will create new */ }

      const response = await fetch('/api/minishop/import-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_ids, metadata, existing_design_id: existingDesignId }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al enviar')
      }

      const data = await response.json()
      toast.success(t.editor.sentToEditor)
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
            {t.editor.landingGenerator}
          </p>
          <h1 className="text-xl font-bold text-text-primary">{product?.name}</h1>
        </div>
      </div>

      {/* Main Content */}
      <Card className="p-6 mb-6">
        {/* Product Photos - Full width, centered */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              {t.editor.productPhotos}
            </label>
            <span className="text-xs text-text-secondary">{t.editor.photoCount}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="aspect-square relative">
                {productPhotos[index] ? (
                  <div className="w-full h-full rounded-xl overflow-hidden border border-border bg-surface">
                    <img
                      src={productPhotos[index]!}
                      alt={`Producto ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-lg hover:bg-error/20 hover:text-error transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => photoInputRefs[index].current?.click()}
                    className="w-full h-full rounded-xl border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent/5 transition-colors flex flex-col items-center justify-center"
                  >
                    <ImageIcon className="w-8 h-8 text-text-secondary/40 mb-2" />
                    <span className="text-sm text-text-secondary">{index + 1}</span>
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

        {/* Visual Style: Colors & Typography */}
        <div className="border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-text-primary">
                {t.editor.visualStyle}
              </span>
            </div>
          </div>

          {/* Color Palette */}
          <div className="mb-5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 block">
              {t.editor.colorPalette}
            </label>

            {/* Color count selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-secondary">{t.editor.quantity}</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setColorCount(3)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    colorCount === 3
                      ? 'bg-accent text-white'
                      : 'bg-background text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.editor.threeColors}
                </button>
                <button
                  onClick={() => setColorCount(4)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    colorCount === 4
                      ? 'bg-accent text-white'
                      : 'bg-background text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.editor.fourColors}
                </button>
              </div>
            </div>

            <div className={`grid gap-3 ${colorCount === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {/* Color 1 - Primary */}
              <div>
                <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.primary}</span>
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
                <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.secondary}</span>
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
                <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.accent}</span>
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
                  <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.extra}</span>
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
              {t.editor.colorsApplied}
            </p>
          </div>

          {/* Typography - 3 independent dropdowns */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 block">
              Typography
            </label>

            {/* Titles */}
            <div className="mb-3">
              <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.headings}</span>
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
                    {t.editor.example}
                  </span>
                </div>
              </div>
            </div>

            {/* Subtitles */}
            <div className="mb-3">
              <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.subtitles}</span>
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
                    {t.editor.example}
                  </span>
                </div>
              </div>
            </div>

            {/* Body text */}
            <div>
              <span className="text-xs text-text-secondary mb-1.5 block">{t.editor.bodyText}</span>
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
                    {t.editor.example}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Country Selector */}
        <div className="mb-6">
          <CountrySelector
            value={selectedCountry.code}
            onChange={(country) => {
              setSelectedCountry(country)
              setPricing(prev => ({ ...prev, currencySymbol: country.currencySymbol }))
              // Auto-set output language based on country
              const lang = COUNTRY_TO_LANG[country.code]
              if (lang) setOutputLanguage(lang)
            }}
            disabled={isGenerating}
          />
        </div>

        {/* Settings Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Output Size */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
              📐 {t.editor.outputSize}
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
              🌐 {t.editor.outputLanguage}
            </label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value)}
              >
                {OUTPUT_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
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

        <h2 className="text-xl font-bold text-text-primary mb-2 mt-2">{t.editor.createCompleteLandings}</h2>
        <p className="text-sm text-text-secondary mb-4">{t.editor.defineContext}</p>

        {/* Product Context — always visible */}
        <div className="border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-text-primary">
              {t.editor.productContext}
            </span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              {t.editor.moreContext}
            </p>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  📦 {t.editor.productDescription}
                </label>
                <textarea
                  placeholder={t.editor.descDetailPlaceholder}
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
                  ✅ {t.editor.mainBenefits}
                </label>
                <textarea
                  placeholder={t.editor.benefitsPlaceholder}
                  value={productContext.benefits}
                  onChange={(e) => setProductContext({ ...productContext, benefits: e.target.value.slice(0, 1000) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Problems it solves */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  🎯 {t.editor.problemsSolved}
                </label>
                <textarea
                  placeholder={t.editor.problemsPlaceholder}
                  value={productContext.problems}
                  onChange={(e) => setProductContext({ ...productContext, problems: e.target.value.slice(0, 1000) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Ingredients/Materials */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  🧪 {t.editor.ingredients}
                </label>
                <textarea
                  placeholder={t.editor.ingredientsPlaceholder}
                  value={productContext.ingredients}
                  onChange={(e) => setProductContext({ ...productContext, ingredients: e.target.value.slice(0, 500) })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={2}
                />
              </div>

              {/* Differentiator */}
              <div>
                <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-1.5">
                  💎 {t.editor.differentiator}
                </label>
                <textarea
                  placeholder={t.editor.differentiatorPlaceholder}
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
                      {t.editor.generatingAngles}
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-5 h-5" />
                      {t.editor.generateAngles}
                    </>
                  )}
                </button>
                <p className="text-xs text-text-secondary text-center mt-2">
                  {t.editor.analyzePhotos}
                </p>
              </div>

              {/* Generated Angles */}
              {generatedAngles.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-500" />
                      {t.editor.generatedAngles}
                      {anglesAiMeta && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          anglesAiMeta.fallbacks?.length
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`} title={anglesAiMeta.fallbacks?.join('\n') || 'Sin fallbacks'}>
                          {anglesAiMeta.provider}{anglesAiMeta.fallbacks?.length ? ` (${t.editor.fallback})` : ''}
                        </span>
                      )}
                    </label>
                    <button
                      onClick={handleGenerateAngles}
                      disabled={isGeneratingAngles}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-accent transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingAngles ? 'animate-spin' : ''}`} />
                      {t.editor.regenerate}
                    </button>
                  </div>

                  {selectedAngleIds.size > 0 && (
                    <p className="text-xs text-amber-500 font-medium mb-2">
                      {selectedAngleIds.size}/4 {t.editor.anglesSelected}
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
                      {t.editor.addManualAngle}
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
                    {isSavingAngles ? 'Guardando...' : t.editor.saveAngles}
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
                    {t.editor.savedAngles}
                  </span>
                  {showSavedAngles ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                </button>
                {showSavedAngles && (
                  <SavedAnglesPanel
                    selectable={true}
                    filterByProduct={product?.name}
                    selectedAngleId={selectedAngleIds.size > 0 ? Array.from(selectedAngleIds)[0] : null}
                    onSelectAngle={(angle) => {
                      // Populate generatedAngles with the saved angle so user can generate banners
                      const angleWithId = { ...angle, id: angle.id || `saved-${Date.now()}` }
                      setGeneratedAngles([angleWithId])
                      setSelectedAngleIds(new Set([angleWithId.id]))
                      // Auto-fill creative controls from the angle
                      setCreativeControls(prev => ({
                        ...prev,
                        salesAngle: angle.salesAngle || angle.hook || '',
                        targetAvatar: angle.avatarSuggestion || '',
                      }))
                    }}
                  />
                )}
              </div>

              {/* Add manual angle when no AI angles exist yet */}
              {generatedAngles.length === 0 && (
                <div className="pt-4 border-t border-border">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-amber-500" />
                    {t.editor.salesAngles}
                  </label>
                  <p className="text-xs text-text-secondary mb-3">
                    {t.editor.generateOrAdd}
                  </p>
                  {showAddAngleForm ? (
                    renderAddAngleForm()
                  ) : (
                    <button
                      onClick={() => setShowAddAngleForm(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-amber-500/30 text-sm text-amber-600 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      {t.editor.addManualAngle}
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
                      {t.editor.landingSections}
                    </label>
                    <span className="text-xs text-text-secondary">
                      {selectedSections.size} {t.editor.sectionsSelected}
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary mb-3">
                    {t.editor.selectSections}
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
                                <>
                                  {/* Compact row with first few templates + "Ver todos" */}
                                  {expandedTemplateSection !== category.id ? (
                                    <div className="flex gap-2 items-center">
                                      <div className="flex gap-2 overflow-hidden flex-1">
                                        {categoryTemplates.slice(0, 8).map((template) => (
                                          <button
                                            key={template.id}
                                            onClick={() => {
                                              setSectionTemplates(prev => ({
                                                ...prev,
                                                [category.id]: prev[category.id]?.id === template.id ? null : template,
                                              }))
                                            }}
                                            className={`flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border-2 transition-all ${
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
                                      {categoryTemplates.length > 0 && (
                                        <button
                                          onClick={() => setExpandedTemplateSection(category.id)}
                                          className="flex-shrink-0 px-5 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shadow-sm"
                                        >
                                          {t.editor.viewAll} ({categoryTemplates.length})
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    /* Expanded grid view */
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-text-secondary">
                                          {categoryTemplates.length} {t.editor.templatesAvailable}
                                        </span>
                                        <button
                                          onClick={() => setExpandedTemplateSection(null)}
                                          className="p-1 text-text-secondary hover:text-text-primary hover:bg-border/50 rounded-lg transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                        {categoryTemplates.map((template) => (
                                          <div key={template.id} className="flex flex-col items-center gap-1.5">
                                            <button
                                              onClick={() => {
                                                setSectionTemplates(prev => ({
                                                  ...prev,
                                                  [category.id]: template,
                                                }))
                                                setExpandedTemplateSection(null)
                                              }}
                                              className={`w-full aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] ${
                                                assignedTemplate?.id === template.id
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
                                            </button>
                                            <button
                                              onClick={() => {
                                                setSectionTemplates(prev => ({
                                                  ...prev,
                                                  [category.id]: template,
                                                }))
                                                setExpandedTemplateSection(null)
                                              }}
                                              className="w-full px-2 py-1.5 bg-white hover:bg-gray-100 text-gray-900 text-xs font-medium rounded-lg transition-colors text-center shadow-sm"
                                            >
                                              {t.editor.selectThisTemplate}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-text-secondary/70 py-2">
                                  {t.editor.noTemplates || 'Sin plantillas para esta sección'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {selectedSections.size > 0 && !selectedTemplate && !uploadedTemplate && (
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
        </div>

        {/* Single section generation removed — use bulk generation only */}
      </Card>

      {/* Generated Sections History */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">{t.editor.generatedSections}</h2>
        
        {isLoadingSections ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : generatedSections.length === 0 ? (
          <Card className="p-8 text-center">
            <ImageIcon className="w-12 h-12 text-accent/30 mx-auto mb-3" />
            <p className="text-text-secondary">{t.editor.noSectionsYet}</p>
            <p className="text-sm text-text-secondary/70">{t.editor.selectTemplate}</p>
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
                          title={isSelected ? `Seccion #${exportOrder} — clic para quitar` : t.editor.selectForExport}
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
                          <span>{t.editor.viewBanner}</span>
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
                <h2 className="text-lg font-semibold text-text-primary">{t.editor.designGallery}</h2>
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
                  <p className="text-text-secondary">{t.editor.noTemplatesInCategory}</p>
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
                {t.editor.clickToSelect}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowTemplateGallery(false)}
                >
                  {t.editor.cancel}
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
                  {t.editor.useTemplate}
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
              <h2 className="text-xl font-bold text-text-primary mb-6">{t.editor.sectionGenerated}</h2>
              
              <div className="space-y-3 flex-1">
                {/* Download 2K */}
                <button
                  onClick={() => handleDownload(selectedSection.generated_image_url, '2k')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <Download className="w-5 h-5 text-text-secondary" />
                  <span className="text-text-primary">{t.editor.download2K}</span>
                </button>

                {/* Download Optimized */}
                <button
                  onClick={() => handleDownload(selectedSection.generated_image_url, 'optimized')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <Download className="w-5 h-5 text-text-secondary" />
                  <span className="text-text-primary">{t.editor.downloadOptimized}</span>
                </button>

                {/* Edit Section */}
                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <Edit3 className="w-5 h-5 text-text-secondary" />
                  <span className="text-text-primary">{t.editor.editSection}</span>
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
                    {isOpeningCanva ? 'Conectando...' : t.editor.editInCanva}
                  </span>
                </button>

                {/* Share WhatsApp */}
                <button
                  onClick={() => handleShareWhatsApp(selectedSection)}
                  disabled={isSharing}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                >
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500">{t.editor.shareWhatsApp}</span>
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
                  <p className="text-xs text-text-secondary">{t.editor.willSendToEditor}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedForExport(new Map())}
                  className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  {t.editor.cancel}
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
                  {t.editor.sendToEditor}
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
              <h2 className="text-xl font-bold text-text-primary mb-2">{t.editor.editSection}</h2>
              
              {/* Edit Instruction */}
              <div className="mb-4">
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  {t.editor.editInstruction}
                </label>
                <textarea
                  placeholder={t.editor.editPlaceholder}
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                  rows={4}
                />
              </div>

              {/* Reference Image Upload */}
              <div className="mb-6">
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  {t.editor.refImage}
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
                      <span className="text-sm text-text-secondary">{t.editor.uploadImage}</span>
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
                  {t.editor.cancel}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleEdit}
                  isLoading={isEditing}
                >
                  {t.editor.applyEdit}
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
