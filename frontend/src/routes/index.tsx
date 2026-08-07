import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { motion, useInView, useMotionValue, useReducedMotion, animate } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useEffect, useRef, useState } from 'react'
import {
  Inbox,
  MailCheck,
  FileText,
  Mail,
  PhoneCall,
  Activity,
  ArrowRight,
  ArrowRightLeft,
  UserX,
  History,
  Upload,
  Plus,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/feedback'
import { DonutChart } from '@/components/charts'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

interface GlobalStats {
  total: number
  retires: number
  courriersSimples: number
  courriersReponses: number
  injoignables: number
  parSignataire: Record<string, number>
  distribution: Record<string, number>
}

interface Activite {
  action: string
  user: { name: string }
  createdAt: string
  courrier: { numero: string } | null
}

function formatActivite(a: Activite): { text: string; type: string; detail: string } {
  const action = a.action.toUpperCase()
  const detail = `par ${a.user.name}`
  if (action === 'IMPORT')
    return { text: 'Importation Excel', type: 'import', detail }
  if (action === 'CREATE' || action === 'CREATION')
    return { text: `Nouveau courrier #${a.courrier?.numero ?? ''}`, type: 'create', detail }
  if (action === 'RETRAIT')
    return { text: `Retrait courrier #${a.courrier?.numero ?? ''}`, type: 'retrait', detail }
  if (action === 'TRANSITION')
    return { text: `Transition #${a.courrier?.numero ?? ''}`, type: 'transition', detail }
  return { text: `${a.action} #${a.courrier?.numero ?? ''}`, type: 'default', detail }
}

function tempsDepuis(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "À l'instant"
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Il y a ${h}h`
  const j = Math.floor(h / 24)
  return `Il y a ${j}j`
}

/* ── Séquence du flux — ordre + couleurs connus, repli alphabétique ── */
const FLUX_ORDRE = [
  'Nouveau',
  'Appel effectué',
  'Injoignable',
  'Destinataire joint',
  'Retiré',
  'Auprès du coursier',
  'Livré',
]
const FLUX_COULEURS: Record<string, string> = {
  Nouveau: '#6B7280',
  'Appel effectué': '#3B82F6',
  Injoignable: '#F59E0B',
  'Destinataire joint': '#10B981',
  Retiré: '#059669',
  'Auprès du coursier': '#E11D48',
  Livré: '#059669',
}
const FLUX_FINALS = new Set(['Retiré', 'Livré'])

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const mv = useMotionValue(0)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      mv.set(value)
      if (ref.current) ref.current.textContent = value.toLocaleString('fr-FR')
      return
    }
    const controls = animate(mv, value, { duration: 0.9, ease: 'easeOut' })
    return () => controls.stop()
  }, [inView, value, reduced, mv])

  useEffect(() => {
    const unsub = mv.on('change', (v) => {
      if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('fr-FR')
    })
    return unsub
  }, [mv])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}

interface Kpi {
  label: string
  value: number
  icon: LucideIcon
  className: string
  href: string | null
}

function KpiTile({
  kpi,
  index,
  featured,
  share,
}: {
  kpi: Kpi
  index: number
  featured?: boolean
  share: number
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.05, duration: 0.4 }}
      className={cn(
        'group relative h-full overflow-hidden rounded-2xl border p-5 transition-all duration-300',
        featured
          ? 'border-transparent bg-gradient-to-br from-primary via-[hsl(235_70%_50%)] to-[hsl(271_75%_55%)] text-white shadow-[0_16px_40px_-12px_hsl(235_70%_50%/0.5)]'
          : 'border-border/70 bg-card shadow-card hover:-translate-y-1 hover:shadow-elevated',
      )}
    >
      {/* halo décoratif */}
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl motion-reduce:hidden',
          featured ? 'bg-white/20' : 'bg-primary/10',
        )}
      />
      <div className="relative flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', featured ? 'bg-white/15 ring-1 ring-white/25' : cn('ring-1', kpi.className))}>
          <kpi.icon className="h-5 w-5" />
        </div>
        <p
          className={cn(
            'font-mono text-kpi tabular-nums tracking-tight',
            featured ? 'text-white' : 'text-foreground',
          )}
        >
          <AnimatedNumber value={kpi.value} />
        </p>
      </div>
      <p
        className={cn(
          'relative mt-3 text-2xs font-semibold uppercase tracking-[0.08em]',
          featured ? 'text-white/80' : 'text-muted-foreground/80',
        )}
      >
        {kpi.label}
      </p>
      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(3, share)}%` }}
          transition={{ duration: 0.9, delay: 0.3 + index * 0.06, ease: 'easeOut' }}
          className={cn('h-full rounded-full', featured ? 'bg-white/80' : 'bg-gradient-to-r from-primary to-[hsl(271_75%_55%)]')}
        />
      </div>
      <p
        className={cn(
          'relative mt-1.5 text-3xs font-medium',
          featured ? 'text-white/60' : 'text-muted-foreground/50',
        )}
      >
        {share.toFixed(1)}% du parc
      </p>
    </motion.div>
  )
  return kpi.href ? (
    <a key={kpi.label} href={kpi.href} className="block h-full">
      {inner}
    </a>
  ) : (
    <div key={kpi.label} className="h-full">
      {inner}
    </div>
  )
}

