import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Shield, KeyRound, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { LoadingState } from '@/components/ui/feedback'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { fetchSession, type Session } from '@/lib/session'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profil',
  component: ProfilPage,
})

function ProfilPage() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    fetchSession().then(setSession)
  }, [])

  if (!session) return <LoadingState />

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Profil" description="Vos informations et vos préférences de sécurité" />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card>
          <div className="flex items-center gap-4 p-6">
            <Avatar name={session.name} size="lg" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">{session.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                {session.roleName || '—'}
              </p>
            </div>
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-medium ${
                session.active
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {session.active ? <><Check className="h-3 w-3" /> Actif</> : <><X className="h-3 w-3" /> Inactif</>}
            </span>
          </div>
          <div className="grid gap-3 border-t border-border/60 p-6 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <Mail className="h-4 w-4 text-muted-foreground/60" />
              <div className="min-w-0">
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/50">Adresse e-mail</p>
                <p className="truncate text-sm text-foreground">{session.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <Shield className="h-4 w-4 text-muted-foreground/60" />
              <div>
                <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/50">Rôle</p>
                <p className="text-sm text-foreground">{session.roleName || '—'}</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <div className="flex items-center gap-2.5 border-b border-border/60 p-6 pb-4">
            <KeyRound className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Changer le mot de passe</h2>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                Utilisez votre mot de passe actuel pour définir un nouveau.
              </p>
            </div>
          </div>
          <div className="p-6">
            <ChangePasswordForm />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

export default ProfilPage
