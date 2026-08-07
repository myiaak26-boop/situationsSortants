import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Loader2, HardDrive, CalendarClock, Sheet as SheetIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { StepShell } from './stepper'
import { InspectResponse, REQUIRED_FIELDS, OPTIONAL_FIELDS, FIELD_LABELS, formatBytes } from '@/lib/import'

interface StepFileProps {
  file: File | null
  meta: InspectResponse | null
  busy: boolean
  error: string | null
  onFile: (f: File) => void
}

export function StepFile({ file, meta, busy, error, onFile }: StepFileProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <StepShell
      title="Sélection du fichier"
      description="Glissez-déposez un fichier Excel (.xlsx ou .xls) contenant les courriers sortants"
      icon={<FileSpreadsheet className="h-5 w-5" />}
    >
      <div
        role="button"
        tabIndex={0}
        data-testid="import-dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200',
          dragOver
            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = '' } }}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl transition-colors',
            file ? 'bg-primary/10' : 'bg-muted',
          )}>
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            ) : file ? (
              <FileSpreadsheet className="h-7 w-7 text-primary" />
            ) : (
              <Upload className="h-7 w-7 text-muted-foreground/60" />
            )}
          </div>
          <div className="space-y-1">
            {file ? (
              <p className="text-sm font-medium text-foreground">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Déposer le fichier ici ou <span className="text-primary">parcourir</span>
                </p>
                <p className="text-xs text-muted-foreground">Format .xlsx ou .xls — taille maximale 20 Mo</p>
              </>
            )}
          </div>
        </div>
      </div>

      {file && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-3 sm:grid-cols-3"
        >
          <FileInfoRow icon={<HardDrive className="h-4 w-4" />} label="Taille" value={formatBytes(file.size)} />
          <FileInfoRow
            icon={<CalendarClock className="h-4 w-4" />}
            label="Modifié le"
            value={new Date(file.lastModified).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          />
          <FileInfoRow
            icon={<SheetIcon className="h-4 w-4" />}
            label="Feuilles"
            value={meta ? String(meta.sheets.length) : '…'}
          />
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Fichier rejeté</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Colonnes attendues</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {REQUIRED_FIELDS.map((field) => (
            <div
              key={field}
              className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{FIELD_LABELS[field]}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {OPTIONAL_FIELDS.map((field) => (
            <span
              key={field}
              className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-2xs text-muted-foreground"
            >
              Facultatif : {FIELD_LABELS[field]}
            </span>
          ))}
        </div>
      </div>
    </StepShell>
  )
}

function FileInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground/70">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