function PipelineFlux({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  const connues = FLUX_ORDRE.map((nom) => ({ nom, count: distribution[nom] ?? 0 }))
  const inconnues = Object.entries(distribution)
    .filter(([nom]) => !FLUX_ORDRE.includes(nom))
    .sort((a, b) => b[1] - a[1])
    .map(([nom, count]) => ({ nom, count }))
  const nodes = [...connues, ...inconnues]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Flux des courriers"
        subtitle="Répartition le long du circuit"
        icon={<ArrowRightLeft className="h-4 w-4" />}
      />
      <div className="overflow-x-auto p-5 scrollbar-thin">
        <div className="flex min-w-[760px] items-start">
          {nodes.map((node, i) => (
            <div key={node.nom} className="flex items-start">
              {i > 0 && (
                <div className="relative mt-5 h-0.5 w-8 shrink-0 overflow-hidden rounded-full bg-muted sm:w-12">
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', delay: i * 0.1 }}
                    className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent motion-reduce:hidden"
                  />
                </div>
              )}
              <div className="flex w-[104px] flex-col items-center text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                  className="relative flex h-10 w-10 items-center justify-center rounded-2xl border-2 bg-card shadow-card"
                  style={{ borderColor: FLUX_COULEURS[node.nom] ?? 'hsl(var(--border))' }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: FLUX_COULEURS[node.nom] ?? 'hsl(var(--muted-foreground))' }}
                  />
                  {FLUX_FINALS.has(node.nom) && (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: FLUX_COULEURS[node.nom] ?? 'hsl(var(--primary))' }}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                  )}
                </motion.div>
                <p className="mt-2 font-mono text-base font-bold tabular-nums text-foreground">
                  <AnimatedNumber value={node.count} />
                </p>
                <p className="mt-0.5 line-clamp-2 text-2xs leading-tight text-muted-foreground/70" title={node.nom}>
                  {node.nom}
                </p>
                <p className="mt-1 text-3xs font-medium tabular-nums text-muted-foreground/40">
                  {total > 0 ? ((node.count / total) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Dashboard() {
  const session = useSession()
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [activites, setActivites] = useState<Activite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/statistiques/global').then((r) => r.json()),
      fetch('/api/historique').then((r) => r.json()),
    ])
      .then(([statsData, historiqueData]) => {
        setStats(statsData)
        setActivites(historiqueData.actions?.slice(0, 5) ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState text="Chargement du tableau de bord..." />

  const total = stats?.total ?? 0
  const retires = stats?.retires ?? 0
  const injoignables = stats?.injoignables ?? 0
  const pctRetires = total > 0 ? Math.round((retires / total) * 100) : 0

  const kpis: Kpi[] = [
    { label: 'Total courriers', value: total, icon: Inbox, className: 'bg-primary/10 text-primary ring-primary/20', href: '/situations' },
    { label: 'Courriers simples', value: stats?.courriersSimples ?? 0, icon: FileText, className: 'bg-sky-500/10 text-sky-500 ring-sky-500/20', href: '/situations?type=simples' },
    { label: 'Courriers réponses', value: stats?.courriersReponses ?? 0, icon: Mail, className: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20', href: '/situations?type=reponses' },
    { label: 'Retirés', value: retires, icon: MailCheck, className: 'bg-teal-500/10 text-teal-500 ring-teal-500/20', href: '/situations?type=retires' },
    { label: 'Injoignables', value: injoignables, icon: PhoneCall, className: 'bg-rose-500/10 text-rose-500 ring-rose-500/20', href: '/situations?type=injoignables' },
  ]

  const totalSig = Object.values(stats?.parSignataire ?? {}).reduce((a, b) => a + b, 0) || 1
  const sigItems = Object.entries(stats?.parSignataire ?? {}).sort((a, b) => b[1] - a[1])
  const sigColors = ['#0F766E', '#0369A1', '#7C3AED', '#DB2777', '#B45309', '#4D7C0F', '#334155']
  const sigMax = Math.max(...sigItems.map(([, v]) => v), 1)

  const totalDist = Object.values(stats?.distribution ?? {}).reduce((a, b) => a + b, 0) || 1
  const distItems = Object.entries(stats?.distribution ?? {}).map(([label, value]) => ({
    label,
    value: (value / totalDist) * 100,
    count: value,
  }))

  const dateLongue = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const R = 34
  const C = 2 * Math.PI * R

  const activityMeta: Record<string, { icon: LucideIcon; className: string }> = {
    create: { icon: Plus, className: 'bg-primary/10 text-primary ring-primary/20' },
    retrait: { icon: MailCheck, className: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' },
    transition: { icon: ArrowRightLeft, className: 'bg-amber-500/10 text-amber-500 ring-amber-500/20' },
    import: { icon: Upload, className: 'bg-violet-500/10 text-violet-500 ring-violet-500/20' },
    default: { icon: Activity, className: 'bg-muted text-muted-foreground ring-border' },
  }

  return (
    <Guard session={session} permission="statistique:read">
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Héro ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
      >
        <div className="absolute inset-0 bg-aurora motion-reduce:hidden" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl motion-reduce:hidden" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-3xs font-semibold uppercase tracking-[0.16em] text-primary">
              Secrétariat Central · Suivi des courriers sortants
            </p>
            <h1 className="mt-2 text-display font-bold tracking-tight text-foreground">
              Tableau de <span className="text-gradient">bord</span>
            </h1>
            <p className="mt-1.5 text-sm capitalize text-muted-foreground/80">{dateLongue}</p>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            <div className="relative">
              <svg viewBox="0 0 80 80" className="h-20 w-20 sm:h-24 sm:w-24">
                <defs>
                  <linearGradient id="hero-ring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(271 75% 55%)" />
                  </linearGradient>
                </defs>
                <circle cx="40" cy="40" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                <motion.circle
                  cx="40"
                  cy="40"
                  r={R}
                  fill="none"
                  stroke="url(#hero-ring)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C * (1 - pctRetires / 100) }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
                  transform="rotate(-90 40 40)"
                />
                <text x="40" y="42" textAnchor="middle" className="fill-foreground" style={{ fontSize: 15, fontWeight: 700 }}>
                  {pctRetires}%
                </text>
                <text x="40" y="56" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 7.5 }}>
                  retirés
                </text>
              </svg>
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </span>
            </div>
            <div className="hidden flex-col gap-1.5 sm:flex">
              <p className="text-sm font-semibold text-foreground">Avancement des retraits</p>
              <p className="text-2xs text-muted-foreground/70">
                <span className="font-mono font-bold tabular-nums text-foreground">{retires.toLocaleString('fr-FR')}</span>{' '}
                sur {total.toLocaleString('fr-FR')} courriers
              </p>
              <p className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {injoignables.toLocaleString('fr-FR')} injoignables
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── KPI ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <KpiTile key={k.label} kpi={k} index={i} featured={i === 0} share={total > 0 ? (k.value / total) * 100 : 0} />
        ))}
      </div>

      {/* ── Flux ── */}
      <PipelineFlux distribution={stats?.distribution ?? {}} total={total} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Distribution par statut */}
        <Card>
          <CardHeader
            title="Distribution"
            subtitle="Répartition par statut"
            icon={<BarChartIcon />}
          />
          <div className="space-y-4 p-5">
            {distItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/60">Aucune donnée</p>
            ) : (
              <DonutChart
                data={distItems.map((d) => ({ label: d.label, value: d.count }))}
                maxSegments={5}
              />
            )}
          </div>
        </Card>

        {/* Par signataire */}
        <Card>
          <CardHeader
            title="Par signataire"
            subtitle="Répartition des courriers"
            icon={<UserX className="h-4 w-4" />}
          />
          <div className="space-y-4 p-5">
            {sigItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/60">Aucune donnée</p>
            ) : (
              sigItems.map(([nom, count], i) => (
                <a
                  key={nom}
                  href={`/situations?type=signataire:${encodeURIComponent(nom)}`}
                  className="group block"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {nom}
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                      {count.toLocaleString('fr-FR')}
                      <span className="ml-1.5 text-3xs font-medium text-muted-foreground/50">
                        {((count / totalSig) * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, (count / sigMax) * 100)}%` }}
                      transition={{ duration: 0.7, delay: i * 0.05 }}
                      className="h-full rounded-full transition-shadow group-hover:shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                      style={{ backgroundColor: sigColors[i % sigColors.length] }}
                    />
                  </div>
                </a>
              ))
            )}
            <p className="pt-1 text-2xs text-muted-foreground/60">
              {sigItems.length > 0 && `${totalSig.toLocaleString('fr-FR')} courriers · cliquer pour filtrer`}
            </p>
          </div>
        </Card>
      </div>

      {/* Activités récentes */}
      <Card>
          <CardHeader
            title="Activités récentes"
            subtitle={activites.length > 0 ? `${activites.length} dernières actions` : undefined}
            icon={<Activity className="h-4 w-4" />}
            action={
              <a href="/historique" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors">
                Voir tout <ArrowRight className="h-3 w-3" />
              </a>
            }
          />
          <div>
            {activites.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <History className="h-8 w-8 text-muted-foreground/20" />
                <p className="mt-2 text-xs text-muted-foreground/60">Aucune activité récente</p>
              </div>
            ) : (
              <div className="p-5">
                <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
                  {activites.map((activity, index) => {
                    const fmt = formatActivite(activity)
                    const meta = activityMeta[fmt.type] ?? activityMeta.default
                    const recent = Date.now() - new Date(activity.createdAt).getTime() < 3600000
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative flex items-start gap-3"
                      >
                        <div className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1', meta.className)}>
                          <meta.icon className="h-3.5 w-3.5" />
                          {recent && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{fmt.text}</p>
                          <p className="mt-0.5 text-2xs text-muted-foreground/60">{fmt.detail}</p>
                        </div>
                        <span className="mt-0.5 shrink-0 text-2xs text-muted-foreground/50">
                          {tempsDepuis(activity.createdAt)}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
    </div>
    </Guard>
  )
}

function BarChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="8" width="3" height="6" rx="1" fill="currentColor" />
      <rect x="6.5" y="5" width="3" height="9" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="11" y="2" width="3" height="12" rx="1" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

export default Dashboard
