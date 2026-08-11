// Tests de cohérence des chiffres des rapports DEX (mission 23 — 9 points).
// Pipeline : stats API → PDF (texte via pdfjs) → Excel (valeurs) — toutes les
// sources doivent concorder (KPI = tableau = graphique, périmètres des délais,
// pourcentages, absence de « 0 jour », PDF = Excel).

import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { prepDirs, pdfjsUrls, tmpUrl } from './audit/engine.js'
import type { AuditPageRaw } from './audit/types.js'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx') as typeof import('xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_SERVED = path.resolve(__dirname, '..', 'public', 'pdf-audit', 'tmp')

const API = 'http://localhost:3000'
const APP = 'http://localhost:5173'

const KPI_LABELS = ['TOTAL COURRIERS', 'COURRIERS SIMPLES', 'COURRIERS RÉPONSES', 'RETIRÉS', 'LIVRÉS', 'NOUVEAUX', 'INJOIGNABLES', 'À RAPPELER', 'RELANCES EFFECTUÉES']

test.describe.configure({ mode: 'serial' })

let TOKEN = ''
let stats: Record<string, unknown>
let pdfPages: AuditPageRaw[]
let xlsxWb: ReturnType<typeof XLSX.read>

const allText = (pages: AuditPageRaw[]) => pages.map((p) => p.text.map((t) => t.str).join(' ')).join('\n')

function sum(rec: Record<string, number>): number {
  return Object.values(rec).reduce((a, b) => a + b, 0)
}

// Valeurs des cartes KPI de la page de synthèse (page index 1) : pour chaque
// label (majuscules), la valeur est l'élément numérique le plus proche — 22 pt
// pour la carte dominante TOTAL, 15 pt pour les cartes secondaires.
function kpiValue(pages: AuditPageRaw[], label: string): string | null {
  const page = pages[1]
  if (!page) return null
  const items = page.text
  for (const t of items) {
    if (t.str.trim() !== label) continue
    const isHero = t.size >= 7 && t.size <= 8
    const targetSize = isHero ? 22 : 15
    let best: (typeof items)[number] | null = null
    let bestD = Infinity
    for (const cand of items) {
      if (cand === t) continue
      if (cand.size < targetSize - 1.5 || cand.size > targetSize + 1.5) continue
      if (!/^[\d\s\u00A0.,-]+$/.test(cand.str.trim())) continue
      if (cand.str.trim().length > 12) continue
      const dx = Math.abs(cand.x - t.x)
      const dy = Math.abs(cand.y - t.y)
      if (dx > 60 || dy > 45) continue
      const d = dx * 0.5 + dy
      if (d < bestD) {
        bestD = d
        best = cand
      }
    }
    if (best) return best.str.trim()
  }
  return null
}

function xlsxKpi(label: string): string | null {
  const synth = xlsxWb.Sheets['Synthèse']
  if (!synth) return null
  const keys = Object.keys(synth).filter((k) => /^[A-Z]+\d+$/.test(k) && !k.startsWith('!'))
  for (const k of keys) {
    const cell = synth[k]
    if (!cell) continue
    const raw = String(cell.v ?? '').trim()
    const clean = raw.replace(/^[\p{S}\p{P}]+\s+/u, '')
    if (clean.toUpperCase() === label) {
      const col = k.replace(/[0-9]/g, '')
      const row = parseInt(k.replace(/[^0-9]/g, ''), 10)
      const valCell = synth[`${col}${row - 1}`]
      return valCell ? String(valCell.v ?? '').replace(/^\s*\S\s+/, '').trim() : null
    }
  }
  return null
}

function xlsxTableTotal(): number | null {
  const situ = xlsxWb.Sheets['Situation complète']
  if (!situ) return null
  for (const k of Object.keys(situ).filter((k) => /^[A-Z]+\d+$/.test(k))) {
    const cell = situ[k]
    if (cell && String(cell.v ?? '').startsWith('TOTAL')) {
      const m = String(cell.v).match(/([\d\s\u00A0]+)\s*courriers/)
      return m ? parseInt(m[1].replace(/\s|\u00A0/g, ''), 10) : null
    }
  }
  return null
}

