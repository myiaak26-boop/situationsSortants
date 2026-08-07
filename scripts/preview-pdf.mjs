import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const file = process.argv[2] || 'current.pdf'
const outDir = process.argv[3] || 'C:\\Users\\HP\\AppData\\Local\\Temp\\opencode\\pdfpreview'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1300 } })
await page.goto(`http://localhost:5173/pdf-audit/preview.html?pdf=/pdf-audit/tmp/${file}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

const count = await page.locator('canvas').count()
console.log(`pages: ${count}`)
for (let i = 0; i < count; i++) {
  const name = `page-${String(i + 1).padStart(2, '0')}.png`
  await page.locator('canvas').nth(i).screenshot({ path: path.join(outDir, name), animations: 'disabled' })
  console.log(`  saved ${name}`)
}
await browser.close()
