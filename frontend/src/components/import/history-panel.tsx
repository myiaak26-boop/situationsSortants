import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { History, FileSpreadsheet, Clock, User, Loader2, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, CardHeader } from '@/components/ui/card'
import { ImportLog, fetchImportHistory, formatDuration } from '@/lib/import'

const resultStyles: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  cancelled: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

const resultLabels: Record<string, string> = {
  success: 'Succès',
  partial: 'Partiel',
  cancelled: 'Annulé',
  error: 'Échec',
}

export function ImportHistory({ trigger }: { trigger: number }) {
  const [logs, setLogs] = useState<ImportLog[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchImportHistory()
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [trigger])

  return (
    <Card padding={false}>
      <CardHeader
        title="Journal des imports"
        subtitle="Historique des importations de courriers sortants"
        icon={<History className="h-4 w-4" />}
        action={<FileSpreadsheet className="h-4 w-4 text-muted-foreground/40" />}
      />
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/20" />
          <p className="text-sm font-medium text-foreground">Aucun import enregistré</p>
          <p className="text-xs text-muted-foreground">Les imports réalisés apparaîtront ici.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Fichier</th>
                <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Utilisateur</th>
                <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Date</th>
                <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Lignes</th>
                <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Importés / MAJ / Err.</th>
                <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Durée</th>
                <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log, i) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="transition-colors hover:bg-muted/20"
                >
                  <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-foreground">{log.fileName}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    <span className="flex items-center gap-1.5"><User className="h-3 w-3" />{log.userName}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{log.nbLignes.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                    {log.nbImportes.toLocaleString('fr-FR')} / {log.nbMaj.toLocaleString('fr-FR')} / {log.nbErreurs.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatDuration(log.dureeMs)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-2xs font-medium', resultStyles[log.resultat] || resultStyles.error)}>
                      {resultLabels[log.resultat] || log.resultat}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}