function xlsxSheetText(name: string): string {
  const ws = xlsxWb.Sheets[name]
  if (!ws) return ''
  return Object.keys(ws)
    .filter((k) => /^[A-Z]+\d+$/.test(k))
    .map((k) => String(ws[k].v ?? ''))
    .join(' ')
}

test.beforeAll(async () => {
  prepDirs()
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.DEX_ADMIN_EMAIL || 'admin@dex.local', password: process.env.DEX_ADMIN_PASSWORD || 'admin123' }),
  })
  if (!loginRes.ok) throw new Error(`Login → ${loginRes.status}`)
  TOKEN = ((await loginRes.json()) as { token: string }).token
  const auth = { Authorization: `Bearer ${TOKEN}` }

  const q = await fetch(`${API}/api/situations/requete`, { headers: auth })
  if (!q.ok) throw new Error(`Requête situation → ${q.status}`)
  const data = (await q.json()) as { stats: Record<string, unknown>; periodeLabel: string }
  stats = data.stats
  expect(data.periodeLabel).not.toMatch(/personnalisée/)

  const pdfRes = await fetch(`${API}/api/situations/export/exec-pdf?reportType=generale`, { headers: auth })
  if (!pdfRes.ok) throw new Error(`Export PDF → ${pdfRes.status}`)
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())
  fs.mkdirSync(TMP_SERVED, { recursive: true })
  fs.writeFileSync(path.join(TMP_SERVED, 'coherence.pdf'), pdfBuf)

  const xlsRes = await fetch(`${API}/api/situations/export/exec-xlsx?reportType=generale`, { headers: auth })
  if (!xlsRes.ok) throw new Error(`Export XLSX → ${xlsRes.status}`)
  xlsxWb = XLSX.read(Buffer.from(await xlsRes.arrayBuffer()), { type: 'buffer' })
})

