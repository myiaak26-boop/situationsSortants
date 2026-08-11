import { COLORS, GRID, tint, usableWidth, chartColorFor } from '../theme.js'
import { existsSync } from 'node:fs'
import { KPI_DEFS, TEMPORAL_DEFS, TABLE_COL_DEFS, CHART_TITLES, visibleKpis, fmtJours, fmtPct } from '../types.js'
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
// 1. Couverture
// ---------------------------------------------------------------------------
export function drawCover(c: Ctx) {
  const { doc, cover } = c
  doc.save()

  const bandeH = 8
  doc.rect(0, 0, GRID.pageW, bandeH).fill(COLORS.teal)
  doc.rect(0, bandeH, GRID.pageW, 2).fill(COLORS.tealDark)
  doc.rect(0, GRID.pageH - 4, GRID.pageW, 4).fill(COLORS.ink)

  const centerX = GRID.pageW / 2

  if (cover.confidentiel) {
    const stampY = 48
    doc.save()
    doc.fillColor(COLORS.red)
    doc.roundedRect(centerX - 55, stampY - 8, 110, 16, 2).fill()
    doc.fillColor(COLORS.white).font(c.B).fontSize(7.5)
    doc.text('CONFIDENTIEL', centerX, stampY - 4, { width: 110, align: 'center', lineBreak: false })
    doc.restore()
  }

  let headerY = 96
  if (cover.logoPath && existsSync(cover.logoPath)) {
    try {
      doc.image(cover.logoPath, centerX - 60, headerY - 30, { fit: [120, 60], align: 'center', valign: 'center' })
      headerY += 60
    } catch {
      // logo illisible ou format non supporté : on continue sans
    }
  }

  // Hiérarchie institutionnelle : République → Devise → Primature → Secrétariat
  doc.fillColor(COLORS.teal).font(c.B).fontSize(17)
  doc.text(cover.republique, 0, headerY, { align: 'center', width: GRID.pageW })
  doc.fillColor(COLORS.muted).font(c.IT).fontSize(10.5)
  doc.text(cover.devise, 0, headerY + 23, { align: 'center', width: GRID.pageW })
  doc.fillColor(COLORS.ink).font(c.B).fontSize(13)
  doc.text('PRIMATURE', 0, headerY + 55, { align: 'center', width: GRID.pageW })
  doc.fillColor(COLORS.slate).font(c.F).fontSize(11)
  doc.text(cover.institutionNom, 0, headerY + 76, { align: 'center', width: GRID.pageW })

  // Grand espace, puis titre du rapport
  const ruleY = Math.max(262, headerY + 102)
  doc.save().strokeColor(COLORS.teal).lineWidth(1.1)
  doc.moveTo(ML + 70, ruleY).lineTo(GRID.pageW - MR - 70, ruleY).stroke()
  doc.restore()

  doc.fillColor(COLORS.ink).font(c.B).fontSize(23)
  doc.text(cover.titre, 0, ruleY + 38, { align: 'center', width: GRID.pageW })

  // Bloc d'identification du rapport : Période, Date d'élaboration, Par, Numéro
  const metaY = 392
  const metaW = 500
  const metaX = centerX - metaW / 2
  const periodeAffiche =
    cover.periodeDebut && cover.periodeFin
      ? `Du ${fmtDate(new Date(`${cover.periodeDebut}T12:00:00`))} au ${fmtDate(new Date(`${cover.periodeFin}T12:00:00`))}`
      : cover.periode
  const meta: [string, string][] = [
    ['Période', periodeAffiche],
    ["Date d'élaboration", fmtDate(cover.genereLe)],
    ['Par', cover.utilisateur || '—'],
    ['', `N° ${cover.numeroRapport}`],
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

  doc.restore()
  addReportPage(c)
}

// ---------------------------------------------------------------------------
// 2. Synthèse exécutive
// ---------------------------------------------------------------------------
export function drawSummary(c: Ctx, stats: SituationExecStats, config: ReportTypeConfig) {
  const { doc } = c
  if (doc.y > GRID.marginTop + 90) addReportPage(c, 'portrait')
  sectionTitle(c, 'Synthèse exécutive', '1')

  const pl = (n: number) => (n > 1 ? 's' : '')
  const intro =
    `La présente situation fait état de ${fmtNum(stats.total)} courrier${pl(stats.total)} sortant${pl(stats.total)} sur la période considérée, ` +
    `dont ${fmtNum(stats.courriersSimples)} courrier${pl(stats.courriersSimples)} simple${pl(stats.courriersSimples)} ` +
    `et ${fmtNum(stats.courriersReponses)} courrier${pl(stats.courriersReponses)} réponse${pl(stats.courriersReponses)} ` +
    `(${fmtNum(stats.reponsesEntrant)} réponse${pl(stats.reponsesEntrant)} à un courrier entrant). ` +
    `${stats.tauxRetrait == null ? 'Aucun courrier n’a été retiré sur la période.' : `${fmtNum(stats.retires)} courrier${pl(stats.retires)} retiré${pl(stats.retires)}, soit un taux de ${fmtPct(stats.tauxRetrait)}.`}`
  sectionSub(c, intro)

  // Fix #3 — hiérarchie visuelle : TOTAL en carte dominante, les autres KPI
  // en second plan (ils ne s'additionnent pas au total).
  const visible = visibleKpis(config, stats)
  const aTotal = visible.includes('total')
  const tileOf = (id: (typeof visible)[number]) => {
    const def = KPI_DEFS[id]
    return { label: def.label, value: def.value(stats), glyph: def.glyph, color: def.color }
  }
  if (aTotal) kpiHero(c, tileOf('total'))
  const secondaires = visible.filter((id) => id !== 'total').map(tileOf)
  if (secondaires.length > 0) kpiGrid(c, secondaires)
  if (aTotal) {
    kpiNote(c, 'Note : SIMPLES + RÉPONSES = TOTAL ; RETIRÉS, LIVRÉS, NOUVEAUX et INJOIGNABLES sont des statuts de suivi distincts.')
  }

  if (config.temporals.length > 0) {
    sectionTitle(c, 'Indicateurs temporels', '2')
    const timeRows: [string, string][] = config.temporals.map((id) => [TEMPORAL_DEFS[id].label, TEMPORAL_DEFS[id].value(stats)])
    timeRows.forEach(([label, value], idx) => {
      const ry = doc.y
      if (idx % 2 === 1) {
        doc.save().fillColor(COLORS.panel).rect(ML, ry, usableWidth(), 22).fill().restore()
      }
      doc.fillColor(COLORS.muted).font(c.F).fontSize(9)
      doc.text(label, ML + 10, ry + 6, { width: usableWidth() * 0.6 })
      doc.fillColor(COLORS.ink).font(c.B).fontSize(9.5)
      doc.text(String(value), ML + usableWidth() - 120, ry + 6, { width: 110, align: 'right' })
      doc.y += 22
    })
    doc.moveDown(0.4)
  }
}

// ---------------------------------------------------------------------------
// 3. Graphiques
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
  sectionTitle(c, 'Graphiques et analyse', '3')

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
    const title = `${slot}.${CHART_TITLES[item.id]}`
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
// 4. Tableau détaillé
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
      if (!r.dateArriveeEntrant) return '—'
      const j = Math.round((new Date(r.dateEnvoi).getTime() - new Date(r.dateArriveeEntrant).getTime()) / 86400000)
      return j >= 0 ? `${j} j` : '—'
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
// 5. Conclusion
// ---------------------------------------------------------------------------
function plu(n: number): string {
  return n > 1 ? 's' : ''
}

function pctOf(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0
}

export function drawConclusion(c: Ctx, stats: SituationExecStats) {
  const { doc } = c
  addReportPage(c, 'portrait')
  sectionTitle(c, 'Conclusion', '5')

  const lignes: string[] = []

  lignes.push(
    `Au cours de la période analysée, ${fmtNum(stats.total)} courrier${plu(stats.total)} sortant${plu(stats.total)} ont été enregistrés, ` +
      `dont ${fmtNum(stats.courriersSimples)} courrier${plu(stats.courriersSimples)} simple${plu(stats.courriersSimples)} ` +
      `et ${fmtNum(stats.courriersReponses)} courrier${plu(stats.courriersReponses)} réponse${plu(stats.courriersReponses)}.`,
  )

  const situations = Object.entries(stats.parSituation).sort((a, b) => b[1] - a[1])
  if (situations.length > 0) {
    lignes.push('Répartition par situation de suivi :')
    for (const [nom, nb] of situations) {
      lignes.push(`${nom} : ${fmtNum(nb)} (${fmtPct(pctOf(nb, stats.total))})`)
    }
  }

  const modes = Object.entries(stats.parModeTransmission).sort((a, b) => b[1] - a[1])
  if (modes.length > 0) {
    lignes.push('Répartition par mode de transmission :')
    for (const [nom, nb] of modes) {
      lignes.push(`${nom} : ${fmtNum(nb)} (${fmtPct(pctOf(nb, stats.total))})`)
    }
  }

  if (stats.retires > 0) {
    lignes.push(`${fmtNum(stats.retires)} courrier${plu(stats.retires)} retiré${plu(stats.retires)} sur la période, soit ${fmtPct(stats.tauxRetrait ?? 0)} de l'ensemble.`)
  }
  if (stats.injoignables > 0) {
    lignes.push(`${fmtNum(stats.injoignables)} courrier${plu(stats.injoignables)} enregistré${plu(stats.injoignables)} au statut « Injoignable ».`)
  }
  if (stats.aRappeler > 0) {
    lignes.push(`${fmtNum(stats.aRappeler)} courrier${plu(stats.aRappeler)} en attente de retrait au-delà du délai de suivi défini.`)
  }
  if (stats.rappelsEffectues > 0) {
    lignes.push(`${fmtNum(stats.rappelsEffectues)} relance${plu(stats.rappelsEffectues)} effectuée${plu(stats.rappelsEffectues)} sur la période.`)
  }
  if (stats.tempsMoyenRetraitJours != null) {
    lignes.push(`Temps moyen de retrait : ${fmtJours(stats.tempsMoyenRetraitJours)} (${fmtNum(stats.retraitsConcernes)} courrier${plu(stats.retraitsConcernes)} concerné${plu(stats.retraitsConcernes)}).`)
  }
  if (stats.tempsMoyenReponseJours != null) {
    lignes.push(`Délai moyen de réponse : ${fmtJours(stats.tempsMoyenReponseJours)} (${fmtNum(stats.reponsesConcernes)} courrier${plu(stats.reponsesConcernes)} concerné${plu(stats.reponsesConcernes)}).`)
  }

  lignes.push('Les indicateurs présentés reflètent la situation observée à la date d\'élaboration du rapport.')

  let enRubrique = false
  lignes.forEach((ligne, idx) => {
    const estCloture = idx === lignes.length - 1
    const estSous = enRubrique && !estCloture
    const y = doc.y
    if (ligne.endsWith(':')) {
      enRubrique = true
      doc.save().fillColor(COLORS.teal).font(c.B).fontSize(10)
      doc.text(ligne, ML + 10, y, { width: usableWidth() - 14 })
      doc.restore()
      doc.moveDown(0.45)
      return
    }
    const tx = ML + (estSous ? 22 : 12)
    if (!estCloture) {
      doc.save().fillColor(COLORS.teal)
      doc.circle(ML + (estSous ? 10 : 3.4), y + 3.8, 1.8).fill()
      doc.restore()
    }
    doc.fillColor(COLORS.slate).font(c.F).fontSize(9.5)
    doc.text(ligne, tx, y, { width: usableWidth() - (tx - ML) - 8, lineGap: 3 })
    doc.moveDown(0.5)
  })

  doc.moveDown(1.2)
  doc.save().strokeColor(COLORS.hair).lineWidth(0.7)
  doc.moveTo(ML + 60, doc.y).lineTo(GRID.pageW - MR - 60, doc.y).lineWidth(0.7).stroke()
  doc.restore()
  doc.moveDown(0.6)
  doc.fillColor(COLORS.ink).font(c.B).fontSize(12)
  doc.text('LE CHEF DE DIVISION', ML, doc.y, { width: usableWidth(), align: 'center' })
  // Fix #4 — signature nominative : même source que « Par » de la page de garde
  // (paramètre situation.signataireNom, repli sur l'utilisateur connecté).
  doc.moveDown(1.1)
  doc.fillColor(COLORS.slate).font(c.B).fontSize(10.5)
  doc.text(c.cover.signataireNom || c.cover.utilisateur || '', ML, doc.y, { width: usableWidth(), align: 'center' })
  // Espace réservé : signature, cachet et date
  doc.moveDown(3.2)
}

// ---------------------------------------------------------------------------
// Annexes
// ---------------------------------------------------------------------------
export interface AnnexesData {
  historique?: { numero: string; action: string; detail: string; user: string; date: string }[]
  signataires?: { code: string; nom: string }[]
}

const ANNEXE_COLS: TableCol[] = [
  { id: 'numero', header: 'N°', w: 65 },
  { id: 'action', header: 'Action', w: 140 },
  { id: 'detail', header: 'Détail', w: 200 },
  { id: 'user', header: 'Utilisateur', w: 110 },
  { id: 'date', header: "Date d'action", w: 90 },
]

const GLOSSAIRE_COLS: TableCol[] = [
  { id: 'code', header: 'Sigle', w: 80 },
  { id: 'nom', header: 'Désignation', w: 300 },
]

export function drawAnnexes(c: Ctx, config: ReportTypeConfig, data: AnnexesData) {
  const { doc } = c
  if (config.annexes.includes('historique') && data.historique && data.historique.length > 0) {
    addReportPage(c, 'portrait')
    sectionTitle(c, 'Annexe A — Historique des actions', '6')
    doc.moveDown(0.2)
    sectionSub(c, `${fmtNum(data.historique.length)} actions enregistrées sur les courriers du rapport`)
    doc.moveDown(0.25)
    const rows = data.historique.map((h) => ({
      cells: { numero: h.numero, action: h.action, detail: h.detail, user: h.user, date: h.date },
      badgeColors: {},
    }))
    drawTable(c, ANNEXE_COLS, rows, {})
  }

  if (config.annexes.includes('glossaire') && data.signataires && data.signataires.length > 0) {
    addReportPage(c, 'portrait')
    sectionTitle(c, 'Annexe B — Glossaire des sigles', '6')
    doc.moveDown(0.2)
    const rows = data.signataires.map((s) => ({
      cells: { code: s.code, nom: s.nom },
      badgeColors: { code: COLORS.teal },
    }))
    drawTable(c, GLOSSAIRE_COLS, rows, {})
  }
}
