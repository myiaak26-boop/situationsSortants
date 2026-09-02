import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import {
  Settings,
  Save,
  Loader2,
  Check,
  Clock,
  AlertTriangle,
  Bell,
  Timer,
  Building2,
  PenSquare,
  Users,
  ShieldCheck,
  ScrollText,
  Plus,
  Trash2,
  Database,
  RefreshCcw,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/feedback'
import { Dialog, ConfirmationDialog } from '@/components/ui/dialog'
import UtilisateursPage from '@/routes/utilisateurs'
import RolesPage from '@/routes/roles'
import PermissionsPage from '@/routes/permissions'
import JournalPage from '@/routes/journal'
import { useSession } from '@/lib/session-context'
import { can } from '@/lib/session'
import { Guard } from '@/components/ui/guard'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/parametres',
  component: ParametresPage,
})

interface Parametre {
  id: string
  cle: string
  valeur: string
}

interface Signataire {
  id: string
  code: string
  nom: string
  actif: boolean
  ordre: number
}

const TABS: { id: string; label: string; icon: LucideIcon; permission?: string }[] = [
  { id: 'seuils', label: 'Seuils des délais', icon: Timer },
  { id: 'institution', label: 'Institution', icon: Building2 },
  { id: 'signataires', label: 'Signataires', icon: PenSquare },
  { id: 'utilisateurs', label: 'Utilisateurs', icon: Users, permission: 'utilisateur:read' },
  { id: 'roles', label: 'Rôles & Permissions', icon: ShieldCheck, permission: 'role:read' },
  { id: 'journal', label: 'Journal', icon: ScrollText, permission: 'audit:read' },
  { id: 'bdd', label: 'Base de données', icon: Database },
]

const PARAM_LABELS: Record<string, { label: string; desc: string; icon: typeof Clock }> = {
  'alerte.normal.jours': { label: 'Seuil Normal', desc: 'Nombre de jours avant passage en statut "Attention"', icon: Clock },
  'alerte.attention.jours': { label: 'Seuil Attention', desc: 'Nombre de jours avant passage en statut "Urgent"', icon: AlertTriangle },
  'alerte.urgent.jours': { label: 'Seuil Urgent', desc: 'Nombre de jours avant alerte critique', icon: Bell },
  'delai.vert.jours': { label: 'Délai vert', desc: 'Jusqu\'à ce seuil (inclus), le délai est affiché en vert (0 à X jours)', icon: Timer },
  'delai.orange.jours': { label: 'Délai orange', desc: 'Jusqu\'à ce seuil (inclus), le délai est affiché en orange (X+1 à Y jours)', icon: Timer },
}

const INSTITUTION_LABELS: Record<string, { label: string; desc: string }> = {
  'situation.institutionNom': { label: "Nom de l'institution", desc: 'Affiché en tête des rapports de situation' },
  'situation.titre': { label: 'Titre du rapport', desc: "Titre générique des rapports de situation" },
  'situation.logo': { label: 'Chemin du logo', desc: "Chemin d'accès au fichier image (utilisé dans les PDF)" },
  'situation.republique': { label: 'République', desc: "Nom de l'État (ex. République de Guinée) sur la page de couverture" },
  'situation.devise': { label: 'Devise nationale', desc: 'Devise affichée sous le nom de l’institution sur la page de couverture' },
}

