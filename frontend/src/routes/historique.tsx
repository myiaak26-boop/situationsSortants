import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/utils'
import {
  Activity,
  Search,
  ChevronDown,
  Filter,
  Clock,
  User,
  FileText,
  Building2,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState, LoadingState } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page-header'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

interface HistoriqueItem {
  id: string
  action: string
  commentaire: string | null
  createdAt: string
  user: { id: string; name: string }
  courrier: { id: string; numero: string; destinataire: string }
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/historique',
  component: HistoriquePage,
})

function HistoriquePage() {
  const session = useSession()
  const [actions, setActions] = useState<HistoriqueItem[]>([])
  const [actionTypes, setActionTypes] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterAction) params.set('action', filterAction)

    fetch(`/api/historique?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setActions(Array.isArray(data?.actions) ? data.actions : [])
        setActionTypes(Array.isArray(data?.filters?.actionTypes) ? data.filters.actionTypes : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  return (
    <Guard session={session} permission="courrier:history">
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Historique des actions"
        description={`${actions.length} action${actions.length > 1 ? 's' : ''} enregistrée${actions.length > 1 ? 's' : ''}`}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par action, courrier, destinataire, utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="relative">
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setTimeout(load, 0) }}
              className="appearance-none rounded-lg border border-border bg-card px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Toutes les actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
        {loading ? (
          <LoadingState />
        ) : actions.length === 0 ? (
          <EmptyState icon={<Activity className="h-10 w-10 text-muted-foreground/20" />} title="Aucune action trouvée" />
        ) : (
          <div className="divide-y divide-border">
            {actions.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.01 }}
                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
              >
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  a.action === 'Retiré' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  a.action === 'Nouveau' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-muted text-muted-foreground'
                )}>
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">{a.action}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {a.user.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(a.createdAt)}
                    </span>
                    <a
                      href={`/courriers/${a.courrier.id}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {a.courrier.numero}
                    </a>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {a.courrier.destinataire}
                    </span>
                  </div>
                  {a.commentaire && (
                    <p className="mt-1 text-xs text-muted-foreground/80">{a.commentaire}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </Card>
      </motion.div>
    </div>
    </Guard>
  )
}
