import { cn } from '@/lib/cn'

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
  className?: string
}) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center gap-2', className)}>
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => {
            if (el) el.indeterminate = Boolean(indeterminate)
          }}
          onChange={onChange}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-background transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 m-auto hidden h-2.5 w-2.5 text-primary-foreground peer-checked:block"
          fill="none"
        >
          <path d="M2.5 6.5L5 9l4.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 m-auto hidden h-2.5 w-2.5 text-primary-foreground peer-indeterminate:block"
          fill="none"
        >
          <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </label>
  )
}
