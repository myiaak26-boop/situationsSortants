import { COLORS, GRID, usableWidth, chartColorFor } from '../theme.js'
import { existsSync } from 'node:fs'
import { KPI_DEFS, TABLE_COL_DEFS, CHART_TITLES, CHART_NUMBERS, PAR_AUTEUR, KPI_NOTE, visibleKpis } from '../types.js'
import type { ReportTypeConfig, TableColId } from '../types.js'
import type { TableRow, SituationExecStats } from '../../situation-query.js'
import type { ExecCoverInfo } from './index.js'
import {
  sectionTitle,
  sectionSub,
  kpiGrid,
  kpiHero,
  kpiNote,
  fmtDate,
  fmtDateShort,
  fmtNum,
  drawTable,
  addReportPage,
  type Ctx,
  type TableCol,
  type TableRowData,
} from './components.js'
import { barChart, hbarChart, donutChart, lineChart, areaChart, inlineBars } from './charts.js'

const { marginL: ML, marginR: MR } = GRID

// ---------------------------------------------------------------------------
// 1. Couverture (+ synthèse KPI)
// ---------------------------------------------------------------------------
export function drawCover(c: Ctx, stats: SituationExecStats, config: ReportTypeConfig) {
  const { doc, cover } = c
  doc.save()

  const bandeH = 8
  doc.rect(0, 0, GRID.pageW, bandeH).fill(COLORS.teal)
  doc.rect(0, bandeH, GRID.pageW, 2).fill(COLORS.tealDark)
  doc.rect(0, GRID.pageH - 4, GRID.pageW, 4).fill(COLORS.ink)

  const centerX = GRID.pageW / 2

  if (cover.confidentiel) {
    const stampY = 34
    doc.save()
    doc.fillColor(COLORS.red)
    doc.roundedRect(centerX - 55, stampY - 8, 110, 16, 2).fill()
    doc.fillColor(COLORS.white).font(c.B).fontSize(7.5)
    doc.text('CONFIDENTIEL', centerX, stampY - 4, { width: 110, align: 'center', lineBreak: false })
    doc.restore()
  }

  // Identité institutionnelle remontée : République → Devise → Primature →
  // Secrétariat Central et Documentation (service de la Primature).
  let headerY = 64
  if (cover.logoPath && existsSync(cover.logoPath)) {
    try {
      doc.image(cover.logoPath, centerX - 60, headerY - 12, { fit: [120, 52], align: 'center', valign: 'center' })
      headerY += 56
    } catch {
      // logo illisible ou format non supporté : on continue sans
    }
  }

  doc.fillColor(COLORS.teal).font(c.B).fontSize(17)
  doc.text(cover.republique, 0, headerY, { align: 'center', width: GRID.pageW })
  doc.fillColor(COLORS.muted).font(c.IT).fontSize(10.5)
  doc.text(cover.devise, 0, headerY + 22, { align: 'center', width: GRID.pageW })
  doc.fillColor(COLORS.ink).font(c.B).fontSize(13)
  doc.text('PRIMATURE', 0, headerY + 50, { align: 'center', width: GRID.pageW })
  doc.fillColor(COLORS.slate).font(c.F).fontSize(11)
  doc.text(cover.institutionNom, 0, headerY + 69, { align: 'center', width: GRID.pageW })

  // Filet puis titre du rapport
  const ruleY = Math.max(210, headerY + 92)
  doc.save().strokeColor(COLORS.teal).lineWidth(1.1)
  doc.moveTo(ML + 70, ruleY).lineTo(GRID.pageW - MR - 70, ruleY).stroke()
  doc.restore()

  doc.fillColor(COLORS.ink).font(c.B).fontSize(23)
  doc.text(cover.titre, 0, ruleY + 30, { align: 'center', width: GRID.pageW })

  // Bloc d'identification du rapport : Période, Date d'élaboration, Par (fixe).
  // Le numéro SCD n'est plus affiché sur la couverture.
  const metaY = ruleY + 66
  const metaW = 500
  const metaX = centerX - metaW / 2
  const periodeAffiche =
    cover.periodeDebut && cover.periodeFin
      ? `Du ${fmtDate(new Date(`${cover.periodeDebut}T12:00:00`))} au ${fmtDate(new Date(`${cover.periodeFin}T12:00:00`))}`
      : cover.periode
  const meta: [string, string][] = [
    ['Période', periodeAffiche],
    ["Date d'élaboration", fmtDate(cover.genereLe)],
    ['Par', PAR_AUTEUR],
  ]
  const rowH = 40
  const padY = 14
  const metaH = meta.length * rowH + padY * 2
  doc.save()
  doc.fillColor(COLORS.panel)
  doc.roundedRect(metaX, metaY, metaW, metaH, GRID.radius).fill()
  doc.strokeColor(COLORS.hair).lineWidth(0.7)
  doc.roundedRect(metaX, metaY, metaW, metaH, GRID.radius).stroke()
  doc.restore()
  let my = metaY + padY
  meta.forEach(([label, value], idx) => {
    if (idx > 0) {
      doc.save().strokeColor(COLORS.hair).lineWidth(0.5)
      doc.moveTo(metaX + 14, my - 4).lineTo(metaX + metaW - 14, my - 4).stroke()
      doc.restore()
    }
    if (label) {
      doc.fillColor(COLORS.muted).font(c.B).fontSize(7.5)
      doc.text(label.toUpperCase(), metaX + 16, my, { width: metaW - 32, lineBreak: false })
    }
    doc.fillColor(COLORS.ink).font(c.B).fontSize(11)
    doc.text(value, metaX + 16, my + (label ? 11 : 0), { width: metaW - 32, lineBreak: false })
    my += rowH
  })

  // Synthèse KPI sur la couverture, sous le bloc d'identification : TOTAL en
  // carte dominante, les autres indicateurs en second plan, note discrète.
  doc.y = metaY + metaH + 10
  const visible = visibleKpis(config, stats)
  const tileOf = (id: (typeof visible)[number]) => {
    const def = KPI_DEFS[id]
    return { label: def.label, value: def.value(stats), glyph: def.glyph, color: def.color }
  }
  const aTotal = visible.includes('total')
  if (aTotal) kpiHero(c, tileOf('total'))
  const secondaires = visible.filter((id) => id !== 'total').map(tileOf)
  if (secondaires.length > 0) kpiGrid(c, secondaires)
  if (aTotal) kpiNote(c, KPI_NOTE)

  doc.restore()
}

