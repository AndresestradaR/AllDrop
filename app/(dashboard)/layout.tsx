'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  Sparkles,
  LayoutDashboard,
  ImageIcon,
  LayoutTemplate,
  Images,
  Settings,
  LogOut,
  Menu,
  Clock,
  Target,
  Wand2,
  Store
} from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
]

const creatorNavigation = [
  { name: 'Crea tu Banner', href: '/dashboard/banner', icon: ImageIcon, soon: true },
  { name: 'Crea tu Landing', href: '/dashboard/landing', icon: LayoutTemplate },
  { name: 'Estudio IA', href: '/dashboard/studio', icon: Wand2, isNew: true },
  { name: 'Encuentra tu Producto Ganador', href: '/dashboard/product-research', icon: Target, isNew: true },
]

const otherNavigation = [
  { name: 'Mi Tienda', href: '/constructor/', icon: Store, external: true },
  { name: 'Galería', href: '/dashboard/gallery', icon: Images },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/login')
    router.refresh()
  }

  const NavLink = ({ item }: { item: typeof mainNavigation[0] & { soon?: boolean; isNew?: boolean; external?: boolean } }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

    if (item.soon) {
      return (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary/50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <item.icon className="w-5 h-5" />
            {item.name}
          </div>
          <span className="text-xs bg-border/50 px-2 py-0.5 rounded text-text-secondary/70">Pronto</span>
        </div>
      )
    }

    if (item.external) {
      return (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-border/50"
        >
          <item.icon className="w-5 h-5" />
          {item.name}
        </a>
      )
    }

    return (
      <Link
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className="w-5 h-5" />
          {item.name}
        </div>
        {item.isNew && (
          <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse-glow">
            <span className="animate-bounce-left">←</span>
            Nuevo
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-64 bg-surface border-r border-border transform transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-background" />
            </div>
            <span className="text-lg font-bold text-text-primary">Estrategas IA</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
            {/* Main */}
            <div className="space-y-1">
              {mainNavigation.map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
            </div>

            {/* Creator Tools */}
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">
                Herramientas
              </p>
              <div className="space-y-1">
                {creatorNavigation.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>

            {/* Other */}
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">
                Cuenta
              </p>
              <div className="space-y-1">
                {otherNavigation.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </div>
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-background/80 backdrop-blur-xl border-b border-border lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-text-secondary hover:text-text-primary"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-background" />
            </div>
          </div>
          <div className="w-10" />
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
