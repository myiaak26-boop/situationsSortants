// Moteur d'audit PDF — rendu pdfjs-dist + analyse pixel + extraction texte.
// Appelé dans une page navigateur (renderer.html) par le spec Playwright.

const WHITE_LUM = 246
const EDGE_PT = 6

export async function auditPdf(pdfUrl, opts = {}) {
  const scale = opts.scale ?? 2
  const tokens = opts.tokens ?? []
  const { pdfjsUrl, workerUrl } = opts

  const pdfjsLib = await import(pdfjsUrl)
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const resp = await fetch(pdfUrl)
  if (!resp.ok) throw new Error(`PDF introuvable : ${pdfUrl} (${resp.status})`)
  const data = new Uint8Array(await resp.arrayBuffer())

  const doc = await pdfjsLib.getDocument({ data }).promise
  const out = { numPages: doc.numPages, pages: [] }

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const vp = page.getViewport({ scale })
    const w = Math.ceil(vp.width)
    const h = Math.ceil(vp.height)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.dataset.auditCanvas = String(i)
    canvas.style.top = `${(i - 1) * (h + 8)}px`
    document.getElementById('audit-root').appendChild(canvas)

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
    const img = ctx.getImageData(0, 0, w, h)

    const text = await page.getTextContent()
    const items = text.items
      .filter((t) => t.str && t.str.trim().length > 0)
      .map((t) => {
        const [a, , , , e, f] = t.transform
        const size = Math.max(Math.abs(a) || t.height || 6, 1)
        const yBot = base.height - f
        return {
          str: t.str,
          x: e,
          y: yBot - size * 0.95,
          w: typeof t.width === 'number' ? t.width : size * t.str.length * 0.55,
          h: size * 1.15,
          size,
        }
      })

    out.pages.push({
      i,
      wPts: base.width,
      hPts: base.height,
      layout: base.width > base.height ? 'landscape' : 'portrait',
      px: analyzePixels(img.data, w, h, scale, tokens, base.width, base.height),
      text: items,
    })
  }

  try {
    if (typeof doc.destroy === 'function') await doc.destroy()
  } catch {
    // nettoyage optionnel
  }
  return out
}

