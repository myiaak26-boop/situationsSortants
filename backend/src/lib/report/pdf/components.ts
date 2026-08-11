import PDFDocument from 'pdfkit'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { COLORS, GRID, FONT_SIZES, tint, usableWidth } from '../theme.js'
import type { ExecCoverInfo } from './index.js'

export const FONT_DIRS = [
  'C:\\Windows\\Fonts',
  '/usr/share/fonts/truetype/dejavu',
  '/usr/share/fonts/truetype/liberation',
  '/System/Library/Fonts',
]

export interface Ctx {
  doc: PDFKit.PDFDocument
  F: string
  B: string
  IT: string
  cover: ExecCoverInfo
}

function findFont(candidates: string[]): string | null {
  for (const dir of FONT_DIRS) {
    for (const f of candidates) {
      const p = join(dir, f)
      if (existsSync(p)) return p
    }
  }
  return null
}

let REGULAR_FONT: string | null = null
let BOLD_FONT: string | null = null
let ITALIC_FONT: string | null = null

export function setupFonts(doc: PDFKit.PDFDocument): { F: string; B: string; IT: string } {
  if (!REGULAR_FONT) REGULAR_FONT = findFont(['arial.ttf', 'DejaVuSans.ttf', 'LiberationSans-Regular.ttf'])
  if (!BOLD_FONT) BOLD_FONT = findFont(['arialbd.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf'])
  if (!ITALIC_FONT) ITALIC_FONT = findFont(['ariali.ttf', 'DejaVuSans-Oblique.ttf', 'LiberationSans-Italic.ttf'])
  const hasFonts = !!(REGULAR_FONT && BOLD_FONT)
  if (hasFonts) {
    doc.registerFont('Regular', REGULAR_FONT!)
    doc.registerFont('Bold', BOLD_FONT!)
    if (ITALIC_FONT) doc.registerFont('Italic', ITALIC_FONT!)
  }
  return {
    F: hasFonts ? 'Regular' : 'Helvetica',
    B: hasFonts ? 'Bold' : 'Helvetica-Bold',
    IT: hasFonts && ITALIC_FONT ? 'Italic' : 'Helvetica-Oblique',
  }
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function fmtDateShort(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR')
}

export function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR')
}

export function cellTextWidth(c: Ctx, s: string, size: number): number {
  c.doc.font(c.F).fontSize(size)
  return c.doc.widthOfString(s)
}

export function fit(c: Ctx, s: string, size: number, maxW: number): string {
  if (maxW <= 0) return ''
  if (cellTextWidth(c, s, size) <= maxW) return s
  let out = s
  while (out.length > 1 && cellTextWidth(c, out + '…', size) > maxW) {
    out = out.slice(0, -1)
  }
  return out + '…'
}

export function ensureSpace(c: Ctx, needed: number) {
  if (c.doc.y + needed > c.doc.page.height - GRID.marginTop - GRID.footerH) {
    addReportPage(c, 'portrait')
  }
}

