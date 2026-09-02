import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, animate } from 'framer-motion'
import { cn } from '@/lib/cn'
import {
  Calendar,
  Filter,
  Inbox,
  Mail,
  Truck,
  PhoneCall,
  UserX,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  FileText,
  PieChart,
  LineChart,
  Sparkles,
  Clock,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/feedback'
import { GenerateSituationDialog, PERIODES } from '@/components/situations/generate-situation-dialog'
import { BarsChart, DonutChart, LineChart as EvolutionChart } from '@/components/charts'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/situations',
  component: SituationsPage,
})

interface SituationMeta {
  id: string
  nom: string
  couleur: string
  estInitial: boolean
  estFinal: boolean
}

interface SituationStats {
  total: number
  courriersSimples: number
  courriersReponses: number
  retires: number
  envoyesMail: number
  envoyesCoursier: number
  enRetraitSecretariat: number
  injoignables: number
  reponsesEntrant: number
  rappelsEffectues: number
  parSignataire: Record<string, number>
  aRappeler: number
  tauxRetrait: number | null
  parSituation: Record<string, number>
  parModeTransmission: Record<string, number>
  evolution: { libelle: string; total: number; retires: number }[]
  repartitionDelais: { libelle: string; count: number }[]
  delaiMinJours: number | null
  delaiMaxJours: number | null
  tempsMoyenReponseJours: number | null
  tempsMoyenRetraitJours: number | null
}

interface TableRow {
  id: string
  numero: string
  dateEnvoi: string
  destinataire: string
  objet: string
  signataire: string
  numeroEntrant: string | null
  dateArriveeEntrant: string | null
  modeTransmission: { nom: string; couleur: string; cle: string | null } | null
  situation: { nom: string; couleur: string }
  retrait: { dateRetrait: string; nomRetraitant: string; telephone: string | null } | null
  observation: string | null
}

interface RequeteResp {
  periodeLabel: string
  filtreTexte: string
  stats: SituationStats
  tableau: { total: number; rows: TableRow[] }
  page: number
  pageSize: number
}

interface IndicateurResp {
  type: string
  total: number
  rows: TableRow[]
  stats: SituationStats
}

const INDICATEUR_LABELS: Record<string, string> = {
  total: 'Total courriers',
  simples: 'Courriers simples',
  reponses: 'Courriers réponses',
  retires: 'Retirés',
  envoyesMail: 'Envoyés par email',
  envoyesCoursier: 'Envoyés par coursier',
  injoignables: 'Injoignables',
  rappels: 'Avec relances',
}

const SORTABLE = ['numero', 'dateEnvoi', 'destinataire', 'objet', 'signataire', 'numeroEntrant', 'dateRetrait', 'observation']

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR')
}

