import { COLORS, GRID, FONT_SIZES, tint, usableWidth } from '../theme.js'
import { cellTextWidth, fit, addReportPage } from './components.js'
import { fmtPct } from '../types.js'
import type { Ctx } from './components.js'

const { marginL: ML } = GRID

function chartTitle(c: Ctx, titre: string, note?: string) {
  const { doc, B } = c
  let y = doc.y
  doc.fillColor(COLORS.ink).font(B).fontSize(FONT_SIZES.h3)
  doc.text(titre, ML, y, { width: usableWidth() })
  y += 13.5
  if (note) {
    doc.fillColor(COLORS.muted).font(c.F).fontSize(7)
    doc.text(note, ML, y, { width: usableWidth() })
    y += 9.5
  }
  y += 2.5
  doc.save().strokeColor(COLORS.hair).lineWidth(0.6)
  doc.moveTo(ML, y).lineTo(usableWidth() + ML, y).stroke()
  doc.restore()
  doc.y = y + 10
}

function chartEmpty(c: Ctx, msg: string) {
  const { doc, F } = c
  doc.fillColor(COLORS.muted).font(F).fontSize(9)
  doc.text(msg, ML + 10, doc.y + 12, { width: usableWidth() })
  doc.y += 28
}

function ensureChartSpace(c: Ctx, needed: number) {
  if (c.doc.y + needed > c.doc.page.height - GRID.marginTop - GRID.footerH) {
    addReportPage(c, 'portrait')
  }
}

// ---------------------------------------------------------------------------
// Barres verticales (libellés à gauche, barres horizontales)
// ---------------------------------------------------------------------------
export function barChart(c: Ctx, data: { label: string; value: number }[], opts: { title: string; color: string; height?: number; note?: string }) {
  const { doc } = c
  ensureChartSpace(c, (opts.note ? 148 : 120))
  chartTitle(c, opts.title, opts.note)
  const dataSorted = [...data].sort((a, b) => b.value - a.value)
  const MAX_ROWS = 24
  const shown = dataSorted.slice(0, MAX_ROWS)
  const maxVal = Math.max(...shown.map((d) => d.value), 1)
  const top = doc.y
  const rowH = 15
  const chartH = shown.length * rowH + 10
  const labelW = 150
  const barMaxW = usableWidth() - labelW - 40
  const rightLimit = ML + usableWidth()

  const gridX = ML + labelW
  for (let g = 0; g <= 4; g++) {
    const gx = gridX + (g / 4) * barMaxW
    doc.save()
    doc.strokeColor(COLORS.hair).lineWidth(0.4)
    doc.moveTo(gx, top - 4).lineTo(gx, top + shown.length * rowH).stroke()
    doc.restore()
    doc.fillColor(COLORS.muted).font(c.F).fontSize(6.5)
    doc.text(String(Math.round((maxVal * g) / 4)), gx - 2, top + shown.length * rowH + 3, { width: 30, align: 'right' })
  }

  shown.forEach((d, i) => {
    const y = top + i * rowH
    doc.fillColor(COLORS.slate).font(c.F).fontSize(8)
    doc.text(fit(c, String(d.label), 8, labelW - 8), ML, y, { width: labelW - 6, lineBreak: false })
    const w = Math.max((d.value / maxVal) * barMaxW, 3)
    doc.save()
    doc.fillColor(opts.color)
    doc.rect(ML + labelW, y + 1.5, w, rowH - 5).fill()
    doc.restore()
    doc.fillColor(COLORS.ink).font(c.B).fontSize(8.5)
    doc.text(String(d.value), ML + labelW + w + 6, y, { width: 40 })
  })
  if (dataSorted.length > shown.length) {
    doc.fillColor(COLORS.muted).font(c.F).fontSize(7)
    doc.text(`+ ${dataSorted.length - shown.length} valeur(s) non représentée(s)`, ML, doc.y, { width: usableWidth() })
    doc.moveDown(0.2)
  }
  doc.y = top + chartH
  doc.moveDown(0.3)
}

