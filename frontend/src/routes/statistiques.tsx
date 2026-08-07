import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Mail,
  MailCheck,
  AlertTriangle,
  PhoneCall,
  Users,
  RotateCcw,
  Filter,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState, LoadingState } from '@/components/ui/feedback'
import { DonutChart, type ChartDatum } from '@/components/charts'
import { cn } from '@/lib/cn'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

interface EvolutionItem {
  mois: string
  total: number
  retires: number
}

interface DestinataireItem {
  destinataire: string
  total: number
}

interface GlobalStats {
  total: number
  retires: number
  injoignables: number
  courriersSimples: number
  courriersReponses: number
  distribution: Record<string, number>
}

interface SituationMeta {
  id: string
  nom: string
}

interface SituationMetaResp {
  situations: SituationMeta[]
  signataires: string[]
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/statistiques',
  component: StatistiquesPage,
})

const situationColors: Record<string, string> = {
  Nouveau: '#6B7280',
  Appeler: '#3B82F6',
  Injoignable: '#F59E0B',
  Rappeler: '#8B5CF6',
  'Destinataire joint': '#10B981',
  Retiré: '#059669',
}

const PERIODES: { v: string; label: string; jours?: number }[] = [
  { v: '30j', label: '30 jours', jours: 30 },
  { v: '3m', label: '3 mois', jours: 90 },
  { v: '6m', label: '6 mois', jours: 180 },
  { v: '12m', label: '12 mois', jours: 365 },
  { v: 'toutes', label: 'Toutes les périodes' },
]

function periodeDebut(jours: number): string {
  const d = new Date()
  d.setDate(d.getDate() - jours)
  return d.toISOString().split('T')[0]
}

function StatistiquesPage() {
  const session = useSession()
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [evolution, setEvolution] = useState<EvolutionItem[]>([])
  const [destinataires, setDestinataires] = useState<DestinataireItem[]>([])
  const [meta, setMeta] = useState<SituationMetaResp | null>(null)
  const [periode, setPeriode] = useState('12m')
  const [signataire, setSignataire] = useState('')
  const [situationId, setSituationId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/situations/meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.situations) && Array.isArray(d.signataires)) setMeta(d as SituationMetaResp)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const p = PERIODES.find((x) => x.v === periode)
    const params = new URLSearchParams()
    if (p?.jours) params.set('debut', periodeDebut(p.jours))
    if (signataire) params.set('signataire', signataire)
    if (situationId) params.set('situationId', situationId)
    const qs = params.toString()

    const f1 = fetch(`/api/statistiques/global${qs ? `?${qs}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    const f2 = fetch(`/api/statistiques/evolution${qs ? `?${qs}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    const f3 = fetch(`/api/statistiques/destinataires${qs ? `?${qs}` : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    Promise.all([f1, f2, f3]).then(([global, evol, dest]) => {
      if (global && typeof global.total === 'number') {
        setGlobalStats(global as GlobalStats)
      }
      if (Array.isArray(evol)) setEvolution(evol as EvolutionItem[])
      if (Array.isArray(dest)) setDestinataires(dest as DestinataireItem[])
      setLoading(false)
    })
  }, [periode, signataire, situationId])

  useEffect(load, [load])

  const maxEvol = Math.max(...evolution.map((e) => e.total), 1)
  const filtreActif = periode !== '12m' || signataire !== '' || situationId !== ''
  const periodeLabel = PERIODES.find((p) => p.v === periode)?.label || ''

  const resetFilters = () => {
    setPeriode('12m')
    setSignataire('')
    setSituationId('')
  }

  return (
    <Guard session={session} permission="statistique:read">
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Statistiques" description="Analyse et indicateurs clés" />

      <Card className="!p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Filtres</h2>
          <button
            onClick={resetFilters}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODES.map((p) => (
            <button
              key={p.v}
              onClick={() => setPeriode(p.v)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                periode === p.v
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-muted-foreground">Signataire</span>
            <select
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
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
          <label className="block">
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-muted-foreground">Situation</span>
            <select
              value={situationId}
              onChange={(e) => setSituationId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Toutes les situations</option>
              {(meta?.situations || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {loading ? (
        <LoadingState />
      ) : globalStats ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          >
            <Card className="!p-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total courriers
                </p>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {globalStats.total.toLocaleString('fr-FR')}
              </p>
            </Card>
            <Card className="!p-4">
              <div className="flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-emerald-500" />
                <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  Retirés
                </p>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {globalStats.retires.toLocaleString('fr-FR')}
              </p>
            </Card>
            <Card className="!p-4">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-rose-500" />
                <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                  Injoignables
                </p>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {globalStats.injoignables.toLocaleString('fr-FR')}
              </p>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
              <CardHeader title="Évolution" icon={<TrendingUp className="h-4 w-4" />} subtitle={periodeLabel} />
              <div className="p-6">
                {evolution.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucune donnée
                  </p>
                ) : (
                  <div className="space-y-2">
                    {evolution.map((e, i) => (
                      <div key={e.mois + i} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-xs text-muted-foreground">
                          {e.mois}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(e.total / maxEvol) * 100}%`,
                                }}
                                transition={{ duration: 0.8 }}
                                className="h-full rounded-full bg-primary"
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-muted-foreground">
                              {e.total}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(e.retires / maxEvol) * 100}%`,
                                }}
                                transition={{ duration: 0.8, delay: 0.1 }}
                                className="h-full rounded-full bg-emerald-500"
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-muted-foreground">
                              {e.retires}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-3 pt-2 text-2xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Total
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Retirés
                      </span>
                    </div>
                  </div>
                )}
              </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
              <CardHeader title="Distribution par statut" icon={<BarChart3 className="h-4 w-4" />} />
              <div className="p-5">
                <DonutChart
                  data={Object.entries(globalStats.distribution).map(
                    ([label, value]): ChartDatum => ({ label, value }),
                  )}
                  colorFor={(label) => situationColors[label]}
                />
              </div>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
            <CardHeader title="Top destinataires" icon={<Users className="h-4 w-4" />} />
            {destinataires.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune donnée
              </div>
            ) : (
              <div className="divide-y divide-border">
                {destinataires.map((d, i) => {
                  const max = destinataires[0].total
                  return (
                    <div
                      key={d.destinataire}
                      className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/30"
                    >
                      <span className="w-6 text-sm font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">
                            {d.destinataire}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {d.total.toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${(d.total / max) * 100}%`,
                            }}
                            transition={{ duration: 0.8, delay: i * 0.03 }}
                            className="h-full rounded-full bg-primary"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </Card>
          </motion.div>

          {filtreActif && (
            <p className="text-xs text-muted-foreground">
              Analyse limitée à : {periodeLabel}
              {signataire ? ` · signataire : ${signataire}` : ''}
              {situationId && meta ? ` · situation : ${meta.situations.find((s) => s.id === situationId)?.nom || situationId}` : ''}
            </p>
          )}
        </>
      ) : (
        <Card><EmptyState icon={<BarChart3 className="h-10 w-10 text-muted-foreground/20" />} title="Aucune donnée disponible" /></Card>
      )}
    </div>
    </Guard>
  )
}

export default StatistiquesPage
