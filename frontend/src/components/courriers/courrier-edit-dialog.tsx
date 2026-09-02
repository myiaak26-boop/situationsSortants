import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Courrier, Signataire } from '@/lib/types'

interface EditForm {
  dateEnvoi: string
  signataireId: string
  destinataire: string
  objet: string
  numeroEntrant: string
  dateArriveeEntrant: string
}

interface CourrierEditDialogProps {
  open: boolean
  courrier: Courrier | null
  onClose: () => void
  onSaved: (c: Courrier) => void
}

function toDateInput(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function CourrierEditDialog({ open, courrier, onClose, onSaved }: CourrierEditDialogProps) {
  const [form, setForm] = useState<EditForm | null>(null)
  const [signataires, setSignataires] = useState<Signataire[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !courrier) return
    setForm({
      dateEnvoi: toDateInput(courrier.dateEnvoi),
      signataireId: courrier.signataireId || '',
      destinataire: courrier.destinataire,
      objet: courrier.objet,
      numeroEntrant: courrier.numeroEntrant || '',
      dateArriveeEntrant: toDateInput(courrier.dateArriveeEntrant || ''),
    })
    setError(null)
    setSaving(false)
    fetch('/api/courriers/meta')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { signataires: Signataire[] } | null) => {
        if (d) {
          setSignataires(d.signataires.filter((s) => s.actif))
        }
      })
      .catch(() => {})
  }, [open, courrier])

  const set = <K extends keyof EditForm>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f))
  }

  const save = async () => {
    if (!form || !courrier || saving) return
    const signataire = signataires.find((s) => s.id === form.signataireId)
    if (!signataire) {
      setError('Le signataire est requis')
      return
    }
    if (!form.destinataire.trim() || !form.objet.trim()) {
      setError('Champs requis : destinataire, objet')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/courriers/${courrier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateEnvoi: form.dateEnvoi ? new Date(form.dateEnvoi).toISOString() : undefined,
          signataireId: signataire.id,
          destinataire: form.destinataire.trim(),
          objet: form.objet.trim(),
          numeroEntrant: form.numeroEntrant.trim() || null,
          dateArriveeEntrant: form.dateArriveeEntrant ? new Date(form.dateArriveeEntrant).toISOString() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Échec de la modification')
        return
      }
      onSaved(data as Courrier)
      onClose()
    } catch {
      setError('Erreur réseau lors de la modification')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Modifier le courrier" size="md">
      {form && (
        <div className="space-y-4 p-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date de signature</label>
              <input
                type="date"
                value={form.dateEnvoi}
                onChange={set('dateEnvoi')}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                data-testid="edit-date-envoi"
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
                data-testid="edit-signataire"
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
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                data-testid="edit-destinataire"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Réponse au courrier (N°)</label>
              <input
                type="text"
                value={form.numeroEntrant}
                onChange={set('numeroEntrant')}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                data-testid="edit-numero-entrant"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date d'arrivée (courrier entrant)</label>
              <input
                type="date"
                value={form.dateArriveeEntrant}
                onChange={set('dateArriveeEntrant')}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                data-testid="edit-date-arrivee-entrant"
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
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                data-testid="edit-objet"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button size="sm" onClick={save} disabled={saving} data-testid="btn-enregistrer-courrier">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}