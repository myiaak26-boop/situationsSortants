import { motion } from 'framer-motion'
import { Columns3, BadgeCheck, RefreshCcw, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { StepShell, StepNav } from './stepper'
import {
  ALL_FIELDS,
  REQUIRED_FIELDS,
  FIELD_LABELS,
  ColumnMapping,
  FieldKey,
} from '@/lib/import'

interface StepMappingProps {
  columns: string[]
  mapping: ColumnMapping
  detectedMapping: ColumnMapping
  onChange: (m: ColumnMapping) => void
  onReset: () => void
  onNext: () => void
  onBack: () => void
}

export function StepMapping({ columns, mapping, detectedMapping, onChange, onReset, onNext, onBack }: StepMappingProps) {
  const requiredMissing = REQUIRED_FIELDS.filter((f) => !mapping[f])

  return (
    <StepShell
      title="Correspondance des colonnes"
      description="Le système a détecté automatiquement les correspondances. Ajustez-les si nécessaire."
      icon={<Columns3 className="h-5 w-5" />}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <BadgeCheck className="h-4 w-4 text-primary" />
          Détection automatique effectuée sur les {columns.length} colonnes du fichier
        </p>
        <button
          onClick={onReset}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Réinitialiser la détection
        </button>
      </div>

      <div className="space-y-2.5">
        {ALL_FIELDS.map((field) => (
          <motion.div
            key={field}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:gap-4',
              mapping[field] ? 'border-border bg-card' : 'border-dashed border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/10',
              isOptional(field) && !mapping[field] && 'border-border bg-card opacity-80',
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">{FIELD_LABELS[field]}</p>
              {isRequired(field) ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
                  Obligatoire
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                  Facultatif
                </span>
              )}
            </div>
            <select
              value={mapping[field] ?? ''}
              onChange={(e) => onChange({ ...mapping, [field]: e.target.value || null })}
              data-testid={`mapping-${field}`}
              className={cn(
                'h-9 w-full rounded-lg border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-72',
                mapping[field] ? 'border-border' : 'border-red-300',
              )}
            >
              <option value="">— Non mappé —</option>
              {columns.map((c, i) => (
                <option key={`${c}-${i}`} value={c}>{c || `Colonne ${i + 1}`}</option>
              ))}
            </select>
          </motion.div>
        ))}
      </div>

      {requiredMissing.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {requiredMissing.length} colonne{requiredMissing.length > 1 ? 's' : ''} obligatoire{requiredMissing.length > 1 ? 's' : ''} à mapper
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {requiredMissing.map((f) => FIELD_LABELS[f as FieldKey]).join(', ')}
            </p>
          </div>
        </div>
      )}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Valider les données"
        nextDisabled={requiredMissing.length > 0}
      />
    </StepShell>
  )
}

function isRequired(f: string): boolean {
  return (REQUIRED_FIELDS as readonly string[]).includes(f)
}

function isOptional(f: string): boolean {
  return !isRequired(f)
}
