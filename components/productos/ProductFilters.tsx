'use client'

import { useState } from 'react'
import { ProductFilters as Filters } from '@/lib/dropkiller/types'
import { COUNTRIES, PLATFORMS } from '@/lib/dropkiller/constants'
import { Search, Filter, ChevronDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface ProductFiltersProps {
  onSearch: (filters: Filters) => void
  isLoading: boolean
}

export function ProductFilters({ onSearch, isLoading }: ProductFiltersProps) {
  const [filters, setFilters] = useState<Filters>({
    platform: 'dropi',
    country: '65c75a5f-0c4a-45fb-8c90-5b538805a15a', // Colombia default
    minSales7d: 10,
    minStock: 50,
    limit: 50,
    page: 1,
  })
  
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { t } = useI18n()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(filters)
  }

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 space-y-6">
      {/* Filtros principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* País */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t.country.country}
          </label>
          <select
            value={filters.country}
            onChange={(e) => updateFilter('country', e.target.value)}
            className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {COUNTRIES.map((country) => (
              <option key={country.id} value={country.uuid}>
                {country.flag} {country.name}
              </option>
            ))}
          </select>
        </div>

        {/* Plataforma */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Platform
          </label>
          <select
            value={filters.platform}
            onChange={(e) => updateFilter('platform', e.target.value)}
            className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {PLATFORMS.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ventas mínimas 7d */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t.productResearch.minSales7d}
          </label>
          <input
            type="number"
            value={filters.minSales7d || ''}
            onChange={(e) => updateFilter('minSales7d', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="Ej: 10"
            className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* Toggle filtros avanzados */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors"
      >
        <Filter className="w-4 h-4" />
        {t.productResearch.advancedFilters}
        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {/* Filtros avanzados */}
      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          {/* Stock mínimo */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Stock min.
            </label>
            <input
              type="number"
              value={filters.minStock || ''}
              onChange={(e) => updateFilter('minStock', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Ej: 50"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Precio mínimo */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t.productResearch.minPrice}
            </label>
            <input
              type="number"
              value={filters.minPrice || ''}
              onChange={(e) => updateFilter('minPrice', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Ej: 25000"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Precio máximo */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t.productResearch.maxPrice}
            </label>
            <input
              type="number"
              value={filters.maxPrice || ''}
              onChange={(e) => updateFilter('maxPrice', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Ej: 150000"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Ventas 30d mínimas */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t.productResearch.minSales30d}
            </label>
            <input
              type="number"
              value={filters.minSales30d || ''}
              onChange={(e) => updateFilter('minSales30d', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Ej: 50"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>
      )}

      {/* Botón buscar */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full md:w-auto px-6 py-3 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-background font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Search className="w-5 h-5" />
        {isLoading ? t.productResearch.searching : t.productResearch.searchProducts}
      </button>
    </form>
  )
}