// Nouvelle page A4 avec marge haute : évite le repli par défaut de pdfkit
// (Letter 612×792) et le contenu collé en haut de page.
export function addReportPage(c: Ctx, layout: 'portrait' | 'landscape' = 'portrait') {
  c.doc.addPage({ size: 'A4', layout, margin: 0 })
  c.doc.y = GRID.marginTop
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export function sectionTitle(c: Ctx, titre: string, num: string) {
  const { doc, B } = c
  const y = doc.y
  doc.save()
  doc.fillColor(COLORS.teal).rect(GRID.marginL, y + 5, 3.5, 15).fill()
  doc.restore()
  doc.fillColor(COLORS.ink).font(B).fontSize(FONT_SIZES.h2)
  doc.text(`${num}  ${titre}`, GRID.marginL + 11, y, { width: usableWidth() - 40 })
  doc.moveDown(0.55)
}

export function sectionSub(c: Ctx, texte: string) {
  const { doc, F } = c
  doc.fillColor(COLORS.muted).font(F).fontSize(9.5)
  doc.text(texte, GRID.marginL, doc.y, { width: usableWidth(), lineGap: 3 })
  doc.moveDown(0.4)
}

// ---------------------------------------------------------------------------
// Badge (pilule)
// ---------------------------------------------------------------------------
export function badge(c: Ctx, text: string, color: string, x: number, y: number, size = 6.5): number {
  const { doc, F } = c
  const w = cellTextWidth(c, text, size) + 9
  const h = 11
  doc.save()
  doc.fillColor(tint(color, 0.13))
  doc.roundedRect(x, y, w, h, h / 2).fill()
  doc.fillColor(color)
  doc.font(F).fontSize(size)
  doc.text(text, x + 4.5, y + 2.2, { width: w - 9, align: 'center', lineBreak: false })
  doc.restore()
  return w
}

function drawBadgeCell(c: Ctx, text: string, color: string, x: number, y: number, maxW: number, maxH: number) {
  const { doc, F } = c
  const size = 6.5
  const full = cellTextWidth(c, text, size)
  const w = Math.min(Math.max(maxW, 16), Math.max(full + 9, 16))
  const lines = Math.max(1, Math.ceil(full / Math.max(w - 9, 1)))
  const h = lines <= 1 ? 11 : Math.min(maxH, lines * 8.6 + 2)
  const ty = y + (maxH - h) / 2
  doc.save()
  doc.fillColor(tint(color, 0.13))
  doc.roundedRect(x, ty, w, h, h / 2).fill()
  doc.fillColor(color)
  doc.font(F).fontSize(size)
  doc.text(text, x + 4.5, ty + 1.6, { width: w - 9, lineBreak: true })
  doc.restore()
}

// ---------------------------------------------------------------------------
// Cartes KPI
// ---------------------------------------------------------------------------
export interface KpiItem {
  label: string
  value: string
  glyph: string
  color: string
}

// Carte KPI dominante (TOTAL) : fond plein, valeur surdimensionnée.
// Fix #3 — le total est un agrégat, il doit visuellement dominer les
// sous-catégories (qui ne s'additionnent pas au total).
export function kpiHero(c: Ctx, item: KpiItem) {
  const { doc } = c
  const tw = usableWidth()
  const th = 58
  const y = doc.y + 4
  doc.save()
  doc.fillColor(COLORS.teal)
  doc.roundedRect(GRID.marginL, y, tw, th, GRID.radius).fill()
  doc.fillColor(COLORS.white).font(c.B).fontSize(22)
  doc.text(item.value, GRID.marginL, y + 10, { width: tw, align: 'center', lineBreak: false })
  doc.fillColor('rgba(255,255,255,0.88)').font(c.F).fontSize(7.5)
  doc.text(item.label.toUpperCase(), GRID.marginL, y + 38, { width: tw, align: 'center', lineBreak: false })
  doc.restore()
  doc.y = y + th + 8
}

// Note explicative sous les KPI : précise ce qui s'additionne et ce qui ne
// s'additionne pas (Fix #3), pour ne pas laisser croire que RETIRÉS /
// INJOIGNABLES s'ajoutent au TOTAL.
export function kpiNote(c: Ctx, texte: string) {
  const { doc, IT } = c
  doc.fillColor(COLORS.muted).font(IT).fontSize(7.5)
  doc.text(texte, GRID.marginL, doc.y + 2, { width: usableWidth(), lineGap: 2 })
  doc.moveDown(0.4)
}

export function kpiGrid(c: Ctx, items: KpiItem[], startY?: number) {
  const { doc } = c
  const { kpiCols, kpiGap, kpiHeight } = GRID
  const tw = (usableWidth() - kpiGap * (kpiCols - 1)) / kpiCols
  let x = GRID.marginL
  let y = startY ?? doc.y + 4
  const th = kpiHeight
  items.forEach((t, i) => {
    if (i > 0 && i % kpiCols === 0) {
      x = GRID.marginL
      y += th + kpiGap
    }
    // Cadre
    doc.save()
    doc.fillColor(COLORS.panel)
    doc.roundedRect(x, y, tw, th, GRID.radius).fill()
    doc.strokeColor(COLORS.hair).lineWidth(0.7)
    doc.roundedRect(x, y, tw, th, GRID.radius).stroke()
    doc.restore()
    // Pastille icône
    doc.save()
    doc.fillColor(tint(t.color, 0.13))
    doc.roundedRect(x + 8, y + 8, 14, 14, 4).fill()
    doc.fillColor(t.color)
    doc.font(c.B).fontSize(8.5)
    doc.text(t.glyph, x + 8, y + 8.5, { width: 14, align: 'center', lineBreak: false })
    // Label + valeur
    doc.fillColor(COLORS.muted).font(c.F).fontSize(FONT_SIZES.meta)
    doc.text(t.label.toUpperCase(), x + 30, y + 6, { width: tw - 38, lineBreak: false })
    doc.fillColor(t.color).font(c.B).fontSize(15)
    doc.text(t.value, x + 30, y + 17, { width: tw - 38, lineBreak: false })
    doc.restore()
    x += tw + kpiGap
  })
  doc.y = y + th + 12
}

export function kpiRow(c: Ctx, items: KpiItem[], startY?: number) {
  const { doc } = c
  const { kpiGap, kpiHeight } = GRID
  const kpiCols = items.length
  const tw = (usableWidth() - kpiGap * (kpiCols - 1)) / kpiCols
  let x = GRID.marginL
  let y = startY ?? doc.y + 4
  items.forEach((t) => {
    doc.save()
    doc.fillColor(COLORS.panel)
    doc.roundedRect(x, y, tw, kpiHeight, GRID.radius).fill()
    doc.strokeColor(COLORS.hair).lineWidth(0.7)
    doc.roundedRect(x, y, tw, kpiHeight, GRID.radius).stroke()
    doc.fillColor(tint(t.color, 0.13))
    doc.roundedRect(x + 8, y + 8, 14, 14, 4).fill()
    doc.fillColor(t.color)
    doc.font(c.B).fontSize(8.5)
    doc.text(t.glyph, x + 8, y + 8.5, { width: 14, align: 'center', lineBreak: false })
    doc.fillColor(COLORS.muted).font(c.F).fontSize(FONT_SIZES.meta)
    doc.text(t.label.toUpperCase(), x + 30, y + 6, { width: tw - 38, lineBreak: false })
    doc.fillColor(t.color).font(c.B).fontSize(15)
    doc.text(t.value, x + 30, y + 17, { width: tw - 38, lineBreak: false })
    doc.restore()
    x += tw + kpiGap
  })
  doc.y = y + kpiHeight + 12
}

// ---------------------------------------------------------------------------
// En-tête courant + pied de page
// ---------------------------------------------------------------------------
export function drawRunningHeader(c: Ctx) {
  const { doc, cover } = c
  const currentUsable = doc.page.width - GRID.marginL - GRID.marginR
  doc.save()
  doc.fillColor(COLORS.ink).font(c.F).fontSize(7)
  doc.text(cover.institutionNom, GRID.marginL, 18, { width: currentUsable * 0.55, lineBreak: false })
  doc.fillColor(COLORS.muted).font(c.F).fontSize(7)
  doc.text(`${cover.confidentiel ? 'CONFIDENTIEL · ' : ''}N° ${cover.numeroRapport}`, GRID.marginL + currentUsable * 0.55, 18, { width: currentUsable * 0.45, align: 'right', lineBreak: false })
  doc.save().strokeColor(COLORS.hair).lineWidth(0.5)
  doc.moveTo(GRID.marginL, 32).lineTo(doc.page.width - GRID.marginR, 32).stroke()
  doc.restore()
  doc.restore()
}

export function addFooters(c: Ctx) {
  const { doc, cover } = c
  const totalPages = doc.bufferedPageRange().count
  const footDate = fmtDate(cover.genereLe)
  for (let p = 0; p < totalPages; p++) {
    doc.switchToPage(p)
    if (p === 0) continue
    const fy = doc.page.height - 26
    const W = doc.page.width
    doc.font(c.F).fontSize(6.5).fillColor(COLORS.muted)
    doc.save().strokeColor(COLORS.hair).lineWidth(0.5)
    doc.moveTo(GRID.marginL, fy - 8).lineTo(W - GRID.marginR, fy - 8).stroke()
    doc.restore()
    doc.text(`N° ${cover.numeroRapport}`, GRID.marginL, fy, { width: W * 0.3, lineBreak: false })
    doc.text(footDate, GRID.marginL + W * 0.35, fy, { width: W * 0.3, align: 'center', lineBreak: false })
    doc.text(`${p + 1} / ${totalPages}`, W - GRID.marginR - 60, fy, { width: 60, align: 'right', lineBreak: false })
    if (p > 0) drawRunningHeader(c)
  }
  doc.switchToPage(0)
}

// ---------------------------------------------------------------------------
// Tableau : en-tête fixe répété + zébra + sous-totaux + total
// ---------------------------------------------------------------------------
export interface TableCol {
  id: string
  header: string
  w: number
  bold?: boolean
  badge?: boolean
}

export interface TableRowData {
  cells: Record<string, string>
  badgeColors: Record<string, string>
  groupKey?: string
  groupLabel?: string
}

// Colonnes à privilégier (textes longs) et colonnes à garder compactes lors
// du redimensionnement automatique du tableau sur la largeur imprimable.
const LONG_TEXT_IDS = new Set(['destinataire', 'objet', 'nomRetraitant'])
const COMPACT_IDS = new Set(['numero', 'dateEnvoi', 'signataire', 'situation', 'modeTransmission', 'dateArriveeEntrant', 'dateRetrait', 'delaiReponse', 'delaiTraitement'])

function scaleColumns(c: Ctx, cols: TableCol[]): TableCol[] {
  const usable = c.doc.page.width - GRID.marginL - GRID.marginR
  const base = cols.reduce((acc, col) => acc + col.w, 0)
  const s = usable / base
  const scaled = cols.map((col) => {
    let f = s
    if (LONG_TEXT_IDS.has(col.id)) f = s * 1.15
    else if (COMPACT_IDS.has(col.id)) f = s * 0.9
    return { ...col, w: Math.max(col.w * f, 24) }
  })
  const total = scaled.reduce((acc, col) => acc + col.w, 0)
  const norm = usable / total
  return scaled.map((col) => ({ ...col, w: col.w * norm }))
}

export function drawTableHeader(c: Ctx, cols: TableCol[]) {
  const { doc } = c
  const y = doc.y
  const currentUsable = doc.page.width - GRID.marginL - GRID.marginR
  doc.save()
  doc.fillColor(COLORS.ink)
  doc.rect(GRID.marginL, y, currentUsable, 20).fill()
  doc.restore()
  doc.fillColor(COLORS.white).font(c.B).fontSize(6.5)
  let x = GRID.marginL
  for (const col of cols) {
    doc.text(col.header, x + 4, y + 7, { width: col.w - 8, lineBreak: false })
    x += col.w
  }
  doc.y = y + 24
}

export function drawTable(c: Ctx, cols: TableCol[], rows: TableRowData[], opts: { rowH?: number; totalLabel?: string; totalValue?: string }) {
  const { doc } = c
  cols = scaleColumns(c, cols)
  const rowH = opts.rowH ?? 22
  const lineH = 9
  const colW = cols.reduce((acc, col) => acc + col.w, 0)
  drawTableHeader(c, cols)

  const rowHeightFor = (row: TableRowData) => {
    let maxLines = 1
    for (const col of cols) {
      const v = row.cells[col.id] ?? ''
      const avail = Math.max(col.w - 8, 20)
      const lines = Math.max(1, Math.ceil(cellTextWidth(c, v, 6.5) / (avail * 0.96)))
      if (lines > maxLines) maxLines = lines
    }
    return maxLines <= 1 ? rowH : rowH + (maxLines - 1) * lineH
  }

  const bottomLimit = () => doc.page.height - GRID.marginTop - GRID.footerH

  let lastGroup: string | null = null
  let groupCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rh = rowHeightFor(row)

    if (row.groupKey !== undefined && row.groupKey !== lastGroup) {
      if (lastGroup !== null) {
        if (doc.y + rowH > bottomLimit()) {
          addReportPage(c, 'landscape')
          drawTableHeader(c, cols)
        }
        drawSubtotal(c, cols, rowH, `${lastGroup} — sous-total`, String(groupCount), colW)
        groupCount = 0
      }
      lastGroup = row.groupKey ?? null
      if (doc.y + rowH > bottomLimit()) {
        addReportPage(c, 'landscape')
        drawTableHeader(c, cols)
      }
      drawGroupHeader(c, cols, rowH, row.groupLabel ?? String(row.groupKey), colW)
    }
    groupCount++

    if (doc.y + rh > bottomLimit()) {
      addReportPage(c, 'landscape')
      drawTableHeader(c, cols)
    }
    const y0 = doc.y
    if (i % 2 === 1) {
      doc.save().fillColor(COLORS.panel).rect(GRID.marginL, y0, colW, rh).fill().restore()
    }
    let x = GRID.marginL
    for (const col of cols) {
      const v = row.cells[col.id] ?? ''
      if (col.badge && row.badgeColors[col.id]) {
        drawBadgeCell(c, v, row.badgeColors[col.id], x + 4, y0 + 4, col.w - 8, rh - 8)
        x += col.w
        continue
      }
      if (col.bold) doc.font(c.B).fontSize(6.5).fillColor(COLORS.ink)
      else doc.font(c.F).fontSize(6.5).fillColor(COLORS.slate)
      doc.text(v, x + 4, y0 + 5, { width: col.w - 8, lineBreak: true })
      x += col.w
    }
    doc.y = y0 + rh
  }

  if (lastGroup !== null) {
    if (doc.y + rowH > bottomLimit()) {
      addReportPage(c, 'landscape')
      drawTableHeader(c, cols)
    }
    drawSubtotal(c, cols, rowH, `${lastGroup} — sous-total`, String(groupCount), colW)
  }

  if (opts.totalLabel && opts.totalValue) {
    if (doc.y + rowH > bottomLimit()) {
      addReportPage(c, 'landscape')
      drawTableHeader(c, cols)
    }
    drawTotal(c, cols, rowH, opts.totalLabel, opts.totalValue, colW)
  }
}

