'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { useI18n, LOCALES } from '@/lib/i18n'
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation'
import DropsBalance from '@/components/drops/DropsBalance'
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
  Globe,
  ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'infoalldrop@gmail.com'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [aiHealth, setAiHealth] = useState<'green' | 'yellow' | 'red' | null>(null)
  const [userDrops, setUserDrops] = useState(0)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  const mainNavigation = [
    { name: t.nav.dashboard, href: '/dashboard', icon: LayoutDashboard },
  ]

  const hasPro = userEmail === ADMIN_EMAIL || ['pro', 'business', 'enterprise'].includes(userPlan)

  const creatorNavigation = [
    { name: t.nav.createLanding, href: '/dashboard/landing', icon: LayoutTemplate },
    { name: t.nav.studioIA, href: '/dashboard/studio', icon: Wand2, isNew: true },
    { name: t.nav.findProduct, href: '/dashboard/product-research', icon: Target, isNew: true },
    ...(hasPro ? [{ name: t.nav.agent || 'AI Assistant', href: '#confirma', icon: Bot, isNew: true, isConfirma: true }] : []),
  ]

  const otherNavigation = [
    { name: t.nav.allDropShop, href: '/constructor/', icon: Store, external: true },
    { name: t.nav.settings, href: '/dashboard/settings', icon: Settings },
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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || null
      setUserEmail(email)
      if (data.user) {
        supabase.from('profiles').select('drops, plan').eq('id', data.user.id).single()
          .then(({ data: profile }) => {
            if (profile) {
              setUserDrops(profile.drops || 0)
              setUserPlan(profile.plan || 'free')
            }
          })
      }
      if (email && email === ADMIN_EMAIL) {
        fetch('/api/admin/monitoring?action=health')
          .then(r => r.json())
          .then(d => setAiHealth(d.health))
          .catch(() => {})
      }
    })
  }, [])

  // Close language dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isAdmin = userEmail === ADMIN_EMAIL

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success(t.common.logoutSuccess)
    router.push('/login')
    router.refresh()
  }

  const currentLocale = LOCALES.find(l => l.code === locale)

  const NavLink = ({ item, healthDot }: { item: { name: string; href: string; icon: any; soon?: boolean; isNew?: boolean; external?: boolean; isConfirma?: boolean }, healthDot?: 'green' | 'yellow' | 'red' | null }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

    if (item.soon) {
      return (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary/50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <item.icon className="w-5 h-5" />
            {item.name}
          </div>
          <span className="text-xs bg-border/50 px-2 py-0.5 rounded text-text-secondary/70">{t.nav.soon}</span>
        </div>
      )
    }

    if (item.isConfirma) {
      const openConfirma = async () => {
        setSidebarOpen(false)
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token || ''
        window.open(`https://alldrop-confirma.vercel.app?token=${token}`, '_blank')
      }
      return (
        <button
          onClick={openConfirma}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-text-secondary hover:text-text-primary hover:bg-border/50"
        >
          <item.icon className="w-5 h-5" />
          {item.name}
          {item.isNew && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-semibold">New</span>}
        </button>
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
            {t.nav.new}
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
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <BackgroundGradientAnimation
            gradientBackgroundStart="rgb(5, 5, 15)"
            gradientBackgroundEnd="rgb(10, 2, 25)"
            firstColor="139, 92, 246"
            secondColor="0, 200, 255"
            thirdColor="168, 85, 247"
            fourthColor="244, 63, 142"
            fifthColor="0, 180, 255"
            pointerColor="139, 92, 246"
            size="120%"
            blendingValue="hard-light"
            interactive={false}
            containerClassName="h-full w-full"
          />
        </div>
        {/* Semi-transparent overlay to keep text readable */}
        <div className="absolute inset-0 bg-black/70" />
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
                <NavLink key={item.href} item={item} />
              ))}
            </div>

            {/* Creator Tools */}
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">
                {t.nav.tools}
              </p>
              <div className="space-y-1">
                {creatorNavigation.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>

            {/* Other */}
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">
                {t.nav.account}
              </p>
              <div className="space-y-1">
                {otherNavigation.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>

            {/* Admin section hidden for now */}
          </nav>

          {/* Drops + Language + Logout */}
          <div className="p-4 border-t border-border space-y-2">
            {/* Drops balance */}
            <DropsBalance drops={userDrops} />

            {/* Language selector */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-border/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5" />
                  <span>{currentLocale?.flag} {currentLocale?.name}</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 transition-transform', langOpen && 'rotate-180')} />
              </button>

              {langOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1a2e] border border-border rounded-lg shadow-xl overflow-hidden">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLocale(l.code)
                        setLangOpen(false)
                      }}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors',
                        locale === l.code
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
                      )}
                    >
                      <span className="text-base">{l.flag}</span>
                      {l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {t.nav.logout}
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
