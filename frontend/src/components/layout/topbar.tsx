import { cn } from '@/lib/cn'
import { type Session } from '@/lib/session'
import {
  Bell,
  Search,
  Sun,
  Moon,
  ChevronDown,
  Menu,
  LayoutDashboard,
  LogOut,
  User,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/avatar'
import { Breadcrumb, type Crumb } from '@/components/ui/breadcrumb'

const breadcrumbMap: Record<string, { label: string; icon?: LucideIcon }> = {
  '/': { label: 'Tableau de bord', icon: LayoutDashboard },
  '/profil': { label: 'Profil', icon: User },
  '/import': { label: 'Importation Excel' },
  '/courriers': { label: 'Courriers sortants' },
  '/historique': { label: 'Historique' },
  '/statistiques': { label: 'Statistiques' },
  '/utilisateurs': { label: 'Utilisateurs' },
  '/roles': { label: 'Rôles' },
  '/permissions': { label: 'Permissions' },
  '/parametres': { label: 'Paramètres' },
  '/journal': { label: "Journal d'audit" },
}

export function Topbar({
  session,
  onLogout,
  onMenuClick,
  collapsed = false,
}: {
  session?: Session | null
  onLogout?: () => void
  onMenuClick?: () => void
  collapsed?: boolean
}) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [showProfile, setShowProfile] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const profileRef = useRef<HTMLDivElement>(null)

  const toggleDark = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
      }
    }
    if (showProfile) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProfile])

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const crumbs: Crumb[] = [{ label: 'DEX', href: '/' }]
  const page = breadcrumbMap[pathname]
  if (page) crumbs.push({ label: page.label, icon: page.icon })

  const iconBtn =
    'relative flex items-center justify-center rounded-xl p-2 text-topbar-foreground/50 transition-all duration-200 hover:bg-topbar-muted hover:text-topbar-foreground hover:shadow-sm'

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-20 flex h-topbar items-center gap-4 border-b border-topbar-border/80 bg-topbar/85 px-5 shadow-topbar backdrop-blur-xl transition-all duration-300',
        'left-0 lg:left-sidebar',
        collapsed ? 'lg:left-sidebar-collapsed' : 'lg:left-sidebar'
      )}
    >
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center rounded-xl p-2 text-topbar-foreground/60 hover:bg-topbar-muted hover:text-topbar-foreground transition-colors lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <Breadcrumb items={crumbs} className="hidden sm:flex" />

      {/* Global search */}
      <div className="relative max-w-sm flex-1 ml-auto">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="w-full rounded-xl border border-border/60 bg-muted/30 py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring/40 focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--ring)/0.12)] transition-all"
        />
      </div>

      {/* Date */}
      <span className="hidden rounded-lg bg-muted/40 px-2.5 py-1 text-2xs font-medium text-muted-foreground/70 md:block">
        {today}
      </span>

      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button onClick={toggleDark} className={iconBtn}>
          <motion.div
            key={dark ? 'moon' : 'sun'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </motion.div>
        </button>

        {/* Notifications */}
        <button className={iconBtn}>
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
          </span>
        </button>

        <div className="mx-2 h-5 w-px bg-border/60" />

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 hover:bg-topbar-muted hover:shadow-sm"
          >
            <div className="rounded-full ring-2 ring-primary/15 transition-shadow hover:ring-primary/30">
              <Avatar name={session?.name || 'Utilisateur'} size="sm" />
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold text-topbar-foreground">{session?.name || 'Utilisateur'}</p>
              <p className="text-3xs text-muted-foreground/60">{session?.roleName || '—'}</p>
            </div>
            <ChevronDown className={cn('h-3 w-3 text-muted-foreground/40 transition-transform duration-200', showProfile && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-xl border border-border/80 bg-card p-1.5 shadow-modal"
              >
                <div className="border-b border-border/60 px-3 pb-2.5 pt-1.5">
                  <p className="text-sm font-semibold text-foreground">{session?.name || 'Utilisateur'}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground/60">{session?.email || ''}</p>
                </div>
                {[
                  { label: 'Profil', icon: User, to: '/profil' },
                  { label: 'Paramètres', icon: Settings, to: '/parametres' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setShowProfile(false)
                      navigate({ to: item.to })
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    {item.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-border/60" />
                <button
                  onClick={() => {
                    setShowProfile(false)
                    onLogout?.()
                  }}
                  data-testid="logout-button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Déconnexion
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
    </header>
  )
}
