import { type ReactNode } from 'react'
import { can, type Session } from '@/lib/session'
import { Card } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'

export function Guard({ session, permission, children }: { session: Session | null; permission: string; children: ReactNode }) {
  if (!can(session, permission)) {
    return (
      <Card>
        <div className="flex items-start gap-3 p-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-foreground">Accès refusé</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vous n'avez pas la permission d'accéder à cette page.
            </p>
          </div>
        </div>
      </Card>
    )
  }
  return <>{children}</>
}