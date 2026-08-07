import { cn } from '@/lib/cn'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'md' && 'h-9 px-4 text-sm',
        size === 'lg' && 'h-10 px-5 text-sm',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'outline' && 'border border-border bg-card hover:bg-muted/50 text-foreground',
        variant === 'ghost' && 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'h-7 w-7',
        size === 'md' && 'h-8 w-8',
        size === 'lg' && 'h-9 w-9',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
IconButton.displayName = 'IconButton'

export const ActionButton = motion.create(Button)