function drawGroupHeader(c: Ctx, cols: TableCol[], rowH: number, label: string, colW: number) {
  const { doc } = c
  const y0 = doc.y
  doc.save()
  doc.fillColor(tint(COLORS.teal, 0.1))
  doc.rect(GRID.marginL, y0, colW, rowH).fill()
  doc.fillColor(COLORS.teal).font(c.B).fontSize(7.5)
  doc.text(label.toUpperCase(), GRID.marginL + 6, y0 + 7, { width: colW - 12, lineBreak: false })
  doc.restore()
  doc.y = y0 + rowH
}

function drawSubtotal(c: Ctx, cols: TableCol[], rowH: number, label: string, value: string, colW: number) {
  const { doc } = c
  const y0 = doc.y
  doc.save()
  doc.fillColor(COLORS.panel)
  doc.rect(GRID.marginL, y0, colW, rowH).fill()
  doc.strokeColor(COLORS.hair).lineWidth(0.5)
  doc.moveTo(GRID.marginL, y0).lineTo(GRID.marginL + colW, y0).stroke()
  doc.fillColor(COLORS.slate).font(c.B).fontSize(6.8)
  doc.text(label, GRID.marginL + 4, y0 + 6, { width: colW - 100, lineBreak: false })
  doc.fillColor(COLORS.ink).font(c.B).fontSize(6.8)
  doc.text(value, GRID.marginL + colW - 34, y0 + 6, { width: 30, align: 'right', lineBreak: false })
  doc.restore()
  doc.y = y0 + rowH
}

function drawTotal(c: Ctx, cols: TableCol[], rowH: number, label: string, value: string, colW: number) {
  const { doc } = c
  const y0 = doc.y
  doc.save()
  doc.fillColor(COLORS.teal)
  doc.rect(GRID.marginL, y0, colW, rowH).fill()
  doc.fillColor(COLORS.white).font(c.B).fontSize(7.5)
  doc.text(label, GRID.marginL + 4, y0 + 6.5, { width: colW - 100, lineBreak: false })
  doc.text(value, GRID.marginL + colW - 34, y0 + 6.5, { width: 30, align: 'right', lineBreak: false })
  doc.restore()
  doc.y = y0 + rowH
}
