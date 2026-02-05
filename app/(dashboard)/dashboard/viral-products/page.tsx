'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Trophy, Folder, Flame, TrendingUp, Star, Package,
  DollarSign, Users, Video, ExternalLink, Play, Search,
  ChevronLeft, ChevronRight, Filter, ArrowUpDown, Eye,
  Heart, MessageCircle, Clock, BadgeCheck
} from 'lucide-react'

interface TopVideo {
  video_id: string
  tiktok_url: string
  plays: number
  plays_show: string
  likes: number
  likes_show: string
  comments: number
  shares: number
  video_sales: number
  video_sales_show: string
  video_revenue: number
  video_revenue_show: string
  interaction_rate: string
  creator: string
  creator_user: string
  creator_followers: number
  creator_followers_show: string
  cover: string
  duration: string
  description: string
  is_ad: boolean
  date: string
}

interface EnrichedProduct {
  product_id: string
  country_rank: string
  country_rank_show: string
  category_rank: string
  category_rank_show: string
  viral_index: number
  popularity_index: number
  review_count: number
  review_count_show: string
  stock_count: string
  stock_count_show: string
  commission_rate: string
  sold_count_base: number
  sale_amount_base: number
  author_count: number
  aweme_count: number
  top_videos: TopVideo[]
  best_video_url: string
  best_video_sales: number
  best_video_plays: number
  enriched_at: string
  // From existing data
  title?: string
  img?: string
  price?: number
  ori_price?: number
  product_rating?: number
  category_l1?: string
  shop_name?: string
}

// Format numbers
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return num.toLocaleString()
}

function formatCurrency(num: number): string {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}k`
  return `$${num.toFixed(2)}`
}

// Index color based on value
function getIndexColor(value: number): string {
  if (value >= 80) return 'text-emerald-400'
  if (value >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function getIndexBg(value: number): string {
  if (value >= 80) return 'bg-emerald-500/20 border-emerald-500/30'
  if (value >= 50) return 'bg-yellow-500/20 border-yellow-500/30'
  return 'bg-red-500/20 border-red-500/30'
}

// Video thumbnail component
function VideoThumbnail({ src }: { src: string }) {
  const [error, setError] = useState(false)

  if (error || !src) {
    return (
      <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Video className="w-6 h-6 text-white/30" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt="Video thumbnail"
      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
      onError={() => setError(true)}
    />
  )
}

// Product image component
function ProductImage({ src, alt }: { src: string, alt: string }) {
  const [error, setError] = useState(false)

  const imageUrl = src?.includes('supabase') ? src : src ? `/api/image-proxy?url=${encodeURIComponent(src)}` : ''

  if (error || !src) {
    return (
      <div className="w-full h-48 bg-gradient-to-br from-emerald-500/20 to-accent/20 flex items-center justify-center rounded-t-xl">
        <Package className="w-12 h-12 text-emerald-500/60" />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className="w-full h-48 object-cover rounded-t-xl"
      onError={() => setError(true)}
    />
  )
}

// Metric card component
function MetricCard({ icon: Icon, label, value, color = 'text-white' }: {
  icon: any, label: string, value: string | number, color?: string
}) {
  return (
    <div className="bg-white/5 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-white/60 text-xs">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}

// Video row component
function VideoRow({ video }: { video: TopVideo }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
      <VideoThumbnail src={video.cover} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-emerald-400 font-bold text-lg">{video.video_sales_show}</span>
          <span className="text-white/40 text-xs">ventas</span>
          {video.is_ad && (
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-medium rounded">AD</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-white/60 mb-1">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" /> {video.plays_show}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" /> {video.likes_show}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {video.duration}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/80">@{video.creator_user}</span>
          <span className="text-white/40">{video.creator_followers_show} followers</span>
        </div>
      </div>

      <a
        href={video.tiktok_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
      >
        <Play className="w-4 h-4" />
        Ver
      </a>
    </div>
  )
}

// Product card component
function ProductCard({ product, existingData }: { product: EnrichedProduct, existingData: any }) {
  const [showAllVideos, setShowAllVideos] = useState(false)

  const title = existingData?.title || `Producto ${product.product_id}`
  const img = existingData?.img || ''
  const price = existingData?.price || 0
  const rating = existingData?.product_rating || 0
  const category = existingData?.category_l1 || 'General'
  const shop = existingData?.shop_name || ''

  const videosToShow = showAllVideos ? product.top_videos : product.top_videos?.slice(0, 3)

  return (
    <div className="bg-[#12121a] rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="relative">
        <ProductImage src={img} alt={title} />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs rounded-full">
            {category}
          </span>
          {product.country_rank_show && (
            <span className="px-2 py-1 bg-emerald-500/80 text-white text-xs rounded-full font-bold">
              #{product.country_rank_show} US
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Title & Price */}
        <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">{title}</h3>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-emerald-400 font-bold text-xl">${price}</span>
          {rating > 0 && (
            <span className="flex items-center gap-1 text-yellow-400 text-sm">
              <Star className="w-4 h-4 fill-yellow-400" />
              {rating}
            </span>
          )}
          {shop && (
            <span className="text-white/50 text-sm truncate">{shop}</span>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className={`rounded-lg p-2 border ${getIndexBg(product.viral_index)}`}>
            <div className="text-white/60 text-[10px] flex items-center gap-1">
              <Flame className="w-3 h-3" /> Viral
            </div>
            <div className={`text-xl font-bold ${getIndexColor(product.viral_index)}`}>
              {product.viral_index}
            </div>
          </div>

          <div className={`rounded-lg p-2 border ${getIndexBg(product.popularity_index)}`}>
            <div className="text-white/60 text-[10px] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Popular
            </div>
            <div className={`text-xl font-bold ${getIndexColor(product.popularity_index)}`}>
              {product.popularity_index}
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-2 border border-white/10">
            <div className="text-white/60 text-[10px] flex items-center gap-1">
              <Folder className="w-3 h-3" /> Cat Rank
            </div>
            <div className="text-xl font-bold text-white">
              #{product.category_rank_show || '-'}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px]">Ventas</div>
            <div className="text-white font-semibold text-sm">{formatNumber(product.sold_count_base)}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px]">Revenue</div>
            <div className="text-white font-semibold text-sm">{formatCurrency(product.sale_amount_base)}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px]">Creators</div>
            <div className="text-white font-semibold text-sm">{formatNumber(product.author_count)}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-2">
            <div className="text-white/50 text-[10px]">Videos</div>
            <div className="text-white font-semibold text-sm">{formatNumber(product.aweme_count)}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="flex items-center gap-1 text-white/60">
            <Star className="w-4 h-4" /> {product.review_count_show} reviews
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <DollarSign className="w-4 h-4" /> {product.commission_rate} comisión
          </span>
        </div>

        {/* Top Videos Section */}
        {product.top_videos && product.top_videos.length > 0 && (
          <div className="border-t border-white/10 pt-4 mt-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              Top Videos Virales
              <span className="text-white/40 text-sm font-normal">({product.top_videos.length})</span>
            </h4>

            <div className="space-y-2">
              {videosToShow?.map((video) => (
                <VideoRow key={video.video_id} video={video} />
              ))}
            </div>

            {product.top_videos.length > 3 && (
              <button
                onClick={() => setShowAllVideos(!showAllVideos)}
                className="w-full mt-3 py-2 text-emerald-400 text-sm hover:bg-white/5 rounded-lg transition-colors"
              >
                {showAllVideos ? 'Ver menos' : `Ver ${product.top_videos.length - 3} más`}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between">
          <span className="text-white/40 text-xs">
            Actualizado: {new Date(product.enriched_at).toLocaleDateString()}
          </span>
          <a
            href={`https://shop.tiktok.com/view/product/${product.product_id}?region=US`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-emerald-400 text-sm hover:underline"
          >
            Ver en TikTok <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

