import { createRoute, useNavigate, Link } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { apiFetch } from '@/lib/api'
import { fetchSession, can, PERM, type Session } from '@/lib/session'
import type { ModeTransmission, Signataire } from '@/lib/types'
import {
  Mail,
  Truck,
  Phone,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, EmptyState } from '@/components/ui/feedback'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/courriers/nouveau',
  component: CourrierNouveauPage,
})

const MODE_ICONS: Record<string, LucideIcon> = { Phone, Mail, Truck, FileText }

function modeIcon(m: ModeTransmission): LucideIcon {
  const base = (m.icone || '').toLowerCase()
  if (base.includes('mail')) return Mail
  if (base.includes('truck')) return Truck
  if (base.includes('phone')) return Phone
  return FileText
}

const EMPTY_FORM = {
  numero: '',
  dateEnvoi: '',
  signataireId: '',
  destinataire: '',
  objet: '',
  numeroEntrant: '',
  dateArriveeEntrant: '',
  observation: '',
}

function CourrierNouveauPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [modes, setModes] = useState<ModeTransmission[]>([])
  const [signataires, setSignataires] = useState<Signataire[]>([])
  const [creationManuelle, setCreationManuelle] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSession().then((s) => setSession(s))
    fetch('/api/courriers/meta')
      .then((r) => r.json())
      .then((d: { modes: ModeTransmission[]; signataires: Signataire[] }) => {
        setModes(d.modes)
        setSignataires(d.signataires.filter((s) => s.actif))
      })
      .catch(() => setError('Impossible de charger les modes de transmission'))
    fetch('/api/parametres')
      .then((r) => r.json())
      .then((params: { cle: string; valeur: string }[]) => {
        const manuelle = params.find((p) => p.cle === 'courrier.creationManuelle')?.valeur
        setCreationManuelle(manuelle === undefined ? true : manuelle === 'true')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const selectedSignataire = signataires.find((s) => s.id === form.signataireId)

  const requiredOk =
    !!selectedModeId && !!form.numero.trim() && !!selectedSignataire && !!form.destinataire.trim() && !!form.objet.trim()

  const submit = async () => {
    if (!requiredOk || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiFetch('/api/courriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: form.numero.trim(),
          dateEnvoi: form.dateEnvoi ? new Date(form.dateEnvoi).toISOString() : undefined,
          signataireId: selectedSignataire!.id,
          destinataire: form.destinataire.trim(),
          objet: form.objet.trim(),
          numeroEntrant: form.numeroEntrant.trim() || null,
          dateArriveeEntrant: form.dateArriveeEntrant ? new Date(form.dateArriveeEntrant).toISOString() : null,
          observation: form.observation.trim() || null,
          modeTransmissionId: selectedModeId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Échec de la création')
        return
      }
      navigate({ to: `/courriers/${data.id}` })
    } catch {
      setError('Erreur réseau lors de la création')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState text="Chargement..." />

  if (!can(session, PERM.CREATE)) {
    return <EmptyState icon={<AlertCircle className="h-12 w-12 text-muted-foreground/20" />} title="Accès refusé" />
  }

  if (creationManuelle === false) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-xl font-semibold text-foreground">Nouveau courrier</h1>
        <p className="text-sm text-muted-foreground">
          La création manuelle de courriers est en cours d'activation.
        </p>
        <Link to="/courriers" className="text-sm font-medium text-primary hover:underline">
          Retour à la liste
        </Link>
      </div>
    )
  }

  const selectedMode = modes.find((m) => m.id === selectedModeId) || null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/courriers"
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Nouveau courrier</h1>
          <p className="text-sm text-muted-foreground">
            Renseignez le courrier et choisissez son mode de transmission
          </p>
        </div>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          data-testid="form-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="rounded-xl border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Mode de transmission <span className="text-destructive">*</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-3">
          {modes.map((m) => {
            const Icon = modeIcon(m)
            const active = m.id === selectedModeId
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedModeId(m.id)}
                data-testid={`mode-option-${m.nom}`}
                className={cn(
                  'relative rounded-xl border p-4 text-left transition-all',
                  active
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                {active && (
                  <span className="absolute right-3 top-3 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                )}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${m.couleur}18`, color: m.couleur }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{m.nom}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {m.description || 'Aucune précision'}
                </p>
              </button>
            )
          })}
        </div>
        {selectedMode && (
          <div className="border-t border-border px-6 py-3" data-testid="workflow-hint">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium" style={{ color: selectedMode.couleur }}>{selectedMode.nom}</span>
              {' — '}
              {selectedMode.description || 'Aucune précision'}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Informations du courrier</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Numéro <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.numero}
              onChange={set('numero')}
              placeholder="Ex : 2026-0042"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-numero"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date de signature</label>
            <input
              type="date"
              value={form.dateEnvoi}
              onChange={set('dateEnvoi')}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-date"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Signataire <span className="text-destructive">*</span>
            </label>
            <select
              value={form.signataireId}
              onChange={set('signataireId')}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-signataire"
            >
              <option value="">— Choisir un signataire —</option>
              {signataires.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Destinataire <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.destinataire}
              onChange={set('destinataire')}
              placeholder="Destinataire du courrier"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-destinataire"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Objet <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.objet}
              onChange={set('objet')}
              placeholder="Objet du courrier"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-objet"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Numéro entrant (réponse)</label>
            <input
              type="text"
              value={form.numeroEntrant}
              onChange={set('numeroEntrant')}
              placeholder="Ex : R-2026-0123"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-numero-entrant"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date d'arrivée (courrier entrant)</label>
            <input
              type="date"
              value={form.dateArriveeEntrant}
              onChange={set('dateArriveeEntrant')}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-date-arrivee-entrant"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observation</label>
            <input
              type="text"
              value={form.observation}
              onChange={set('observation')}
              placeholder="Observation facultative"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
              data-testid="field-observation"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/courriers' })}>
            Annuler
          </Button>
          <Button size="sm" onClick={submit} disabled={!requiredOk || submitting} data-testid="btn-creer">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Créer le courrier
          </Button>
        </div>
      </section>
    </div>
  )
}