test('1 · KPI total = total du tableau', async ({ page }) => {
  const { pdfjsUrl, workerUrl } = pdfjsUrls()
  await page.goto(`${APP}/pdf-audit/renderer.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => (window as unknown as { __auditReady?: boolean }).__auditReady === true)
  pdfPages = ((await page.evaluate(
    async ({ pdfUrl, pdfjsUrl, workerUrl }) => {
      const fn = (window as unknown as { __auditPdf: (url: string, opts: unknown) => Promise<unknown> }).__auditPdf
      return fn(pdfUrl, { scale: 1.5, pdfjsUrl, workerUrl })
    },
    { pdfUrl: tmpUrl('coherence'), pdfjsUrl, workerUrl },
  )) as { pages: AuditPageRaw[] }).pages

  const pdfTotal = kpiValue(pdfPages, 'TOTAL COURRIERS')
  const text = allText(pdfPages)
  const m = text.match(/TOTAL —\s*([\d\s\u00A0]+) courriers/)
  const tableTotal = m ? parseInt(m[1].replace(/\s|\u00A0/g, ''), 10) : null
  const xlsxTotal = xlsxTableTotal()

  expect(String(stats.total)).toBe(String(pdfTotal))
  expect(tableTotal).toBe(stats.total as number)
  expect(xlsxTotal).toBe(stats.total as number)
})

test('2 · Total des graphiques = total des courriers concernés', () => {
  const total = stats.total as number
  const s = stats as unknown as { parSituation: Record<string, number>; parModeTransmission: Record<string, number>; parSignataire: Record<string, number> }
  expect(sum(s.parSituation)).toBe(total)
  expect(sum(s.parModeTransmission)).toBe(total)
  expect(sum(s.parSignataire)).toBe(total)
})

test('3 · KPI Retirés = graphique = tableau', async () => {
  const s = stats as unknown as { retires: number; parSituation: Record<string, number> }
  const sit = s.parSituation['Retiré'] ?? 0
  expect(s.retires).toBe(sit)
  expect(kpiValue(pdfPages, 'RETIRÉS')).toBe(String(s.retires))
  expect(xlsxKpi('RETIRÉS')).toBe(String(s.retires))
  expect(allText(pdfPages)).toContain(`${s.retires} courrier`)
})

test('4 · KPI Livrés = graphique = tableau', () => {
  const s = stats as unknown as { livres: number; parSituation: Record<string, number> }
  expect(s.livres).toBe(s.parSituation['Livré'] ?? 0)
  expect(kpiValue(pdfPages, 'LIVRÉS')).toBe(String(s.livres))
  expect(xlsxKpi('LIVRÉS')).toBe(String(s.livres))
})

test('5 · KPI Nouveaux = graphique = tableau', () => {
  const s = stats as unknown as { nouveaux: number; parSituation: Record<string, number> }
  expect(s.nouveaux).toBe(s.parSituation['Nouveau'] ?? 0)
  expect(kpiValue(pdfPages, 'NOUVEAUX')).toBe(String(s.nouveaux))
  expect(xlsxKpi('NOUVEAUX')).toBe(String(s.nouveaux))
})

test('6 · Pourcentages : taux retrait correct et répartitions à 100 %', () => {
  const s = stats as unknown as { retires: number; total: number; tauxRetrait: number | null; parSituation: Record<string, number> }
  const expected = s.total > 0 ? Math.round((s.retires / s.total) * 1000) / 10 : null
  expect(s.tauxRetrait).toBe(expected)
  const total = sum(s.parSituation)
  const pctSum = Object.values(s.parSituation).reduce((a, b) => a + Math.round((b / total) * 1000) / 10, 0)
  expect(Math.abs(pctSum - 100)).toBeLessThanOrEqual(0.6)
  if (s.retires > 0) {
    const fr = String(s.tauxRetrait).replace('.', ',')
    expect(allText(pdfPages)).toContain(`${fr} %`)
  }
})

test('7 · Délais calculés uniquement sur les courriers concernés', () => {
  const s = stats as unknown as {
    tempsMoyenReponseJours: number | null
    tempsMoyenRetraitJours: number | null
    reponsesConcernes: number
    retraitsConcernes: number
    delaiMinJours: number | null
    delaiMaxJours: number | null
  }
  expect(s.tempsMoyenReponseJours != null).toBe(s.reponsesConcernes > 0)
  expect(s.tempsMoyenRetraitJours != null).toBe(s.retraitsConcernes > 0)
  expect(s.delaiMinJours != null).toBe(s.reponsesConcernes > 0)
  expect(s.delaiMaxJours != null).toBe(s.reponsesConcernes > 0)
  const text = allText(pdfPages)
  if (s.reponsesConcernes === 0) expect(text).toContain('Non applicable')
  else expect(text).toContain(`${s.reponsesConcernes} courrier`)
})

test('8 · Aucun « 0 jour » dans le rapport', () => {
  const text = allText(pdfPages)
  expect(text).not.toMatch(/(^|\s)0\s*jour/)
  const synthText = xlsxSheetText('Synthèse')
  expect(synthText).not.toMatch(/(^|\s)0\s*jour/)
  const delaisText = xlsxSheetText('Délais')
  expect(delaisText).not.toMatch(/(^|\s)0\s*jour/)
})

test('9 · Statistiques PDF = statistiques Excel', async () => {
  const s = stats as unknown as { aRappeler: number }
  for (const label of KPI_LABELS) {
    if (label === 'À RAPPELER' && s.aRappeler === 0) continue
    const pdfV = kpiValue(pdfPages, label)
    const xlV = xlsxKpi(label)
    expect(pdfV, `KPI ${label}`).not.toBeNull()
    expect(xlV, `KPI ${label}`).not.toBeNull()
    expect(pdfV, `PDF = Excel pour ${label}`).toBe(xlV)
  }
  expect(xlsxTableTotal()).toBe(stats.total as number)
})

