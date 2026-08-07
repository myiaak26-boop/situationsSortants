// Suite de tests visuels des rapports DEX.
// Pipeline : générer → ouvrir → capturer chaque page → analyser (pixel + texte)
// → détecter les défauts → scorer → écrire le rapport d'audit.
// Objectif : score global ≥ 95/100 sur chaque rapport.

import { test, expect, request } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SCENARIOS, prepDirs, fetchReportFile, fetchParams, renderAndCapture, capturePages, assessPdf, persist, writeGlobalIndex, auditOutDir } from './audit/engine.js'
import { auditXlsxBuffer } from './audit/xlsx-audit.js'
import type { ScenarioReport } from './audit/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TMP_SERVED = path.resolve(__dirname, '..', 'public', 'pdf-audit', 'tmp')

test.describe.configure({ mode: 'serial' })

const API = 'http://localhost:3000'
const APP = 'http://localhost:5173'
let TOKEN = ''
let EXPECTED_LOGO = false
const allReports: ScenarioReport[] = []

test.beforeAll(async () => {
  prepDirs()
  const ctx = await request.newContext({ baseURL: API })
  const res = await ctx.post('/api/auth/login', {
    data: { email: process.env.DEX_ADMIN_EMAIL || 'admin@dex.local', password: process.env.DEX_ADMIN_PASSWORD || 'admin123' },
  })
  if (!res.ok) throw new Error(`Login → ${res.status()}`)
  TOKEN = ((await res.json()) as { token: string }).token
  const params = await fetchParams(API, TOKEN)
  EXPECTED_LOGO = Boolean(params['situation.logo']?.trim())
  await ctx.dispose()
})

test.afterAll(() => {
  // Nettoyage des fichiers temporaires servis par Vite
  fs.rmSync(TMP_SERVED, { recursive: true, force: true })
  writeGlobalIndex(allReports)
  const reportPath = path.join(auditOutDir(), 'index.html')
  console.log(`\nRapport d'audit global : file:///${reportPath.replace(/\\/g, '/')}`)
  const worst = Math.min(...allReports.map((r) => r.globalScore), 100)
  if (worst < 95) {
    console.warn(`⚠ Score minimum : ${worst}/100 — corrections requises (voir rapport HTML).`)
  }
})

for (const scenario of SCENARIOS) {
  test(`Audit visuel — ${scenario.label}`, async ({ page }) => {
    const { dir, size } = await fetchReportFile(API, TOKEN, scenario)
    const { pages } = await renderAndCapture(page, scenario)
    const shots = await capturePages(page, { pages }, dir)

    const rep = assessPdf({ pages }, scenario, { fileSize: size, expectedLogo: EXPECTED_LOGO })
    await persist(rep, shots)
    allReports.push(rep)

    for (const p of rep.pages) {
      expect(p.wPts, `p.${p.i} format A4 (largeur ${p.wPts})`).toBeGreaterThan(400)
      expect(p.wPts, `p.${p.i} format A4 (largeur ${p.wPts})`).toBeLessThan(900)
      expect(p.hPts, `p.${p.i} format A4 (hauteur ${p.hPts})`).toBeGreaterThan(400)
      expect(p.hPts, `p.${p.i} format A4 (hauteur ${p.hPts})`).toBeLessThan(900)
    }

    const failures = rep.checks.filter((c) => c.ok === false)
    if (failures.length) {
      console.warn(`\n[${scenario.label}] ${failures.length} défaut(s) :`)
      for (const f of failures) {
        console.warn(`  p.${f.page} ${f.severity.toUpperCase()} — ${f.label} : ${f.detail}`)
        console.warn(`     → Correction : ${f.fix}`)
      }
    }
    console.log(`[${scenario.label}] Score : ${rep.globalScore}/100 (objectif 95) — ${rep.verdict}`)
    expect(rep.globalScore, `Score ${scenario.label} ≥ 95 — détails dans ${dir}/index.html`).toBeGreaterThanOrEqual(95)
  })
}

test('Audit structurel — Excel Exécutif et Standard', async () => {
  for (const [type, reportType, label] of [
    ['exec-xlsx', 'generale', 'Excel Exécutif'],
    ['xlsx', 'generale', 'Excel Standard'],
  ] as const) {
    const params = new URLSearchParams({ reportType })
    const res = await fetch(`${API}/api/situations/export/${type}?${params}`, { headers: { Authorization: `Bearer ${TOKEN}` } })
    expect(res.ok, `${label} généré (${res.status})`).toBeTruthy()
    const buf = Buffer.from(await res.arrayBuffer())
    const audit = await auditXlsxBuffer(buf, { exec: type === 'exec-xlsx' })
    for (const l of audit.lines) {
      console.log(`  [${label}] ${l.ok ? '✓' : '✗'} ${l.label} — ${l.detail}`)
    }
    console.log(`[${label}] Score : ${audit.score}/100`)
    expect(audit.score, `${label} ≥ 95`).toBeGreaterThanOrEqual(95)
  }
})
