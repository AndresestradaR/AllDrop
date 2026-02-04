'use client'

import { useState, useMemo, useEffect } from 'react'
import { ProductFilters } from '@/components/productos/ProductFilters'
import { ProductTable } from '@/components/productos/ProductTable'
import { CookieInput } from '@/components/productos/CookieInput'
import { ProductExplorer } from '@/components/productos/ProductExplorer'
import { Product, ProductFilters as Filters } from '@/lib/dropkiller/types'
import { Target, AlertCircle, Search, Users, TrendingUp, DollarSign, ExternalLink, Loader2, CheckCircle, XCircle, BarChart3, Calculator, Truck, Package, Megaphone, PiggyBank, Flame, Sparkles, TrendingDown, Settings, Gift, Tag, Check, Square, CheckSquare, ArrowRight, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
type TabType = 'catalog' | 'tiktok' | 'competitor'

// FastMoss Supabase config (separate from app's Supabase)
const FASTMOSS_SUPABASE_URL = 'https://papfcbiswvdgalfteujm.supabase.co'
const FASTMOSS_SUPABASE_KEY = 'sb_publishable_WVUzDgFTG0naCP8PJHc0kg_pT1dIXHf'

// TikTok Viral product type
interface TikTokProduct {
  product_id: string
  title: string
  img: string
  price: number
  currency: string
  sold_count: number
  day7_sold_count: number
  category_l1: string
  category_l2: string
  shop_name: string
  detail_url: string
  last_synced_at: string
}
type AnalysisPhase = 'search' | 'select' | 'analyze' | 'results'

// Fase 1: Resultados de búsqueda
interface SearchAd {
  id: string
  advertiserName: string
  landingUrl: string
  adText: string
  ctaText: string
  adLibraryUrl: string
  dropshippingScore: number
  imageUrl: string | null
  domain: string
}

// Fase 2: Resultados analizados
interface PriceOffer {
  label: string
  quantity: number
  price: number
  originalPrice?: number
}

interface AnalyzedCompetitor {
  id: string
  advertiserName: string
  landingUrl: string
  adLibraryUrl: string
  adText: string
  ctaText: string
  price: number | null
  priceFormatted: string | null
  allPrices?: PriceOffer[]
  combo: string | null
  gift: string | null
  angle: string | null
  headline: string | null
  cta: string | null
  source?: 'browserless' | 'jina'
  error?: string
}

interface AnalysisStats {
  total: number
  analyzed: number
  withPrice: number
  priceMin: number | null
  priceMax: number | null
  priceAvg: number | null
  withGift: number
  withCombo: number
}

export default function ProductResearchPage() {
  const [activeTab, setActiveTab] = useState<TabType>('catalog')
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [cookies, setCookies] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // State para análisis de competencia - Nuevo flujo 2 fases
  const [competitorKeyword, setCompetitorKeyword] = useState('')
  const [competitorCountry, setCompetitorCountry] = useState('CO')
  const [resultsLimit, setResultsLimit] = useState(10)
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('search')
  const [isSearching, setIsSearching] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Fase 1: Búsqueda
  const [searchResults, setSearchResults] = useState<SearchAd[]>([])
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set())
  const [searchStats, setSearchStats] = useState<{ totalFound: number; filteredCount: number } | null>(null)
  
  // Fase 2: Análisis
  const [analysisResults, setAnalysisResults] = useState<AnalyzedCompetitor[] | null>(null)
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Competidores manuales
  const [manualCompetitors, setManualCompetitors] = useState<AnalyzedCompetitor[]>([])
  const [showAddManualForm, setShowAddManualForm] = useState(false)
  const [manualForm, setManualForm] = useState({
    name: '',
    url: '',
    price1: '',
    price2: '',
    price3: ''
  })

  // TikTok Viral state
  const [tiktokProducts, setTiktokProducts] = useState<TikTokProduct[]>([])
  const [tiktokLoading, setTiktokLoading] = useState(false)
  const [tiktokCategory, setTiktokCategory] = useState('')
  const [tiktokSearch, setTiktokSearch] = useState('')
  const [tiktokSort, setTiktokSort] = useState<'day7_sold_count' | 'sold_count' | 'last_synced_at'>('day7_sold_count')

  // Load TikTok products from Supabase
  useEffect(() => {
    if (activeTab === 'tiktok') {
      loadTiktokProducts()
    }
  }, [activeTab])

  const loadTiktokProducts = async () => {
    setTiktokLoading(true)
    try {
      const response = await fetch(
        `${FASTMOSS_SUPABASE_URL}/rest/v1/fastmoss_products?select=*&order=day7_sold_count.desc&limit=200`,
        {
          headers: {
            'apikey': FASTMOSS_SUPABASE_KEY,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        console.error('Error loading TikTok products:', response.statusText)
        toast.error('Error al cargar productos de TikTok')
        return
      }

      const data = await response.json()
      setTiktokProducts(data || [])
    } catch (err) {
      console.error('Error:', err)
      toast.error('Error al conectar con FastMoss')
    } finally {
      setTiktokLoading(false)
    }
  }

  // Filter and sort TikTok products
  const filteredTiktokProducts = useMemo(() => {
    let filtered = tiktokProducts

    // Filter by category
    if (tiktokCategory) {
      filtered = filtered.filter(p => p.category_l1 === tiktokCategory)
    }

    // Filter by search
    if (tiktokSearch) {
      const searchLower = tiktokSearch.toLowerCase()
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(searchLower)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      if (tiktokSort === 'day7_sold_count') return (b.day7_sold_count || 0) - (a.day7_sold_count || 0)
      if (tiktokSort === 'sold_count') return (b.sold_count || 0) - (a.sold_count || 0)
      return new Date(b.last_synced_at).getTime() - new Date(a.last_synced_at).getTime()
    })

    return filtered
  }, [tiktokProducts, tiktokCategory, tiktokSearch, tiktokSort])

  // Get unique categories for filter dropdown
  const tiktokCategories = useMemo(() => {
    const cats = new Set(tiktokProducts.map(p => p.category_l1).filter(Boolean))
    return Array.from(cats).sort()
  }, [tiktokProducts])

  // State para calculadora de márgenes
  const [costProduct, setCostProduct] = useState<number | ''>('')
  const [costShipping, setCostShipping] = useState<number | ''>('')
  const [costCPA, setCostCPA] = useState<number | ''>('')
  const [effectiveRate, setEffectiveRate] = useState<number>(65)
  const [cancellationRate, setCancellationRate] = useState<number>(20)
  const [simPrice1, setSimPrice1] = useState<number | ''>('')
  const [simPrice2, setSimPrice2] = useState<number | ''>('')
  const [simPrice3, setSimPrice3] = useState<number | ''>('')

  const handleSearch = async (filters: Filters) => {
    if (!cookies) {
      toast.error('Primero ingresa tus cookies de DropKiller')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/productos/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, cookies }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al buscar productos')
      }

      setProducts(data.products)
      
      if (data.products.length === 0) {
        toast('No se encontraron productos con esos filtros', { icon: '🔍' })
      } else {
        toast.success(`Se encontraron ${data.products.length} productos`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  // FASE 1: Búsqueda rápida de anuncios
  const handleSearchCompetitors = async () => {
    if (!competitorKeyword.trim() || competitorKeyword.trim().length < 2) {
      toast.error('Ingresa una palabra clave (mínimo 2 caracteres)')
      return
    }

    setIsSearching(true)
    setSearchResults([])
    setSelectedAds(new Set())
    setAnalysisResults(null)
    setAnalysisStats(null)
    setAnalysisError(null)
    setAnalysisPhase('search')

    try {
      const response = await fetch('/api/competitor-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: competitorKeyword.trim(),
          country: competitorCountry,
          resultsLimit: resultsLimit
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al buscar competidores')
      }

      if (data.ads.length === 0) {
        toast('No se encontraron anuncios de ecommerce para esta keyword', { icon: '🔍' })
        setAnalysisPhase('search')
      } else {
        setSearchResults(data.ads)
        setSearchStats({ totalFound: data.totalFound, filteredCount: data.filteredCount })
        setAnalysisPhase('select')
        toast.success(`Se encontraron ${data.ads.length} tiendas de ecommerce`)
      }
    } catch (err: any) {
      const message = err.message || 'Error desconocido'
      setAnalysisError(message)
      toast.error(message)
    } finally {
      setIsSearching(false)
    }
  }

  // FASE 2: Análisis profundo de seleccionados
  const handleAnalyzeSelected = async () => {
    if (selectedAds.size === 0) {
      toast.error('Selecciona al menos un competidor para analizar')
      return
    }

    const adsToAnalyze = searchResults.filter(ad => selectedAds.has(ad.id))

    setIsAnalyzing(true)
    setAnalysisPhase('analyze')
    setAnalysisError(null)

    try {
      const response = await fetch('/api/competitor-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads: adsToAnalyze }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al analizar competidores')
      }

      setAnalysisResults(data.competitors)
      setAnalysisStats(data.stats)
      setAnalysisPhase('results')
      
      if (data.stats.withPrice > 0) {
        toast.success(`Análisis completo: ${data.stats.withPrice} con precios encontrados`)
      } else {
        toast('Análisis completo, pero no se encontraron precios', { icon: '⚠️' })
      }
    } catch (err: any) {
      const message = err.message || 'Error desconocido'
      setAnalysisError(message)
      setAnalysisPhase('select')
      toast.error(message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Toggle selección de anuncio
  const toggleAdSelection = (id: string) => {
    const newSelected = new Set(selectedAds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      if (newSelected.size >= 10) {
        toast.error('Máximo 10 competidores por análisis')
        return
      }
      newSelected.add(id)
    }
    setSelectedAds(newSelected)
  }

  // Seleccionar/deseleccionar todos
  const toggleSelectAll = () => {
    if (selectedAds.size === searchResults.length) {
      setSelectedAds(new Set())
    } else {
      const maxToSelect = searchResults.slice(0, 10)
      setSelectedAds(new Set(maxToSelect.map(ad => ad.id)))
    }
  }

  // Volver a búsqueda
  const handleBackToSearch = () => {
    setAnalysisPhase('search')
    setSearchResults([])
    setSelectedAds(new Set())
    setAnalysisResults(null)
    setAnalysisStats(null)
  }

  // Volver a selección
  const handleBackToSelect = () => {
    setAnalysisPhase('select')
    setAnalysisResults(null)
    setAnalysisStats(null)
  }

  // Agregar competidor manual
  const handleAddManualCompetitor = () => {
    if (!manualForm.name.trim() || !manualForm.price1) {
      toast.error('Nombre y precio de 1 unidad son requeridos')
      return
    }

    const allPrices: PriceOffer[] = []
    if (manualForm.price1) {
      allPrices.push({ label: '1 unidad', quantity: 1, price: Number(manualForm.price1) })
    }
    if (manualForm.price2) {
      allPrices.push({ label: '2 unidades', quantity: 2, price: Number(manualForm.price2) })
    }
    if (manualForm.price3) {
      allPrices.push({ label: '3 unidades', quantity: 3, price: Number(manualForm.price3) })
    }

    const newCompetitor: AnalyzedCompetitor = {
      id: `manual-${Date.now()}`,
      advertiserName: manualForm.name.trim(),
      landingUrl: manualForm.url || '',
      adLibraryUrl: '',
      adText: '',
      ctaText: '',
      price: Number(manualForm.price1),
      priceFormatted: `$${Number(manualForm.price1).toLocaleString()}`,
      allPrices,
      combo: null,
      gift: null,
      angle: null,
      headline: null,
      cta: null,
      source: 'browserless' as const,
    }

    setManualCompetitors(prev => [...prev, newCompetitor])
    setManualForm({ name: '', url: '', price1: '', price2: '', price3: '' })
    setShowAddManualForm(false)
    toast.success('Competidor agregado')
  }

  // Eliminar competidor manual
  const handleRemoveManualCompetitor = (id: string) => {
    setManualCompetitors(prev => prev.filter(c => c.id !== id))
  }

  // Combinar resultados con manuales
  const allCompetitors = useMemo(() => {
    if (!analysisResults) return manualCompetitors
    return [...analysisResults, ...manualCompetitors]
  }, [analysisResults, manualCompetitors])

  // Calcular estadísticas por cantidad (1, 2, 3 unidades)
  const pricesByQuantity = useMemo(() => {
    if (!allCompetitors || allCompetitors.length === 0) return null

    const grouped: { [qty: number]: number[] } = {}

    allCompetitors.forEach(comp => {
      if (comp.allPrices && comp.allPrices.length > 0) {
        comp.allPrices.forEach(offer => {
          const qty = offer.quantity || 1
          if (!grouped[qty]) grouped[qty] = []
          if (offer.price >= 20000 && offer.price <= 500000) {
            grouped[qty].push(offer.price)
          }
        })
      } else if (comp.price) {
        // Si no hay allPrices pero hay price, asumir qty=1
        if (!grouped[1]) grouped[1] = []
        grouped[1].push(comp.price)
      }
    })

    // Calcular stats por cantidad
    const result: { [qty: number]: { min: number; max: number; avg: number; count: number } } = {}

    Object.entries(grouped).forEach(([qty, prices]) => {
      if (prices.length > 0) {
        result[Number(qty)] = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          count: prices.length
        }
      }
    })

    return result
  }, [allCompetitors])

  // Cálculos de margen
  const marginCalc = useMemo(() => {
    if (!analysisStats || analysisStats.priceMin === null || analysisStats.priceAvg === null || costProduct === '' || costShipping === '' || costCPA === '') {
      return null
    }

    const minCompetitorPrice = analysisStats.priceMin
    const avgCompetitorPrice = analysisStats.priceAvg

    const totalCost = Number(costProduct) + Number(costShipping)
    // CPA ajustado por cancelaciones: CPA_real = CPA / (1 - cancelaciones/100)
    const adjustedCPA = Number(costCPA) / (1 - cancellationRate / 100)
    const totalCostWithCPA = totalCost + adjustedCPA

    const marginAtMinPrice = minCompetitorPrice - totalCostWithCPA
    const marginPercentAtMin = ((marginAtMinPrice / minCompetitorPrice) * 100)

    const marginAtAvgPrice = avgCompetitorPrice - totalCostWithCPA
    const marginPercentAtAvg = ((marginAtAvgPrice / avgCompetitorPrice) * 100)

    const realMarginAtMin = marginAtMinPrice * (effectiveRate / 100) - (totalCost * ((100 - effectiveRate) / 100))
    const realMarginAtAvg = marginAtAvgPrice * (effectiveRate / 100) - (totalCost * ((100 - effectiveRate) / 100))

    const minViablePrice = Math.ceil((totalCostWithCPA / (1 - 0.20)) / 100) * 100

    let verdict: 'go' | 'maybe' | 'nogo' = 'nogo'
    let verdictTitle = ''
    let verdictText = ''
    let verdictTip = ''

    if (realMarginAtMin >= 15000) {
      verdict = 'go'
      verdictTitle = '🔥 ¡Está pa\' darle!'
      verdictText = 'Parcero, los números cuadran bien. Hay buen margen incluso si te toca competir al precio más bajo. A meterle que este tiene potencial.'
      verdictTip = '🚀 Arranca con el precio promedio y vas ajustando según cómo responda el mercado.'
    } else if (realMarginAtAvg >= 15000) {
      verdict = 'maybe'
      verdictTitle = '🤔 Puede funcionar, pero ojo...'
      verdictText = 'El margen es justo si vendes al precio del montón. La clave acá es diferenciarte: mejor landing, mejor regalo, mejor ángulo. No te vayas a la guerra de precios que ahí perdemos todos.'
      verdictTip = `💡 Si lo vas a montar, véndelo mínimo a $${minViablePrice.toLocaleString()} para que te quede algo decente.`
    } else {
      verdict = 'nogo'
      verdictTitle = '😬 Este está difícil...'
      verdictText = 'Nea, con estos números el margen queda muy apretado. O consigues mejor precio con el proveedor, o mejor busca otro producto. No vale la pena quemarse por tan poquito.'
      verdictTip = `💸 Para que valga la pena tendrías que venderlo a $${minViablePrice.toLocaleString()} y la competencia está más abajo.`
    }

    return {
      totalCost,
      adjustedCPA,
      totalCostWithCPA,
      marginAtMinPrice,
      marginPercentAtMin,
      marginAtAvgPrice,
      marginPercentAtAvg,
      realMarginAtMin,
      realMarginAtAvg,
      minViablePrice,
      verdict,
      verdictTitle,
      verdictText,
      verdictTip
    }
  }, [analysisStats, costProduct, costShipping, costCPA, cancellationRate, effectiveRate])

  // Cálculos del simulador de precio (para 1, 2 y 3 unidades)
  const simulatedCalcs = useMemo(() => {
    if (costProduct === '' || costShipping === '' || costCPA === '') {
      return null
    }

    const adjustedCPA = Number(costCPA) / (1 - cancellationRate / 100)
    const results: { [qty: number]: { price: number; totalCost: number; marginBruto: number; marginPercent: number; marginReal: number; marginRealPercent: number } } = {}

    const prices = [
      { qty: 1, price: simPrice1 },
      { qty: 2, price: simPrice2 },
      { qty: 3, price: simPrice3 }
    ]

    prices.forEach(({ qty, price }) => {
      if (price !== '' && Number(price) > 0) {
        const p = Number(price)
        const productCost = Number(costProduct) * qty
        const totalCost = productCost + Number(costShipping) + adjustedCPA
        const marginBruto = p - totalCost
        const marginPercent = (marginBruto / p) * 100
        const marginReal = marginBruto * (effectiveRate / 100) - ((productCost + Number(costShipping)) * ((100 - effectiveRate) / 100))
        const marginRealPercent = (marginReal / p) * 100

        results[qty] = {
          price: p,
          totalCost,
          marginBruto,
          marginPercent,
          marginReal,
          marginRealPercent
        }
      }
    })

    return Object.keys(results).length > 0 ? results : null
  }, [simPrice1, simPrice2, simPrice3, costProduct, costShipping, costCPA, cancellationRate, effectiveRate])

  // Score badge color
  const getScoreBadge = (score: number) => {
    if (score >= 5) return { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Alto' }
    if (score >= 2) return { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'Medio' }
    return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Bajo' }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
          <Target className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Encuentra tu Producto Ganador
          </h1>
          <p className="text-text-secondary">
            Explora el catálogo de Dropi, busca en tiempo real o analiza la competencia
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-surface rounded-xl border border-border w-fit">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'bg-accent text-background'
              : 'text-text-secondary hover:text-text-primary hover:bg-background'
          }`}
        >
          <Database className="w-4 h-4" />
          Explorar Catálogo
          <span className="text-xs bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">14k+</span>
        </button>
        <button
          onClick={() => setActiveTab('competitor')}
          className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'competitor'
              ? 'bg-accent text-background'
              : 'text-text-secondary hover:text-text-primary hover:bg-background'
          }`}
        >
          <Users className="w-4 h-4" />
          Analizar Competencia
        </button>
        <button
          onClick={() => setActiveTab('tiktok')}
          className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'tiktok'
              ? 'bg-accent text-background'
              : 'text-text-secondary hover:text-text-primary hover:bg-background'
          }`}
        >
          <Flame className="w-4 h-4" />
          TikTok Viral
          <span className="text-xs bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded">NEW</span>
        </button>
      </div>

      {/* Tab Content: Explorar Catálogo */}
      {activeTab === 'catalog' && (
        <ProductExplorer />
      )}

      {/* Tab Content: TikTok Viral */}
      {activeTab === 'tiktok' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    value={tiktokSearch}
                    onChange={(e) => setTiktokSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </div>
              <select
                value={tiktokCategory}
                onChange={(e) => setTiktokCategory(e.target.value)}
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">Todas las categorías</option>
                {tiktokCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={tiktokSort}
                onChange={(e) => setTiktokSort(e.target.value as typeof tiktokSort)}
                className="px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="day7_sold_count">Ventas 7 días</option>
                <option value="sold_count">Ventas totales</option>
                <option value="last_synced_at">Más recientes</option>
              </select>
              <button
                onClick={loadTiktokProducts}
                disabled={tiktokLoading}
                className="px-4 py-2.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors flex items-center gap-2"
              >
                {tiktokLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                Actualizar
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="text-text-secondary text-sm">
            {filteredTiktokProducts.length} productos encontrados
            {tiktokCategory && ` en ${tiktokCategory}`}
          </div>

          {/* Loading state */}
          {tiktokLoading && (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">Cargando productos virales de TikTok...</p>
            </div>
          )}

          {/* Empty state */}
          {!tiktokLoading && filteredTiktokProducts.length === 0 && (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Flame className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No hay productos disponibles
              </h3>
              <p className="text-text-secondary max-w-md mx-auto">
                {tiktokSearch || tiktokCategory
                  ? 'No se encontraron productos con esos filtros. Intenta con otros criterios.'
                  : 'Los productos de TikTok Shop se sincronizan automáticamente. Vuelve más tarde.'}
              </p>
            </div>
          )}

          {/* Products Grid */}
          {!tiktokLoading && filteredTiktokProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTiktokProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="bg-surface rounded-xl border border-border overflow-hidden hover:border-accent/50 transition-all group"
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gradient-to-br from-orange-500/20 to-accent/20 flex items-center justify-center">
                    <div className="text-center">
                      <Flame className="w-10 h-10 text-orange-500/60 mx-auto mb-2" />
                      <span className="text-xs text-text-secondary">TikTok Shop</span>
                    </div>
                    {/* Sales badge */}
                    {product.day7_sold_count > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-orange-500/90 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {product.day7_sold_count.toLocaleString()} /7d
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-medium text-text-primary text-sm line-clamp-2 mb-2 min-h-[40px]">
                      {product.title}
                    </h3>

                    <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
                      <span className="px-2 py-1 bg-accent/10 text-accent rounded truncate max-w-[120px]">
                        {product.category_l1 || 'Sin categoría'}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {(product.sold_count || 0).toLocaleString()} total
                      </span>
                    </div>

                    {product.price > 0 && (
                      <p className="text-lg font-bold text-text-primary mb-3">
                        ${product.price.toLocaleString()} <span className="text-xs font-normal text-text-secondary">{product.currency || 'USD'}</span>
                      </p>
                    )}

                    <a
                      href={product.detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center px-4 py-2 bg-accent hover:bg-accent/90 text-background font-medium rounded-lg transition-colors text-sm"
                    >
                      Ver en FastMoss
                      <ExternalLink className="w-3 h-3 inline ml-1" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center text-sm text-text-secondary/70 py-4">
            <p>Productos sincronizados desde TikTok Shop via FastMoss</p>
          </div>
        </div>
      )}

      {/* Tab Content: Analizar Competencia */}
      {activeTab === 'competitor' && (
        <div className="space-y-6">
          {/* Search Form - Siempre visible excepto en resultados */}
          {analysisPhase !== 'results' && (
            <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {analysisPhase === 'search' ? 'Buscar Competencia' : 'Búsqueda: ' + competitorKeyword}
                </h2>
              </div>
              
              {analysisPhase === 'search' && (
                <p className="text-text-secondary text-sm">
                  Escribe el nombre del producto y buscaremos quién lo está vendiendo en Meta Ads.
                  Luego podrás seleccionar cuáles analizar en detalle.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                    <Search className="w-4 h-4" />
                    Producto a buscar
                  </label>
                  <input
                    type="text"
                    value={competitorKeyword}
                    onChange={(e) => setCompetitorKeyword(e.target.value)}
                    placeholder="Ej: sartén antiadherente, faja colombiana, serum vitamina c"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchCompetitors()}
                    disabled={analysisPhase !== 'search'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    País
                  </label>
                  <select
                    value={competitorCountry}
                    onChange={(e) => setCompetitorCountry(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    disabled={analysisPhase !== 'search'}
                  >
                    <option value="CO">🇨🇴 Colombia</option>
                    <option value="MX">🇲🇽 México</option>
                    <option value="GT">🇬🇹 Guatemala</option>
                    <option value="PE">🇵🇪 Perú</option>
                    <option value="EC">🇪🇨 Ecuador</option>
                    <option value="CL">🇨🇱 Chile</option>
                    <option value="AR">🇦🇷 Argentina</option>
                    <option value="PA">🇵🇦 Panamá</option>
                    <option value="PY">🇵🇾 Paraguay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Resultados
                  </label>
                  <select
                    value={resultsLimit}
                    onChange={(e) => setResultsLimit(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    disabled={analysisPhase !== 'search'}
                  >
                    <option value={10}>10 resultados</option>
                    <option value={20}>20 resultados</option>
                    <option value={30}>30 resultados</option>
                    <option value={40}>40 resultados</option>
                    <option value={50}>50 resultados</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {analysisPhase === 'search' ? (
                  <button
                    onClick={handleSearchCompetitors}
                    disabled={isSearching}
                    className="px-6 py-3 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-background font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Buscar Competidores
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleBackToSearch}
                    className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                  >
                    ← Nueva búsqueda
                  </button>
                )}

                <Link 
                  href="/dashboard/settings"
                  className="text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1"
                >
                  <Settings className="w-4 h-4" />
                  Configurar API Key
                </Link>
              </div>

              {analysisPhase === 'search' && (
                <p className="text-xs text-text-secondary/70">
                  💡 Usa keywords específicas para mejores resultados. Ej: &quot;sartén cerámica&quot; en vez de solo &quot;sartén&quot;
                </p>
              )}

              {searchStats && analysisPhase === 'select' && (
                <p className="text-xs text-text-secondary/70">
                  📊 Se encontraron {searchStats.totalFound} anuncios, {searchStats.filteredCount} pasaron los filtros de ecommerce, mostrando {searchResults.length} únicos
                </p>
              )}
            </div>
          )}

          {/* Error Alert */}
          {analysisError && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-error">Error en el análisis</p>
                <p className="text-sm text-error/80">{analysisError}</p>
                {analysisError.includes('API key') && (
                  <Link 
                    href="/dashboard/settings" 
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-2"
                  >
                    <Settings className="w-4 h-4" />
                    Ir a Configuración
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* FASE 1: Selección de competidores */}
          {analysisPhase === 'select' && searchResults.length > 0 && (
            <div className="space-y-4">
              {/* Selection Header */}
              <div className="bg-surface rounded-xl border border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {selectedAds.size === searchResults.length ? (
                      <CheckSquare className="w-5 h-5 text-accent" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                    Seleccionar todos
                  </button>
                  <span className="text-sm text-text-secondary">
                    {selectedAds.size} de {searchResults.length} seleccionados
                  </span>
                </div>

                <button
                  onClick={handleAnalyzeSelected}
                  disabled={selectedAds.size === 0 || isAnalyzing}
                  className="px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:bg-accent/30 text-background font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      Analizar Seleccionados
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Ad Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((ad) => {
                  const isSelected = selectedAds.has(ad.id)
                  const scoreBadge = getScoreBadge(ad.dropshippingScore)
                  
                  return (
                    <div
                      key={ad.id}
                      onClick={() => toggleAdSelection(ad.id)}
                      className={`bg-surface rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg ${
                        isSelected 
                          ? 'border-accent bg-accent/5' 
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-text-primary truncate">
                              {ad.advertiserName}
                            </h3>
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-text-secondary truncate">{ad.domain}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${scoreBadge.bg} ${scoreBadge.text}`}>
                          {scoreBadge.label}
                        </span>
                      </div>

                      {/* CTA Badge */}
                      {ad.ctaText && (
                        <div className="mb-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent rounded text-xs font-medium">
                            🔘 {ad.ctaText}
                          </span>
                        </div>
                      )}

                      {/* Ad Text Preview */}
                      <p className="text-sm text-text-secondary line-clamp-3 mb-3">
                        {ad.adText || 'Sin texto del anuncio'}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <a
                          href={ad.landingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-accent hover:underline flex items-center gap-1"
                        >
                          Ver landing <ExternalLink className="w-3 h-3" />
                        </a>
                        {ad.adLibraryUrl && (
                          <a
                            href={ad.adLibraryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-text-secondary hover:text-accent flex items-center gap-1"
                          >
                            Ver anuncio <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-center text-xs text-text-secondary/70">
                Selecciona los competidores relevantes para tu producto
              </p>
            </div>
          )}

          {/* FASE 2: Analizando */}
          {analysisPhase === 'analyze' && (
            <div className="bg-surface rounded-xl border border-border p-8 text-center">
              <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Analizando {selectedAds.size} landing pages...
              </h3>
              <p className="text-text-secondary">
                Esto puede tomar 30-60 segundos. Estamos extrayendo precios, combos y ofertas.
              </p>
            </div>
          )}

          {/* FASE 3: Resultados */}
          {analysisPhase === 'results' && analysisResults && analysisStats && (
            <>
              {/* Back Button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToSelect}
                  className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                >
                  ← Volver a selección
                </button>
                <button
                  onClick={handleBackToSearch}
                  className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                >
                  🔍 Nueva búsqueda
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="bg-surface rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Analizados</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {analysisStats.analyzed}/{analysisStats.total}
                  </p>
                </div>

                {analysisStats.priceMin && (
                  <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 text-text-secondary mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Mínimo</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">${analysisStats.priceMin.toLocaleString()}</p>
                  </div>
                )}

                {analysisStats.priceAvg && (
                  <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 text-text-secondary mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">Promedio</span>
                    </div>
                    <p className="text-2xl font-bold text-accent">${analysisStats.priceAvg.toLocaleString()}</p>
                  </div>
                )}

                {analysisStats.priceMax && (
                  <div className="bg-surface rounded-xl border border-border p-4">
                    <div className="flex items-center gap-2 text-text-secondary mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Máximo</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-500">${analysisStats.priceMax.toLocaleString()}</p>
                  </div>
                )}

                <div className="bg-surface rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <Gift className="w-4 h-4" />
                    <span className="text-sm">Con Regalo</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-500">{analysisStats.withGift}</p>
                </div>

                <div className="bg-surface rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <Tag className="w-4 h-4" />
                    <span className="text-sm">Con Combo</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-500">{analysisStats.withCombo}</p>
                </div>
              </div>

              {/* Competitors Table */}
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">Detalle de Competidores</h3>
                  <button
                    onClick={() => setShowAddManualForm(!showAddManualForm)}
                    className="px-3 py-1.5 text-sm bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {showAddManualForm ? 'Cancelar' : '+ Agregar Competidor'}
                  </button>
                </div>

                {/* Formulario para agregar competidor manual */}
                {showAddManualForm && (
                  <div className="p-4 bg-background border-b border-border">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs text-text-secondary">Nombre tienda *</label>
                        <input
                          type="text"
                          value={manualForm.name}
                          onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Mi Competidor"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Precio 1 und *</label>
                        <input
                          type="number"
                          value={manualForm.price1}
                          onChange={(e) => setManualForm(prev => ({ ...prev, price1: e.target.value }))}
                          placeholder="79900"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Precio 2 und</label>
                        <input
                          type="number"
                          value={manualForm.price2}
                          onChange={(e) => setManualForm(prev => ({ ...prev, price2: e.target.value }))}
                          placeholder="109900"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary">Precio 3 und</label>
                        <input
                          type="number"
                          value={manualForm.price3}
                          onChange={(e) => setManualForm(prev => ({ ...prev, price3: e.target.value }))}
                          placeholder="159600"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={handleAddManualCompetitor}
                          className="w-full px-3 py-2 bg-accent text-background text-sm font-medium rounded-lg hover:bg-accent/90"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Tienda</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-text-secondary">Precio</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Combo/Oferta</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Regalo</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">Ángulo de Venta</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-text-secondary">CTA</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-text-secondary w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allCompetitors.map((competitor, index) => (
                        <tr key={index} className="hover:bg-background/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="font-medium text-text-primary text-sm">{competitor.advertiserName}</p>
                              {competitor.error ? (
                                <span className="text-red-500 text-xs flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  {competitor.error}
                                </span>
                              ) : (
                                <a 
                                  href={competitor.landingUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-accent hover:underline flex items-center gap-1 text-xs"
                                >
                                  Ver landing
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {competitor.price ? (
                              <div className="space-y-1">
                                <span className="font-semibold text-text-primary block">
                                  {competitor.priceFormatted || `$${competitor.price.toLocaleString()}`}
                                </span>
                                {competitor.allPrices && competitor.allPrices.length > 1 && (
                                  <div className="space-y-0.5">
                                    {competitor.allPrices.slice(0, 3).map((offer, idx) => (
                                      <div key={idx} className="text-xs flex items-center gap-2 text-text-secondary">
                                        <span className="truncate max-w-[80px]">{offer.label}:</span>
                                        <span className="text-text-primary">${offer.price.toLocaleString()}</span>
                                        {offer.originalPrice && (
                                          <span className="line-through text-text-secondary/60">${offer.originalPrice.toLocaleString()}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {competitor.source && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${competitor.source === 'browserless' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                    {competitor.source === 'browserless' ? 'Browser' : 'Jina'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-text-secondary text-sm">No encontrado</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-left text-sm">
                            {competitor.combo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs">
                                <Tag className="w-3 h-3" />
                                {competitor.combo.length > 25 ? competitor.combo.slice(0, 25) + '...' : competitor.combo}
                              </span>
                            ) : (
                              <span className="text-text-secondary">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-left text-sm">
                            {competitor.gift ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded-full text-xs">
                                <Gift className="w-3 h-3" />
                                {competitor.gift.length > 25 ? competitor.gift.slice(0, 25) + '...' : competitor.gift}
                              </span>
                            ) : (
                              <span className="text-text-secondary">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-left text-sm text-text-secondary max-w-[200px]">
                            <span className="line-clamp-2">{competitor.angle || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-left text-sm">
                            {competitor.cta ? (
                              <span className="text-accent font-medium">{competitor.cta}</span>
                            ) : (
                              <span className="text-text-secondary">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {competitor.id.startsWith('manual-') ? (
                              <button
                                onClick={() => handleRemoveManualCompetitor(competitor.id)}
                                className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                title="Eliminar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-xs text-text-secondary/50">Auto</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculadora de Márgenes */}
              {(analysisStats.priceMin && analysisStats.priceAvg) || allCompetitors.length > 0 ? (
                <div className="bg-surface rounded-xl border border-border p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5 text-accent" />
                    <h2 className="text-lg font-semibold text-text-primary">Calculadora de Márgenes</h2>
                  </div>
                  
                  <p className="text-text-secondary text-sm mb-6">
                    Mete tus costos acá y miramos si los números dan o si toca buscar otro producto 👇
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                        <Package className="w-4 h-4" />
                        Costo Proveedor
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                        <input
                          type="number"
                          value={costProduct}
                          onChange={(e) => setCostProduct(e.target.value ? Number(e.target.value) : '')}
                          placeholder="25000"
                          className="w-full pl-8 pr-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                        <Truck className="w-4 h-4" />
                        Costo Flete
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                        <input
                          type="number"
                          value={costShipping}
                          onChange={(e) => setCostShipping(e.target.value ? Number(e.target.value) : '')}
                          placeholder="12000"
                          className="w-full pl-8 pr-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                        <Megaphone className="w-4 h-4" />
                        CPA (Publicidad)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                        <input
                          type="number"
                          value={costCPA}
                          onChange={(e) => setCostCPA(e.target.value ? Number(e.target.value) : '')}
                          placeholder="15000"
                          className="w-full pl-8 pr-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                        <XCircle className="w-4 h-4" />
                        % Cancelaciones
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={cancellationRate}
                          onChange={(e) => setCancellationRate(Number(e.target.value) || 20)}
                          placeholder="20"
                          min={0}
                          max={80}
                          className="w-full pl-4 pr-8 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                        <PiggyBank className="w-4 h-4" />
                        % Efectividad
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={effectiveRate}
                          onChange={(e) => setEffectiveRate(Number(e.target.value) || 65)}
                          placeholder="65"
                          min={0}
                          max={100}
                          className="w-full pl-4 pr-8 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>
                      </div>
                    </div>
                  </div>

                  {marginCalc && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-background rounded-lg">
                        <div>
                          <p className="text-xs text-text-secondary mb-1">Costo Total (Producto + Flete)</p>
                          <p className="text-lg font-semibold text-text-primary">${marginCalc.totalCost.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary mb-1">CPA Ajustado ({cancellationRate}% cancel.)</p>
                          <p className="text-lg font-semibold text-orange-500">${Math.round(marginCalc.adjustedCPA).toLocaleString()}</p>
                          <p className="text-[10px] text-text-secondary">CPA base: ${Number(costCPA).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary mb-1">Costo Total + CPA</p>
                          <p className="text-lg font-semibold text-text-primary">${Math.round(marginCalc.totalCostWithCPA).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-secondary mb-1">Precio Mín. pa&apos; que cuadre</p>
                          <p className="text-lg font-semibold text-accent">${marginCalc.minViablePrice.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Cards por cantidad */}
                      {pricesByQuantity && Object.keys(pricesByQuantity).length > 0 ? (
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-text-secondary">Análisis por cantidad de unidades</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map(qty => {
                              const qtyData = pricesByQuantity[qty]
                              if (!qtyData) return null

                              const costForQty = (Number(costProduct) * qty) + Number(costShipping)
                              // CPA ajustado por cancelaciones
                              const adjustedCPAForCalc = Number(costCPA) / (1 - cancellationRate / 100)
                              const costWithCPA = costForQty + adjustedCPAForCalc
                              const marginAtAvg = qtyData.avg - costWithCPA
                              const marginPercent = (marginAtAvg / qtyData.avg) * 100
                              const realMargin = marginAtAvg * (effectiveRate / 100) - (costForQty * ((100 - effectiveRate) / 100))

                              return (
                                <div
                                  key={qty}
                                  className={`p-4 rounded-lg border ${realMargin >= 15000 ? 'bg-green-500/5 border-green-500/30' : realMargin >= 0 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-red-500/5 border-red-500/30'}`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-semibold text-text-primary">
                                      Vendiendo {qty} unidad{qty > 1 ? 'es' : ''}
                                    </h5>
                                    <span className="text-xs text-text-secondary bg-background px-2 py-1 rounded">
                                      {qtyData.count} competidores
                                    </span>
                                  </div>

                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Precio promedio:</span>
                                      <span className="text-text-primary font-medium">${qtyData.avg.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Rango:</span>
                                      <span className="text-text-secondary">${qtyData.min.toLocaleString()} - ${qtyData.max.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Tu costo ({qty}u + flete + CPA):</span>
                                      <span className="text-text-primary">${Math.round(costWithCPA).toLocaleString()}</span>
                                    </div>
                                    <hr className="border-border" />
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Margen bruto:</span>
                                      <span className={marginAtAvg >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                                        ${Math.round(marginAtAvg).toLocaleString()} ({marginPercent.toFixed(0)}%)
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-text-secondary">Margen real ({effectiveRate}%):</span>
                                      <span className={`font-bold ${realMargin >= 15000 ? 'text-green-500' : realMargin >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        ${Math.round(realMargin).toLocaleString()}
                                      </span>
                                    </div>
                                    <hr className="border-border" />
                                    <div className={`text-xs font-medium px-2 py-1 rounded text-center ${realMargin >= 15000 ? 'bg-green-500/10 text-green-500' : realMargin >= 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                      {realMargin >= 15000 ? '🟢 Rentable' : realMargin >= 0 ? '🟡 Ajustado' : '🔴 No rentable'}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium text-text-secondary">Análisis por escenario de precio</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Card MÍNIMO */}
                            <div className={`p-4 rounded-lg border ${marginCalc.realMarginAtMin >= 15000 ? 'bg-green-500/5 border-green-500/30' : marginCalc.realMarginAtMin >= 0 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-semibold text-text-primary flex items-center gap-2">
                                  📉 Si vendes al MÍNIMO
                                </h5>
                                <span className="text-lg font-bold text-text-primary">${analysisStats.priceMin?.toLocaleString()}</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Tu costo:</span>
                                  <span className="text-text-primary">${Math.round(marginCalc.totalCostWithCPA).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Margen bruto:</span>
                                  <span className={marginCalc.marginAtMinPrice >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                                    ${Math.round(marginCalc.marginAtMinPrice).toLocaleString()} ({marginCalc.marginPercentAtMin.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Margen real ({effectiveRate}%):</span>
                                  <span className={`font-bold ${marginCalc.realMarginAtMin >= 15000 ? 'text-green-500' : marginCalc.realMarginAtMin >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    ${Math.round(marginCalc.realMarginAtMin).toLocaleString()}
                                  </span>
                                </div>
                                <hr className="border-border" />
                                <div className={`text-xs font-medium px-2 py-1 rounded ${marginCalc.realMarginAtMin >= 15000 ? 'bg-green-500/10 text-green-500' : marginCalc.realMarginAtMin >= 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {marginCalc.realMarginAtMin >= 15000 ? '🟢 Rentable' : marginCalc.realMarginAtMin >= 0 ? '🟡 Ajustado, cuidado' : '🔴 No rentable - pierdes plata'}
                                </div>
                              </div>
                            </div>

                            {/* Card PROMEDIO */}
                            <div className={`p-4 rounded-lg border ${marginCalc.realMarginAtAvg >= 15000 ? 'bg-green-500/5 border-green-500/30' : marginCalc.realMarginAtAvg >= 0 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-semibold text-text-primary flex items-center gap-2">
                                  📊 Si vendes al PROMEDIO
                                </h5>
                                <span className="text-lg font-bold text-text-primary">${analysisStats.priceAvg?.toLocaleString()}</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Tu costo:</span>
                                  <span className="text-text-primary">${Math.round(marginCalc.totalCostWithCPA).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Margen bruto:</span>
                                  <span className={marginCalc.marginAtAvgPrice >= 0 ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                                    ${Math.round(marginCalc.marginAtAvgPrice).toLocaleString()} ({marginCalc.marginPercentAtAvg.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Margen real ({effectiveRate}%):</span>
                                  <span className={`font-bold ${marginCalc.realMarginAtAvg >= 15000 ? 'text-green-500' : marginCalc.realMarginAtAvg >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    ${Math.round(marginCalc.realMarginAtAvg).toLocaleString()}
                                  </span>
                                </div>
                                <hr className="border-border" />
                                <div className={`text-xs font-medium px-2 py-1 rounded ${marginCalc.realMarginAtAvg >= 15000 ? 'bg-green-500/10 text-green-500' : marginCalc.realMarginAtAvg >= 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {marginCalc.realMarginAtAvg >= 15000 ? '🟢 Rentable' : marginCalc.realMarginAtAvg >= 0 ? '🟡 Ajustado, cuidado' : '🔴 No rentable - pierdes plata'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className={`p-6 rounded-xl border ${
                        marginCalc.verdict === 'go' 
                          ? 'bg-gradient-to-r from-green-500/10 to-accent/10 border-green-500/30' 
                          : marginCalc.verdict === 'maybe'
                          ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30'
                          : 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
                      }`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            marginCalc.verdict === 'go' 
                              ? 'bg-green-500/20' 
                              : marginCalc.verdict === 'maybe'
                              ? 'bg-yellow-500/20'
                              : 'bg-red-500/20'
                          }`}>
                            {marginCalc.verdict === 'go' ? (
                              <Flame className="w-6 h-6 text-green-500" />
                            ) : marginCalc.verdict === 'maybe' ? (
                              <Sparkles className="w-6 h-6 text-yellow-500" />
                            ) : (
                              <TrendingDown className="w-6 h-6 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-lg font-semibold mb-2 ${
                              marginCalc.verdict === 'go' 
                                ? 'text-green-500' 
                                : marginCalc.verdict === 'maybe'
                                ? 'text-yellow-500'
                                : 'text-red-500'
                            }`}>
                              {marginCalc.verdictTitle}
                            </h3>
                            <p className="text-text-secondary mb-3">
                              {marginCalc.verdictText}
                            </p>
                            <p className="text-sm text-text-secondary/80 bg-background/50 rounded-lg px-3 py-2">
                              {marginCalc.verdictTip}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Simulador de precio personalizado - 3 inputs */}
                  <div className="mt-6 p-4 bg-background rounded-lg border border-border">
                    <h4 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Simulador de Precio - ¿A cuánto venderías?
                    </h4>

                    {/* 3 inputs independientes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">¿A cuánto venderías 1 unidad?</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                          <input
                            type="number"
                            value={simPrice1}
                            onChange={(e) => setSimPrice1(e.target.value ? Number(e.target.value) : '')}
                            placeholder="Ej: 79900"
                            className="w-full pl-8 pr-4 py-2.5 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">¿A cuánto venderías 2 unidades?</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                          <input
                            type="number"
                            value={simPrice2}
                            onChange={(e) => setSimPrice2(e.target.value ? Number(e.target.value) : '')}
                            placeholder="Ej: 119900"
                            className="w-full pl-8 pr-4 py-2.5 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">¿A cuánto venderías 3 unidades?</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                          <input
                            type="number"
                            value={simPrice3}
                            onChange={(e) => setSimPrice3(e.target.value ? Number(e.target.value) : '')}
                            placeholder="Ej: 159900"
                            className="w-full pl-8 pr-4 py-2.5 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Análisis de los precios ingresados */}
                    {simulatedCalcs && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(qty => {
                          const calc = simulatedCalcs[qty]
                          if (!calc) return null

                          const marginRealPercent = (calc.marginReal / calc.price) * 100

                          return (
                            <div
                              key={qty}
                              className={`p-3 rounded-lg border ${calc.marginReal >= calc.price * 0.15 ? 'bg-green-500/5 border-green-500/30' : calc.marginReal >= 0 ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-red-500/5 border-red-500/30'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-text-primary">
                                  Vendiendo {qty} unidad{qty > 1 ? 'es' : ''}
                                </span>
                                <span className="text-sm font-bold text-text-primary">${calc.price.toLocaleString()}</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Tu costo:</span>
                                  <span className="text-text-primary">${Math.round(calc.totalCost).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Margen bruto:</span>
                                  <span className={calc.marginBruto >= 0 ? 'text-green-500' : 'text-red-500'}>
                                    ${Math.round(calc.marginBruto).toLocaleString()} ({calc.marginPercent.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-text-secondary">Margen real ({effectiveRate}%):</span>
                                  <span className={`font-semibold ${calc.marginReal >= calc.price * 0.15 ? 'text-green-500' : calc.marginReal >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    ${Math.round(calc.marginReal).toLocaleString()}
                                  </span>
                                </div>
                                <div className={`mt-2 text-xs font-medium px-2 py-1 rounded text-center ${calc.marginReal >= calc.price * 0.15 ? 'bg-green-500/10 text-green-500' : calc.marginReal >= 0 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                  {calc.marginReal >= calc.price * 0.15 ? '🟢 Rentable' : calc.marginReal >= 0 ? '🟡 Ajustado' : '🔴 No rentable'}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!simulatedCalcs && (
                      <p className="text-xs text-text-secondary/70 text-center">
                        Ingresa al menos un precio para ver el análisis
                      </p>
                    )}
                  </div>

                  {!marginCalc && (
                    <div className="text-center py-6 text-text-secondary">
                      <Calculator className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Llena todos los campos pa&apos; ver si los números dan 📊</p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="text-center text-sm text-text-secondary/70 py-4">
                <p>Datos extraidos automaticamente de las landing pages</p>
              </div>
            </>
          )}

          {/* Empty State */}
          {analysisPhase === 'search' && !isSearching && searchResults.length === 0 && !analysisError && (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Espía a tu competencia en 2 pasos
              </h3>
              <p className="text-text-secondary max-w-md mx-auto mb-4">
                Busca, selecciona y analiza solo los competidores que te interesan:
              </p>
              <ol className="text-left max-w-sm mx-auto text-sm text-text-secondary space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="text-text-primary">Búsqueda rápida (~15 seg)</strong>
                    <p className="text-xs">Encontramos tiendas en Meta Ads, filtradas por CTAs de ecommerce</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="text-text-primary">Selecciona los relevantes</strong>
                    <p className="text-xs">Elige solo los que venden tu producto, ignora el resto</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="text-text-primary">Análisis profundo</strong>
                    <p className="text-xs">Extraemos precios, combos, regalos y ángulos de venta</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                  <div>
                    <strong className="text-text-primary">Calculadora de márgenes</strong>
                    <p className="text-xs">Te decimos si el margen da o toca buscar otro producto</p>
                  </div>
                </li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
