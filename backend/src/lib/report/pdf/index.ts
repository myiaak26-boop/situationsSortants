import PDFDocument from 'pdfkit'
import { setupFonts, addFooters, type Ctx } from './components.js'
import type { TableRow, SituationExecStats } from '../../situation-query.js'
import { reportConfigFor } from '../types.js'
import type { ReportTypeConfig } from '../types.js'
import { buildSignataireMap, signataireCode, hasSignataireCode, type SignataireInfo } from '../signataires.js'
import { drawCover, drawCharts, drawDetailedTablePage, type AnnexesData } from './pages.js'

export interface ExecCoverInfo {
  institutionNom: string
  republique: string
  devise: string
  logoPath: string
  titre: string
  periode: string
  periodeDebut?: string
  periodeFin?: string
  filtresTexte?: string
  numeroRapport: string
  utilisateur: string
  signataireNom?: string
  genereLe: Date
  confidentiel?: boolean
}

export interface ExecPdfInput {
  cover: ExecCoverInfo
  rows: TableRow[]
  stats: SituationExecStats
  config?: ReportTypeConfig
  annexes?: AnnexesData
  compact?: boolean
  signataires?: SignataireInfo[]
}

export async function generateExecPdf(input: ExecPdfInput): Promise<Buffer> {
  const { cover, rows, stats } = input
  const config = input.config ?? reportConfigFor(undefined)
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

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 0,
    bufferPages: true,
    info: {
      Title: `${cover.titre} — ${cover.periode}`,
      Author: cover.utilisateur || 'DEX',
      Creator: 'DEX',
      Subject: 'Situation des courriers sortants',
      Keywords: 'situation, courriers, suivi, Primature',
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => {
    doc.once('end', () => resolve(Buffer.concat(chunks)))
  })

  const fonts = setupFonts(doc)
  doc.font(fonts.F)

  const c: Ctx = { doc, cover, ...fonts }

  // Structure : couverture + synthèse KPI (page 1), tableau détaillé
  // (page 2 et suivantes), répartitions graphiques (dernières pages).
  drawCover(c, statsAffichage, config)
  drawDetailedTablePage(c, rowsAffichage, config)
  if (!compact) {
    drawCharts(c, statsAffichage, config)
  }
  addFooters(c)

  doc.end()
  return done
}