function SeuilsTab() {
  const [params, setParams] = useState<Parametre[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/parametres')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setParams(data as Parametre[])
          const v: Record<string, string> = {}
          for (const p of data) v[p.id] = p.valeur
          setValues(v)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const p of params) {
        if (values[p.id] !== p.valeur) {
          await fetch(`/api/parametres/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valeur: values[p.id] }),
          })
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  const hasChanges = params.some((p) => values[p.id] !== p.valeur)
  const alerteParams = params.filter((p) => p.cle.startsWith('alerte.'))
  const delaiParams = params.filter((p) => p.cle.startsWith('delai.'))
  const toggleParams = params.filter((p) => p.cle.startsWith('courrier.'))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Seuils d'alerte et de délai</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configurez les délais qui déterminent les statuts Normal, Attention et Urgent.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges} variant={saved ? 'secondary' : 'primary'} size="sm">
          {saved ? <><Check className="h-4 w-4" /> Enregistré</> : <><Save className="h-4 w-4" /> Enregistrer</>}
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Seuils d'alerte</h3>
        </div>
        <div className="space-y-5">
          {alerteParams.map((p) => {
            const info = PARAM_LABELS[p.cle]
            const IconComponent = info?.icon || Settings
            return (
              <div key={p.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-3 sm:w-64">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{info?.label || p.cle}</p>
                    {info?.desc && <p className="text-2xs text-muted-foreground">{info.desc}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={values[p.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-24 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Seuils de délai de traitement</h3>
        </div>
        <div className="space-y-5">
          {delaiParams.map((p) => {
            const info = PARAM_LABELS[p.cle]
            const IconComponent = info?.icon || Settings
            return (
              <div key={p.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-3 sm:w-64">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{info?.label || p.cle}</p>
                    {info?.desc && <p className="text-2xs text-muted-foreground">{info.desc}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={values[p.id] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-24 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {toggleParams.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Fonctionnalités</h3>
          </div>
          <div className="space-y-5">
            {toggleParams.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {p.cle === 'courrier.creationManuelle' ? 'Création manuelle des courriers' : p.cle}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    {p.cle === 'courrier.creationManuelle'
                      ? 'Autorise la page « Nouveau courrier » pour les administrateurs (en complément de l\'import Excel)'
                      : ''}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={values[p.id] === 'true'}
                  data-testid={`toggle-${p.cle}`}
                  onClick={() => setValues((prev) => ({ ...prev, [p.id]: prev[p.id] === 'true' ? 'false' : 'true' }))}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    values[p.id] === 'true' ? 'bg-primary' : 'bg-muted-foreground/25',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                      values[p.id] === 'true' ? 'left-[calc(100%-1.375rem)]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function InstitutionTab() {
  const [params, setParams] = useState<Parametre[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/parametres')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setParams(data as Parametre[])
          const v: Record<string, string> = {}
          for (const p of data) v[p.id] = p.valeur
          setValues(v)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const p of params) {
        if (values[p.id] !== p.valeur) {
          await fetch(`/api/parametres/${p.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valeur: values[p.id] }),
          })
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  const instParams = params.filter((p) => p.cle.startsWith('situation.'))
  const hasChanges = instParams.some((p) => values[p.id] !== p.valeur)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Informations de l'institution</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Ces informations figurent sur les rapports de situation (PDF).</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !hasChanges} variant={saved ? 'secondary' : 'primary'} size="sm">
          {saved ? <><Check className="h-4 w-4" /> Enregistré</> : <><Save className="h-4 w-4" /> Enregistrer</>}
        </Button>
      </div>
      <Card>
        <div className="space-y-5">
          {instParams.length === 0 && <p className="text-sm text-muted-foreground">Aucun paramètre institutionnel configuré.</p>}
          {instParams.map((p) => {
            const info = INSTITUTION_LABELS[p.cle]
            return (
              <div key={p.id}>
                <p className="text-sm font-medium text-foreground">{info?.label || p.cle}</p>
                {info?.desc && <p className="mt-0.5 text-2xs text-muted-foreground">{info.desc}</p>}
                <input
                  type="text"
                  value={values[p.id] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="mt-2 w-full max-w-md rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function SignatairesTab() {
  const [signataires, setSignataires] = useState<Signataire[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Signataire | null>(null)
  const [deleting, setDeleting] = useState<Signataire | null>(null)
  const [form, setForm] = useState({ code: '', nom: '', ordre: '0' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    fetch('/api/signataires')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setSignataires(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ code: '', nom: '', ordre: String(signataires.length) })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (s: Signataire) => {
    setEditing(s)
    setForm({ code: s.code, nom: s.nom, ordre: String(s.ordre) })
    setError('')
    setDialogOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const body = { code: form.code, nom: form.nom, ordre: parseInt(form.ordre, 10) || 0 }
      const res = editing
        ? await fetch(`/api/signataires/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/signataires', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError((data && (data as { error?: string }).error) || "Erreur d'enregistrement")
        return
      }
      setDialogOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    await fetch(`/api/signataires/${deleting.id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const toggleActif = async (s: Signataire) => {
    await fetch(`/api/signataires/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !s.actif }),
    })
    load()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Signataires</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PM, MDC, DCA, CCAB — les codes sont utilisés pour l'import et les rapports.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      <Card className="!p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Code</th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Nom</th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Ordre</th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Actif</th>
              <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {signataires.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Aucun signataire configuré
                </td>
              </tr>
            ) : (
              signataires.map((s) => (
                <tr key={s.id} className={cn('transition-colors hover:bg-muted/20', !s.actif && 'opacity-50')}>
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">{s.code}</td>
                  <td className="px-4 py-3 text-sm">{s.nom}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{s.ordre}</td>
                  <td className="px-4 py-3">
                    <button
                      role="switch"
                      aria-checked={s.actif}
                      onClick={() => toggleActif(s)}
                      className={cn(
                        'relative h-5 w-9 rounded-full transition-colors',
                        s.actif ? 'bg-primary' : 'bg-muted-foreground/25',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                          s.actif ? 'left-[calc(100%-1.125rem)]' : 'left-0.5',
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(s)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Modifier ${editing.code}` : 'Nouveau signataire'} size="sm">
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-muted-foreground">Code</span>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="PM, MDC, DCA, CCAB…"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-muted-foreground">Nom complet</span>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-2xs font-medium uppercase tracking-wider text-muted-foreground">Ordre d'affichage</span>
            <input
              type="number"
              min="0"
              value={form.ordre}
              onChange={(e) => setForm((f) => ({ ...f, ordre: e.target.value }))}
              className="h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </label>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={submit} disabled={saving || !form.code.trim() || !form.nom.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmationDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={`Supprimer ${deleting?.code ?? ''}`}
        description={
          deleting && signataires.find((s) => s.id === deleting.id)
            ? 'Si des courriers sont associés à ce signataire, il sera désactivé au lieu d\'être supprimé.'
            : ''
        }
        confirmLabel="Supprimer"
      />
    </div>
  )
}

function BaseDeDonneesTab() {
  const [session, setSession] = useState<{ isSuperAdmin: boolean } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSession(data))
      .catch(() => setSession(null))
  }, [])

  const handleReset = async () => {
    setResetting(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
      const data = await res.json().catch(() => null)
      setResult({
        ok: res.ok,
        message: res.ok ? 'Base de données réinitialisée.' : (data?.error ?? 'Erreur lors de la réinitialisation'),
      })
    } catch {
      setResult({ ok: false, message: 'Erreur lors de la réinitialisation' })
    } finally {
      setResetting(false)
    }
  }

  if (session === null) return <LoadingState />

  if (!session.isSuperAdmin) {
    return (
      <Card>
        <div className="flex items-start gap-3 p-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-foreground">Accès restreint</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              La réinitialisation de la base de données est réservée aux super administrateurs.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Base de données</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Réinitialisez complètement l'application à son état initial (utilisateurs, rôles, workflow, paramètres, signataires).
        </p>
      </div>

      <Card className="border-destructive/30">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <Database className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">Zone dangereuse</p>
              <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
                Supprime tous les courriers, historiques, retraits, logs et imports, puis restaure les données par défaut.
                Cette action est irréversible.
              </p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)} disabled={resetting}>
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Réinitialiser la base de données
          </Button>
        </div>
      </Card>

      {result && (
        <Card>
          <div className={cn('flex items-center gap-2 p-4', result.ok ? 'text-emerald-600' : 'text-destructive')}>
            {result.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <p className="text-xs font-medium">{result.message}</p>
          </div>
        </Card>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleReset}
        title="Réinitialiser la base de données"
        description="Toutes les données (courriers, historiques, retraits, logs, imports) seront définitivement supprimées. L'application sera restaurée à son état d'origine. Continuer ?"
        confirmLabel={resetting ? 'Réinitialisation…' : 'Réinitialiser'}
      />
    </div>
  )
}

function ParametresPage() {
  const session = useSession()
  const [tab, setTab] = useState('seuils')
  const visibleTabs = TABS.filter((t) => !t.permission || can(session, t.permission))
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : (visibleTabs[0]?.id ?? 'seuils')

  return (
    <Guard session={session} permission="parametre:read">
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-aurora relative overflow-hidden rounded-2xl border border-border/50 px-6 py-8">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl motion-reduce:hidden" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[hsl(271_75%_55%)]/10 blur-3xl motion-reduce:hidden" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-gradient text-2xl font-bold tracking-tight">Paramètres</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Configuration de l'application — délais, institution, signataires, accès et maintenance.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/80 p-1 shadow-card backdrop-blur-sm">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200',
              activeTab === t.id
                ? 'bg-gradient-to-r from-primary to-[hsl(235_70%_50%)] text-white shadow-[0_4px_12px_-4px_hsl(215_80%_50%/0.6)]'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {activeTab === 'seuils' && <SeuilsTab />}
        {activeTab === 'institution' && <InstitutionTab />}
        {activeTab === 'signataires' && <SignatairesTab />}
        {activeTab === 'utilisateurs' && <UtilisateursPage />}
        {activeTab === 'roles' && (
          <div className="space-y-5">
            <RolesPage />
            <PermissionsPage />
          </div>
        )}
        {activeTab === 'journal' && <JournalPage />}
        {activeTab === 'bdd' && <BaseDeDonneesTab />}
      </motion.div>
    </div>
    </Guard>
  )
}

export default ParametresPage
