import { cn } from '@/lib/cn'
import { CheckCircle2 } from 'lucide-react'

export function StatusBadge({ couleur, nom }: { couleur: string; nom: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs font-medium leading-relaxed"
      style={{ backgroundColor: `${couleur}14`, color: couleur }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: couleur }} />
      {nom}
    </span>
  )
}

export interface DelaiSeuils {
  vert: number
  orange: number
}

export const DELAI_SEUILS_DEFAULTS: DelaiSeuils = { vert: 3, orange: 7 }

export type DelaiLevel = 'vert' | 'orange' | 'rouge'

export function delaiLevel(jours: number, seuils: DelaiSeuils = DELAI_SEUILS_DEFAULTS): DelaiLevel {
  if (jours <= seuils.vert) return 'vert'
  if (jours <= seuils.orange) return 'orange'
  return 'rouge'
}

const delaiStyles: Record<DelaiLevel, string> = {
  vert: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  orange: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rouge: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const delaiDots: Record<DelaiLevel, string> = {
  vert: 'bg-emerald-500',
  orange: 'bg-amber-500',
  rouge: 'bg-red-500',
}

export function DelaiBadge({
  jours,
  seuils = DELAI_SEUILS_DEFAULTS,
  retrait,
  testid = 'delai-badge',
}: {
  jours: number
  seuils?: DelaiSeuils
  retrait?: boolean
  testid?: string
}) {
  if (retrait) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-medium text-success">
        <CheckCircle2 className="h-3 w-3" />
        Retiré
      </span>
    )
  }
  const level = delaiLevel(jours, seuils)
  return (
    <span
      data-testid={testid}
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold', delaiStyles[level])}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', delaiDots[level])} />
      {jours}j
    </span>
  )
}

type WorkflowBadgeType = 'create' | 'retrait' | 'update' | 'import' | 'transition' | 'default'

const workflowStyles: Record<WorkflowBadgeType, string> = {
  create: 'bg-primary/10 text-primary',
  retrait: 'bg-success/10 text-success',
  update: 'bg-warning/10 text-warning',
  import: 'bg-chart-4/10 text-chart-4',
  transition: 'bg-chart-3/10 text-chart-3',
  default: 'bg-muted text-muted-foreground',
}

export function WorkflowBadge({ type, label }: { type: WorkflowBadgeType; label: string }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-2xs font-medium', workflowStyles[type] || workflowStyles.default)}>
      {label}
    </span>
  )
}
