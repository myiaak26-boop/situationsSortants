import { motion } from 'framer-motion'
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CopyX,
  Database,
  Loader2,
  FileWarning,
  ListChecks,
  RefreshCcw,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { StepShell, StepNav } from './stepper'
import { ValidationReport } from '@/lib/import'

interface StepValidateProps {
  busy: boolean
  report: ValidationReport | null
  duplicatePolicy: 'ignore' | 'update'
  onPolicyChange: (p: 'ignore' | 'update') => void
  onImport: () => void
  onBack: () => void
}

export function StepValidate({ busy, report, duplicatePolicy, onPolicyChange, onImport, onBack }: StepValidateProps) {
  const canImport = !!report && report.valid && !report.erreurCritique

  return (
    <StepShell
      title="Validation"
      description="Vérification complète avant import : colonnes, lignes, numéros, dates et doublons"
      icon={<ShieldCheck className="h-5 w-5" />}
    >
      {busy || !report ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground/60">Validation des données…</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className={cn(
            'flex items-center gap-3 rounded-xl border p-5',
            report.valid
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
              : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
          )}>
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              report.valid ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
            )}>
              {report.valid ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
            </div>
            <div>
              <p className={cn('text-sm font-semibold', report.valid ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {report.valid ? 'Fichier valide' : 'Fichier invalide'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {report.valid
                  ? `${report.prets.toLocaleString('fr-FR')} ligne${report.prets > 1 ? 's' : ''} prête${report.prets > 1 ? 's' : ''} à l'importation`
                  : 'Corrigez les éléments ci-dessous avant de poursuivre'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatBox label="Lignes" value={report.total} tone="default" icon={<ListChecks className="h-4 w-4" />} />
            <StatBox label="Prêtes" value={report.prets} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
            <StatBox label="Vides" value={report.vides} tone={report.vides > 0 ? 'warn' : 'default'} icon={<FileWarning className="h-4 w-4" />} />
            <StatBox label="Doublons fichier" value={report.doublonsFichier.length} tone={report.doublonsFichier.length > 0 ? 'warn' : 'default'} icon={<CopyX className="h-4 w-4" />} />
            <StatBox label="Déjà en base" value={report.doublonsBase.length} tone={report.doublonsBase.length > 0 ? 'warn' : 'default'} icon={<Database className="h-4 w-4" />} />
            <StatBox label="Erreurs" value={report.erreurs.length} tone={report.erreurs.length > 0 ? 'err' : 'default'} icon={<AlertTriangle className="h-4 w-4" />} />
          </div>

          {report.colonnesManquantes.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Colonnes obligatoires manquantes</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {report.colonnesManquantes.join(', ')} — retournez à l'étape « Colonnes » pour les mapper.
                </p>
              </div>
            </div>
          )}

          {report.erreurs.length > 0 && (
            <IssueBlock
              title={`${report.erreurs.length} ligne${report.erreurs.length > 1 ? 's' : ''} en erreur`}
              icon={<AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              items={report.erreurs.slice(0, 30).map((e) => `Ligne ${e.ligne} : ${e.message}`)}
              more={report.erreurs.length > 30 ? report.erreurs.length - 30 : 0}
            />
          )}

          {report.doublonsFichier.length > 0 && (
            <IssueBlock
              title={`${report.doublonsFichier.length} numéro${report.doublonsFichier.length > 1 ? 's' : ''} en doublon dans le fichier`}
              icon={<CopyX className="h-3.5 w-3.5 text-amber-500" />}
              items={report.doublonsFichier.slice(0, 15).map((d) => `${d.numero} — lignes ${d.lignes.join(', ')}`)}
              more={report.doublonsFichier.length > 15 ? report.doublonsFichier.length - 15 : 0}
            />
          )}

          {report.doublonsBase.length > 0 && (
            <div className="rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Database className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-sm font-medium text-foreground">
                  {report.doublonsBase.length} numéro{report.doublonsBase.length > 1 ? 's' : ''} déjà importé{report.doublonsBase.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <p className="flex-1 text-xs text-muted-foreground">
                  Un numéro déjà présent en base ne sera <strong>jamais</strong> créé en double. Choisissez comment traiter
                  ces {report.doublonsBase.length} courrier{report.doublonsBase.length > 1 ? 's' : ''}.
                </p>
                <div className="flex shrink-0 gap-2">
                  <PolicyButton
                    active={duplicatePolicy === 'ignore'}
                    onClick={() => onPolicyChange('ignore')}
                    title="Ignorer"
                    desc="Conserver la base telle quelle"
                    icon={<XCircle className="h-4 w-4" />}
                  />
                  <PolicyButton
                    active={duplicatePolicy === 'update'}
                    onClick={() => onPolicyChange('update')}
                    title="Mettre à jour"
                    desc="Écraser les données du courrier existant"
                    icon={<RefreshCcwIcon />}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground/80">
              {report.erreurCritique
                ? 'Import bloqué : colonnes obligatoires manquantes.'
                : `${report.prets.toLocaleString('fr-FR')} courrier${report.prets > 1 ? 's' : ''} seront traités.`}
            </p>
            <div className="flex items-center gap-3">
              <StepNav onBack={onBack} onNext={onImport} nextLabel={`Importer ${report.prets > 0 ? report.prets.toLocaleString('fr-FR') : ''} courrier${report.prets > 1 ? 's' : ''}`} nextDisabled={!canImport || report.prets === 0} />
            </div>
          </div>
        </motion.div>
      )}
    </StepShell>
  )
}

function RefreshCcwIcon() {
  return <RefreshCcw className="h-4 w-4" />
}

function StatBox({ label, value, tone, icon }: { label: string; value: number; tone: 'default' | 'ok' | 'warn' | 'err'; icon: React.ReactNode }) {
  const tones = {
    default: 'text-muted-foreground',
    ok: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    err: 'text-red-600 dark:text-red-400',
  }
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}</div>
      <p className={cn('mt-2 font-mono text-xl font-bold', tones[tone])}>{value.toLocaleString('fr-FR')}</p>
      <p className="mt-0.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground/70">{label}</p>
    </div>
  )
}

function IssueBlock({ title, icon, items, more }: { title: string; icon: React.ReactNode; items: string[]; more: number }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {icon}
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <div className="max-h-36 space-y-1 overflow-y-auto p-3">
        {items.map((it, i) => (
          <p key={i} className="truncate text-xs text-muted-foreground">{it}</p>
        ))}
        {more > 0 && <p className="text-xs text-muted-foreground/60">… et {more} autres</p>}
      </div>
    </div>
  )
}

function PolicyButton({ active, onClick, title, desc, icon }: { active: boolean; onClick: () => void; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-all',
        active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-sm font-medium', active ? 'text-primary' : 'text-foreground')}>
        {icon}
        {title}
      </span>
      <span className="text-2xs text-muted-foreground">{desc}</span>
    </button>
  )
}
