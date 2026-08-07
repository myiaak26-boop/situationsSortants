import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import {
  ClipboardList,
  Search,
  User,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState, LoadingState } from '@/components/ui/feedback'
import { formatDate } from '@/lib/utils'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

interface AuditLogItem {
  id: string
  action: string
  entity: string
  entityId: string
  details: string | null
  createdAt: string
  user: { id: string; name: string }
}

interface AuditResponse {
  logs: AuditLogItem[]
  total: number
  page: number
  totalPages: number
  filters: {
    entities: { value: string; count: number }[]
    actions: { value: string; count: number }[]
  }
}

const entityLabels: Record<string, string> = {
  COURRIER: 'Courrier',
  IMPORT: 'Import',
  USER: 'Utilisateur',
  ROLE: 'Rôle',
  PARAMETRE: 'Paramètre',
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  UPDATE: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  RETRAIT: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  IMPORT: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/journal',
  component: JournalPage,
})

function JournalPage() {
  const session = useSession()
  const [data, setData] = useState<AuditResponse | null>(null)
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = (p: number) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterEntity) params.set('entity', filterEntity)
    if (filterAction) params.set('action', filterAction)
    params.set('page', String(p))

    fetch(`/api/audit?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && Array.isArray(d.logs)) setData(d as AuditResponse); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [filterEntity, filterAction])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(1) }

return (
    <Guard session={session} permission="audit:read">
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Journal d'audit"
        description={data ? `${data.total} entrée${data.total > 1 ? 's' : ''}` : 'Traçabilité des actions'}
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher dans le journal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          {data && data.filters.entities.length > 0 && (
            <select
              value={filterEntity}
              onChange={(e) => { setFilterEntity(e.target.value); setPage(1) }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Toutes entités</option>
              {data.filters.entities.map((e) => (
                <option key={e.value} value={e.value}>{entityLabels[e.value] || e.value} ({e.count})</option>
              ))}
            </select>
          )}
          {data && data.filters.actions.length > 0 && (
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Toutes actions</option>
              {data.filters.actions.map((a) => (
                <option key={a.value} value={a.value}>{a.value} ({a.count})</option>
              ))}
            </select>
          )}
        </form>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
        {loading ? (
          <LoadingState />
        ) : data && data.logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entité</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Détails</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Utilisateur</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.005 }}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-2xs font-medium', actionColors[log.action] || 'bg-muted text-muted-foreground')}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{entityLabels[log.entity] || log.entity}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[300px] truncate">{log.details || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3 w-3" />
                          {log.user.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.createdAt)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-6 py-4">
                <p className="text-xs text-muted-foreground">Page {data.page} sur {data.totalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setPage((p) => { const n = Math.max(1, p - 1); load(n); return n }) }}
                    disabled={data.page <= 1}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setPage((p) => { const n = Math.min(data.totalPages, p + 1); load(n); return n }) }}
                    disabled={data.page >= data.totalPages}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState icon={<ClipboardList className="h-10 w-10 text-muted-foreground/20" />} title="Aucune entrée dans le journal" />
        )}
        </Card>
</motion.div>
    </div>
    </Guard>
  )
}

export default JournalPage
