import { cn } from '@/lib/cn'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('bg-aurora relative overflow-hidden rounded-2xl border border-border/50 px-6 py-7', className)}
    >
      <div className="pointer-events-none absolute -top-20 -right-20 h-52 w-52 rounded-full bg-primary/15 blur-3xl motion-reduce:hidden" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-44 w-44 rounded-full bg-[hsl(271_75%_55%)]/10 blur-3xl motion-reduce:hidden" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-3xs font-semibold uppercase tracking-[0.12em] text-primary">
            <Sparkles className="h-3 w-3" />
            DEX — Suivi courriers
          </div>
          <h1 className="text-gradient text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground/90">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </motion.div>
  )
}

interface SectionTitleProps {
  title: string
  description?: string
  icon?: ReactNode
  className?: string
}

export function SectionTitle({ title, description, icon, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground/70">{description}</p>}
      </div>
    </div>
  )
}
