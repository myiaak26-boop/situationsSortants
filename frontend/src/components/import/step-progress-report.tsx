import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Eye,
  RotateCcw,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { StepShell } from './stepper'
import { FinalReport, ProgressSnapshot, formatDuration } from '@/lib/import'

interface StepImportProps {
  jobId: string | null
  progress: ProgressSnapshot | null
  report: FinalReport | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onViewCourriers: () => void
  onNewImport: () => void
}

export function StepImport({ jobId, progress, report, busy, error, onCancel, onViewCourriers, onNewImport }: StepImportProps) {
  const running = !!jobId && !!progress && progress.status === 'running'
  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0

  return (
    <StepShell
      title="Importation"
      description={running ? 'Traitement par lots en cours — l’interface reste disponible' : 'Rapport final de l’importation'}
      icon={<Download className="h-5 w-5" />}
    >
      <AnimatePresence mode="wait">
        {running ? (
          <motion.div key="progress" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Import en cours…</p>
                <p className="font-mono text-sm font-semibold text-primary">{percent}%</p>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {progress?.processed.toLocaleString('fr-FR')} / {progress?.total.toLocaleString('fr-FR')} lignes traitées
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <LiveStat label="Importés" value={progress?.importes ?? 0} tone="ok" />
              <LiveStat label="Ignorés" value={progress?.ignores ?? 0} tone="warn" />
              <LiveStat label="Mis à jour" value={progress?.maj ?? 0} tone="info" />
              <LiveStat label="Erreurs" value={progress?.erreurs ?? 0} tone="err" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-dashed p-4">
              <p className="text-xs text-muted-foreground">
                {progress?.cancelRequested ? 'Annulation en cours… le lot en cours sera terminé.' : 'Vous pouvez annuler l’import à tout moment.'}
              </p>
              <button
                onClick={onCancel}
                disabled={progress?.cancelRequested}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
              >
                <Ban className="h-4 w-4" />
                {progress?.cancelRequested ? 'Annulation…' : 'Annuler l’import'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {busy && !report && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground/60">Récupération du rapport…</p>
              </div>
            )}

            {error && !report && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Import en échec</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
            )}

            {report && (
              <>
                <div className={cn(
                  'flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:gap-4',
                  report.status === 'done'
                    ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                    : report.status === 'cancelled'
                      ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
                      : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
                )}>
                  <div className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                    report.status === 'done'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400'
                      : report.status === 'cancelled'
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
                  )}>
                    {report.status === 'done' ? <CheckCircle2 className="h-6 w-6" /> : report.status === 'cancelled' ? <Ban className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground">
                      {report.status === 'done' && 'Importation terminée'}
                      {report.status === 'cancelled' && 'Importation annulée'}
                      {report.status === 'error' && 'Importation en échec'}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {report.fileName} — feuille « {report.sheetName} »
                    </p>
                    {report.error && <p className="mt-1 text-xs text-red-500">{report.error}</p>}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(report.dureeMs)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <FinalStat label="Analysées" value={report.total} tone="default" />
                  <FinalStat label="Importés" value={report.importes} tone="ok" />
                  <FinalStat label="Ignorés" value={report.ignores} tone="warn" />
                  <FinalStat label="Mis à jour" value={report.maj} tone="info" />
                  <FinalStat label="Erreurs" value={report.erreurs} tone="err" />
                  <FinalStat label="Durée" value={formatDuration(report.dureeMs)} tone="default" small />
                </div>

                {report.details.length > 0 && (
                  <div className="rounded-xl border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-sm font-medium text-foreground">Détails du traitement</p>
                    </div>
                    <div className="max-h-40 space-y-1 overflow-y-auto p-3">
                      {report.details.map((d, i) => (
                        <p key={i} className="truncate font-mono text-xs text-muted-foreground">{d}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={onViewCourriers}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                  >
                    <Eye className="h-4 w-4" />
                    Voir les courriers importés
                  </button>
                  <button
                    onClick={() => downloadReport(report)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger le rapport d’import
                  </button>
                  <button
                    onClick={onNewImport}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Nouvel import
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </StepShell>
  )
}

function LiveStat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'info' | 'err' }) {
  const tones = {
    ok: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    err: 'text-red-600 dark:text-red-400',
  }
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <p className={cn('font-mono text-xl font-bold', tones[tone])}>{value.toLocaleString('fr-FR')}</p>
      <p className="mt-0.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground/70">{label}</p>
    </div>
  )
}

function FinalStat({ label, value, tone, small }: { label: string; value: string | number; tone: 'default' | 'ok' | 'warn' | 'info' | 'err'; small?: boolean }) {
  const tones = {
    default: 'text-foreground',
    ok: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    err: 'text-red-600 dark:text-red-400',
  }
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <p className={cn('font-mono font-bold', small ? 'text-sm' : 'text-xl', tones[tone])}>
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>
      <p className="mt-0.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground/70">{label}</p>
    </div>
  )
}

export function downloadReport(report: FinalReport) {
  const lines: string[] = []
  lines.push('RAPPORT D\'IMPORTATION — COURRIERS SORTANTS')
  lines.push(`Fichier ;${report.fileName}`)
  lines.push(`Feuille ;${report.sheetName}`)
  lines.push(`Statut ;${report.status}`)
  lines.push(`Lignes analysées ;${report.total}`)
  lines.push(`Importés ;${report.importes}`)
  lines.push(`Ignorés ;${report.ignores}`)
  lines.push(`Mis à jour ;${report.maj}`)
  lines.push(`Erreurs ;${report.erreurs}`)
  lines.push(`Durée ;${formatDuration(report.dureeMs)}`)
  lines.push('')
  lines.push('Détails')
  lines.push('Ligne;Détail')
  for (const d of report.details) {
    const m = d.match(/^Ligne (\d+) : (.*)$/)
    if (m) lines.push(`${m[1]};${m[2].replace(/;/g, ',')}`)
    else lines.push(d)
  }
  const csv = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rapport_import_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