// ---------------------------------------------------------------------------
// 2. Tableau détaillé
// ---------------------------------------------------------------------------
function tableValue(r: TableRow, colId: TableColId): string {
  switch (colId) {
    case 'dateEnvoi':
      return fmtDateShort(new Date(r.dateEnvoi))
    case 'dateArriveeEntrant':
      return r.dateArriveeEntrant ? fmtDateShort(new Date(r.dateArriveeEntrant)) : '—'
    case 'dateRetrait':
      return r.retrait ? fmtDateShort(new Date(r.retrait.dateRetrait)) : '—'
    case 'situation':
      return r.situation.nom
    case 'modeTransmission':
      return r.modeTransmission?.nom || '—'
    case 'nomRetraitant':
      return r.retrait?.nomRetraitant || '—'
    case 'telephone':
      return r.retrait?.telephone || '—'
    case 'delaiReponse': {
      // Durée de traitement : date du courrier sortant − date d'arrivée du
      // courrier entrant. Sans courrier entrant associé : aucun délai calculé.
      if (!r.dateArriveeEntrant) return '—'
      const j = Math.round((new Date(r.dateEnvoi).getTime() - new Date(r.dateArriveeEntrant).getTime()) / 86400000)
      if (j < 0) return '—'
      if (j === 0) return "Moins d'un jour"
      return `${j} jour${j > 1 ? 's' : ''}`
    }
    case 'delaiTraitement': {
      if (!r.retrait) return '—'
      const j = Math.round((new Date(r.retrait.dateRetrait).getTime() - new Date(r.dateEnvoi).getTime()) / 86400000)
      return j >= 0 ? `${j} j` : '—'
    }
    default: {
      const v = (r as unknown as Record<string, unknown>)[colId]
      return v == null || v === '' ? '—' : String(v)
    }
  }
}

function groupKeyOf(r: TableRow, groupBy: string | null): { key?: string; label?: string } {
  switch (groupBy) {
    case 'signataire':
      return { key: r.signataire || 'Inconnu', label: r.signataire || 'Inconnu' }
    case 'situation':
      return { key: r.situation.nom, label: r.situation.nom }
    case 'destinataire':
      return { key: r.destinataire || 'Inconnu', label: r.destinataire || 'Inconnu' }
    default:
      return {}
  }
}

