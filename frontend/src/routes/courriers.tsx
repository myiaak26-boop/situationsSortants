import { createRoute, Link } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
  type Updater,
  type RowData,
} from '@tanstack/react-table'
import {
  Search,
  Upload,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Mail,
  Inbox,
  MoreVertical,
  Columns3,
  History,
  Printer,
  Trash2,
  Plus,
  Lock,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  StatusBadge,
  DELAI_SEUILS_DEFAULTS,
  type DelaiSeuils,
} from '@/components/ui/status-badge'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmationDialog } from '@/components/ui/dialog'
import { formatDateFull, formatDateTime } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { fetchSession, can, PERM, type Session } from '@/lib/session'
import { Guard } from '@/components/ui/guard'
import type { Courrier, ModeTransmission } from '@/lib/types'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string
    headerClassName?: string
  }
}

interface SituationOption {
  id: string
  nom: string
  couleur: string
  ordre: number
}

interface CourrierMeta {
  situations: SituationOption[]
  signataires: { id: string; code: string; nom: string; actif: boolean; ordre: number }[]
  signataireOptions: { id: string; nom: string }[]
  modes: ModeTransmission[]
}

interface CourrierList {
  items: Courrier[]
  total: number
}

interface Filters {
  search: string
  situationId: string
  modeTransmissionId: string
  signataire: string
  dateDebut: string
  dateFin: string
}

const EMPTY_FILTERS: Filters = { search: '', situationId: '', modeTransmissionId: '', signataire: '', dateDebut: '', dateFin: '' }
const PAGE_SIZES = [20, 50, 100, 200]

const COLUMN_MENU = [
  { key: 'numero', label: 'Numéro' },
  { key: 'dateEnvoi', label: "Date de signature" },
  { key: 'signataire', label: 'Signataire' },
  { key: 'destinataire', label: 'Destinataire' },
  { key: 'objet', label: 'Objet' },
  { key: 'modeTransmission', label: 'Mode' },
  { key: 'situation', label: 'Situation' },
  { key: 'numeroEntrant', label: 'Réponse au courrier (N°)' },
  { key: 'dateArriveeEntrant', label: "Date d'arrivée (entrant)" },
  { key: 'dateRetrait', label: 'Date de retrait' },
]

type CourrierRow = Courrier & {
  dateRetrait: string | null
}

function decorate(c: Courrier): CourrierRow {
  return {
    ...c,
    dateRetrait: c.retrait ? formatDateTime(c.retrait.dateRetrait) : null,
  }
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/courriers',
  component: CourriersPage,
})

