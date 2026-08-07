const { chromium } = require('@playwright/test')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const errors = []
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`) })
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))
  await page.goto('http://localhost:5173/rapports', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'C:/Users/HP/AppData/Local/Temp/opencode/rapports.png', fullPage: true })
  const heading = await page.getByRole('heading', { name: 'Rapports' }).count()
  const stats = await page.locator('.grid > div').count()
  const tableRows = await page.locator('tbody tr').count()
  const statText = await page.locator('tbody tr').first().textContent().catch(() => '')
  console.log(JSON.stringify({ heading, statCards: stats, tableRows, errors }, null, 2))
  await browser.close()
})().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
