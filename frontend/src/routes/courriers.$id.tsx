import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatDate, daysSince } from '@/lib/utils'
import type { Courrier } from '@/lib/types'
import { fetchSession, can, PERM, type Session } from '@/lib/session'
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  User,
  Hash,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Activity,
  MessageSquare,
  ChevronRight,
  Loader2,
  X,
  Phone as PhoneIcon,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, EmptyState } from '@/components/ui/feedback'
import { CourrierEditDialog } from '@/components/courriers/courrier-edit-dialog'

interface AvailableTransition {
  id: string
  nom: string
  demandeRetrait: boolean
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/courriers/$id',
  component: CourrierDetailPage,
})

function CourrierDetailPage() {
  const { id } = Route.useParams()
  const [courrier, setCourrier] = useState<Courrier | null>(null)
  const [loading, setLoading] = useState(true)
  const [transitions, setTransitions] = useState<AvailableTransition[]>([])
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [showRetrait, setShowRetrait] = useState<AvailableTransition | null>(null)
  const [retraitForm, setRetraitForm] = useState({ nomRetraitant: '', telephone: '', observation: '' })
  const [retraitLoading, setRetraitLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/courriers/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/courriers/${id}/transitions`).then((r) => r.ok ? r.json() : []),
    ]).then(([c, t]) => {
      setCourrier(c)
      setTransitions(t)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchSession().then((s) => setSession(s))
    load()
  }, [id])

  const doTransition = async (transitionId: string, retrait?: { nomRetraitant: string; telephone: string; observation: string }) => {
    setTransitioning(transitionId)
    try {
      const res = await fetch(`/api/courriers/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transitionId, retrait: retrait || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCourrier(data)
        setShowRetrait(null)
        setRetraitForm({ nomRetraitant: '', telephone: '', observation: '' })
        load()
      } else if (data.demandeRetrait) {
        const t = transitions.find((x) => x.id === transitionId)
        if (t) setShowRetrait(t)
      }
    } finally {
      setTransitioning(null)
    }
  }

  const doRetrait = async () => {
    if (!showRetrait) return
    if (!retraitForm.nomRetraitant.trim()) return
    setRetraitLoading(true)
    try {
      await doTransition(showRetrait.id, retraitForm)
    } finally {
      setRetraitLoading(false)
    }
  }

  if (loading) return <LoadingState text="Chargement du courrier..." />

  if (!courrier) {
    return <EmptyState icon={<FileText className="h-12 w-12 text-muted-foreground/20" />} title="Courrier introuvable" />
  }

  const jours = daysSince(courrier.dateEnvoi)
  const alertLevel = courrier.retrait ? null : jours >= 21 ? 'urgent' : jours >= 14 ? 'attention' : 'normal'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <a
          href="/courriers"
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a href="/courriers" className="hover:text-foreground transition-colors">Courriers</a>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-mono text-foreground">{courrier.numero}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl',
            courrier.retrait
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-primary/10 text-primary'
          )}>
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold text-foreground">
              {courrier.numero}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{courrier.objet}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {can(session, PERM.EDIT_OFFICIAL) && (
            <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} data-testid="btn-modifier-courrier">
              <Pencil className="h-4 w-4" />
              Modifier
            </Button>
          )}
          {alertLevel && (
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
              alertLevel === 'urgent' && 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
              alertLevel === 'attention' && 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
              alertLevel === 'normal' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
            )}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {jours}j sans retrait
            </span>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border bg-card"
          >
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">Informations</h2>
            </div>
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              {[
                { icon: Hash, label: 'Numéro', value: courrier.numero },
                { icon: Calendar, label: "Date de signature", value: formatDate(courrier.dateEnvoi) },
                { icon: Calendar, label: "Date d'arrivée (entrant)", value: courrier.dateArriveeEntrant ? formatDate(courrier.dateArriveeEntrant) : '—' },
                { icon: Building2, label: 'Destinataire', value: courrier.destinataire },
                { icon: User, label: 'Signataire', value: courrier.signataire },
                { icon: User, label: 'Créé par', value: courrier.createdBy.name },
                { icon: Clock, label: 'Date création', value: formatDate(courrier.createdAt) },
              ].map((f) => (
                <div key={f.label} className="bg-card px-6 py-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <f.icon className="h-3.5 w-3.5" />
                    {f.label}
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{f.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {courrier.observation && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border bg-card p-6"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Observation
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{courrier.observation}</p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border bg-card"
            data-testid="historique-list"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Historique des actions</h2>
              </div>
            </div>
            <div className="p-6">
              {courrier.historiqueActions && courrier.historiqueActions.length > 0 ? (
                <div className="relative space-y-0">
                  {courrier.historiqueActions.map((action, i, arr) => (
                    <div key={action.id} className="relative flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                          i === 0
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted text-muted-foreground'
                        )}>
                          <Activity className="h-3.5 w-3.5" />
                        </div>
                        {i < arr.length - 1 && <div className="mt-1 h-full w-px bg-border" />}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-sm font-medium text-foreground">{action.action}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                          <span>{action.user.name}</span>
                          <span>•</span>
                          <span>{formatDate(action.createdAt)}</span>
                        </div>
                        {action.commentaire && (
                          <p className="mt-1 text-xs text-muted-foreground/80">{action.commentaire}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">Aucune action enregistrée</p>
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          {courrier.retrait && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-emerald-200 bg-card dark:border-emerald-900"
              data-testid="retrait-card"
            >
              <div className="border-b border-emerald-200 px-6 py-4 dark:border-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-sm font-semibold text-foreground">Retrait</h2>
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Retiré par</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{courrier.retrait.nomRetraitant}</p>
                </div>
                {courrier.retrait.telephone && (
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Téléphone</p>
                    <p className="mt-0.5 text-sm text-foreground">{courrier.retrait.telephone}</p>
                  </div>
                )}
                <div>
                  <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Date de retrait</p>
                  <p className="mt-0.5 text-sm text-foreground">{formatDate(courrier.retrait.dateRetrait)}</p>
                </div>
                {courrier.retrait.observation && (
                  <div>
                    <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Observation</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{courrier.retrait.observation}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showRetrait && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setShowRetrait(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl border bg-card shadow-2xl"
              data-testid="retrait-dialog"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-base font-semibold text-foreground">Retrait du courrier</h2>
                </div>
                <button
                  onClick={() => setShowRetrait(null)}
                  className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Nom du retraitant <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={retraitForm.nomRetraitant}
                    onChange={(e) => setRetraitForm((f) => ({ ...f, nomRetraitant: e.target.value }))}
                    placeholder="Nom de la personne ayant retiré"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                    data-testid="retrait-nom"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Numéro de téléphone</label>
                  <div className="relative mt-1.5">
                    <PhoneIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <input
                      type="tel"
                      value={retraitForm.telephone}
                      onChange={(e) => setRetraitForm((f) => ({ ...f, telephone: e.target.value }))}
                      placeholder="+221 77 XXX XX XX"
                      className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                      data-testid="retrait-tel"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Observation</label>
                  <textarea
                    value={retraitForm.observation}
                    onChange={(e) => setRetraitForm((f) => ({ ...f, observation: e.target.value }))}
                    placeholder="Observation facultative..."
                    rows={3}
                    className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                    data-testid="retrait-obs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <Button variant="ghost" size="sm" onClick={() => { setShowRetrait(null); setRetraitForm({ nomRetraitant: '', telephone: '', observation: '' }) }}>
                  Annuler
                </Button>
                <Button size="sm" onClick={doRetrait} disabled={retraitLoading || !retraitForm.nomRetraitant.trim()} data-testid="btn-confirmer-retrait">
                  {retraitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirmer le retrait
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CourrierEditDialog
        open={showEdit}
        courrier={courrier}
        onClose={() => setShowEdit(false)}
        onSaved={() => { setShowEdit(false); load() }}
      />
    </div>
  )
}
