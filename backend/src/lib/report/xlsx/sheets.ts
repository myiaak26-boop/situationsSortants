import XLSX from 'xlsx'
import { COLORS, tint } from '../theme.js'
import { STYLE, badgeStyle, kpiValueStyle, kpiLabelStyle, type CellStyle } from './styles.js'
import { KPI_DEFS, TABLE_COL_DEFS, visibleKpis, PAR_AUTEUR, KPI_NOTE, ALWAYS_VISIBLE_COLS } from '../types.js'
import type { KpiId, ReportTypeConfig, TableColId } from '../types.js'
import type { TableRow, SituationExecStats } from '../../situation-query.js'
import { formatDureeCourt } from '../../duree.js'
import type { AnnexesData } from '../pdf/pages.js'

interface Cover {
  republique: string
  institutionNom: string
  devise: string
  titre: string
  numeroRapport: string
  utilisateur: string
  genereLe: Date
}

function cell(ws: XLSX.WorkSheet, r: number, c: number, value: unknown, style?: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c })
  ws[addr] = { t: 's', v: String(value ?? ''), s: style ?? {} }
}

function merge(ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number) {
  ws['!merges'] = ws['!merges'] || []
  ws['!merges'].push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
}

function finalize(ws: XLSX.WorkSheet) {
  const keys = Object.keys(ws).filter((k) => /^[A-Z]+\d+$/.test(k))
  if (keys.length === 0) return ws
  let maxR = 0
  let maxC = 0
  for (const k of keys) {
    const a = XLSX.utils.decode_cell(k)
    if (a.r > maxR) maxR = a.r
    if (a.c > maxC) maxC = a.c
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } })
  return ws
}

function fmtDateTime(d: Date): string {
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR')
}

function daysBetween(d1: Date | null | undefined, d2: Date | null | undefined): number | null {
  if (!d1 || !d2) return null
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return diff >= 0 ? diff : null
}

function colLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function baseSheet(colWidths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([[]])
  ws['!cols'] = colWidths.map((w) => ({ wch: w }))
  ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  return ws
}

function sheetTitleBand(ws: XLSX.WorkSheet, row: number, lastCol: number, titre: string, sub?: string) {
  merge(ws, row, 0, row, lastCol)
  cell(ws, row, 0, titre, STYLE.h2)
  ws['!rows'] = ws['!rows'] || []
  ws['!rows'][row] = { hpt: 22 }
  if (sub) {
    merge(ws, row + 1, 0, row + 1, lastCol)
    cell(ws, row + 1, 0, sub, STYLE.sub)
  }
}

// ---------------------------------------------------------------------------
// Feuille Couverture
// ---------------------------------------------------------------------------
export function buildCover(cover: Cover, periode: string): XLSX.WorkSheet {
  const ws = baseSheet([16, 20, 20, 20, 20, 20])
  // Bande teal
  merge(ws, 0, 0, 0, 5)
  cell(ws, 0, 0, '', STYLE.bandeTop)
  ws['!rows'] = ws['!rows'] || []
  ws['!rows'][0] = { hpt: 14 }
  // Bande ink
  merge(ws, 16, 0, 16, 5)
  cell(ws, 16, 0, '', STYLE.bandeBot)
  ws['!rows'][16] = { hpt: 14 }

  merge(ws, 2, 0, 2, 5)
  cell(ws, 2, 0, cover.republique, { font: { bold: true, sz: 13, color: { rgb: COLORS.teal } }, alignment: { horizontal: 'center' } })
  merge(ws, 3, 0, 3, 5)
  cell(ws, 3, 0, cover.devise, STYLE.italic)
  merge(ws, 4, 0, 4, 5)
  cell(ws, 4, 0, 'PRIMATURE', { font: { bold: true, sz: 17, color: { rgb: COLORS.ink } }, alignment: { horizontal: 'center' } })
  merge(ws, 5, 0, 5, 5)
  cell(ws, 5, 0, cover.institutionNom, { font: { sz: 11, color: { rgb: COLORS.slate } }, alignment: { horizontal: 'center' } })
  merge(ws, 7, 0, 7, 5)
  cell(ws, 7, 0, cover.titre, { font: { bold: true, sz: 23, color: { rgb: COLORS.ink } }, alignment: { horizontal: 'center' } })

  const meta: [string, string][] = [
    ['Période', periode],
    ["Date d'élaboration", fmtDateTime(cover.genereLe).split(' ')[0]],
    ['Heure', fmtDateTime(cover.genereLe).split(' ')[1]],
    ['Par', PAR_AUTEUR],
  ]
  meta.forEach(([label, value], i) => {
    const r = 9 + i
    merge(ws, r, 0, r, 1)
    merge(ws, r, 2, r, 5)
    cell(ws, r, 0, label.toUpperCase(), { font: { bold: true, sz: 8, color: { rgb: COLORS.muted } }, fill: { fgColor: { rgb: COLORS.panel } }, alignment: { vertical: 'center' } })
    cell(ws, r, 2, value, { font: { sz: 10, color: { rgb: COLORS.ink } }, fill: { fgColor: { rgb: COLORS.panel } }, alignment: { vertical: 'center' } })
    ws['!rows']![r] = { hpt: 20 }
  })

  return finalize(ws)
}

