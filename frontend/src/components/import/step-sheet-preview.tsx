import { motion } from 'framer-motion'
import { Table2, ListOrdered, CheckCircle2, Loader2, Rows3, Columns3 as ColumnsIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { StepShell, StepNav } from './stepper'
import { SheetMeta, SheetResponse, formatBytes, formatDuration } from '@/lib/import'

interface StepSheetProps {
  sheets: SheetMeta[]
  busy: boolean
  selected: string | null
  onSelect: (name: string) => void
  onNext: () => void
  onBack: () => void
}

export function StepSheet({ sheets, busy, selected, onSelect, onNext, onBack }: StepSheetProps) {
  return (
    <StepShell
      title="Choix de la feuille"
      description={`Le fichier contient ${sheets.length} feuille${sheets.length > 1 ? 's' : ''}. Sélectionnez celle à importer.`}
      icon={<Table2 className="h-5 w-5" />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {sheets.map((s) => (
          <button
            key={s.name}
            disabled={busy}
            onClick={() => onSelect(s.name)}
            className={cn(
              'group flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200',
              selected === s.name
                ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
              selected === s.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {busy && selected === s.name ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Table2 className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Rows3 className="h-3 w-3" />{s.rows.toLocaleString('fr-FR')} lignes</span>
                <span className="flex items-center gap-1"><ColumnsIcon className="h-3 w-3" />{s.cols} colonnes</span>
              </p>
            </div>
            {selected === s.name && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continuer" nextDisabled={!selected || busy} />
    </StepShell>
  )
}

interface StepPreviewProps {
  sheetName: string
  fileName: string
  size: number
  sheet: SheetResponse | null
  busy: boolean
  onNext: () => void
  onBack: () => void
}

export function StepPreview({ sheetName, fileName, size, sheet, busy, onNext, onBack }: StepPreviewProps) {
  return (
    <StepShell
      title="Prévisualisation"
      description={`Aperçu de la feuille « ${sheetName} » — vérifiez que le bon fichier a été sélectionné`}
      icon={<ListOrdered className="h-5 w-5" />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {fileName} ({formatBytes(size)})
        </span>
        {sheet && (
          <>
            <span className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              {sheet.totalRows.toLocaleString('fr-FR')} ligne{sheet.totalRows > 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              {sheet.columns.length} colonnes
            </span>
          </>
        )}
      </div>

      {busy || !sheet ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground/60">Analyse de la feuille…</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {sheet.columns.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                <ColumnsIcon className="h-3 w-3 text-primary/70" />
                {c || `Colonne ${i + 1}`}
              </span>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-x-auto rounded-xl border bg-card"
          >
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                  {sheet.columns.map((c, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold text-foreground/80 whitespace-nowrap">
                      {c || `Colonne ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sheet.preview.length === 0 ? (
                  <tr>
                    <td colSpan={sheet.columns.length + 1} className="px-3 py-10 text-center text-muted-foreground">
                      Aucune donnée dans cette feuille
                    </td>
                  </tr>
                ) : (
                  sheet.preview.map((row, ri) => (
                    <tr key={ri} className="transition-colors hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-muted-foreground/60">{ri + 2}</td>
                      {sheet.columns.map((_, ci) => (
                        <td key={ci} className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                          {formatCell(row[ci])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </motion.div>

          <p className="text-xs text-muted-foreground/70">
            Affichage des 20 premières lignes sur {sheet.totalRows.toLocaleString('fr-FR')}.
          </p>
        </>
      )}

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Continuer" nextDisabled={busy || !sheet} />
    </StepShell>
  )
}

export function formatCell(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (typeof v === 'number' && isFinite(v)) {
    if (Number.isInteger(v)) return v.toLocaleString('fr-FR')
    return String(v)
  }
  return String(v)
}

export function formatReportTime(ms: number): string {
  return formatDuration(ms)
}
