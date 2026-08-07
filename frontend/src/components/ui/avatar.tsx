import { cn } from '@/lib/cn'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary font-medium text-primary-foreground',
        size === 'sm' && 'h-6 w-6 text-3xs',
        size === 'md' && 'h-8 w-8 text-2xs',
        size === 'lg' && 'h-10 w-10 text-xs',
        className,
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