// ---------------------------------------------------------------------------
// Cartes KPI (rangée de cartes fusionnées)
// ---------------------------------------------------------------------------
export function kpiCardsRow(ws: XLSX.WorkSheet, row: number, items: { label: string; value: string; glyph: string; color: string; num?: number }[], lastCol = 15) {
  const cardW = Math.ceil((lastCol + 1) / items.length)
  items.forEach((item, i) => {
    const c0 = i * cardW
    const c1 = i === items.length - 1 ? lastCol : Math.min(c0 + cardW - 1, lastCol)
    merge(ws, row, c0, row, c1)
    const valCell = XLSX.utils.encode_cell({ r: row, c: c0 })
    const labCell = XLSX.utils.encode_cell({ r: row + 1, c: c0 })
    const isFormula = item.value.startsWith('=')
    ws[valCell] = isFormula
      ? { t: 'n', f: item.value, v: item.num ?? 0, s: { ...STYLE.kpiBox, ...kpiValueStyle(item.color) } }
      : { t: 's', v: `${item.glyph}  ${item.value}`, s: { ...STYLE.kpiBox, ...kpiValueStyle(item.color) } }
    ws[labCell] = {
      t: 's',
      v: (isFormula ? `${item.glyph}  ` : '') + item.label.toUpperCase(),
      s: { ...STYLE.kpiBox, ...kpiLabelStyle() },
    }
    ws['!rows'] = ws['!rows'] || []
    ws['!rows'][row] = { hpt: 26 }
    ws['!rows'][row + 1] = { hpt: 16 }
  })
}

const KPI_NUM: Record<KpiId, (s: SituationExecStats) => number> = {
  total: (s) => s.total,
  simples: (s) => s.courriersSimples,
  reponses: (s) => s.courriersReponses,
  retires: (s) => s.retires,
  livres: (s) => s.livres,
  nouveaux: (s) => s.nouveaux,
  mail: (s) => s.envoyesMail,
  coursier: (s) => s.envoyesCoursier,
  aRappeler: (s) => s.aRappeler,
  rappels: (s) => s.rappelsEffectues,
}

