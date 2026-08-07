import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { apiFetch } from '@/lib/api'
import { fetchSession, can, type Session } from '@/lib/session'
import type { ModeTransmission, Situation, Transition, WorkflowAdminData } from '@/lib/types'
import {
  Mail,
  Truck,
  Phone,
  FileText,
  Pencil,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, EmptyState } from '@/components/ui/feedback'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workflows',
  component: WorkflowsPage,
})

type Tab = 'modes' | 'situations' | 'transitions'

const MODE_ICONS: Record<string, LucideIcon> = { Phone, Mail, Truck, FileText }

function modeIcon(m: ModeTransmission): LucideIcon {
  const base = (m.icone || '').toLowerCase()
  if (base.includes('mail')) return Mail
  if (base.includes('truck')) return Truck
  if (base.includes('phone')) return Phone
  return FileText
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'modes', label: 'Modes de transmission' },
  { key: 'situations', label: 'Situations' },
  { key: 'transitions', label: 'Transitions' },
]

function WorkflowsPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<WorkflowAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('modes')
  const [modeFilter, setModeFilter] = useState('')
  const [editing, setEditing] = useState<ModeTransmission | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ModeTransmission | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/workflow/admin')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: WorkflowAdminData) => {
        setData(d)
        setError(null)
      })
      .catch(() => setError('Impossible de charger la configuration des workflows'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSession().then((s) => setSession(s))
    load()
  }, [])

  const openEdit = (m: ModeTransmission) => {
    setEditing(m)
    setEditDesc(m.description || '')
  }

  const saveEdit = async () => {
    if (!editing || saving) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/workflow/modes/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDesc }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || 'Échec de la modification')
        return
      }
      setEditing(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await apiFetch(`/api/workflow/modes/${deleting.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setDeleteError(err.error || 'Impossible de supprimer ce mode')
        return
      }
      setDeleting(null)
      load()
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading) return <LoadingState text="Chargement de la configuration..." />

  if (!can(session, 'workflow:manage')) {
    return <EmptyState icon={<AlertCircle className="h-12 w-12 text-muted-foreground/20" />} title="Accès refusé" />
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-xl font-semibold text-foreground">Workflows</h1>
        <p className="text-sm text-destructive">{error || "La gestion des workflows est en cours d'activation."}</p>
      </div>
    )
  }

  const situationsById = new Map(data.situations.map((s) => [s.id, s]))
  const filteredTransitions = modeFilter
    ? data.transitions.filter((t) => t.modeTransmissionId === modeFilter)
    : data.transitions

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Configuration du moteur de workflow : modes de transmission, situations et transitions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'modes' && (
        <div className="space-y-3">
          {data.modes.map((m) => {
            const Icon = modeIcon(m)
            return (
              <div
                key={m.id}
                data-testid={`mode-${m.nom}`}
                className="flex items-start justify-between gap-4 rounded-xl border bg-card p-5"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${m.couleur}18`, color: m.couleur }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{m.nom}</p>
                      {!m.actif && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                          Inactif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{m.description || 'Aucune précision'}</p>
                    <p className="mt-2 text-2xs text-muted-foreground/70">
                      {m._count?.courriers ?? 0} courrier(s) · {m._count?.transitions ?? 0} transition(s)
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)} data-testid={`edit-mode-${m.nom}`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setDeleting(m); setDeleteError(null) }} data-testid={`delete-mode-${m.nom}`}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    Supprimer
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'situations' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.situations.map((s) => (
            <div
              key={s.id}
              data-testid={`situation-${s.nom}`}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: s.couleur }} />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.nom}</p>
                  <p className="text-2xs text-muted-foreground">Ordre {s.ordre}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {s.estInitial && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
                    Initiale
                  </span>
                )}
                {s.estFinal && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                    Finale
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'transitions' && (
        <div className="space-y-4">
          <div className="max-w-xs">
            <label className="text-xs font-medium text-muted-foreground">Mode de transmission</label>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              data-testid="select-mode-transitions"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Tous les modes</option>
              {data.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {filteredTransitions.map((t) => {
              const from = situationsById.get(t.fromSituationId)
              const to = situationsById.get(t.toSituationId)
              return (
                <div
                  key={t.id}
                  data-testid={`transition-${t.nom}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">{t.nom}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{from?.nom || '?'}</span>
                    <span>→</span>
                    <span style={{ color: to?.couleur }}>{to?.nom || '?'}</span>
                    {t.demandeRetrait && (
                      <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                        Retrait
                      </span>
                    )}
                    {t.estRappel && (
                      <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-2xs font-medium text-amber-600 dark:text-amber-400">
                        Rappel
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredTransitions.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Aucune transition pour ce mode</p>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="edit-mode-dialog"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Modifier le mode</h2>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nom</label>
                <p className="mt-1 text-sm font-semibold text-foreground">{editing.nom}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Précision affichée aux agents"
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={saving} data-testid="btn-save-entity">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setDeleting(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="delete-mode-dialog"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <h2 className="text-base font-semibold text-foreground">
                  Supprimer « {deleting.nom} » ?
                </h2>
              </div>
              <button
                onClick={() => setDeleting(null)}
                className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground">
                Cette action est irréversible. Les transitions associées au mode seront également supprimées.
              </p>
              {deleteError && (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="delete-error">
                  {deleteError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={confirmDelete} disabled={deleteBusy} data-testid="btn-confirm-delete">
                {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkflowsPage
