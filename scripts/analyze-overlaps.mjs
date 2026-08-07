import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const file = process.argv[2] || 'current.pdf'
const outDir = process.argv[3] || 'C:\\Users\\HP\\AppData\\Local\\Temp\\opencode\\pdfpreview'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.goto('http://localhost:5173/pdf-audit/renderer.html', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__auditReady === true)

const repoRoot = process.cwd()
const toPosix = (p) => p.split(path.sep).join('/')
const pdfjsUrl = `/@fs/${toPosix(path.join(repoRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.mjs'))}`
const workerUrl = `/@fs/${toPosix(path.join(repoRoot, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'))}`

const res = await page.evaluate(
  async ({ pdfUrl, pdfjsUrl, workerUrl }) => {
    const pdfjsLib = await import(pdfjsUrl)
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    const resp = await fetch(pdfUrl)
    const data = new Uint8Array(await resp.arrayBuffer())
    const doc = await pdfjsLib.getDocument({ data }).promise
    const out = []
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i)
      const base = pg.getViewport({ scale: 1 })
      const text = await pg.getTextContent()
      const items = text.items
        .filter((t) => t.str && t.str.trim().length > 0)
        .map((t) => {
          const [a, , , , e, f] = t.transform
          const size = Math.max(Math.abs(a) || t.height || 6, 1)
          const yBot = base.height - f
          return {
            str: t.str,
            x: +e.toFixed(1),
            y: +(yBot - size * 0.95).toFixed(1),
            w: +(typeof t.width === 'number' ? t.width : size * t.str.length * 0.55).toFixed(1),
            h: +(size * 1.15).toFixed(1),
            size: +size.toFixed(2),
          }
        })
      out.push({ i, wPts: base.width, hPts: base.height, layout: base.width > base.height ? 'landscape' : 'portrait', items })
    }
    return out
  },
  { pdfUrl: `/pdf-audit/tmp/${file}`, pdfjsUrl, workerUrl },
)

const ML = 46
const MR = 46
let problems = 0
for (const p of res) {
  const W = p.wPts
  const items = p.items
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const overlaps = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      if (b.y > a.y + a.h) break
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ix > 0.5 && iy > 0.5) {
        const small = Math.min(a.w * a.h, b.w * b.h)
        if (small > 0 && (ix * iy) / small > 0.3) {
          overlaps.push(`«${a.str.slice(0, 24)}» vs «${b.str.slice(0, 24)}» (inter ${ix.toFixed(0)}x${iy.toFixed(0)})`)
        }
      }
    }
  }
  const outOfBounds = items
    .filter((t) => t.x < ML - 2 || t.x + t.w > W - MR + 2)
    .map((t) => `«${t.str.slice(0, 26)}» x=${t.x} w=${t.w} (limite ${(W - MR).toFixed(0)})`)
  if (overlaps.length) {
    problems++
    console.log(`\n== p.${p.i} ${p.layout} — ${overlaps.length} CHEVAUCHEMENT(s)`)
    for (const o of overlaps.slice(0, 12)) console.log(`   ${o}`)
  }
  if (outOfBounds.length) {
    problems++
    console.log(`\n== p.${p.i} ${p.layout} — ${outOfBounds.length} HORS MARGES`)
    for (const o of outOfBounds.slice(0, 12)) console.log(`   ${o}`)
  }
}
console.log(problems ? `\n${problems} pages avec problèmes` : '\nAucun chevauchement ni débordement')
await browser.close()
