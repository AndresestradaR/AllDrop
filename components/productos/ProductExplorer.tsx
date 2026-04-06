'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, Package, TrendingUp, DollarSign, Loader2, ChevronLeft, ChevronRight, BarChart3, Flame, ShoppingCart, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'

const API_URL = '/api/product-proxy'

interface Product {
  id: string
  externalId: string
  name: string
  salePrice: number
  suggestedPrice: number
  totalSoldUnits: number
  soldUnitsLast30Days: number
  soldUnitsLast7Days: number
  billingLast30Days: number
  stock: number
  status: string
  category: string
  provider: string
  image: string | null
}

interface Stats {
  total_productos: number
  productos_con_ventas: number
  ventas_total: number
  ventas_promedio_30d: number
  precio_promedio: number
  top_100_ventas: number
  top_categorias: Array<{ categoria: string; ventas_30d: number }>
}

interface Category {
  name: string
  count: number
}

export function ProductExplorer() {
  const router = useRouter()
  const { t } = useI18n()

  // State
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [minVentas, setMinVentas] = useState<number | ''>(100)
  const [maxVentas, setMaxVentas] = useState<number | ''>('')
  const [minPrecio, setMinPrecio] = useState<number | ''>('')
  const [maxPrecio, setMaxPrecio] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState('soldUnitsLast30Days')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Load stats and categories on mount
  useEffect(() => {
    loadStats()
    loadCategories()
  }, [])

  // Load products on filter change
  useEffect(() => {
    loadProducts()
  }, [offset, sortBy, sortOrder])

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categorias`)
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('q', searchQuery)
      if (selectedCategory) params.append('categoria', selectedCategory)
      if (minVentas !== '') params.append('min_ventas', String(minVentas))
      if (maxVentas !== '') params.append('max_ventas', String(maxVentas))
      if (minPrecio !== '') params.append('min_precio', String(minPrecio))
      if (maxPrecio !== '') params.append('max_precio', String(maxPrecio))
      params.append('limit', String(limit))
      params.append('offset', String(offset))
      params.append('sort_by', sortBy)
      params.append('sort_order', sortOrder)

      const res = await fetch(`${API_URL}/api/productos?${params}`)
      const data = await res.json()
      
      setProducts(data.productos || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Error loading products:', err)
      toast.error('Error al cargar productos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    setOffset(0)
    loadProducts()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-CO').format(value)
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {isLoadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse">
              <div className="h-4 bg-border rounded w-20 mb-2"></div>
              <div className="h-8 bg-border rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <Package className="w-4 h-4" />
              <span className="text-sm">{t.productResearch.totalProducts}</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{formatNumber(stats.total_productos)}</p>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-sm">{t.productResearch.withSales}</span>
            </div>
            <p className="text-2xl font-bold text-accent">{formatNumber(stats.productos_con_ventas)}</p>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <Flame className="w-4 h-4" />
              <span className="text-sm">{t.productResearch.totalSales}</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{formatNumber(stats.ventas_total)}</p>
          </div>
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-text-secondary mb-1">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">{t.productResearch.topSellers}</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">{formatNumber(stats.top_100_ventas)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-text-primary">{t.productResearch.filters}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.searchProduct}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.productResearch.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.category}</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="">{t.productResearch.allCategories}</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.orderBy}</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field)
                setSortOrder(order as 'asc' | 'desc')
              }}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="soldUnitsLast30Days-desc">{t.productResearch.bestSelling30d}</option>
              <option value="soldUnitsLast7Days-desc">{t.productResearch.bestSelling7d}</option>
              <option value="totalSoldUnits-desc">{t.productResearch.bestSellingTotal}</option>
              <option value="salePrice-asc">{t.productResearch.priceLowHigh}</option>
              <option value="salePrice-desc">{t.productResearch.priceHighLow}</option>
              <option value="billingLast30Days-desc">{t.productResearch.highestRevenue}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Min Ventas */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.minSalesMonth}</label>
            <input
              type="number"
              value={minVentas}
              onChange={(e) => setMinVentas(e.target.value ? Number(e.target.value) : '')}
              placeholder="100"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Max Ventas */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.maxSalesMonth}</label>
            <input
              type="number"
              value={maxVentas}
              onChange={(e) => setMaxVentas(e.target.value ? Number(e.target.value) : '')}
              placeholder={t.productResearch.noLimit}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Min Precio */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.minPrice}</label>
            <input
              type="number"
              value={minPrecio}
              onChange={(e) => setMinPrecio(e.target.value ? Number(e.target.value) : '')}
              placeholder="$0"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Max Precio */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">{t.productResearch.maxPrice}</label>
            <input
              type="number"
              value={maxPrecio}
              onChange={(e) => setMaxPrecio(e.target.value ? Number(e.target.value) : '')}
              placeholder={t.productResearch.noLimit}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Search Button */}
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-background font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t.productResearch.search}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {t.productResearch.showing} {offset + 1}-{Math.min(offset + limit, total)} {t.productResearch.of} <strong>{formatNumber(total)}</strong> {t.productResearch.products}
          </p>
          <button
            onClick={() => loadProducts()}
            className="text-sm text-accent hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            {t.productResearch.refresh}
          </button>
        </div>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4 animate-pulse">
              <div className="aspect-square bg-border rounded-lg mb-4"></div>
              <div className="h-4 bg-border rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-border rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center">
          <Package className="w-12 h-12 text-text-secondary/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No se encontraron productos</h3>
          <p className="text-text-secondary">Intenta con otros filtros o palabras clave</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => router.push(`/dashboard/product-research/${product.id}`)}
              className="bg-surface rounded-xl border border-border overflow-hidden hover:border-accent/50 transition-colors group cursor-pointer"
            >
              {/* Image */}
              <div className="aspect-square bg-background relative overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-text-secondary/30" />
                  </div>
                )}
                {/* Status Badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                  product.status === 'ACTIVE' 
                    ? 'bg-green-500/20 text-green-500' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-medium text-text-primary line-clamp-2 text-sm min-h-[2.5rem]">
                  {product.name}
                </h3>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-accent">
                    {formatCurrency(product.salePrice)}
                  </span>
                  {product.suggestedPrice > product.salePrice && (
                    <span className="text-sm text-text-secondary line-through">
                      {formatCurrency(product.suggestedPrice)}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-text-secondary">{t.productResearch.sales30d}</p>
                    <p className="font-semibold text-text-primary">{formatNumber(product.soldUnitsLast30Days)}</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-text-secondary">{t.productResearch.sales7d}</p>
                    <p className="font-semibold text-text-primary">{formatNumber(product.soldUnitsLast7Days)}</p>
                  </div>
                </div>

                {/* Provider & Category */}
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span className="truncate">{product.provider}</span>
                  <span className="px-2 py-0.5 bg-accent/10 text-accent rounded">
                    {product.category}
                  </span>
                </div>

                {/* Stock & Billing */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                  <span className="text-text-secondary">
                    Stock: <strong className="text-text-primary">{formatNumber(product.stock)}</strong>
                  </span>
                  <span className="text-green-500 font-medium">
                    {formatCurrency(product.billingLast30Days)}/mes
                  </span>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="p-2 rounded-lg border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setOffset((pageNum - 1) * limit)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    currentPage === pageNum
                      ? 'bg-accent text-background'
                      : 'border border-border hover:bg-background'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setOffset(Math.min((totalPages - 1) * limit, offset + limit))}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg border border-border hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-text-secondary/70 py-4">
        <p>Datos actualizados de Dropi Colombia. Sin necesidad de cuenta o cookies.</p>
      </div>
    </div>
  )
}
