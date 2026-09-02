import { cn } from '@/lib/cn'
import { can, type Session } from '@/lib/session'
import {
  LayoutDashboard,
  Upload,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  permission?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', href: '/' },
      { icon: FileText, label: 'Courriers sortants', href: '/courriers', permission: 'courrier:read' },
    ],
  },
  {
    title: 'Données',
    items: [
      { icon: Upload, label: 'Importation', href: '/import', permission: 'import' },
      { icon: Settings, label: 'Paramètres', href: '/parametres', permission: 'parametre:read' },
    ],
  },
]

function sectionsFor(session: Session | null): NavSection[] {
  if (!session) return []
  return navSections
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || can(session, i.permission)) }))
    .filter((s) => s.items.length > 0)
}

const ACTIVE_CLASS =
  'bg-gradient-to-r from-primary to-[hsl(235_70%_50%)] text-white shadow-[0_4px_16px_-4px_hsl(215_80%_50%/0.55)]'
const IDLE_CLASS =
  'text-sidebar-foreground/55 hover:bg-sidebar-muted hover:text-sidebar-foreground'

export function Sidebar({
  mobileOpen,
  onClose,
  session,
  collapsed,
  onToggle,
}: {
  mobileOpen: boolean
  onClose: () => void
  session: Session | null
  collapsed: boolean
  onToggle: () => void
}) {
  const [search, setSearch] = useState('')
  const { pathname } = useLocation()

  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) onClose()
    }
    if (mobileOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [mobileOpen, onClose])

  const expanded = !collapsed || !isDesktop

  const allowedSections = useMemo(() => sectionsFor(session), [session])

  const filteredSections = useMemo(() => {
    if (!search) return allowedSections
    const q = search.toLowerCase()
    return allowedSections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0)
  }, [search, allowedSections])

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-sidebar flex-col overflow-hidden border-r border-sidebar-border bg-sidebar shadow-sidebar transition-all duration-300',
          collapsed ? 'lg:w-sidebar-collapsed' : 'lg:w-sidebar',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Halo décoratif */}
        <div className="pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl motion-reduce:hidden" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-[hsl(271_75%_55%)]/15 blur-3xl motion-reduce:hidden" />

        {/* Logo */}
        <div className="relative flex h-topbar items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(271_75%_55%)] text-white shadow-[0_4px_14px_-4px_hsl(215_80%_50%/0.7)]">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M4 6h8M4 9h5M4 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <AnimatePresence mode="wait">
            {expanded && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-col overflow-hidden whitespace-nowrap leading-tight"
              >
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground">DEX</span>
                <span className="text-3xs font-semibold tracking-[0.14em] uppercase text-sidebar-foreground/40">
                  Suivi courriers
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <AnimatePresence mode="wait">
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative px-3 pt-3"
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/30" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-sidebar-border bg-sidebar-muted py-2 pl-8 pr-3 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/25 focus:outline-none focus:border-sidebar-accent/40 focus:ring-2 focus:ring-sidebar-accent/20 transition-all"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="relative flex-1 space-y-4 overflow-y-auto px-3 py-4 scrollbar-thin">
          <AnimatePresence mode="wait">
            {collapsed && isDesktop && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-0.5"
              >
                {allowedSections.flatMap((s) => s.items).map((item) => {
                  const active = pathname === item.href
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      onClick={onClose}
                      className={cn(
                        'flex items-center justify-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200',
                        active ? ACTIVE_CLASS : IDLE_CLASS,
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </a>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {expanded && (
            <>
              {filteredSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-1.5 px-3 text-3xs font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/30">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const active = pathname === item.href
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                            active ? ACTIVE_CLASS : IDLE_CLASS,
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {active && (
                            <motion.div
                              layoutId="sidebar-active"
                              className="h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                        </a>
                      )
                    })}
                  </div>
                </div>
              ))}
              {filteredSections.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs text-sidebar-foreground/30">Aucun résultat</p>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="relative border-t border-sidebar-border p-3">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/50 hover:bg-sidebar-muted hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4 shrink-0" />
            {expanded && <span>Déconnexion</span>}
          </button>
          <button
            onClick={onToggle}
            className="mt-0.5 hidden w-full items-center justify-center rounded-xl px-3 py-2 text-sidebar-foreground/30 hover:bg-sidebar-muted hover:text-sidebar-foreground transition-colors lg:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
