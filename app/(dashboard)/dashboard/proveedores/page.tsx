'use client'

import { useState } from 'react'
import { FileText, Play, Download, Eye, ChevronLeft, MessageCircle } from 'lucide-react'

interface ProviderResource {
  title: string
  type: 'pdf' | 'video'
  url: string
}

interface ProviderContact {
  name: string
  phone: string
  role: string
}

interface Provider {
  id: string
  name: string
  logo: string
  description: string
  whyChoose: string[]
  videoId: string | null
  contacts: ProviderContact[]
  resources: ProviderResource[]
}

const PROVIDERS: Provider[] = [
  {
    id: 'kompras-plus',
    name: 'KOMPRAS PLUS',
    logo: '/proveedores/logo-kompras-plus.png',
    description: 'Proveedor de productos de laboratorio propios con registro INVIMA para Colombia y México. Desarrollo de marca propia desde 300 unidades, stock garantizado de +5,000 unidades por producto y última milla en Bogotá con su plataforma Plus Envíos.',
    whyChoose: [
      'Productos de laboratorio propios con registro INVIMA — no son productos genéricos de catálogo público',
      'Marca propia desde 300 unidades — ellos desarrollan tu branding con las mismas fórmulas probadas',
      'Stock garantizado (+5,000 uds por producto) — sin tiempos muertos de importación',
      'Última milla en Bogotá con Plus Envíos — seguimiento en tiempo real y dispersión de pagos diaria',
      'Catálogo amplio: salud, belleza, hogar, consumo, nicho black — todos con registro sanitario',
      'Creativos, landing pages y Google Drive con material listo para vender',
    ],
    videoId: 'RkCtDKuVBw0',
    contacts: [
      { name: 'Juan', phone: '+573148679307', role: 'Proveeduría y desarrollo de marca' },
      { name: 'Natalia', phone: '+573242223825', role: 'Pedidos y soporte' },
    ],
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
    ],
  },
]

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function ProveedoresPage() {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

  if (selectedProvider) {
    const pdfs = selectedProvider.resources.filter(r => r.type === 'pdf')

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
            <div className="w-14 h-14 bg-white rounded-xl border border-border flex items-center justify-center p-2">
              <img
                src={selectedProvider.logo}
                alt={selectedProvider.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{selectedProvider.name}</h1>
              <p className="text-sm text-text-secondary mt-1 max-w-2xl">{selectedProvider.description}</p>
            </div>
          </div>
        </div>

        {/* Two-column layout: Video + PDFs */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* Left: Video */}
          {selectedProvider.videoId && (
            <div className="lg:col-span-3">
              <div className="aspect-video rounded-xl overflow-hidden border border-border bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedProvider.videoId}`}
                  title={selectedProvider.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Right: PDFs + Contacts */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* PDF Resources */}
            {pdfs.map((resource, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl"
              >
                <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{resource.title}</h3>
                  <p className="text-xs text-text-secondary">Documento PDF</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                    title="Ver"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <a
                    href={resource.url}
                    download
                    className="p-2 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}

            {/* WhatsApp Contacts */}
            {selectedProvider.contacts.map((contact, i) => (
              <a
                key={i}
                href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${contact.name}, soy de la comunidad Estrategas IA y me interesa la proveeduría de Kompras Plus.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl hover:bg-[#25D366]/20 hover:border-[#25D366]/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#25D366]/20 text-[#25D366] flex items-center justify-center flex-shrink-0">
                  <WhatsAppIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-[#25D366] transition-colors">
                    Contactar a {contact.name}
                  </h3>
                  <p className="text-xs text-text-secondary">{contact.role}</p>
                </div>
                <MessageCircle className="w-4 h-4 text-[#25D366] flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>

        {/* Why choose section */}
        {selectedProvider.whyChoose.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-base font-bold text-text-primary mb-3">¿Por qué elegir este proveedor?</h2>
            <ul className="space-y-2">
              {selectedProvider.whyChoose.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-accent mt-0.5 flex-shrink-0">&#10003;</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
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
                {provider.videoId && (
                  <div className="flex items-center gap-1">
                    <Play className="w-3.5 h-3.5" />
                    1 video
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
