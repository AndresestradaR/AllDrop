import Link from 'next/link'
import { Sparkles, ArrowRight, Store, Image as ImageIcon, Wrench } from 'lucide-react'
import { GradientDots } from '@/components/ui/gradient-dots'

const TOOLS = [
  {
    title: 'Generador de Banners',
    description: 'Crea imagenes de producto profesionales con IA. Plantillas optimizadas para landing pages de dropshipping.',
    icon: ImageIcon,
    href: '/dashboard',
    cta: 'Crear banners',
    accent: '#10B981',
  },
  {
    title: 'DropPage',
    description: 'Construye tu tienda online y landing pages de venta con el editor visual. Checkout de contraentrega listo.',
    icon: Store,
    href: 'https://estrategasia.com/constructor/',
    cta: 'Ir al constructor',
    accent: '#4DBEA4',
    external: true,
  },
  {
    title: 'Mas herramientas',
    description: 'Investigacion de productos, estudio creativo, asistentes de voz y mas. Todo en un solo lugar.',
    icon: Wrench,
    href: '/dashboard',
    cta: 'Explorar',
    accent: '#6366F1',
  },
]

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Animated background */}
      <GradientDots duration={20} backgroundColor="#0a0a0a" className="pointer-events-none opacity-40" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navbar */}
        <nav className="border-b border-white/5 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Estrategas IA</span>
            </div>
            <Link
              href="/login"
              className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Acceder
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-4 pb-12 pt-24 text-center sm:pt-32">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-gray-300">Herramientas de IA para tu negocio de e-commerce</span>
            </div>

            <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Todo lo que necesitas
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                para vender online
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-xl text-lg text-gray-400">
              Genera banners con IA, construye tu tienda y gestiona pedidos.
              El ecosistema completo para dropshipping en LATAM.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25"
            >
              Empezar gratis
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* Tool Cards */}
        <section className="px-4 pb-24 pt-8">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                {...(tool.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-all hover:border-white/20 hover:bg-white/[0.08]"
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${tool.accent}20` }}
                >
                  <tool.icon className="h-6 w-6" style={{ color: tool.accent }} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{tool.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-400">{tool.description}</p>
                <span
                  className="inline-flex items-center gap-1 text-sm font-medium transition-transform group-hover:translate-x-1"
                  style={{ color: tool.accent }}
                >
                  {tool.cta}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8">
          <div className="mx-auto flex max-w-7xl items-center justify-center px-4">
            <span className="text-sm text-gray-500">
              © 2025 Estrategas IA — Herramientas de Trucos Ecomm & Drop
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
