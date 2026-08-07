// Capture chaque page d'un rapport DEX (PDF) et dump texte + pixels pour analyse.
// Usage : node scripts/review-report.mjs [reportType] [outDir]
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..')
const FRONTEND = path.join(REPO, 'frontend')
const API = 'http://localhost:3000'
const APP = 'http://localhost:5173'

const reportType = process.argv[2] || 'generale'
const exportType = process.argv[3] || 'exec-pdf'
const outDir = process.argv[4] || path.join(REPO, 'test', 'report-captures', `${exportType}-${reportType}`)
const tmpDir = path.join(FRONTEND, 'public', 'pdf-audit', 'tmp')
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(tmpDir, { recursive: true })

const email = process.env.DEX_ADMIN_EMAIL || 'admin@dex.local'
const pass = process.env.DEX_ADMIN_PASSWORD || 'admin123'
const id = `review-${reportType}`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

const login = await page.request.post(`${API}/api/auth/login`, { data: { email, password: pass } })
if (!login.ok()) throw new Error(`login ${login.status()} ${await login.text()}`)
const { token } = await login.json()

const params = new URLSearchParams({ reportType })
const res = await page.request.get(`${API}/api/situations/export/${exportType}?${params}`, {
  headers: { Authorization: `Bearer ${token}` },
})
if (!res.ok()) throw new Error(`export ${res.status()} ${(await res.text()).slice(0, 300)}`)
const buf = Buffer.from(await res.body())
const pdfPath = path.join(tmpDir, `${id}.pdf`)
fs.writeFileSync(pdfPath, buf)
console.log(`PDF: ${pdfPath} (${buf.length} octets, ${exportType}/${reportType})`)

const toPosix = (p) => p.split(path.sep).join('/')
const pdfjsDir = `/@fs/${toPosix(path.join(REPO, 'node_modules', 'pdfjs-dist', 'build'))}/`

await page.goto(`${APP}/pdf-audit/renderer.html`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__auditReady === true)

const raw = await page.evaluate(
  async ({ pdfUrl, pdfjsUrl, workerUrl }) => {
    const fn = window.__auditPdf
    const data = await fn(pdfUrl, { scale: 2, tokens: [], pdfjsUrl, workerUrl })
    return data
  },
  { pdfUrl: `/pdf-audit/tmp/${id}.pdf`, pdfjsUrl: `${pdfjsDir}pdf.min.mjs`, workerUrl: `${pdfjsDir}pdf.worker.min.mjs` },
)

console.log(`Pages: ${raw.numPages}`)
const pages = raw.pages.map((p) => {
  const t = Object.fromEntries(
    Object.entries(p.px).filter(([k]) => !['bands', 'cols', 'colors', 'tokens'].includes(k)),
  )
  t.bands = p.px.bands.filter((_, i) => i % 4 === 0).map((v) => Math.round(v * 1000) / 10)
  t.colors = p.px.colors.slice(0, 6)
  return {
    i: p.i,
    wPts: Math.round(p.wPts),
    hPts: Math.round(p.hPts),
    layout: p.layout,
    px: t,
    text: p.text
      .filter((x) => x.str && x.str.trim())
      .map((x) => ({ str: x.str, x: Math.round(x.x), y: Math.round(x.y), size: Math.round(x.size * 10) / 10 })),
  }
})

for (const pg of raw.pages) {
  const nm = `page-${String(pg.i).padStart(2, '0')}.png`
  await page.locator(`[data-audit-canvas="${pg.i}"]`).first().screenshot({ path: path.join(outDir, nm) })
  console.log(`  capture ${nm} (${Math.round(pg.wPts)}x${Math.round(pg.hPts)} pt, ${pg.layout})`)
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ id, exportType, reportType, numPages: raw.numPages, pages }, null, 2))
console.log(`Out: ${outDir}`)
await browser.close()