import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { ImportWizard } from '@/components/import/import-wizard'
import { Upload, Sparkles } from 'lucide-react'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/import',
  component: ImportPage,
})

function ImportPage() {
  const session = useSession()
  return (
    <Guard session={session} permission="import">
      <div className="space-y-6">
      {/* Hero */}
      <div className="bg-aurora relative overflow-hidden rounded-2xl border border-border/50 px-6 py-8">
        <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl motion-reduce:hidden" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[hsl(271_75%_55%)]/10 blur-3xl motion-reduce:hidden" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-3xs font-semibold uppercase tracking-[0.12em] text-primary">
              <Sparkles className="h-3 w-3" />
              Assistant d'import
            </div>
            <h1 className="text-gradient text-2xl font-bold tracking-tight">Importation Excel</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Importer des courriers sortants depuis un fichier Excel — analyse, mappage et validation guidés.
            </p>
          </div>
        </div>
      </div>

      <ImportWizard />
      </div>
    </Guard>
  )
}

export default ImportPage
