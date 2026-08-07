import { cn } from '@/lib/cn'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export interface Crumb {
  label: string
  href?: string
  icon?: LucideIcon
}

interface BreadcrumbProps {
  items: Crumb[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center gap-1.5 text-xs', className)} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const Icon = item.icon
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            {Icon && <Icon className="h-3 w-3 text-muted-foreground/50" />}
            {item.href && !isLast ? (
              <a href={item.href} className="text-muted-foreground/70 hover:text-foreground transition-colors">
                {item.label}
              </a>
            ) : (
              <span className={cn(isLast ? 'text-foreground font-medium' : 'text-muted-foreground/70')}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
