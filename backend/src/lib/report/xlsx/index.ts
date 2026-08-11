import XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { buildCover, buildSynthese, buildComplet, buildStatsSheets, buildReponses, buildHistorique, buildAuditInterne, type AuditInterne } from './sheets.js'
import { reportConfigFor, TABLE_COL_DEFS } from '../types.js'
import type { ReportTypeConfig, TableColId } from '../types.js'
import type { TableRow, SituationExecStats } from '../../situation-query.js'
import type { AnnexesData } from '../pdf/pages.js'
import { buildSignataireMap, signataireCode, hasSignataireCode, type SignataireInfo } from '../signataires.js'

export interface ExecXlsxInput {
  institutionNom: string
  republique: string
  devise: string
  titre: string
  periode: string
  filtresTexte?: string
  numeroRapport: string
  utilisateur: string
  genereLe: Date
  stats: SituationExecStats
  rows: TableRow[]
  config?: ReportTypeConfig
  annexes?: AnnexesData
  compact?: boolean
  signataires?: SignataireInfo[]
  auditInterne?: AuditInterne
}

export async function generateExecXlsx(input: ExecXlsxInput): Promise<Buffer> {
  const { stats, rows, numeroRapport, utilisateur, institutionNom, republique, devise, titre, periode, genereLe } = input
  const config = input.config ?? reportConfigFor(undefined)
  const annexes = input.annexes ?? {}
  const compact = !!input.compact

  const sigMap = buildSignataireMap(input.signataires ?? [])
  const rowsAffichage: TableRow[] =
    sigMap.size > 0
      ? rows.map((r) => (hasSignataireCode(r.signataire, sigMap) ? { ...r, signataire: signataireCode(r.signataire, sigMap) } : r))
      : rows
  const statsAffichage: SituationExecStats =
    sigMap.size > 0
      ? {
          ...stats,
          parSignataire: Object.fromEntries(Object.entries(stats.parSignataire).map(([k, v]) => [signataireCode(k, sigMap), v])),
        }
      : stats

  const cover = { republique, institutionNom, devise, titre, numeroRapport, utilisateur, genereLe }
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, buildCover(cover, periode), 'Couverture')
  XLSX.utils.book_append_sheet(wb, buildSynthese(cover, statsAffichage, config, { inlineTable: compact, rows: rowsAffichage }, periode), 'Synthèse')
  XLSX.utils.book_append_sheet(wb, buildComplet(rowsAffichage, config), 'Situation complète')

  if (!compact) {
    for (const s of buildStatsSheets(statsAffichage)) {
      XLSX.utils.book_append_sheet(wb, s.ws, s.name)
    }
    if (annexes.historique && annexes.historique.length > 0) {
      XLSX.utils.book_append_sheet(wb, buildHistorique(annexes.historique), 'Historique')
    }
    const hasReponses = config.annexes.includes('reponses') && rows.some((r) => r.numeroEntrant)
    if (hasReponses) {
      XLSX.utils.book_append_sheet(wb, buildReponses(rows), 'Courriers réponses')
    }
    if (input.auditInterne) {
      XLSX.utils.book_append_sheet(wb, buildAuditInterne(input.auditInterne), 'Audit interne')
    }
  }

  return injectSheetPatches(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), config)
}

// SheetJS CE n'écrit ni !cols ni !freeze : on réinjecte ces propriétés de mise
// en page avec exceljs (gel de l'en-tête + largeurs réelles des colonnes).
async function injectSheetPatches(buf: Buffer, config: ReportTypeConfig): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.calcProperties = { fullCalcOnLoad: true }
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  for (const ws of wb.worksheets) {
    const landscape = ws.name === 'Situation complète'
    ws.pageSetup = {
      paperSize: 9,
      orientation: landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    }
  }
  const ws = wb.getWorksheet('Situation complète')
  if (ws) {
    ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
    ws.columns = config.cols.map((id: TableColId) => ({ width: Math.min(TABLE_COL_DEFS[id].w, 30) }))
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
