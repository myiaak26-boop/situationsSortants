import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Reply,
  CheckCircle2,
  Mail,
  Truck,
  PhoneCall,
  Clock,
  FileText,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
  Sparkles,
  Loader2,
  Settings2,
  type LucideIcon,
} from 'lucide-react'

export const PERIODES: { v: string; label: string }[] = [
  { v: 'mois', label: 'Ce mois' },
  { v: 'semaine', label: 'Cette semaine' },
  { v: 'trimestre', label: 'Ce trimestre' },
  { v: 'aujourdhui', label: "Aujourd'hui" },
  { v: 'hier', label: 'Hier' },
  { v: 'annee', label: "Cette année" },
  { v: '', label: 'Toutes périodes' },
  { v: 'personnalisee', label: 'Personnalisée' },
]

export type WizardFormat = 'exec-pdf' | 'exec-xlsx' | 'csv'

interface PresetDef {
  v: string
  label: string
  description: string
  icon: LucideIcon
  flags?: Record<string, boolean>
  recommended?: boolean
}

const PRESETS: PresetDef[] = [
  { v: 'generale', label: 'Tous les courriers', description: "Vue d'ensemble complète", icon: LayoutDashboard, recommended: true },
  { v: 'reponses', label: 'Réponses', description: 'Envoyés en réponse à un courrier entrant', icon: Reply, flags: { reponseEntrant: true } },
  { v: 'retraits', label: 'Retirés', description: 'Courriers retirés de la situation', icon: CheckCircle2, flags: { retires: true } },
  { v: 'mail', label: 'Par email', description: 'Courriers transmis par email', icon: Mail, flags: { parMail: true } },
  { v: 'coursier', label: 'Par coursier', description: 'Courriers remis par coursier', icon: Truck, flags: { parCoursier: true } },
  { v: 'injoignables', label: 'Injoignables', description: 'Destinataires injoignables', icon: PhoneCall, flags: { injoignables: true } },
  { v: 'delais', label: 'Délais', description: 'Analyse des délais de réponse et de traitement', icon: Clock },
]

const GROUP_BY: { v: string; label: string; reportType: string }[] = [
  { v: '', label: 'Aucun regroupement', reportType: '' },
  { v: 'signataire', label: 'Par signataire', reportType: 'parSignataire' },
]

const FORMATS: { v: WizardFormat; label: string; description: string; icon: LucideIcon; recommended?: boolean }[] = [
  { v: 'exec-pdf', label: 'PDF', description: 'Rapport complet : couverture, synthèse, graphiques, tableau détaillé', icon: FileText, recommended: true },
  { v: 'exec-xlsx', label: 'Excel', description: 'Classeur 7 feuilles : résumé, détails, stats, délais, réponses, historique', icon: FileSpreadsheet },
  { v: 'csv', label: 'CSV', description: 'Données brutes exploitables dans tout tableur', icon: FileDown },
]

interface WizardDefaults {
  periode: string
  dateDebut: string
  dateFin: string
  signataire: string
  type: string
}

interface GenerateSituationDialogProps {
  open: boolean
  onClose: () => void
  onGenerated: () => void
  meta: { situations: { id: string; nom: string; couleur: string }[]; signataires: string[] } | null
  defaults: WizardDefaults
  onGenerate: (format: 'exec-pdf' | 'exec-xlsx' | 'pdf' | 'xlsx' | 'csv', params: URLSearchParams, openInTab: boolean) => Promise<void>
}

function presetFromDefaults(t: string): string {
  if (t === 'reponses') return 'reponses'
  if (t === 'retires') return 'retraits'
  if (t === 'injoignables') return 'injoignables'
  return 'generale'
}