// ---------------------------------------------------------------------------
// Barres horizontales empilées 100 %
// ---------------------------------------------------------------------------
export function hbarChart(c: Ctx, data: { label: string; value: number }[], opts: { title: string; colors: Map<string, string>; note?: string }) {
  const { doc } = c
  ensureChartSpace(c, (opts.note ? 150 : 110))
  chartTitle(c, opts.title, opts.note)
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 12)
  const total = sorted.reduce((acc, d) => acc + d.value, 0) || 1
  const top = doc.y
  const labelH = 16
  const innerW = usableWidth() - 70
  const rightLimit = ML + usableWidth()

  let lx = ML
  let ly = top
  sorted.forEach((d) => {
    const pc = Math.round((d.value / total) * 1000) / 10
    const text = `${d.label} — ${d.value} (${fmtPct(pc)})`
    const tw = cellTextWidth(c, text, 7.5) + 10
    if (lx + tw > rightLimit) {
      lx = ML
      ly += 13
    }
    doc.save()
    doc.fillColor(opts.colors.get(d.label) || COLORS.teal)
    doc.rect(lx, ly, 7, 7).fill()
    doc.restore()
    doc.fillColor(COLORS.slate).font(c.F).fontSize(7.5)
    doc.text(fit(c, text, 7.5, Math.min(tw - 6, rightLimit - (lx + 11))), lx + 11, ly - 1.5, { width: Math.min(tw - 6, rightLimit - (lx + 11)), lineBreak: false })
    lx += tw
  })
  doc.y = ly + 22

  const baseY = doc.y
  let accX = ML
  sorted.forEach((d) => {
    const w = (d.value / total) * innerW
    doc.save()
    doc.fillColor(opts.colors.get(d.label) || COLORS.teal)
    doc.rect(accX, baseY, Math.max(w, 1.5), labelH).fill()
    doc.restore()
    accX += w
  })
  doc.y = baseY + labelH + 14
  doc.moveDown(0.2)
}

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------
export function donutChart(c: Ctx, data: { label: string; value: number }[], opts: { title: string; colors: Map<string, string>; note?: string }) {
  const { doc } = c
  ensureChartSpace(c, (opts.note ? 160 : 130))
  chartTitle(c, opts.title, opts.note)
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 8)
  const total = sorted.reduce((acc, d) => acc + d.value, 0)
  if (total === 0) {
    chartEmpty(c, 'Aucune donnée')
    return
  }
  const cx = ML + 70
  const cy = doc.y + 60
  const R = 46
  const RIN = R * 0.55
  doc.save()
  let angle = -Math.PI / 2
  sorted.forEach((d) => {
    const sweep = (d.value / total) * Math.PI * 2
    const start = angle
    const end = angle + sweep
    const path =
      `M ${cx + R * Math.cos(start)} ${cy + R * Math.sin(start)} ` +
      `A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${cx + R * Math.cos(end)} ${cy + R * Math.sin(end)} ` +
      `L ${cx + RIN * Math.cos(end)} ${cy + RIN * Math.sin(end)} ` +
      `A ${RIN} ${RIN} 0 ${sweep > Math.PI ? 1 : 0} 0 ${cx + RIN * Math.cos(start)} ${cy + RIN * Math.sin(start)} Z`
    doc.path(path).fill(opts.colors.get(d.label) || COLORS.teal)
    angle += sweep
  })
  doc.fillColor(COLORS.white).circle(cx, cy, RIN).fill()
  doc.restore()
  doc.fillColor(COLORS.ink).font(c.B).fontSize(11)
  doc.text(String(total), cx - 25, cy - 7, { width: 50, align: 'center' })
  doc.fillColor(COLORS.muted).font(c.F).fontSize(6.5)
  doc.text('TOTAL', cx - 25, cy + 8, { width: 50, align: 'center' })

  let lx = ML + 150
  let ly = cy - 30
  const legendW = usableWidth() - 150
  const colW = legendW / 2
  let col = 0
  sorted.forEach((d) => {
    const pc = Math.round((d.value / total) * 1000) / 10
    if (ly > cy + 28) {
      col++
      lx = ML + 150 + col * colW
      ly = cy - 30
    }
    doc.save()
    doc.fillColor(opts.colors.get(d.label) || COLORS.teal)
    doc.rect(lx, ly, 7, 7).fill()
    doc.restore()
    doc.fillColor(COLORS.slate).font(c.F).fontSize(7.5)
    doc.text(fit(c, `${d.label} — ${d.value} (${fmtPct(pc)})`, 7.5, colW - 16), lx + 11, ly - 1.5, { width: colW - 16, lineBreak: false })
    ly += 13
  })
  doc.y = Math.max(cy + 50, ly + 16)
  doc.moveDown(0.2)
}