export function drawDetailedTablePage(c: Ctx, rows: TableRow[], config: ReportTypeConfig) {
  const { doc } = c
  addReportPage(c, 'landscape')
  sectionTitle(c, 'Tableau détaillé des courriers', '4')
  doc.moveDown(0.2)
  sectionSub(c, `${fmtNum(rows.length)} courriers — triés par date de signature croissante`)
  doc.moveDown(0.25)

  // Colonnes vides sur la sélection : adaptées (masquées) pour ne pas laisser
  // de zone blanche et donner plus de largeur aux colonnes de texte.
  const cols: TableCol[] = config.cols
    .filter((id) => rows.some((r) => tableValue(r, id) !== '—'))
    .map((id) => {
      const def = TABLE_COL_DEFS[id]
      return {
        id,
        header: def.header,
        w: def.w,
        bold: id === 'numero',
        badge: id === 'situation' || id === 'modeTransmission',
      }
    })

  const data: TableRowData[] = rows.map((r) => {
    const cells: Record<string, string> = {}
    for (const col of cols) cells[col.id] = tableValue(r, col.id as TableColId)
    const badgeColors: Record<string, string> = {}
    if (cols.some((col) => col.id === 'situation')) badgeColors['situation'] = r.situation.couleur || COLORS.teal
    if (cols.some((col) => col.id === 'modeTransmission') && r.modeTransmission?.couleur) badgeColors['modeTransmission'] = r.modeTransmission.couleur
    const g = groupKeyOf(r, config.groupBy)
    return {
      cells,
      badgeColors,
      groupKey: g.key,
      groupLabel: g.label,
    }
  })

  drawTable(c, cols, data, { totalLabel: `TOTAL — ${fmtNum(rows.length)} courriers`, totalValue: fmtNum(rows.length) })
}

// ---------------------------------------------------------------------------
// 3. Répartitions (graphiques) — après le tableau détaillé
// ---------------------------------------------------------------------------
function chartData(stats: SituationExecStats, chart: string): { label: string; value: number }[] | null {
  switch (chart) {
    case 'signataire': {
      const e = Object.entries(stats.parSignataire)
      return e.length ? e.map(([label, value]) => ({ label, value })) : null
    }
    case 'situation': {
      const e = Object.entries(stats.parSituation)
      return e.length ? e.map(([label, value]) => ({ label, value })) : null
    }
    case 'mode': {
      const e = Object.entries(stats.parModeTransmission)
      return e.length ? e.map(([label, value]) => ({ label, value })) : null
    }
    case 'destinataire': {
      const e = Object.entries(stats.parDestinataire)
      return e.length ? e.map(([label, value]) => ({ label, value })) : null
    }
    case 'delais': {
      const e = stats.repartitionDelais.map((d) => ({ label: d.libelle, value: d.count }))
      return e.length ? e : null
    }
    default:
      return null
  }
}

export function drawCharts(c: Ctx, stats: SituationExecStats, config: ReportTypeConfig) {
  const { doc } = c
  if (doc.y > GRID.marginTop + 60) addReportPage(c, 'portrait')

  let slot = 1
  const colorMap = new Map<string, string>()
  const allData = config.charts
    .map((id) => ({ id, data: chartData(stats, id) }))
    .filter((d): d is { id: (typeof config.charts)[number]; data: { label: string; value: number }[] } => d.data !== null)

  for (const item of allData) {
    for (const d of item.data) chartColorFor(d.label, colorMap)
  }

  const evoData = stats.evolution.length ? stats.evolution.map((e) => ({ label: e.libelle, total: e.total })) : null

  for (const item of allData) {
    // Sections 4.1 à 4.4 : structure fixe du rapport (répartitions).
    const num = CHART_NUMBERS[item.id] ?? `${slot}.`
    const title = `${num} ${CHART_TITLES[item.id]}`
    switch (item.id) {
      case 'signataire':
        barChart(c, item.data, { title, color: COLORS.teal })
        break
      case 'delais':
        barChart(c, item.data, { title, color: COLORS.amber })
        break
      case 'destinataire':
        inlineBars(c, item.data, { title, color: COLORS.teal })
        break
      case 'situation':
        donutChart(c, item.data, { title, colors: colorMap })
        break
      case 'mode':
        hbarChart(c, item.data, { title, colors: colorMap })
        break
      case 'evolution':
        if (evoData) {
          if (item.data.length > 24) areaChart(c, evoData, { title, color: COLORS.blue })
          else lineChart(c, evoData, { title, color: COLORS.blue })
        }
        break
    }
    slot++
    doc.moveDown(0.4)
  }
}

// ---------------------------------------------------------------------------
// Annexes (données transmises à l'export Excel)
// ---------------------------------------------------------------------------
export interface AnnexesData {
  historique?: { numero: string; action: string; detail: string; user: string; date: string }[]
  signataires?: { code: string; nom: string }[]
}
