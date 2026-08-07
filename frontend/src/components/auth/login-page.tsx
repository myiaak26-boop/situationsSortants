import { useState } from 'react'
import { login } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, Mail, LogIn, FileText, ShieldCheck } from 'lucide-react'

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-aurora relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Halos décoratifs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl motion-reduce:hidden" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[hsl(271_75%_55%)]/15 blur-3xl motion-reduce:hidden" />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative w-full max-w-md">
        {/* Carte de connexion */}
        <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-card backdrop-blur-xl transition-shadow duration-300 hover:shadow-elevated">
          <div className="mb-8 text-center">
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(271_75%_55%)] text-white shadow-[0_8px_24px_-6px_hsl(215_80%_50%/0.6)]">
              <FileText className="h-8 w-8" />
              <span className="absolute -inset-1 -z-10 rounded-2xl bg-primary/30 blur-lg motion-reduce:hidden" />
            </div>
            <h1 className="text-gradient text-2xl font-bold tracking-tight">Situation des Courriers Sortants</h1>
            <p className="mt-2 text-sm text-muted-foreground">Secrétariat Central — République de Guinée</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                Adresse e-mail
              </label>
              <div className="relative mt-2">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dex.local"
                  required
                  autoFocus
                  data-testid="login-email"
                  className="w-full rounded-xl border border-border bg-background/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            <div>
              <label className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                Mot de passe
              </label>
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  data-testid="login-password"
                  className="w-full rounded-xl border border-border bg-background/70 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            {error && (
              <p
                data-testid="login-error"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-xl bg-gradient-to-r from-primary to-[hsl(235_70%_50%)] shadow-[0_6px_18px_-6px_hsl(215_80%_50%/0.6)] transition-all hover:shadow-[0_8px_24px_-6px_hsl(215_80%_50%/0.8)]"
              disabled={submitting}
              data-testid="login-submit"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Se connecter
            </Button>

            <div className="flex items-center justify-center gap-1.5 pt-1">
              <ShieldCheck className="h-3 w-3 text-muted-foreground/40" />
              <p className="text-3xs text-muted-foreground/50">
                Démo : admin@dex.local / admin123
              </p>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-3xs tracking-wide text-muted-foreground/40">
          © {new Date().getFullYear()} DEX — Direction des Exploitations et du Suivi
        </p>
      </div>
    </div>
  )
}
