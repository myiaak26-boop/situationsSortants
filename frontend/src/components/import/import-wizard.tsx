import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Stepper } from './stepper'
import { StepFile } from './step-file'
import { StepSheet, StepPreview } from './step-sheet-preview'
import { StepMapping } from './step-mapping'
import { StepValidate } from './step-validate'
import { StepImport } from './step-progress-report'
import {
  InspectResponse,
  SheetResponse,
  ColumnMapping,
  ValidationReport,
  ProgressSnapshot,
  FinalReport,
  fetchSheet,
  inspectFile,
  validateRows,
  startImport,
  fetchProgress,
  cancelImport,
  fetchResult,
} from '@/lib/import'

const POLL_INTERVAL_MS = 1500

export function ImportWizard() {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [meta, setMeta] = useState<InspectResponse | null>(null)
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetResponse | null>(null)
  const [detectedMapping, setDetectedMapping] = useState<ColumnMapping | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [validation, setValidation] = useState<ValidationReport | null>(null)
  const [duplicatePolicy, setDuplicatePolicy] = useState<'ignore' | 'update'>('ignore')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null)
  const [report, setReport] = useState<FinalReport | null>(null)

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = useCallback((s: number) => {
    setStep(s)
    setMaxReached((m) => Math.max(m, s))
  }, [])

  const reset = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    setFile(null); setMeta(null); setSheetName(null); setSheet(null); setDetectedMapping(null)
    setMapping(null); setValidation(null); setDuplicatePolicy('ignore')
    setJobId(null); setProgress(null); setReport(null); setError(null); setBusy(false)
    setStep(1); setMaxReached(1)
  }, [])

  const handleFile = useCallback(async (f: File) => {
    setError(null)
    setFile(f)
    setMeta(null); setSheetName(null); setSheet(null); setDetectedMapping(null)
    setMapping(null); setValidation(null); setJobId(null); setProgress(null); setReport(null)
    setStep(1); setMaxReached(1)

    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase()
    if (!['.xlsx', '.xls'].includes(ext)) {
      setError(`Format non supporté : « ${ext || '(aucune extension)'} ». Formats acceptés : .xlsx, .xls`)
      return
    }
    setBusy(true)
    try {
      const m = await inspectFile(f)
      setMeta(m)
      goTo(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lire le fichier')
    } finally {
      setBusy(false)
    }
  }, [goTo])

  const handleSelectSheet = useCallback(async (name: string) => {
    if (!meta) return
    setSheetName(name)
    setSheet(null)
    setBusy(true)
    setError(null)
    try {
      const s = await fetchSheet(meta.token, name)
      setSheet(s)
      setDetectedMapping(s.detectedMapping)
      setMapping(s.detectedMapping)
      setValidation(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’analyser la feuille')
    } finally {
      setBusy(false)
    }
  }, [meta])

  useEffect(() => {
    if (step === 2 && meta && meta.sheets.length === 1 && !sheetName) {
      void handleSelectSheet(meta.sheets[0].name)
      goTo(2)
    }
  }, [step, meta, sheetName, handleSelectSheet, goTo])

  useEffect(() => {
    if (step !== 5 || validation || !meta || !sheetName || !mapping || busy) return
    setBusy(true)
    setError(null)
    validateRows(meta.token, sheetName, mapping)
      .then((v) => { setValidation(v); if (v.valid) goTo(5) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de validation'))
      .finally(() => setBusy(false))
  }, [step, validation, meta, sheetName, mapping, busy, goTo])

  const handleImport = useCallback(async () => {
    if (!meta || !sheetName || !mapping) return
    setBusy(true)
    setError(null)
    try {
      const { jobId: id } = await startImport(meta.token, sheetName, mapping, duplicatePolicy)
      setJobId(id)
      setProgress({ status: 'running', processed: 0, total: 0, importes: 0, ignores: 0, maj: 0, erreurs: 0, cancelRequested: false })
      goTo(6)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer l’import')
      setBusy(false)
    }
  }, [meta, sheetName, mapping, duplicatePolicy, goTo])

  useEffect(() => {
    if (!jobId) return
    pollTimer.current = setInterval(async () => {
      try {
        const p = await fetchProgress(jobId)
        setProgress(p)
        if (p.status !== 'running') {
          if (pollTimer.current) clearInterval(pollTimer.current)
          const r = await fetchResult(jobId)
          setReport(r)
          setProgress((prev) => (prev ? { ...prev, ...p } : prev))
          setBusy(false)
        }
      } catch {
        /* réessai au prochain tick */
      }
    }, POLL_INTERVAL_MS)
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [jobId])

  const handleCancel = useCallback(() => {
    if (jobId) void cancelImport(jobId)
  }, [jobId])

  const handleNewImport = useCallback(() => {
    reset()
  }, [reset])

  const handleViewCourriers = useCallback(() => {
    navigate({ to: '/courriers' })
  }, [navigate])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-card backdrop-blur-sm"
      >
        <Stepper current={step} maxReached={maxReached} />
      </motion.div>

      {error && step !== 1 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <StepFile key="s1" file={file} meta={meta} busy={busy} error={error} onFile={handleFile} />
        )}
        {step === 2 && meta && (
          <StepSheet
            key="s2"
            sheets={meta.sheets}
            busy={busy}
            selected={sheetName}
            onSelect={handleSelectSheet}
            onNext={() => { if (sheetName && sheet) goTo(3) }}
            onBack={() => goTo(1)}
          />
        )}
        {step === 3 && meta && sheetName && sheet && (
          <StepPreview
            key="s3"
            sheetName={sheetName}
            fileName={meta.fileName}
            size={meta.size}
            sheet={sheet}
            busy={busy}
            onNext={() => goTo(4)}
            onBack={() => goTo(2)}
          />
        )}
        {step === 4 && sheet && mapping && (
          <StepMapping
            key="s4"
            columns={sheet.columns}
            mapping={mapping}
            detectedMapping={detectedMapping ?? mapping}
            onChange={setMapping}
            onReset={() => { if (detectedMapping) setMapping({ ...detectedMapping }) }}
            onNext={() => goTo(5)}
            onBack={() => goTo(3)}
          />
        )}
        {step === 5 && meta && sheetName && mapping && (
          <StepValidate
            key="s5"
            busy={busy}
            report={validation}
            duplicatePolicy={duplicatePolicy}
            onPolicyChange={setDuplicatePolicy}
            onImport={handleImport}
            onBack={() => goTo(4)}
          />
        )}
        {step === 6 && (
          <StepImport
            key="s6"
            jobId={jobId}
            progress={progress}
            report={report}
            busy={busy}
            error={error}
            onCancel={handleCancel}
            onViewCourriers={handleViewCourriers}
            onNewImport={handleNewImport}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