type SortOption = 'best_video_sales' | 'viral_index' | 'popularity_index' | 'sold_count_base' | 'sale_amount_base' | 'author_count'

const SORT_OPTIONS: { value: SortOption, label: string }[] = [
  { value: 'best_video_sales', label: 'Ventas Video Top' },
  { value: 'viral_index', label: 'Índice Viral' },
  { value: 'popularity_index', label: 'Popularidad' },
  { value: 'sold_count_base', label: 'Ventas Totales' },
  { value: 'sale_amount_base', label: 'Revenue' },
  { value: 'author_count', label: 'Creators' },
]

export default function ViralProductsPage() {
  const [enrichedProducts, setEnrichedProducts] = useState<EnrichedProduct[]>([])
  const [existingProducts, setExistingProducts] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('best_video_sales')
  const [onlyWithVideos, setOnlyWithVideos] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Load enrichment data
  useEffect(() => {
    async function loadData() {
      try {
        // Load enrichment JSON
        const enrichRes = await fetch('/data/enrichment.json')
        const enrichData = await enrichRes.json()
        setEnrichedProducts(enrichData)

        // Load existing products from Supabase
        const SUPABASE_URL = 'https://papfcbiswvdgalfteujm.supabase.co'
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhcGZjYmlzd3ZkZ2FsZnRldWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0MjEzNDQsImV4cCI6MjA0Njk5NzM0NH0.MH2RMM9wqKSqmMJqFI4mCnLssSCRHWexPiABNuXOC_A'

        const productsRes = await fetch(
          `${SUPABASE_URL}/rest/v1/fastmoss_products?select=product_id,title,img,price,product_rating,category_l1,shop_name&limit=1000`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          }
        )
        const productsData = await productsRes.json()

        // Index by product_id
        const indexed: Record<string, any> = {}
        productsData.forEach((p: any) => {
          indexed[p.product_id] = p
        })
        setExistingProducts(indexed)

      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...enrichedProducts]

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(p => {
        const existing = existingProducts[p.product_id]
        const title = existing?.title || ''
        return title.toLowerCase().includes(term) || p.product_id.includes(term)
      })
    }

    // Filter only with videos
    if (onlyWithVideos) {
      result = result.filter(p => p.best_video_sales > 0)
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortBy] || 0
      const bVal = b[sortBy] || 0
      return bVal - aVal
    })

    return result
  }, [enrichedProducts, existingProducts, searchTerm, sortBy, onlyWithVideos])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, sortBy, onlyWithVideos])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Flame className="w-8 h-8 text-emerald-400" />
            Productos Virales TikTok
          </h1>
          <p className="text-white/60">
            {filteredProducts.length} productos con métricas y videos virales
          </p>
        </div>

        {/* Filters */}
        <div className="bg-[#12121a] rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-white/40" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Filter toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithVideos}
              onChange={(e) => setOnlyWithVideos(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-white/70 text-sm">Solo con videos vendedores</span>
          </label>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {paginatedProducts.map(product => (
            <ProductCard
              key={product.product_id}
              product={product}
              existingData={existingProducts[product.product_id]}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            <span className="text-white/60">
              Página {currentPage} de {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