// ---------------------------------------------------------------------------
// Ligne / aires
// ---------------------------------------------------------------------------
function lineChartBase(
  c: Ctx,
  data: { label: string; total: number }[],
  opts: { title: string; color: string; area: boolean },
) {
  const { doc } = c
  ensureChartSpace(c, 190)
  chartTitle(c, opts.title)
  const n = data.length
  if (n === 0) {
    chartEmpty(c, 'Aucune donnée sur la période')
    return
  }
  const chartTop = doc.y + 14
  const chartW = usableWidth() - 34
  const chartH = 150
  const maxV = Math.max(...data.map((d) => d.total), 1)
  doc.save()
  doc.fillColor(COLORS.faint).font(c.F).fontSize(7)
  for (let g = 0; g <= 4; g++) {
    const gy = chartTop + chartH - (g / 4) * chartH
    doc.save()
    doc.strokeColor(COLORS.hair).lineWidth(0.5)
    doc.moveTo(ML + 24, gy).lineTo(ML + 24 + chartW, gy).stroke()
    doc.restore()
    doc.fillColor(COLORS.muted)
    doc.text(String(Math.round((maxV * g) / 4)), ML - 8, gy - 3, { width: 22, align: 'right' })
  }
  const step = chartW / Math.max(n - 1, 1)
  const x0 = ML + 30
  const yBase = chartTop + chartH
  const rightLimit = ML + usableWidth()
  const points = data.map((d, i) => ({ x: x0 + i * step, y: yBase - (d.total / maxV) * chartH }))

  if (opts.area) {
    doc.save()
    doc.path(
      `M ${points[0].x} ${yBase} ` +
        points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
        ` L ${points[points.length - 1].x} ${yBase} Z`,
    )
    doc.fillOpacity(0.18).fill(opts.color)
    doc.restore()
  }

  doc.save()
  doc.strokeColor(opts.color).lineWidth(1.6)
  doc.moveTo(points[0].x, points[0].y)
  for (const p of points) doc.lineTo(p.x, p.y)
  doc.stroke()
  doc.restore()

  // Éclaircissement des libellés et des valeurs quand les points sont denses
  const labelStep = Math.max(1, Math.ceil(32 / Math.max(step, 1)))
  const valStep = Math.max(1, Math.ceil(16 / Math.max(step, 1)))
  const last = n - 1

  doc.fillColor(COLORS.ink).font(c.B).fontSize(7)
  points.forEach((p, i) => {
    doc.save().fillColor(opts.color).circle(p.x, p.y, 1.6).fill().restore()
    if (labelStep > 1 && i % labelStep !== 0 && i !== last) return
    const label = data[i].label
    const lw = cellTextWidth(c, label, 7)
    doc.fillColor(COLORS.muted).font(c.F).fontSize(7)
    doc.text(label, Math.min(Math.max(p.x - lw / 2, ML), rightLimit - lw), yBase + 6, { width: lw, lineBreak: false })
  })

  doc.fillColor(COLORS.ink).font(c.B).fontSize(7.5)
  points.forEach((p, i) => {
    if (valStep > 1 && i % valStep !== 0 && i !== last) return
    const vx = Math.min(Math.max(p.x - 7, ML), rightLimit - 14)
    doc.text(String(data[i].total), vx, Math.max(p.y - 13, chartTop - 6), { width: 14, align: 'center' })
  })
  doc.y = yBase + 20
  doc.moveDown(0.3)
}

export function lineChart(c: Ctx, data: { label: string; total: number }[], opts: { title: string; color: string }) {
  lineChartBase(c, data, { ...opts, area: false })
}

export function areaChart(c: Ctx, data: { label: string; total: number }[], opts: { title: string; color: string }) {
  lineChartBase(c, data, { ...opts, area: true })
}

// ---------------------------------------------------------------------------
// Barres inline (cellules) — miroir Excel
// ---------------------------------------------------------------------------
export function inlineBars(c: Ctx, data: { label: string; value: number }[], opts: { title: string; color: string; max?: number }) {
  const { doc } = c
  ensureChartSpace(c, 40 + data.length * 13)
  chartTitle(c, opts.title)
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const maxVal = opts.max ?? Math.max(...sorted.map((d) => d.value), 1)
  const labelW = 150
  const barMaxW = usableWidth() - labelW - 70
  const rowH = 12
  const rightLimit = ML + usableWidth()
  sorted.slice(0, 15).forEach((d, i) => {
    const y = doc.y + i * rowH
    if (y > GRID.pageH - GRID.marginTop - 30) return
    doc.fillColor(COLORS.slate).font(c.F).fontSize(7.5)
    doc.text(fit(c, String(d.label), 7.5, labelW - 8), ML, y, { width: labelW - 8, lineBreak: false })
    const w = Math.max((d.value / maxVal) * barMaxW, 2)
    doc.save()
    doc.fillColor(tint(opts.color, 0.85))
    doc.rect(ML + labelW, y + 1, w, rowH - 5).fill()
    doc.restore()
    doc.fillColor(COLORS.ink).font(c.B).fontSize(8)
    doc.text(String(d.value), Math.min(ML + labelW + w + 5, rightLimit - 46), y - 0.5, { width: 40 })
  })
  const shown = sorted.slice(0, 15)
  if (sorted.length > shown.length) {
    doc.y += shown.length * rowH + 6
    doc.fillColor(COLORS.muted).font(c.F).fontSize(7)
    doc.text(`+ ${sorted.length - shown.length} valeur(s) non représentée(s)`, ML, doc.y, { width: usableWidth() })
    doc.moveDown(0.3)
  } else {
    doc.y += sorted.length * rowH + 6
    doc.moveDown(0.3)
  }
}