export function GenerateSituationDialog({ open, onClose, onGenerated, meta, defaults, onGenerate }: GenerateSituationDialogProps) {
  const [presetV, setPresetV] = useState('generale')
  const [periode, setPeriode] = useState('mois')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [signataire, setSignataire] = useState('')
  const [groupBy, setGroupBy] = useState('')
  const [format, setFormat] = useState<WizardFormat>('exec-pdf')
  const [advanced, setAdvanced] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (open) {
      setPresetV(presetFromDefaults(defaults.type))
      setPeriode(defaults.periode || 'mois')
      setDateDebut(defaults.dateDebut)
      setDateFin(defaults.dateFin)
      setSignataire(defaults.signataire)
      setGroupBy('')
      setFormat('exec-pdf')
      setAdvanced(false)
      setGenerating(false)
    }
  }, [open, defaults])

  const preset = PRESETS.find((p) => p.v === presetV) ?? PRESETS[0]
  const group = GROUP_BY.find((g) => g.v === groupBy) ?? GROUP_BY[0]
  const formatDef = FORMATS.find((f) => f.v === format) ?? FORMATS[0]

  const reportType = group.reportType || preset.v
  const situationType = group.reportType ? group.label : preset.v === 'generale' ? 'Générale' : preset.label

  const periodeFull =
    periode === 'personnalisee' && dateDebut && dateFin
      ? `${PERIODES.find((p) => p.v === periode)?.label} (${dateDebut} → ${dateFin})`
      : PERIODES.find((p) => p.v === periode)?.label || 'Toutes périodes'

  const buildParams = () => {
    const p = new URLSearchParams()
    if (periode) p.set('periode', periode)
    if (dateDebut) p.set('dateDebut', dateDebut)
    if (dateFin) p.set('dateFin', dateFin)
    if (signataire) p.set('signataire', signataire)
    for (const [k, v] of Object.entries(preset.flags || {})) if (v) p.set(k, '1')
    p.set('reportType', reportType)
    p.set('situationType', situationType)
    return p
  }

  const generate = async () => {
    setGenerating(true)
    try {
      await onGenerate(format === 'csv' ? 'csv' : format, buildParams(), false)
      onGenerated()
      onClose()
    } finally {
      setGenerating(false)
    }
  }

  const chips = [
    ['Préréglage', preset.label],
    ['Période', periodeFull],
    ...(signataire ? [['Signataire', signataire] as [string, string]] : []),
    ['Format', formatDef.label],
  ]

  return (
    <Dialog open={open} onClose={onClose} title="Générer une situation" size="lg">
      <div className="p-5">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5">
          {/* Période */}
          <div>
            <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">Période</p>
            <div className="flex flex-wrap items-center gap-2">
              {PERIODES.map((p) => (
                <button
                  key={p.v || 'toutes'}
                  onClick={() => setPeriode(p.v)}
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
            </div>
            {periode === 'personnalisee' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
            )}
          </div>

          {/* Préréglages */}
          <div>
            <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">Contenu</p>
            <div className="grid max-h-[26vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {PRESETS.map((t) => (
                <button
                  key={t.v}
                  data-testid={`wizard-type-${t.v}`}
                  onClick={() => setPresetV(t.v)}
                  className={cn(
                    'group relative rounded-xl border p-3 text-left transition-all duration-150',
                    presetV === t.v ? 'border-primary bg-primary/5 ring-2 ring-ring/20' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        presetV === t.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                      )}
                    >
                      <t.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        {t.label}
                        {t.recommended && (
                          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-2xs font-medium text-amber-600">Populaire</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{t.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Critères */}
          <div>
            <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">Critères</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-2xs font-medium text-muted-foreground">Signataire</span>
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
            </div>

            {/* Options avancées */}
            <button
              onClick={() => setAdvanced(!advanced)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Options avancées
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', advanced && 'rotate-180')} />
            </button>
            {advanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-2xs font-medium text-muted-foreground">Regrouper par</span>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                    >
                      {GROUP_BY.map((g) => (
                        <option key={g.v} value={g.v}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-2xs font-medium text-muted-foreground">Format</span>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as WizardFormat)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                    >
                      {FORMATS.map((f) => (
                        <option key={f.v} value={f.v}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </motion.div>
            )}
          </div>

          {/* Format */}
          {!advanced && (
            <div>
              <p className="mb-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">Format</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FORMATS.filter((f) => f.v !== 'csv').map((f) => (
                  <button
                    key={f.v}
                    data-testid={`wizard-format-${f.v}`}
                    onClick={() => setFormat(f.v)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-150',
                      format === f.v ? 'border-primary bg-primary/5 ring-2 ring-ring/20' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        format === f.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <f.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        {f.label}
                        {f.recommended && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary">Recommandé</span>}
                      </p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{f.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Récapitulatif inline */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Récapitulatif
            </p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1 text-2xs font-medium text-muted-foreground ring-1 ring-border">
                  <span className="uppercase tracking-wider text-muted-foreground/60">{k}</span>
                  <span className="text-foreground">{v}</span>
                </span>
              ))}
            </div>
          </div>

          <p className="text-2xs leading-relaxed text-muted-foreground">
            La génération peut prendre quelques secondes. Le document sera téléchargé et ajouté à l'historique.
          </p>
        </motion.div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button size="sm" onClick={generate} disabled={generating} data-testid="wizard-generate" className="min-w-[180px]">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Génération en cours…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Générer la situation
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
