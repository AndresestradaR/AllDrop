'use client'

import { Product } from '@/lib/dropkiller/types'
import { ExternalLink, Copy, TrendingUp, Package, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'

interface ProductTableProps {
  products: Product[]
  isLoading: boolean
}

export function ProductTable({ products, isLoading }: ProductTableProps) {
  const { t } = useI18n()
  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl border border-border p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-text-secondary">{t.productResearch.searching}</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-12">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <Package className="w-16 h-16 text-text-secondary/50" />
          <div>
            <p className="text-text-primary font-medium">{t.productResearch.noProducts}</p>
            <p className="text-text-secondary text-sm">{t.productResearch.searchProducts}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">{t.productResearch.product}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">{t.productResearch.price}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">{t.productResearch.sales7d}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">{t.productResearch.sales30d}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-background/30 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    {product.image ? (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-background flex-shrink-0">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-text-secondary/50" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate max-w-[200px]">
                        {product.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {product.platform} · ID: {product.externalId}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-medium text-text-primary">
                    {formatCurrency(product.price)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">
                      {formatNumber(product.sales7d)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm text-text-primary">
                    {formatNumber(product.sales30d)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`text-sm font-medium ${
                    product.stock > 100 ? 'text-green-500' : 
                    product.stock > 20 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {formatNumber(product.stock)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {product.url && (
                      <>
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                          title="Ver en Dropi"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => copyLink(product.url)}
                          className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                          title="Copiar link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