function delaiJours(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null
  const diff = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

function fmtJours(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—'
  const v = Math.round(n * 10) / 10
  const s = Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
  return `${s} jour${v > 1 ? 's' : ''}`
}

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

interface Tile {
  type: string
  label: string
  key: keyof SituationStats | null
  icon: LucideIcon
  className: string
}

function TileCard({
  tile,
  active,
  value,
  share,
  index,
  onClick,
}: {
  tile: Tile
  active: boolean
  value: number
  share: number
  index: number
  onClick: () => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06 + index * 0.03, duration: 0.35 }}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated',
        active ? 'border-primary bg-primary/[0.04] ring-2 ring-ring/30' : 'border-border/70',
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl motion-reduce:hidden" />
      <div className="relative flex items-start justify-between">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg ring-1', tile.className)}>
          <tile.icon className="h-4 w-4" />
        </span>
        <span className="font-mono text-lg font-bold tabular-nums tracking-tight text-foreground">
          <AnimatedNumber value={value} />
        </span>
      </div>
      <p className="relative mt-2 truncate text-xs font-medium text-muted-foreground/90">{tile.label}</p>
      <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, share)}%` }}
          transition={{ duration: 0.8, delay: 0.25 + index * 0.04, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(271_75%_55%)]"
        />
      </div>
    </motion.button>
  )
}

function SituationsPage() {
  const session = useSession()
  const [meta, setMeta] = useState<{ situations: SituationMeta[]; signataires: string[] } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [periode, setPeriode] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [signataire, setSignataire] = useState('')
  const [type, setType] = useState('tous')

  const [stats, setStats] = useState<SituationStats | null>(null)
  const [activeStats, setActiveStats] = useState<SituationStats | null>(null)
  const [rows, setRows] = useState<TableRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [periodeLabel, setPeriodeLabel] = useState('Toutes périodes')
  const [filtreTexte, setFiltreTexte] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [tri, setTri] = useState('dateEnvoi')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [indicateurType, setIndicateurType] = useState<string | null>(null)
  const [indicateurLabel, setIndicateurLabel] = useState('')
  const [indicateurTotal, setIndicateurTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const PAGE_SIZE_MAX = 200

  const refreshHistorique = useCallback(() => {}, [])

  useEffect(() => {
    fetch('/api/situations/meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((metaData) => {
        if (metaData) setMeta(metaData)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const t = sp.get('type')
    const p = sp.get('periode')
    const s = sp.get('signataire')
    if (t) {
      if (t === 'simples' || t === 'reponses' || t === 'retires' || t === 'injoignables') {
        setType(t)
      } else if (t.startsWith('signataire:')) {
        setIndicateurType(t)
        setIndicateurLabel(`Signataire ${t.replace('signataire:', '')}`)
      }
    }
    if (p) setPeriode(p)
    if (s) setSignataire(s)
  }, [])

  const filterParams = useCallback(() => {
    const p = new URLSearchParams()
    if (periode) p.set('periode', periode)
    if (dateDebut) p.set('dateDebut', dateDebut)
    if (dateFin) p.set('dateFin', dateFin)
    if (signataire) p.set('signataire', signataire)
    if (type === 'reponses') p.set('reponseEntrant', '1')
    if (type === 'retires') p.set('retires', '1')
    return p
  }, [periode, dateDebut, dateFin, signataire, type])

  useEffect(() => {
    setLoading(true)
    const typeIndicateur = ['simples', 'injoignables', 'mail', 'coursier'].includes(type) ? type : null
    const activeIndicateur = indicateurType ?? (typeIndicateur ? { simples: 'simples', injoignables: 'injoignables', mail: 'envoyesMail', coursier: 'envoyesCoursier' }[typeIndicateur] : null)

    if (activeIndicateur) {
      const p = filterParams()
      if (p.has('reponseEntrant')) p.delete('reponseEntrant')
      if (p.has('retires')) p.delete('retires')
      fetch(`/api/situations/indicateur/${activeIndicateur}?${p}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: IndicateurResp | null) => {
          if (data) {
            setRows(data.rows)
            setTotalRows(data.total)
            setIndicateurTotal(data.total)
            setActiveStats(data.stats)
            setLoading(false)
          }
        })
        .catch(() => setLoading(false))
      return
    }

    const p = filterParams()
    p.set('page', String(page))
    p.set('pageSize', String(pageSize))
    p.set('tri', tri)
    p.set('dir', dir)
    fetch(`/api/situations/requete?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RequeteResp | null) => {
        if (data) {
          setStats(data.stats)
          setActiveStats(null)
          setRows(data.tableau.rows)
          setTotalRows(data.tableau.total)
          setPeriodeLabel(data.periodeLabel)
          setFiltreTexte(data.filtreTexte)
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [filterParams, page, pageSize, tri, dir, indicateurType, type])

  const onSort = (col: string) => {
    if (tri === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setTri(col)
      setDir('asc')
    }
  }

  const resetFilters = () => {
    setPeriode('')
    setDateDebut('')
    setDateFin('')
    setSignataire('')
    setType('tous')
    setIndicateurType(null)
    setActiveStats(null)
    setPage(1)
  }

  const clickIndicateur = (t: string, label: string) => {
    setType('tous')
    setIndicateurLabel(label)
    setIndicateurType(t === 'total' ? null : t)
    setActiveStats(null)
    setPage(1)
  }

  const download = async (exportType: 'pdf' | 'xlsx' | 'csv' | 'exec-pdf' | 'exec-xlsx', params: URLSearchParams, openInTab = false) => {
    const res = await fetch(`/api/situations/export/${exportType}?${params}`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const cd = res.headers.get('Content-Disposition') || ''
    const m = cd.match(/filename="?([^";]+)"?/)
    if (openInTab) {
      window.open(url, '_blank')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = m?.[1] || `situation.${exportType}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
  }

  const handleWizardGenerate = async (format: 'exec-pdf' | 'exec-xlsx' | 'pdf' | 'xlsx' | 'csv', params: URLSearchParams, openInTab: boolean) => {
    await download(format, params, openInTab)
  }

  const tiles: Tile[] = [
    { type: 'total', label: 'Total courriers', key: 'total', icon: Inbox, className: 'bg-primary/10 text-primary ring-primary/20' },
    { type: 'simples', label: 'Courriers simples', key: 'courriersSimples', icon: FileText, className: 'bg-sky-500/10 text-sky-500 ring-sky-500/20' },
    { type: 'reponses', label: 'Courriers réponses', key: 'courriersReponses', icon: Mail, className: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20' },
    { type: 'retires', label: 'Retirés', key: 'retires', icon: Inbox, className: 'bg-teal-500/10 text-teal-500 ring-teal-500/20' },
    { type: 'envoyesMail', label: 'Envoyés email', key: 'envoyesMail', icon: Mail, className: 'bg-violet-500/10 text-violet-500 ring-violet-500/20' },
    { type: 'envoyesCoursier', label: 'Envoyés coursier', key: 'envoyesCoursier', icon: Truck, className: 'bg-indigo-500/10 text-indigo-500 ring-indigo-500/20' },
    { type: 'injoignables', label: 'Injoignables', key: 'injoignables', icon: PhoneCall, className: 'bg-rose-500/10 text-rose-500 ring-rose-500/20' },
    { type: 'rappels', label: 'Relances effectuées', key: 'rappelsEffectues', icon: RotateCcw, className: 'bg-orange-500/10 text-orange-500 ring-orange-500/20' },
  ]

  const shown = activeStats ?? stats
  const statsVal = (t: Tile): number => (t.key ? (shown?.[t.key] as number) ?? 0 : shown?.total ?? 0)

  const parSignataireData = Object.entries(shown?.parSignataire || {})
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  const parSituationData = Object.entries(shown?.parSituation || {})
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  const evolutionData = (shown?.evolution || []).map((e) => ({ libelle: e.libelle, total: e.total }))

  const total = shown?.total ?? 0

  const pl = (n: number) => (n > 1 ? 's' : '')
  const nf = (n: number) => n.toLocaleString('fr-FR')
  const narrative = shown
    ? `La présente situation fait état de ${nf(shown.total)} courrier${pl(shown.total)} sortant${pl(shown.total)} sur la période considérée, dont ${nf(shown.courriersSimples)} courrier${pl(shown.courriersSimples)} simple${pl(shown.courriersSimples)} et ${nf(shown.courriersReponses)} courrier${pl(shown.courriersReponses)} réponse${pl(shown.courriersReponses)} (${nf(shown.reponsesEntrant)} réponse${pl(shown.reponsesEntrant)} à un courrier entrant). ${
        shown.tauxRetrait == null
          ? 'Aucun courrier n’a été retiré sur la période.'
          : `${nf(shown.retires)} courrier${pl(shown.retires)} retiré${pl(shown.retires)}, soit un taux de ${shown.tauxRetrait} %.`
      }`
    : 'Chargement…'

  return (
    <Guard session={session} permission="situation:read">
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
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-3xs font-semibold uppercase tracking-[0.16em] text-primary">
              Secrétariat Central · Suivi des courriers sortants
            </p>
            <h1 className="mt-2 text-display font-bold tracking-tight text-foreground">
              Situation des <span className="text-gradient">courriers</span>
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground/80">
              {periodeLabel}
              {filtreTexte && <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{filtreTexte}</span>}
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="lg" data-testid="btn-generer-situation" className="shrink-0">
            <Sparkles className="h-4 w-4" /> Générer une situation
          </Button>
        </div>
      </motion.section>

      {/* ── Filtres ── */}
      <Card className="!p-4 rounded-2xl border-border/70">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Filtres</h2>
          <button
            onClick={resetFilters}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            <Calendar className="h-4 w-4" />
          </span>
          {PERIODES.map((p) => (
            <button
              key={p.v || 'toutes'}
              onClick={() => {
                setPeriode(p.v)
                setPage(1)
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                periode === p.v
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
          {periode === 'personnalisee' && (
            <>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => {
                  setDateDebut(e.target.value)
                  setPage(1)
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => {
                  setDateFin(e.target.value)
                  setPage(1)
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-muted-foreground">Signataire</span>
            <select
              value={signataire}
              onChange={(e) => {
                setSignataire(e.target.value)
                setPage(1)
              }}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Tous les signataires</option>
              {(meta?.signataires || []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {/* ── Synthèse exécutive ── */}
      <Card data-testid="synthèse-executive" className="!p-5 rounded-2xl border-border/70">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-primary">Synthèse exécutive</p>
          {indicateurType && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
              Vue filtrée : {indicateurLabel || indicateurType}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">{narrative}</p>
      </Card>

      {/* ── Indicateurs ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {tiles.map((t, i) => (
          <TileCard
            key={t.type}
            tile={t}
            active={indicateurType === t.type}
            value={statsVal(t)}
            share={total > 0 ? (statsVal(t) / total) * 100 : 0}
            index={i}
            onClick={() => clickIndicateur(t.type, t.label)}
          />
        ))}
      </div>

      {/* ── 2 · Indicateurs temporels ── */}
      {stats && (
        <Card data-testid="indicateurs-temporels" className="!p-5 rounded-2xl border-border/70">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-3.5 w-3.5" />
            </span>
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-primary">2 · Indicateurs temporels</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Clock, label: 'Temps moyen de réponse', value: fmtJours(stats.tempsMoyenReponseJours) },
              { icon: Timer, label: 'Temps moyen avant retrait', value: fmtJours(stats.tempsMoyenRetraitJours) },
              { icon: Timer, label: 'Délai de traitement min.', value: fmtJours(stats.delaiMinJours) },
              { icon: Timer, label: 'Délai de traitement max.', value: fmtJours(stats.delaiMaxJours) },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </div>
                <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{f.value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Graphiques ── */}
      {stats && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="!p-4 rounded-2xl border-border/70">
              <CardHeader title="Par signataire" subtitle="Volume par signataire officiel — cliquer pour filtrer" icon={<UserX className="h-4 w-4 text-muted-foreground" />} />
              <BarsChart data={parSignataireData} onRowClick={(label) => clickIndicateur(`signataire:${label}`, `Signataire ${label}`)} />
            </Card>
            <Card className="!p-4 rounded-2xl border-border/70">
              <CardHeader title="Répartition par situation" subtitle="Où en sont les courriers — cliquer pour filtrer" icon={<PieChart className="h-4 w-4 text-muted-foreground" />} />
              <DonutChart data={parSituationData} onSegmentClick={(label) => clickIndicateur(`situation:${label}`, `Situation ${label}`)} />
            </Card>
          </div>
          {evolutionData.length > 0 && (
            <Card className="!p-4 rounded-2xl border-border/70">
              <CardHeader title="Évolution des envois" subtitle="Tendance dans la période" icon={<LineChart className="h-4 w-4 text-muted-foreground" />} />
              <EvolutionChart points={evolutionData} />
            </Card>
          )}
        </>
      )}

      {/* ── Bandeau indicateur actif ── */}
      {indicateurType && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/[0.05] px-4 py-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">
              {indicateurType?.startsWith('signataire:')
                ? indicateurLabel || `Signataire ${indicateurType.replace('signataire:', '')}`
                : INDICATEUR_LABELS[indicateurType || ''] || indicateurLabel || indicateurType}
            </span>
            {' — '}
            {indicateurTotal} courrier{indicateurTotal > 1 ? 's' : ''}
            {filtreTexte ? ` · ${filtreTexte}` : ''}
          </p>
          <button
            onClick={() => setIndicateurType(null)}
            className="text-xs font-medium text-primary hover:text-primary/70"
          >
            Réinitialiser
          </button>
        </div>
      )}

      {periodeLabel && !indicateurType && (
        <p className="text-xs text-muted-foreground">
          {periodeLabel}
          {filtreTexte ? ` — ${filtreTexte}` : ''}
        </p>
      )}

      {/* ── Tableau ── */}
      <Card className="!p-0 overflow-hidden rounded-2xl border-border/70">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {(
                      [
                        { key: 'numero', label: 'N°' },
                        { key: 'dateEnvoi', label: "Date de signature" },
                        { key: 'signataire', label: 'Signataire' },
                        { key: 'destinataire', label: 'Destinataire' },
                        { key: 'objet', label: 'Objet' },
                        { key: 'numeroEntrant', label: 'Réponse à' },
                        { key: 'dateArrivee', label: 'Date arrivée' },
                        { key: 'delai', label: 'Délai rép.' },
                        { key: 'dateRetrait', label: 'Date retrait' },
                        { key: 'observation', label: 'Observation' },
                      ] as { key: string; label: string }[]
                    ).map((col) => {
                      const sortable = SORTABLE.includes(col.key)
                      return (
                        <th
                          key={col.key}
                          className={cn(
                            'whitespace-nowrap px-4 py-3.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70',
                            sortable && 'cursor-pointer select-none hover:text-foreground',
                          )}
                          onClick={sortable ? () => onSort(col.key) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {sortable && tri === col.key && (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        Aucun courrier pour ces critères
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const delai = delaiJours(r.dateArriveeEntrant, r.dateEnvoi)
                      return (
                        <tr key={r.id} className="transition-colors hover:bg-muted/20">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                            <a href={`/courriers/${r.id}`} className="text-primary hover:underline">
                              {r.numero}
                            </a>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{fmtDate(r.dateEnvoi)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{r.signataire}</td>
                          <td className="max-w-[180px] truncate px-4 py-3 text-sm">{r.destinataire}</td>
                          <td className="max-w-[220px] truncate px-4 py-3 text-sm text-muted-foreground">{r.objet}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">{r.numeroEntrant || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{fmtDate(r.dateArriveeEntrant)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums">
                            {delai === null ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : (
                              <span className={cn('font-medium', delai <= 10 ? 'text-success' : delai <= 30 ? 'text-amber-500' : 'text-destructive')}>
                                {delai}j
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{fmtDate(r.retrait?.dateRetrait)}</td>
                          <td className="max-w-[160px] truncate px-4 py-3 text-sm text-muted-foreground">{r.observation || '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {totalRows > 0 && (
              <Pagination page={page} totalPages={Math.max(1, Math.ceil(totalRows / pageSize))} onPageChange={setPage} />
            )}
          </>
        )}
      </Card>

      <GenerateSituationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onGenerated={refreshHistorique}
        meta={meta}
        defaults={{ periode, dateDebut, dateFin, signataire, type }}
        onGenerate={handleWizardGenerate}
      />
    </div>
    </Guard>
  )
}

export default SituationsPage