function analyzePixels(data, w, h, scale, tokens, pageW, pageH) {
  const lum = new Float32Array(w * h)
  const ink = new Uint8Array(w * h)
  const colored = new Uint8Array(w * h)

  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const L = (299 * r + 587 * g + 114 * b) / 1000
    lum[i] = L
    const isInk = L < WHITE_LUM
    ink[i] = isInk ? 1 : 0
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b
    if (isInk && mx - mn > 35) colored[i] = 1
  }

  // Bbox de l'encre (en points)
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  let inkCount = 0
  let coloredCount = 0
  const BANDS = 56
  const bandH = Math.max(4, Math.floor(h / BANDS))
  const bands = new Array(BANDS).fill(0)
  const COLS = 28
  const colW = Math.max(4, Math.floor(w / COLS))
  const cols = new Array(COLS).fill(0)
  const edge = { l: 0, r: 0, t: 0, b: 0 }
  const edgePx = EDGE_PT * scale

  for (let y = 0; y < h; y++) {
    const band = Math.min(BANDS - 1, Math.floor(y / bandH))
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!ink[i]) continue
      inkCount++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      bands[band]++
      cols[Math.min(COLS - 1, Math.floor(x / colW))]++
      if (x < edgePx) edge.l++
      if (x >= w - edgePx) edge.r++
      if (y < edgePx) edge.t++
      if (y >= h - edgePx) edge.b++
      if (colored[i]) coloredCount++
    }
  }

  // Netteté (gradient moyen) — tout l'encre puis pixels colorés
  let gradAll = 0
  let gradCol = 0
  let gradAllN = 0
  let gradColN = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!ink[i]) continue
      const g =
        Math.abs(lum[i] - lum[i - 1]) +
        Math.abs(lum[i] - lum[i + 1]) +
        Math.abs(lum[i] - lum[i - w]) +
        Math.abs(lum[i] - lum[i + w])
      gradAll += g
      gradAllN++
      if (colored[i]) {
        gradCol += g
        gradColN++
      }
    }
  }

  // Bbox des pixels colorés (graphiques)
  let cMinX = w
  let cMinY = h
  let cMaxX = -1
  let cMaxY = -1
  const cEdge = { l: 0, r: 0, t: 0, b: 0 }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!colored[y * w + x]) continue
      if (x < cMinX) cMinX = x
      if (x > cMaxX) cMaxX = x
      if (y < cMinY) cMinY = y
      if (y > cMaxY) cMaxY = y
      if (x < edgePx) cEdge.l++
      if (x >= w - edgePx) cEdge.r++
      if (y < edgePx) cEdge.t++
      if (y >= h - edgePx) cEdge.b++
    }
  }

  // Netteté des zones colorées : fraction de pixels à fort gradient
  let strongCol = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!colored[i]) continue
      const g =
        Math.abs(lum[i] - lum[i - 1]) +
        Math.abs(lum[i] - lum[i + 1]) +
        Math.abs(lum[i] - lum[i - w]) +
        Math.abs(lum[i] - lum[i + w])
      if (g > 90) strongCol++
    }
  }

  // Couleurs dominantes (quantifiées)
  const bucket = new Map()
  for (let i = 0; i < w * h; i++) {
    if (!ink[i]) continue
    const o = i * 4
    const key = ((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4)
    bucket.set(key, (bucket.get(key) || 0) + 1)
  }
  const colors = [...bucket.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([key, count]) => ({
      hex: `#${((key >> 8) << 4).toString(16).padStart(2, '0')}${(((key >> 4) & 15) << 4).toString(16).padStart(2, '0')}${((key & 15) << 4).toString(16).padStart(2, '0')}`,
      count,
    }))

  // Présence des tokens charte (proximité ±30 par canal)
  const tokenCounts = tokens.map((hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    let count = 0
    for (let i = 0; i < w * h; i++) {
      if (!ink[i]) continue
      const o = i * 4
      if (Math.abs(data[o] - r) <= 30 && Math.abs(data[o + 1] - g) <= 30 && Math.abs(data[o + 2] - b) <= 30) count++
    }
    return { hex, count }
  })

  // Profil ligne : dernier contenu
  let lastBand = -1
  for (let b = 0; b < BANDS; b++) if (bands[b] > Math.max(10, w * 0.002)) lastBand = b

  const totalPx = w * h
  return {
    ink: inkCount,
    colored: coloredCount,
    total: totalPx,
    inkRatio: inkCount / totalPx,
    coloredRatio: coloredCount / totalPx,
    minX: minX / scale,
    minY: minY / scale,
    maxX: maxX / scale,
    maxY: maxY / scale,
    cMinX: cMinX / scale,
    cMinY: cMinY / scale,
    cMaxX: cMaxX / scale,
    cMaxY: cMaxY / scale,
    cEdge: { l: cEdge.l / scale, r: cEdge.r / scale, t: cEdge.t / scale, b: cEdge.b / scale },
    edgeFracColored: coloredCount ? strongCol / coloredCount : 0,
    bands: bands.map((n) => n / Math.max(w, 1)),
    cols: cols.map((n) => n / Math.max(h, 1)),
    edge: { l: edge.l / scale, r: edge.r / scale, t: edge.t / scale, b: edge.b / scale },
    bottomFrac: lastBand < 0 ? 1 : 1 - (lastBand + 1) / BANDS,
    sharpAll: gradAllN ? gradAll / gradAllN : 0,
    sharpColored: gradColN ? gradCol / gradColN : 0,
    centerMassX: 0,
    colors,
    tokens: tokenCounts,
  }
}
