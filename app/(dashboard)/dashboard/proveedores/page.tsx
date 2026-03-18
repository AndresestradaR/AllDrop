'use client'

import { useState } from 'react'
import { Package, FileText, Play, ExternalLink, ChevronLeft } from 'lucide-react'

interface ProviderResource {
  title: string
  type: 'pdf' | 'video'
  url: string
}

interface Provider {
  id: string
  name: string
  logo: string
  description: string
  resources: ProviderResource[]
}

const PROVIDERS: Provider[] = [
  {
    id: 'kompras-plus',
    name: 'KOMPRAS PLUS',
    logo: '/proveedores/logo-kompras-plus.png',
    description: 'Proveedor de productos de dropshipping para Colombia y Latinoamérica.',
    resources: [
      {
        title: 'Catálogo Kompras Plus CO',
        type: 'pdf',
        url: 'https://papfcbiswvdgalfteujm.supabase.co/storage/v1/object/public/landing-images/proveedores/catalogo-kompras-plus-co.pdf',
      },
      {
        title: 'Catálogo Nutranova',
        type: 'pdf',
        url: '/proveedores/catalogo-nutranova.pdf',
      },
      {
        title: 'Kompras Plus - Proveedor Dropshipping',
        type: 'video',
        url: 'https://youtu.be/RkCtDKuVBw0',
      },
    ],
  },
]

export default function ProveedoresPage() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

  if (selectedProvider) {
    return (
      <div>
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedProvider(null)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver a proveedores
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-xl border border-border flex items-center justify-center p-2">
              <img
                src={selectedProvider.logo}
                alt={selectedProvider.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{selectedProvider.name}</h1>
              <p className="text-text-secondary mt-1">{selectedProvider.description}</p>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="space-y-3">
          {selectedProvider.resources.map((resource, i) => (
            <a
              key={i}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl hover:border-accent/50 hover:shadow-lg transition-all group"
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                resource.type === 'pdf'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-blue-500/10 text-blue-500'
              }`}>
                {resource.type === 'pdf' ? (
                  <FileText className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {resource.title}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {resource.type === 'pdf' ? 'Documento PDF' : 'Video'}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-text-secondary group-hover:text-accent transition-colors flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Proveedores</h1>
        <p className="text-text-secondary mt-1">
          Catálogos y recursos de nuestros proveedores aliados
        </p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            onClick={() => setSelectedProvider(provider)}
            className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-accent/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left"
          >
            {/* Logo area */}
            <div className="aspect-video bg-white flex items-center justify-center p-8 overflow-hidden">
              <img
                src={provider.logo}
                alt={provider.name}
                className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            {/* Info */}
            <div className="p-4">
              <h3 className="text-base font-bold text-text-primary tracking-wide">
                {provider.name}
              </h3>
              <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                {provider.description}
              </p>
              <div className="flex items-center gap-3 mt-3 text-xs text-text-secondary">
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {provider.resources.filter(r => r.type === 'pdf').length} catálogos
                </div>
                {provider.resources.some(r => r.type === 'video') && (
                  <div className="flex items-center gap-1">
                    <Play className="w-3.5 h-3.5" />
                    {provider.resources.filter(r => r.type === 'video').length} videos
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
