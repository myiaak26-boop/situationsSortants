import { createRoute, Link } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { formatDateFull, formatDureeTraitement } from '@/lib/utils'
import type { Courrier } from '@/lib/types'
import { fetchSession, can, PERM, type Session } from '@/lib/session'
import { Printer, ArrowLeft, Calendar, Building2, User, Hash, FileText, CheckCircle2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, EmptyState } from '@/components/ui/feedback'
import { StatusBadge } from '@/components/ui/status-badge'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/courriers/$id/fiche',
  component: CourrierFichePage,
})

function FicheField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 border-b border-border/70 pb-3">
      <dt className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/60">{label}</dt>
      <dd className={cn('mt-1 text-sm text-foreground', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function CourrierFichePage() {
  const { id } = Route.useParams()
  const [courrier, setCourrier] = useState<Courrier | null>(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    fetchSession().then((s) => setSession(s))
    fetch(`/api/courriers/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setCourrier(c))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (session === undefined) return <LoadingState text="Vérification des droits..." />

  if (!can(session, PERM.PRINT)) {
    return (
      <EmptyState
        icon={<Ban className="h-12 w-12 text-muted-foreground/20" />}
        title="Accès refusé"
        description="Vous n'avez pas la permission d'imprimer la fiche d'un courrier."
      />
    )
  }

  if (loading) return <LoadingState text="Chargement du courrier..." />

  if (!courrier) {
    return <EmptyState icon={<FileText className="h-12 w-12 text-muted-foreground/20" />} title="Courrier introuvable" />
  }

  return (
    <div className="mx-auto max-w-[210mm] space-y-4 p-2 sm:p-4 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/courriers/$id" params={{ id: courrier.id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Retour au courrier
        </Link>
        <Button size="sm" data-testid="btn-imprimer-fiche" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimer
        </Button>
      </div>

      <div
        data-testid="fiche-courrier"
        className="rounded-xl border bg-card p-8 shadow-card print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none"
      >
        <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-border pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Fiche de suivi de courrier sortant</p>
            <p className="mt-2 font-mono text-2xl font-bold text-foreground" data-testid="fiche-numero">{courrier.numero}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground" data-testid="fiche-objet">{courrier.objet}</p>
          </div>
          <div className="text-right text-2xs text-muted-foreground">
            <p>Édité le {formatDateFull(new Date().toISOString())}</p>

          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 print:grid-cols-2">
          <FicheField label="Date de signature" value={formatDateFull(courrier.dateEnvoi)} mono />
          <FicheField label="Signataire" value={courrier.signataire} />
          <FicheField label="Destinataire" value={courrier.destinataire} />
          <FicheField label="Réponse au courrier (N°)" value={courrier.numeroEntrant || '—'} mono />
          <FicheField label="Date d'arrivée (courrier entrant)" value={courrier.dateArriveeEntrant ? formatDateFull(courrier.dateArriveeEntrant) : '—'} mono />
          <FicheField label="Durée de traitement" value={formatDureeTraitement(courrier.dureeTraitement)} />
          <FicheField label="Créé par" value={courrier.createdBy.name} />
          <FicheField label="Date de création" value={formatDateFull(courrier.createdAt)} mono />
          <FicheField
            label="Retrait"
            value={
              courrier.retrait ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Retiré le {formatDateFull(courrier.retrait.dateRetrait)} par {courrier.retrait.nomRetraitant}
                </span>
              ) : (
                '—'
              )
            }
          />
        </dl>

        {courrier.observation && (
          <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 print:bg-transparent">
            <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/60">Observation</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground" data-testid="fiche-observation">{courrier.observation}</p>
          </div>
        )}

        {courrier.historiqueActions && courrier.historiqueActions.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Historique des actions
            </h2>
            <ul className="mt-3 divide-y divide-border/70 border-y border-border/70">
              {courrier.historiqueActions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    <span className="text-sm text-foreground">{a.action}</span>
                    <span className="text-xs text-muted-foreground">par {a.user.name}</span>
                  </div>
                  <time className="text-xs tabular-nums text-muted-foreground">{formatDateFull(a.createdAt)}</time>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex items-end justify-between gap-6 print:mt-16">
          <div className="text-2xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3" />
              Document édité depuis l'application de suivi des courriers sortants
            </p>
          </div>
          <div className="text-right text-2xs text-muted-foreground">
            <p className="flex items-center justify-end gap-1.5">
              <User className="h-3 w-3" />
              Imprimé par {courrier.createdBy.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
