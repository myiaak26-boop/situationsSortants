import { cn } from '@/lib/cn'
import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: { value: number; positive?: boolean }
  accent?: string
  className?: string
  delay?: number
}

export function StatCard({ label, value, icon, trend, accent, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05, duration: 0.35 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-5 shadow-card transition-all duration-250 hover:shadow-card-hover hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            {label}
          </p>
          <p className="font-mono text-kpi tracking-tight text-foreground">
            {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
          </p>
          {trend && (
            <p className={cn('flex items-center gap-1 text-2xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
              <span className={cn('text-xs', trend.positive ? 'rotate-0' : 'rotate-180')}>↑</span>
              {trend.value}%
            </p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accent || 'bg-primary/10')}>
          <div className={cn('h-5 w-5', accent ? '' : 'text-primary')}>{icon}</div>
        </div>
      </div>
    </motion.div>
  )
}

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-card', padding && 'p-5', className)}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, icon, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between border-b border-border px-5 py-4', className)}>
      <div className="flex items-center gap-3">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-2xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

interface ChartCardProps {
  children: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
  height?: string
}

export function ChartCard({ children, title, subtitle, action, height }: ChartCardProps) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className={cn('p-5', height)}>{children}</div>
    </Card>
  )
}

interface InfoCardProps {
  children: ReactNode
  className?: string
}

export function InfoCard({ children, className }: InfoCardProps) {
  return (
    <div className={cn('rounded-lg border border-border/60 bg-muted/30 p-4', className)}>
      {children}
    </div>
  )
}