function CourriersPage() {
  const [rows, setRows] = useState<CourrierRow[]>([])
  const [total, setTotal] = useState(0)
  const [meta, setMeta] = useState<CourrierMeta>({ situations: [], signataires: [], signataireOptions: [], modes: [] })
  const [seuils, setSeuils] = useState<DelaiSeuils>(DELAI_SEUILS_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dateEnvoi', desc: true }])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [refreshTick, setRefreshTick] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [creationManuelle, setCreationManuelle] = useState<boolean | null>(null)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set(['numeroEntrant']))
  const [showCols, setShowCols] = useState(false)
  const [actionRowId, setActionRowId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourrierRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const debounceRef = useRef<number | null>(null)
  const fetchSeqRef = useRef(0)

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput.trim() }))
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  useEffect(() => {
    fetch('/api/courriers/meta')
      .then(async (r) => {
        if (!r.ok) throw new Error('meta')
        return (await r.json()) as CourrierMeta
      })
      .then((d) => setMeta(d))
      .catch(() => {})
    fetch('/api/parametres')
      .then(async (r) => {
        if (!r.ok) throw new Error('parametres')
        return (await r.json()) as { cle: string; valeur: string }[]
      })
      .then((params) => {
        const get = (cle: string) => Number(params.find((p) => p.cle === cle)?.valeur)
        const vert = get('delai.vert.jours')
        const orange = get('delai.orange.jours')
        if (Number.isFinite(vert) && Number.isFinite(orange)) setSeuils({ vert, orange })
        const manuelle = params.find((p) => p.cle === 'courrier.creationManuelle')?.valeur
        setCreationManuelle(manuelle === undefined ? true : manuelle === 'true')
      })
      .catch(() => {})
    fetchSession().then((s) => setSession(s))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const seq = ++fetchSeqRef.current
    setLoading(true)
    setError(null)
    const usp = new URLSearchParams()
    if (filters.search) usp.set('search', filters.search)
    if (filters.situationId) usp.set('situationId', filters.situationId)
    if (filters.signataire) usp.set('signataire', filters.signataire)
    if (filters.dateDebut) usp.set('dateDebut', filters.dateDebut)
    if (filters.dateFin) usp.set('dateFin', filters.dateFin)
    const sort = sorting[0]
    if (sort) {
      usp.set('sortBy', sort.id)
      usp.set('sortDir', sort.desc ? 'desc' : 'asc')
    }
    usp.set('page', String(page))
    usp.set('pageSize', String(pageSize))

    fetch(`/api/courriers?${usp.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Erreur de chargement')
        return data as CourrierList
      })
      .then((data) => {
        if (seq !== fetchSeqRef.current) return
        setRows(data.items.map(decorate))
        setTotal(data.total)
      })
      .catch((err: unknown) => {
        if (seq !== fetchSeqRef.current) return
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      })
      .finally(() => {
        if (seq === fetchSeqRef.current) setLoading(false)
      })
    return () => controller.abort()
  }, [filters, sorting, page, pageSize, refreshTick])

  const hasFilters = useMemo(
    () => Object.values(filters).some(Boolean) || searchInput.trim() !== '',
    [filters, searchInput],
  )

  const applyPart = (partial: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...partial }))
    setPage(1)
  }

  const resetFilters = () => {
    setSearchInput('')
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const refresh = () => setRefreshTick((t) => t + 1)

  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/courriers/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteTarget(null)
        setActionRowId(null)
        setPage(1)
        refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        setError(err?.error || 'Échec de la suppression')
      }
    } finally {
      setDeleting(false)
    }
  }

  const canCreate = can(session, PERM.CREATE) && creationManuelle !== false
  const canDelete = can(session, PERM.DELETE) && !!session?.isSuperAdmin
  const canPrint = can(session, PERM.PRINT)
  const canUpdate = can(session, PERM.UPDATE_SITUATION)

  const exportCsv = async () => {
    setLoading(true)
    const usp = new URLSearchParams()
    if (filters.search) usp.set('search', filters.search)
    if (filters.situationId) usp.set('situationId', filters.situationId)
    if (filters.modeTransmissionId) usp.set('modeTransmissionId', filters.modeTransmissionId)
    if (filters.signataire) usp.set('signataire', filters.signataire)
    if (filters.dateDebut) usp.set('dateDebut', filters.dateDebut)
    if (filters.dateFin) usp.set('dateFin', filters.dateFin)
    const sort = sorting[0]
    if (sort) {
      usp.set('sortBy', sort.id)
      usp.set('sortDir', sort.desc ? 'desc' : 'asc')
    }
    usp.set('page', '1')
    usp.set('pageSize', '100000')
    try {
      const r = await fetch(`/api/courriers?${usp.toString()}`)
      const data = (await r.json()) as CourrierList
      const all = [
        ['N°', "Date de signature", 'Signataire', 'Destinataire', 'Objet', 'Mode', 'Situation', 'Réponse au courrier (N°)', "Date d'arrivée (entrant)", 'Date de retrait'],
        ...data.items.map((c) => {
          const row = decorate(c)
          return [
            row.numero,
            formatDateFull(row.dateEnvoi),
            row.signataire,
            row.destinataire,
            row.objet,
            row.modeTransmission?.nom ?? '',
            row.situation.nom,
            row.numeroEntrant || '',
            row.dateArriveeEntrant ? formatDateFull(row.dateArriveeEntrant) : '',
            row.dateRetrait || '',
          ]
        }),
      ]
      const csv = '\uFEFF' + all.map((l) => l.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `courriers-sortants-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* silencieux */
    } finally {
      setLoading(false)
    }
  }

  return (
    <Guard session={session} permission="courrier:read">
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* ── Héro ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
      >
        <div className="absolute inset-0 bg-aurora motion-reduce:hidden" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl motion-reduce:hidden" />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-3xs font-semibold uppercase tracking-[0.16em] text-primary">
              Secrétariat Central · Registre des courriers
            </p>
            <h1 className="mt-2 text-display font-bold tracking-tight text-foreground">
              Courriers <span className="text-gradient">sortants</span>
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground/80">
              {total.toLocaleString('fr-FR')} courrier{total > 1 ? 's' : ''}
              {hasFilters && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <FilterX className="h-3 w-3" />
                  Filtres actifs
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <Link to="/courriers/nouveau" data-testid="btn-nouveau-courrier">
                <Button size="md">
                  <Plus className="h-4 w-4" />
                  Nouveau courrier
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.section>

      <CourrierToolbar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        filters={filters}
        onApply={applyPart}
        onReset={resetFilters}
        hasFilters={hasFilters}
        situations={meta.situations}
        signataireOptions={meta.signataireOptions}
        modes={meta.modes}
        hiddenCols={hiddenCols}
        showCols={showCols}
        onToggleCol={toggleCol}
        onOpenCols={() => setShowCols(!showCols)}
      />

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 px-5 py-8 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-950/10 dark:text-red-400">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={refresh}>Réessayer</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card">
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {total === 0 ? (
            <EmptyCourriers hasFilters={hasFilters} onReset={resetFilters} />
          ) : (
            <>
              <div className="hidden md:block">
                <CourrierTable
                  rows={rows}
                  sorting={sorting}
                  seuils={seuils}
                  hiddenCols={hiddenCols}
                  actionRowId={actionRowId}
                  onActionRow={setActionRowId}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canPrint={canPrint}
                  onDelete={(c) => setDeleteTarget(c)}
                  onSortingChange={(s) => {
                    setSorting(s)
                    setPage(1)
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
                {rows.map((c, i) => (
                  <CardCourrier
                    key={c.id}
                    c={c}
                    seuils={seuils}
                    index={i}
                    actionOpen={actionRowId === c.id}
                    onActionToggle={() => setActionRowId(actionRowId === c.id ? null : c.id)}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    canPrint={canPrint}
                    onDelete={() => setDeleteTarget(c)}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground" data-testid="pagination-info">
                  {total === 0
                    ? '0 résultat'
                    : (
                      <>
                        <span className="font-medium text-foreground">{Math.min((page - 1) * pageSize + 1, total)}</span>
                        {'–'}{Math.min(page * pageSize, total)} sur <span className="font-medium text-foreground">{total}</span>
                      </>
                    )}
                </p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Par page
                    <select
                      data-testid="page-size"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setPage(1)
                      }}
                      className="h-8 rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                    >
                      {PAGE_SIZES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <Pagination page={page} totalPages={Math.ceil(total / pageSize)} onPageChange={setPage} />
                </div>
              </div>
            </>
          )}
        </>
      )}
      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le courrier"
        description={deleteTarget ? `Confirmer la suppression du courrier n°${deleteTarget.numero} ? Cette opération est définitive.` : ''}
        confirmLabel="Supprimer"
      />
    </div>
    </Guard>
  )
}

/* ---------------------------------- Toolbar ---------------------------------- */

interface CourrierToolbarProps {
  searchInput: string
  onSearchChange: (v: string) => void
  filters: Filters
  onApply: (p: Partial<Filters>) => void
  onReset: () => void
  hasFilters: boolean
  situations: SituationOption[]
  signataireOptions: { id: string; nom: string }[]
  modes: ModeTransmission[]
  hiddenCols: Set<string>
  showCols: boolean
  onToggleCol: (key: string) => void
  onOpenCols: () => void
}

function CourrierToolbar({ searchInput, onSearchChange, filters, onApply, onReset, hasFilters, situations, signataireOptions, modes, hiddenCols, showCols, onToggleCol, onOpenCols }: CourrierToolbarProps) {
  const field = 'h-9 rounded-xl border border-border/80 bg-background px-2.5 text-sm text-foreground focus:border-ring focus:outline-none'
  const lab = 'flex flex-col gap-1 text-2xs font-medium text-muted-foreground'
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="search"
            data-testid="search-global"
            placeholder="Rechercher par numéro, destinataire, objet, signataire, réponse..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring/40 focus:outline-none focus:ring-2 focus:ring-ring/10"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className={lab}>
            Situation
            <select
              data-testid="filter-situation"
              value={filters.situationId}
              onChange={(e) => onApply({ situationId: e.target.value })}
              className={field}
            >
              <option value="">Toutes</option>
              {situations.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </label>
          <label className={lab}>
            Mode
            <select
              data-testid="filter-mode"
              value={filters.modeTransmissionId}
              onChange={(e) => onApply({ modeTransmissionId: e.target.value })}
              className={field}
            >
              <option value="">Tous</option>
              {modes.map((m) => (
                <option key={m.id} value={m.id}>{m.nom}</option>
              ))}
            </select>
          </label>
          <label className={lab}>
            Signataire
            <select
              data-testid="filter-signataire"
              value={filters.signataire}
              onChange={(e) => onApply({ signataire: e.target.value })}
              className={cn(field, 'max-w-[10rem]')}
            >
              <option value="">Tous</option>
              {signataireOptions.map((s) => (
                <option key={s.id} value={s.nom}>{s.nom}</option>
              ))}
            </select>
          </label>
          <label className={lab}>
            Du
            <input
              type="date"
              data-testid="filter-date-debut"
              value={filters.dateDebut}
              onChange={(e) => onApply({ dateDebut: e.target.value })}
              className={field}
            />
          </label>
          <label className={lab}>
            Au
            <input
              type="date"
              data-testid="filter-date-fin"
              value={filters.dateFin}
              onChange={(e) => onApply({ dateFin: e.target.value })}
              className={field}
            />
          </label>
          {hasFilters && (
            <Button variant="outline" size="sm" data-testid="btn-reset-filters" onClick={onReset} className="h-9">
              <FilterX className="h-4 w-4" />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-border/50 pt-3">
        <div className="relative">
          <Button variant="outline" size="sm" data-testid="btn-colonnes" onClick={onOpenCols} className="h-8">
            <Columns3 className="h-4 w-4" />
            Colonnes
          </Button>
          {showCols && (
            <>
              <div className="fixed inset-0 z-20" onClick={onOpenCols} />
              <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-xl border border-border bg-card p-2 shadow-modal">
                {COLUMN_MENU.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-muted/50">
                    <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => onToggleCol(c.key)} className="h-3.5 w-3.5 rounded border-border" />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- Table ---------------------------------- */

const columnHelper = createColumnHelper<CourrierRow>()

interface RowActionHandlers {
  actionRowId: string | null
  onActionRow: (id: string | null) => void
  canUpdate: boolean
  canDelete: boolean
  canPrint: boolean
  onDelete: (c: CourrierRow) => void
}

function RowActions({ c, handlers }: { c: CourrierRow; handlers: RowActionHandlers }) {
  const open = handlers.actionRowId === c.id
  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground'
  return (
    <div className="relative flex justify-end">
      <button
        data-testid={`action-menu-${c.numero}`}
        onClick={() => handlers.onActionRow(open ? null : c.id)}
        className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => handlers.onActionRow(null)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-modal">
            <a href={`/courriers/${c.id}`} data-testid={`action-consulter-${c.numero}`} className={item}>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Consulter
            </a>
            {handlers.canUpdate && (
              <a href={`/courriers/${c.id}#situation`} data-testid={`action-situation-${c.numero}`} className={item}>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Mettre à jour la situation
              </a>
            )}
            <a href={`/courriers/${c.id}#historique`} data-testid={`action-historique-${c.numero}`} className={item}>
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              Voir l'historique
            </a>
            {handlers.canPrint && (
              <a href={`/courriers/${c.id}/fiche`} target="_blank" rel="noreferrer" data-testid={`action-imprimer-${c.numero}`} className={item}>
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                Imprimer la fiche
              </a>
            )}
            {handlers.canDelete && (
              <button
                data-testid={`action-supprimer-${c.numero}`}
                onClick={() => handlers.onDelete(c)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const TableColumns = (handlers: RowActionHandlers) => {
  return [
    columnHelper.accessor('numero', {
      id: 'numero',
      header: ({ column }) => <SortHeader column={column} label="N°" />,
      cell: ({ row }) => (
        <Link to="/courriers/$id" params={{ id: row.original.id }} className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors">
          {row.original.numero}
        </Link>
      ),
    }),
    columnHelper.accessor('dateEnvoi', {
      id: 'dateEnvoi',
      header: ({ column }) => <SortHeader column={column} label="Date de signature" />,
      cell: ({ getValue }) => <span className="whitespace-nowrap text-sm tabular-nums text-foreground/80">{formatDateFull(getValue())}</span>,
    }),
    columnHelper.accessor('signataire', {
      id: 'signataire',
      header: ({ column }) => <SortHeader column={column} label="Signataire" />,
      cell: ({ getValue }) => <span title={getValue()} className="block truncate text-sm text-muted-foreground">{getValue()}</span>,
      meta: { className: 'hidden lg:table-cell max-w-[10rem]' },
    }),
    columnHelper.accessor('destinataire', {
      id: 'destinataire',
      header: ({ column }) => <SortHeader column={column} label="Destinataire" />,
      cell: ({ getValue }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          <span title={getValue()} className="truncate text-sm text-foreground">{getValue()}</span>
        </div>
      ),
      meta: { className: 'max-w-[12rem]' },
    }),
    columnHelper.accessor('objet', {
      id: 'objet',
      header: ({ column }) => <SortHeader column={column} label="Objet" />,
      cell: ({ getValue }) => <ObjetCell text={getValue()} />,
      meta: { className: 'max-w-[13rem]' },
    }),
    columnHelper.accessor((r) => r.modeTransmission?.nom ?? '', {
      id: 'modeTransmission',
      header: ({ column }) => <SortHeader column={column} label="Mode" />,
      cell: ({ row }) => {
        const m = row.original.modeTransmission
        return m ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold"
            style={{ backgroundColor: `${m.couleur}14`, color: m.couleur }}
            data-testid="badge-mode"
          >
            {m.nom}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/40">-</span>
        )
      },
      meta: { className: 'whitespace-nowrap' },
    }),
    columnHelper.accessor((r) => r.situation.nom, {
      id: 'situation',
      header: ({ column }) => <SortHeader column={column} label="Situation" />,
      cell: ({ row }) => (
        <StatusBadge couleur={row.original.situation.couleur} nom={row.original.situation.nom} />
      ),
    }),
    columnHelper.accessor('numeroEntrant', {
      id: 'numeroEntrant',
      header: 'Réponse au courrier (N°)',
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="text-sm font-mono text-foreground/80">{getValue()}</span>
        ) : (
          <span className="text-sm text-muted-foreground/40">-</span>
        ),
      meta: { className: 'hidden lg:table-cell whitespace-nowrap' },
    }),
    columnHelper.accessor('dateArriveeEntrant', {
      id: 'dateArriveeEntrant',
      header: 'Date arrivée',
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? (
          <span className="whitespace-nowrap text-sm tabular-nums text-foreground/80">{formatDateFull(v)}</span>
        ) : (
          <span className="text-sm text-muted-foreground/40">-</span>
        )
      },
      meta: { className: 'hidden lg:table-cell whitespace-nowrap' },
    }),
    columnHelper.accessor('dateRetrait', {
      id: 'dateRetrait',
      header: 'Date de retrait',
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="whitespace-nowrap text-sm tabular-nums text-foreground/80" data-testid="cell-date-retrait">{getValue()}</span>
        ) : (
          <span className="text-sm text-muted-foreground/40">-</span>
        ),
      meta: { className: 'hidden lg:table-cell' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions c={row.original} handlers={handlers} />,
      meta: { className: 'w-10' },
    }),
  ] as ColumnDef<CourrierRow>[]
}

interface SortHeaderProps {
  column: import('@tanstack/react-table').Column<CourrierRow, unknown>
  label: string
}

function SortHeader({ column, label }: SortHeaderProps) {
  const sorted = column.getIsSorted()
  return (
    <button
      data-testid={`sort-${column.id}`}
      onClick={column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70 transition-colors hover:text-foreground data-[state=on]:text-foreground"
      data-state={sorted ? sorted : 'off'}
      title={`Trier par ${label}`}
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3 w-3" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  )
}

function ObjetCell({ text }: { text: string }) {
  return (
    <span data-testid="objet-tooltip" className="group/objet relative block">
      <span
        tabIndex={0}
        data-testid="objet-cell"
        className="block cursor-default truncate text-sm text-foreground transition-colors group-hover/objet:text-primary"
      >
        {text}
      </span>
      <span
        role="tooltip"
        data-testid="objet-tooltip-content"
        className="invisible absolute bottom-full left-0 z-50 mb-1.5 max-w-sm whitespace-normal rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground opacity-0 shadow-xl transition-all duration-150 group-hover/objet:visible group-hover/objet:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

interface CourrierTableProps {
  rows: CourrierRow[]
  sorting: SortingState
  seuils: DelaiSeuils
  hiddenCols: Set<string>
  actionRowId: string | null
  onActionRow: (id: string | null) => void
  canUpdate: boolean
  canDelete: boolean
  canPrint: boolean
  onDelete: (c: CourrierRow) => void
  onSortingChange: (s: SortingState) => void
}

function CourrierTable({ rows, sorting, seuils, hiddenCols, actionRowId, onActionRow, canUpdate, canDelete, canPrint, onDelete, onSortingChange }: CourrierTableProps) {
  const columnVisibility = useMemo(() => {
    const vis: Record<string, boolean> = {}
    for (const c of COLUMN_MENU) vis[c.key] = !hiddenCols.has(c.key)
    return vis
  }, [hiddenCols])

  const table = useReactTable<CourrierRow>({
    data: rows,
    columns: TableColumns({ actionRowId, onActionRow, canUpdate, canDelete, canPrint, onDelete }),
    state: { sorting, columnVisibility },
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      onSortingChange(next)
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
    onColumnVisibilityChange: () => {},
    meta: { seuils },
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/50">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const isSorted = header.column.getIsSorted()
                  const content = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())
                  return (
                    <th
                      key={header.id}
                      data-testid={`th-${header.id}`}
                      data-sorted={isSorted ? isSorted : undefined}
                      className={cn(
                        'px-2.5 py-3 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70',
                        isSorted && 'text-primary',
                        meta?.headerClassName,
                        meta?.className,
                        header.id === 'numero' && 'sticky left-0 z-20',
                        header.id === 'actions' && 'sticky right-0 z-20',
                      )}
                    >
                      {content}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-testid={`row-${row.original.numero}`}
                className="group transition-colors hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <td key={cell.id} className={cn('px-2.5 py-3 align-middle', meta?.className,
                      cell.column.id === 'numero' && 'sticky left-0 z-10 bg-card',
                      cell.column.id === 'actions' && 'sticky right-0 z-10 bg-card')}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* -------------------------------- Mobile cards -------------------------------- */

interface CardCourrierProps {
  c: CourrierRow
  seuils: DelaiSeuils
  index: number
  actionOpen: boolean
  onActionToggle: () => void
  canUpdate: boolean
  canDelete: boolean
  canPrint: boolean
  onDelete: (c: CourrierRow) => void
}

function CardCourrier({ c, seuils, index, actionOpen, onActionToggle, canUpdate, canDelete, canPrint, onDelete }: CardCourrierProps) {
  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground'
  return (
    <div className="relative rounded-2xl border border-border/70 bg-card shadow-card transition-all hover:shadow-card-hover">
      <Link
        to="/courriers/$id"
        params={{ id: c.id }}
        data-testid="courrier-card"
        className="block p-4 pr-10"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{c.numero}</span>
            {c.modeTransmission && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold"
                style={{ backgroundColor: `${c.modeTransmission.couleur}14`, color: c.modeTransmission.couleur }}
                data-testid="badge-mode"
              >
                {c.modeTransmission.nom}
              </span>
            )}
            <StatusBadge couleur={c.situation.couleur} nom={c.situation.nom} />
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{c.objet}</p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          {c.destinataire}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/70 pt-3 text-xs">
          <InfoItem label="Date de signature" value={formatDateFull(c.dateEnvoi)} />
          <InfoItem label="Signataire" value={c.signataire} />
          <InfoItem label="Réponse (N°)" value={c.numeroEntrant || '-'} mono />
          <InfoItem label="Date arrivée" value={c.dateArriveeEntrant ? formatDateFull(c.dateArriveeEntrant) : '-'} />
          <InfoItem label="Date de retrait" value={c.dateRetrait || '-'} />
        </dl>
      </Link>
      <button
        data-testid={`action-menu-mobile-${c.numero}`}
        onClick={onActionToggle}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {actionOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={onActionToggle} />
          <div className="absolute right-2 top-10 z-40 w-56 rounded-xl border border-border bg-card p-1.5 shadow-modal">
            <a href={`/courriers/${c.id}`} data-testid={`action-consulter-${c.numero}`} className={item}>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Consulter
            </a>
            {canUpdate && (
              <a href={`/courriers/${c.id}#situation`} data-testid={`action-situation-${c.numero}`} className={item}>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Mettre à jour la situation
              </a>
            )}
            <a href={`/courriers/${c.id}#historique`} data-testid={`action-historique-${c.numero}`} className={item}>
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              Voir l'historique
            </a>
            {canPrint && (
              <a href={`/courriers/${c.id}/fiche`} target="_blank" rel="noreferrer" data-testid={`action-imprimer-${c.numero}`} className={item}>
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                Imprimer la fiche
              </a>
            )}
            {canDelete && (
              <button
                data-testid={`action-supprimer-${c.numero}`}
                onClick={() => onDelete(c)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function InfoItem({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs uppercase tracking-wide text-muted-foreground/50">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-sm text-foreground', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

/* ---------------------------------- Empty states ---------------------------------- */

function EmptyCourriers({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  if (hasFilters) {
    return (
      <div data-testid="empty-no-results" className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/70 bg-card px-6 py-20 text-center shadow-card">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
          <Search className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Aucun courrier ne correspond à vos critères</p>
          <p className="mt-1 text-xs text-muted-foreground">Modifiez ou réinitialisez vos filtres de recherche.</p>
        </div>
        <Button variant="outline" size="sm" data-testid="btn-empty-reset" onClick={onReset}>
          <FilterX className="h-4 w-4" />
          Réinitialiser les filtres
        </Button>
      </div>
    )
  }
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border/70 bg-card px-6 py-20 text-center shadow-card">
      <div className="relative">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5">
          <Mail className="h-10 w-10 text-primary/40" />
        </div>
        <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Inbox className="h-3.5 w-3.5 text-primary" />
        </span>
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Aucun courrier disponible.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Importez un fichier Excel pour commencer le suivi des courriers sortants.
        </p>
      </div>
      <Link to="/import" className="inline-flex">
        <Button>
          <Upload className="h-4 w-4" />
          Importer un fichier Excel
        </Button>
      </Link>
    </div>
  )
}