// ---------------------------------------------------------------------------
// Feuille Synthèse
// ---------------------------------------------------------------------------
export function buildSynthese(
  cover: Cover,
  stats: SituationExecStats,
  config: ReportTypeConfig,
  opts: { inlineTable?: boolean; rows?: TableRow[] },
  periode: string,
): XLSX.WorkSheet {
  const ws = baseSheet(Array(16).fill(8))

  // Liaison dynamique : valeurs KPI en formules Excel pointant vers « Situation complète ».
  const dataRows = opts.rows?.length ?? 0
  const lastRow = Math.max(dataRows + 1, 2) + 500
  const colIdx = (id: TableColId): string | null => {
    const i = config.cols.indexOf(id)
    return i >= 0 ? colLetter(i) : null
  }
  const rangeCol = (id: TableColId): string | null => {
    const c = colIdx(id)
    return c ? `'Situation complète'!${c}2:${c}${lastRow}` : null
  }
  const kpiFormula = (id: KpiId): string | null => {
    switch (id) {
      case 'total': {
        const c = colIdx('numero') ?? 'A'
        return dataRows > 0 ? `=COUNTA('Situation complète'!${c}2:${c}${lastRow})` : null
      }
      case 'simples': {
        const r = rangeCol('numeroEntrant')
        return r ? `=COUNTIF(${r},"")` : null
      }
      case 'reponses': {
        const r = rangeCol('numeroEntrant')
        return r ? `=COUNTIF(${r},"<>")` : null
      }
      case 'retires': {
        const rDate = rangeCol('dateRetrait')
        return rDate ? `=COUNTIF(${rDate},"<>")` : null
      }
      default:
        return null
    }
  }
  const kpis = visibleKpis(config, stats).map((id) => {
    const def = KPI_DEFS[id]
    const formula = kpiFormula(id)
    return {
      label: def.label,
      value: formula ?? def.value(stats),
      glyph: def.glyph,
      color: def.color,
      num: formula ? KPI_NUM[id](stats) : undefined,
    }
  })
  const kpiGroups: typeof kpis[] = []
  for (let i = 0; i < kpis.length; i += 4) kpiGroups.push(kpis.slice(i, i + 4))
  let row = 0
  kpiGroups.forEach((group) => {
    kpiCardsRow(ws, row, group, 15)
    row += 2
  })

  merge(ws, row, 0, row, 15)
  cell(ws, row, 0, KPI_NOTE, { ...STYLE.sub, alignment: { wrapText: true, vertical: 'top' } })
  row += 2

  if (opts.inlineTable && opts.rows && opts.rows.length > 0) {
    row += 1
    sheetTitleBand(ws, row, 15, '1 · Tableau détaillé des courriers', `${opts.rows.length} courriers`)
    row += 2
    const cols: TableColId[] = config.cols.filter((id) => ALWAYS_VISIBLE_COLS.has(id) || opts.rows!.some((r) => tableValue(r, id) !== ''))
    cols.forEach((id, ci) => {
      cell(ws, row, ci, TABLE_COL_DEFS[id].header, STYLE.th)
    })
    row++
    opts.rows.forEach((r, ri) => {
      cols.forEach((id, ci) => {
        const v = tableValue(r, id)
        cell(ws, row, ci, v, ri % 2 === 1 ? STYLE.zebra : {})
      })
      row++
    })
    merge(ws, row, 0, row, cols.length - 1)
    cell(ws, row, 0, `TOTAL — ${opts.rows.length} courriers`, STYLE.total)
  }

  return finalize(ws)
}

function tableValue(r: TableRow, colId: TableColId): string {
  switch (colId) {
    case 'dateEnvoi':
      return fmtDate(new Date(r.dateEnvoi))
    case 'dateArriveeEntrant':
      return r.dateArriveeEntrant ? fmtDate(new Date(r.dateArriveeEntrant)) : ''
    case 'dateRetrait':
      return r.retrait ? fmtDate(new Date(r.retrait.dateRetrait)) : ''
    case 'nomRetraitant':
      return r.retrait?.nomRetraitant || ''
    case 'telephone':
      return r.retrait?.telephone || ''
    case 'delaiReponse': {
      // Durée de traitement : valeur importée depuis Excel en priorité,
      // sinon date de signature − date d'arrivée du courrier entrant.
      if (r.dureeTraitement != null) return formatDureeCourt(r.dureeTraitement)
      const v = daysBetween(r.dateArriveeEntrant, r.dateEnvoi)
      return v === null ? '' : String(v)
    }
    case 'delaiTraitement': {
      const v = daysBetween(r.dateEnvoi, r.retrait?.dateRetrait)
      return v === null ? '' : String(v)
    }
    default:
      return (r as unknown as Record<string, unknown>)[colId] == null ? '' : String((r as unknown as Record<string, unknown>)[colId])
  }
}

