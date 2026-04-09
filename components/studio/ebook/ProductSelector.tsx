'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Search,
  Upload,
  Package,
  Store,
  Database,
  Loader2,
  ImageIcon,
  X,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'
import type { ProductInput, ProductSource } from '@/lib/ebook/types'

interface ProductSelectorProps {
  onSelect: (product: ProductInput) => void
}

const SOURCE_DEFS: { id: ProductSource; nameKey: 'dropiCatalog' | 'myProducts' | 'myStore' | 'manualUpload'; icon: React.ElementType }[] = [
  { id: 'dropkiller', nameKey: 'dropiCatalog', icon: Database },
  { id: 'landing', nameKey: 'myProducts', icon: Package },
  { id: 'droppage', nameKey: 'myStore', icon: Store },
  { id: 'manual', nameKey: 'manualUpload', icon: Upload },
]

// ============================================
// DROPKILLER PRODUCT SEARCH
// ============================================
function DropKillerSearch({ onSelect }: { onSelect: (p: ProductInput) => void }) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(
        `https://product-intelligence-dropi-production.up.railway.app/api/productos?search=${encodeURIComponent(query)}&limit=12&sort=soldUnitsLast30Days&order=desc`
      )
      const data = await res.json()
      setResults(data.products || data || [])
    } catch {
      toast.error(te.searchError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        {te.dropiSearchDesc}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={te.dropiSearchPh}
          className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {te.search}
        </button>
      </div>

      {!loading && results.length === 0 && query.trim() === '' && (
        <div className="text-center py-6 text-zinc-500 text-sm">
          {te.searchHint}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
          {results.map((p: any) => (
            <button
              key={p.id || p.externalId}
              onClick={() =>
                onSelect({
                  source: 'dropkiller',
                  name: p.name,
                  description: p.description || `${p.name} — Precio: $${p.salePrice || p.suggestedPrice}. Vendidos ultimo mes: ${p.soldUnitsLast30Days || 0}.`,
                  images: p.image ? [p.image] : [],
                  externalId: p.id || p.externalId,
                })
              }
              className="group text-left p-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-emerald-500/50 rounded-lg transition-all"
            >
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-28 object-cover rounded-md mb-2" />
              ) : (
                <div className="w-full h-28 bg-zinc-700 rounded-md mb-2 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-zinc-500" />
                </div>
              )}
              <p className="text-sm text-white font-medium truncate">{p.name}</p>
              {p.soldUnitsLast30Days > 0 && (
                <p className="text-xs text-emerald-400 mt-1">{p.soldUnitsLast30Days} {te.salesMonth}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// SUPABASE PRODUCTS (Landing Generator)
// ============================================
function LandingProducts({ onSelect }: { onSelect: (p: ProductInput) => void }) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const data = await res.json()
          setProducts(data.products || [])
        }
      } catch {
        toast.error(te.loadError)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        <span className="text-sm text-zinc-400">{te.loadingProducts}</span>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-zinc-400">{te.noProducts}</p>
        <p className="text-xs text-zinc-500">{te.noProductsHint}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
      {products.map((p: any) => (
        <button
          key={p.id}
          onClick={() =>
            onSelect({
              source: 'landing',
              name: p.name,
              description: p.description || '',
              images: p.image_url ? [p.image_url] : [],
              externalId: p.id,
            })
          }
          className="group text-left p-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-emerald-500/50 rounded-lg transition-all"
        >
          {p.image_url ? (
            <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover rounded-md mb-2" />
          ) : (
            <div className="w-full h-28 bg-zinc-700 rounded-md mb-2 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-zinc-500" />
            </div>
          )}
          <p className="text-sm text-white font-medium truncate">{p.name}</p>
          {p.sections_count > 0 && (
            <p className="text-xs text-zinc-500 mt-1">{p.sections_count} {te.sections}</p>
          )}
        </button>
      ))}
    </div>
  )
}

// ============================================
// MANUAL UPLOAD
// ============================================
function ManualUpload({ onSelect }: { onSelect: (p: ProductInput) => void }) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (images.length >= 3) return
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    if (!name.trim() || !description.trim()) {
      toast.error(te.nameDescRequired)
      return
    }
    onSelect({
      source: 'manual',
      name: name.trim(),
      description: description.trim(),
      images,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">{te.productName}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={te.productNamePh}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">{te.productDesc}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={te.productDescPh}
          rows={4}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">
          {te.productPhotos}
        </label>
        <div className="flex gap-3 items-center">
          {images.map((img, i) => (
            <div key={i} className="relative w-20 h-20">
              <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {images.length < 3 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-zinc-600 hover:border-emerald-500 rounded-lg flex items-center justify-center transition-colors"
            >
              <Upload className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !description.trim()}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
      >
        {te.continueProduct}
      </button>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function ProductSelector({ onSelect }: ProductSelectorProps) {
  const { t } = useI18n()
  const te = t.studio.ebook
  const [activeSource, setActiveSource] = useState<ProductSource>('dropkiller')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{te.selectProduct}</h3>
        <p className="text-sm text-zinc-400">
          {te.selectProductDesc}
        </p>
      </div>

      {/* Source tabs */}
      <div className="flex gap-2 flex-wrap">
        {SOURCE_DEFS.map((s) => {
          const Icon = s.icon
          const active = activeSource === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveSource(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {te[s.nameKey]}
            </button>
          )
        })}
      </div>

      {/* Source content */}
      <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4">
        {activeSource === 'dropkiller' && <DropKillerSearch onSelect={onSelect} />}
        {activeSource === 'landing' && <LandingProducts onSelect={onSelect} />}
        {activeSource === 'droppage' && (
          <div className="text-center py-8 space-y-3">
            <Store className="w-10 h-10 text-zinc-600 mx-auto" />
            <div>
              <p className="text-zinc-400 font-medium">{te.comingSoon}</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                {te.comingSoonDesc}
              </p>
            </div>
          </div>
        )}
        {activeSource === 'manual' && <ManualUpload onSelect={onSelect} />}
      </div>
    </div>
  )
}
