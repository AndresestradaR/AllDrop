'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  Sparkles,
  LayoutDashboard,
  GraduationCap,
  LayoutTemplate,
  PlayCircle,
  Settings,
  LogOut,
  Menu,
  Clock,
  Target,
  Wand2,
  Store,
  Upload,
  Zap,
  BookOpen,
  Bot,
  Activity,
  School,
  MessageCircle,
  Package,
  TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
]

const creatorNavigation = [
  { name: 'Academia', href: '/dashboard/academia', icon: School, isNew: true },
  { name: 'Coaching', href: '/dashboard/coaching', icon: GraduationCap, isNew: true },
  { name: 'Crea tu Landing', href: '/dashboard/landing', icon: LayoutTemplate },
  { name: 'Landing Code', href: '/dashboard/landing-ia', icon: Zap, isNew: true },
  { name: 'Estudio IA', href: '/dashboard/studio', icon: Wand2, isNew: true },
  { name: 'Encuentra tu Producto Ganador', href: '/dashboard/product-research', icon: Target, isNew: true },
  { name: 'Agente (Beta)', href: '/dashboard/meta-ads', icon: Sparkles, isNew: true },
  { name: 'Informe Financiero', href: '/dashboard/informe-financiero', icon: TrendingUp, isNew: true },
  { name: 'Proveedores', href: '/dashboard/proveedores', icon: Package, isNew: true },
  { name: 'Únete a Discord', href: 'https://discord.gg/dpxM6SaUr', icon: MessageCircle, external: true },
]

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

const otherNavigation = [
  { name: 'Mi Tienda', href: '/constructor/', icon: Store, external: true },
  { name: 'Tutorial Herramienta', href: '/dashboard/gallery', icon: PlayCircle },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const adminNavigation = [
  { name: 'Lucio', href: '/dashboard/lucio', icon: Bot, isNew: true },
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
  const [isMentor, setIsMentor] = useState(false)
  const [aiHealth, setAiHealth] = useState<'green' | 'yellow' | 'red' | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || null
      setUserEmail(email)
      if (email) {
        supabase
          .from('coaching_mentors')
          .select('id')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle()
          .then(({ data: mentor }) => {
            setIsMentor(!!mentor)
          })
        // Fetch AI health indicator for admin
        if (email === ADMIN_EMAIL) {
          fetch('/api/admin/monitoring?action=health')
            .then(r => r.json())
            .then(d => setAiHealth(d.health))
            .catch(() => {})
        }
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
          <span className="inline-flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse-glow">
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
                {creatorNavigation
                  .filter(item => item.name !== 'Landing Code' || isAdmin)
                  .filter(item => item.name !== 'Informe Financiero' || isAdmin)
                  .map((item) => (
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

            {/* Mentor — only if user is a coaching mentor */}
            {isMentor && (
              <div>
                <p className="px-3 mb-2 text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">
                  Mentor
                </p>
                <div className="space-y-1">
                  <NavLink item={{ name: 'Panel Mentor', href: '/dashboard/coaching/mentor', icon: GraduationCap }} />
                </div>
              </div>
            )}

            {/* Admin — only for admin email */}
            {isAdmin && (
              <div>
                <p className="px-3 mb-2 text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">
                  Admin
                </p>
                <div className="space-y-1">
                  {adminNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      item={item}
                      healthDot={item.href === '/dashboard/admin/monitoring' ? aiHealth : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
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