// ---------------------------------------------------------------------------
// Feuille Situation complète
// ---------------------------------------------------------------------------
export function buildComplet(rows: TableRow[], config: ReportTypeConfig): XLSX.WorkSheet {
  // Colonnes vides sur la sélection : masquées pour éviter les zones blanches.
  const cols: TableColId[] = config.cols.filter((id) => ALWAYS_VISIBLE_COLS.has(id) || rows.some((r) => tableValue(r, id) !== ''))
  const ws = baseSheet(cols.map((id) => Math.min(TABLE_COL_DEFS[id].w, 40)))
  cols.forEach((id, ci) => cell(ws, 0, ci, TABLE_COL_DEFS[id].header, STYLE.th))
  rows.forEach((r, ri) => {
    cols.forEach((id, ci) => {
      const v = tableValue(r, id)
      const style: CellStyle = ri % 2 === 1 ? STYLE.zebra : {}
      cell(ws, ri + 1, ci, v, style)
    })
  })
  const lastRow = rows.length
  merge(ws, lastRow + 1, 0, lastRow + 1, cols.length - 1)
  cell(ws, lastRow + 1, 0, `TOTAL — ${rows.length} courriers`, STYLE.total)
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_cell({ r: rows.length, c: cols.length - 1 })}` }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  return finalize(ws)
}

// ---------------------------------------------------------------------------
// Feuilles agrégées
// ---------------------------------------------------------------------------
function buildEntriesSheet(title: string, sub: string | null, headers: string[], entries: [string, number][]): XLSX.WorkSheet {
  const ws = baseSheet([40, 12, ...Array(20).fill(2)])
  sheetTitleBand(ws, 0, 21, title, sub ?? undefined)
  cell(ws, 2, 0, headers[0], STYLE.th)
  cell(ws, 2, 1, headers[1], STYLE.th)
  const maxVal = Math.max(...entries.map(([, v]) => v), 1)
  const BAR_CELLS = 20
  entries.forEach(([label, value], i) => {
    const r = 3 + i
    cell(ws, r, 0, label, { font: { sz: 10, color: { rgb: COLORS.slate } }, fill: { fgColor: { rgb: i % 2 === 1 ? COLORS.panel : COLORS.white } } })
    ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: value, s: { numFmt: '#,##0', font: { bold: true, sz: 10, color: { rgb: COLORS.ink } }, fill: { fgColor: { rgb: i % 2 === 1 ? COLORS.panel : COLORS.white } } } }
    const n = Math.max(1, Math.round((value / maxVal) * BAR_CELLS))
    const color = tint(COLORS.teal, 0.85).replace('#', '')
    for (let b = 0; b < BAR_CELLS; b++) {
      const style = b < n ? { fill: { fgColor: { rgb: color } } } : {}
      cell(ws, r, 2 + b, '', style)
    }
  })
  return finalize(ws)
}

export function buildStatsSheets(stats: SituationExecStats): { name: string; ws: XLSX.WorkSheet }[] {
  return [
    {
      name: 'Stats signataire',
      ws: buildEntriesSheet('Par signataire', null, ['Signataire', 'Courriers'], Object.entries(stats.parSignataire).sort((a, b) => b[1] - a[1])),
    },
    {
      name: 'Délais',
      ws: buildEntriesSheet('Répartition des délais de traitement', null, ['Tranche', 'Courriers'], stats.repartitionDelais.map((d) => [d.libelle, d.count] as [string, number])),
    },
  ]
}

// ---------------------------------------------------------------------------
// Feuille Réponses
// ---------------------------------------------------------------------------
export function buildReponses(rows: TableRow[]): XLSX.WorkSheet {
  const filtered = rows.filter((r) => r.numeroEntrant)
  const ws = baseSheet([16, 40, 26, 12, 16, 12])
  sheetTitleBand(ws, 0, 5, 'Courriers réponses', `${filtered.length} courriers en réponse à un courrier entrant`)
  const headers = ['N°', 'Objet', 'Destinataire', "Date de signature", 'Réponse (N° entrant)', "Date d'arrivée"]
  headers.forEach((h, i) => cell(ws, 2, i, h, STYLE.th))
  filtered.forEach((r, ri) => {
    const vals = [r.numero, r.objet, r.destinataire, fmtDate(r.dateEnvoi), r.numeroEntrant || '', r.dateArriveeEntrant ? fmtDate(r.dateArriveeEntrant) : '']
    vals.forEach((v, ci) => cell(ws, ri + 3, ci, v, ri % 2 === 1 ? STYLE.zebra : {}))
  })
  return finalize(ws)
}

// ---------------------------------------------------------------------------
// Feuille Historique
// ---------------------------------------------------------------------------
export function buildHistorique(historique: NonNullable<AnnexesData['historique']>): XLSX.WorkSheet {
  const ws = baseSheet([16, 26, 34, 20, 20])
  sheetTitleBand(ws, 0, 4, 'Historique des actions', `${historique.length} actions`)
  const headers = ['Courrier', 'Action', 'Détail', 'Utilisateur', "Date d'action"]
  headers.forEach((h, i) => cell(ws, 2, i, h, STYLE.th))
  historique.forEach((a, ri) => {
    const vals = [a.numero, a.action, a.detail, a.user, a.date]
    vals.forEach((v, ci) => cell(ws, ri + 3, ci, v, ri % 2 === 1 ? STYLE.zebra : {}))
  })
  return finalize(ws)
}

// ---------------------------------------------------------------------------
// Feuille Audit interne (diagnostic des anomalies de données)
// ---------------------------------------------------------------------------
export interface AuditInterne {
  exclus: { numero: string }[]
  totalInclus: number
  signatairesNonRenseignes: number
  destinatairesNonRenseignes: number
  objetsSansLibelle: number
}

export function buildAuditInterne(data: AuditInterne): XLSX.WorkSheet {
  const ws = baseSheet([46, 30, 20])
  sheetTitleBand(ws, 0, 2, 'Audit interne des données', 'Destiné à l’administration — ne figure pas dans le rapport hiérarchique')
  let row = 2
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: 's', v: 'Courriers exclus du rapport', s: STYLE.h2 }
  ws['!rows'] = ws['!rows'] || []
  ws['!rows'][row] = { hpt: 20 }
  row += 2
  cell(ws, row, 0, 'Numéro', STYLE.th)
  row++
  if (data.exclus.length === 0) {
    cell(ws, row, 0, 'Aucun courrier exclu')
    row++
  } else {
    for (const e of data.exclus) {
      cell(ws, row, 0, e.numero, { font: { sz: 10, color: { rgb: COLORS.rose } } })
      row++
    }
  }
  row += 2
  ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { t: 's', v: 'Complétude des données (courriers inclus)', s: STYLE.h2 }
  ws['!rows'][row] = { hpt: 20 }
  row += 2
  cell(ws, row, 0, 'Indicateur', STYLE.th)
  cell(ws, row, 1, 'Valeur', STYLE.th)
  row++
  const lignes: [string, number][] = [
    ['Courriers inclus dans le rapport', data.totalInclus],
    ['Signataire « Non renseigné »', data.signatairesNonRenseignes],
    ['Destinataire « Non renseigné »', data.destinatairesNonRenseignes],
    ['Objet « Sans objet »', data.objetsSansLibelle],
  ]
  for (const [label, value] of lignes) {
    cell(ws, row, 0, label, { font: { sz: 10, color: { rgb: COLORS.slate } } })
    ws[XLSX.utils.encode_cell({ r: row, c: 1 })] = { t: 'n', v: value, s: { numFmt: '#,##0', font: { bold: true, sz: 10, color: { rgb: COLORS.ink } } } }
    row++
  }
  return finalize(ws)
}