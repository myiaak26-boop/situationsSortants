import { cn } from '@/lib/cn'
import { Check, FileSpreadsheet, ListOrdered, Table2, Columns3, ShieldCheck, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

export const STEPS = [
  { id: 1, label: 'Fichier', icon: FileSpreadsheet },
  { id: 2, label: 'Feuille', icon: Table2 },
  { id: 3, label: 'Aperçu', icon: ListOrdered },
  { id: 4, label: 'Colonnes', icon: Columns3 },
  { id: 5, label: 'Validation', icon: ShieldCheck },
  { id: 6, label: 'Import', icon: Download },
] as const

interface StepperProps {
  current: number
  maxReached: number
}

export function Stepper({ current, maxReached }: StepperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-0">
        {STEPS.map((step, idx) => {
          const done = step.id < current || step.id < maxReached
          const active = step.id === current
          const isLast = idx === STEPS.length - 1
          const Icon = step.icon
          return (
            <li key={step.id} className={cn('flex items-center', !isLast && 'flex-1')}>
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-200',
                    active && 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20',
                    done && !active && 'border-primary/60 bg-primary/10 text-primary',
                    !active && !done && 'border-border bg-card text-muted-foreground/60',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </motion.div>
                <span
                  className={cn(
                    'text-2xs font-medium transition-colors',
                    active ? 'text-foreground' : done ? 'text-primary/80' : 'text-muted-foreground/50',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors duration-300',
                    done ? 'bg-primary/40' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function StepNav({
  onBack,
  onNext,
  backLabel = 'Précédent',
  nextLabel = 'Continuer',
  nextDisabled,
  nextBusy,
}: {
  onBack?: () => void
  onNext: () => void
  backLabel?: string
  nextLabel?: string
  nextDisabled?: boolean
  nextBusy?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {onBack ? (
        <button
          onClick={onBack}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          ← {backLabel}
        </button>
      ) : <div />}
      <button
        onClick={onNext}
        disabled={nextDisabled || nextBusy}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {nextBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
        {nextLabel} →
      </button>
    </div>
  )
}

export function StepShell({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22 }}
      className="space-y-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground/80">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  )
}
