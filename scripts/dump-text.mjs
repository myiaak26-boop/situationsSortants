import { chromium } from 'playwright'
import path from 'node:path'

const file = process.argv[2] || 'current.pdf'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:5173/pdf-audit/renderer.html', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__auditReady === true)
const repoRoot = process.cwd()
const toPosix = (p) => p.split(path.sep).join('/')
const pdfjsUrl = `/@fs/${toPosix(repoRoot + '/node_modules/pdfjs-dist/build/pdf.min.mjs')}`
const workerUrl = `/@fs/${toPosix(repoRoot + '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs')}`
const res = await page.evaluate(
  async ({ pdfUrl, pdfjsUrl, workerUrl }) => {
    const pdfjsLib = await import(pdfjsUrl)
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    const data = new Uint8Array(await (await fetch(pdfUrl)).arrayBuffer())
    const doc = await pdfjsLib.getDocument({ data }).promise
    const out = []
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i)
      const base = pg.getViewport({ scale: 1 })
      const text = await pg.getTextContent()
      const strs = text.items.filter((t) => t.str && t.str.trim()).map((t) => {
        const [a, , , , e, f] = t.transform
        const size = Math.max(Math.abs(a), 1)
        return { s: t.str, x: +e.toFixed(0), y: +(base.height - f).toFixed(0), size: +size.toFixed(1) }
      })
      out.push({ i, lens: strs.length, items: strs })
    }
    return out
  },
  { pdfUrl: `/pdf-audit/tmp/${file}`, pdfjsUrl, workerUrl },
)
for (const p of res) {
  console.log(`\n========== PAGE ${p.i} (${p.lens} items) ==========`)
  for (const t of p.items) console.log(`  [${String(t.size).padStart(4)}pt x=${String(t.x).padStart(5)} y=${String(t.y).padStart(4)}] ${t.s}`)
}
await browser.close()
