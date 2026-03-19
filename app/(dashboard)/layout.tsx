'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation'
import {
  Sparkles,
  LayoutDashboard,
  LayoutTemplate,
  PlayCircle,
  Settings,
  LogOut,
  Menu,
  Target,
  Wand2,
  Store,
  Upload,
  Bot,
  Activity,
  BookOpen,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
]

const creatorNavigation = [
  { name: 'Crea tu Landing', href: '/dashboard/landing', icon: LayoutTemplate },
  { name: 'Estudio IA', href: '/dashboard/studio', icon: Wand2, isNew: true },
  { name: 'Encuentra tu Producto Ganador', href: '/dashboard/product-research', icon: Target, isNew: true },
]

const ADMIN_EMAIL = 'infoalldrop@gmail.com'

const otherNavigation = [
  { name: 'AllDrop Shop', href: '/constructor/', icon: Store, external: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const adminNavigation = [
  { name: 'Lucio', href: '/dashboard/lucio', icon: Bot, isNew: true },
  { name: 'Agente (Beta)', href: '/dashboard/meta-ads', icon: Sparkles, isNew: true },
  { name: 'Landing Code', href: '/dashboard/landing-ia', icon: Sparkles, isNew: true },
  { name: 'Informe Financiero', href: '/dashboard/informe-financiero', icon: TrendingUp, isNew: true },
  { name: 'Monitoring IA', href: '/dashboard/admin/monitoring', icon: Activity },
  { name: 'Admin Plantillas', href: '/dashboard/admin/templates', icon: Upload },
  { name: 'Admin Coaching', href: '/dashboard/admin/coaching', icon: BookOpen },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [aiHealth, setAiHealth] = useState<'green' | 'yellow' | 'red' | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || null
      setUserEmail(email)
      if (email && email === ADMIN_EMAIL) {
        fetch('/api/admin/monitoring?action=health')
          .then(r => r.json())
          .then(d => setAiHealth(d.health))
          .catch(() => {})
      }
    })
  }, [])

  const isAdmin = userEmail === ADMIN_EMAIL

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Sesión cerrada')
    router.push('/login')
    router.refresh()
  }

  const NavLink = ({ item, healthDot }: { item: typeof mainNavigation[0] & { soon?: boolean; isNew?: boolean; external?: boolean }, healthDot?: 'green' | 'yellow' | 'red' | null }) => {
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
          <span className="inline-flex items-center gap-1 bg-violet-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse-glow">
            <span className="animate-bounce-left">←</span>
            Nuevo
          </span>
        )}
        {healthDot && (
          <span className={cn(
            'w-2.5 h-2.5 rounded-full',
            healthDot === 'green' && 'bg-emerald-500',
            healthDot === 'yellow' && 'bg-amber-500 animate-pulse',
            healthDot === 'red' && 'bg-red-500 animate-pulse',
          )} />
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
        'fixed top-0 left-0 z-50 h-full w-64 border-r border-border transform transition-transform duration-200 lg:translate-x-0 overflow-hidden',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Subtle animated gradient background */}
        <div className="absolute inset-0 opacity-[0.15]">
          <BackgroundGradientAnimation
            gradientBackgroundStart="rgb(10, 10, 10)"
            gradientBackgroundEnd="rgb(15, 5, 30)"
            firstColor="139, 92, 246"
            secondColor="0, 240, 255"
            thirdColor="139, 92, 246"
            fourthColor="244, 63, 142"
            fifthColor="0, 240, 255"
            pointerColor="139, 92, 246"
            size="100%"
            blendingValue="screen"
            interactive={false}
            containerClassName="h-full w-full"
          />
        </div>
        {/* Dark overlay to keep text readable */}
        <div className="absolute inset-0 bg-surface/90" />
        <div className="flex flex-col h-full relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50">
            <img src="/images/logo.png" alt="AllDrop" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold" style={{ background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AllDrop</span>
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

            {/* Admin section hidden for now */}
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
            <img src="/images/logo.png" alt="AllDrop" className="w-8 h-8 object-contain" />
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
