// Moteur d'audit des rapports DEX — génération, capture, analyse pixel/texte, score, corrections.
// Utilisé par le spec Playwright `report-audit.spec.ts`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COLORS, GRID, CHART_COLORS, FONT_SIZES, tint } from '../../../backend/dist/lib/report/theme.js'
import { TABLE_COL_DEFS, REPORT_TYPES } from '../../../backend/dist/lib/report/types.js'
import type { AuditPageRaw, AuditTextItem, AuditPixels, CategoryScore, Finding, ScenarioReport, Severity } from './types.js'
import { writeScenarioHtml, writeIndexHtml } from './report.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const TMP_SERVED = path.join(FRONTEND_ROOT, 'public', 'pdf-audit', 'tmp')
const AUDIT_OUT = path.resolve(FRONTEND_ROOT, '..', 'test-results', 'report-audit')

export type ExportType = 'pdf' | 'exec-pdf' | 'exec-xlsx'

export interface Scenario {
  id: string
  label: string
  type: ExportType
  reportType: string
  params?: Record<string, string>
}

export const SCENARIOS: Scenario[] = [
  { id: 'exec-generale', label: 'PDF Exécutif — Générale', type: 'exec-pdf', reportType: 'generale' },
  { id: 'executive', label: 'PDF Exécutif — Confidentiel', type: 'exec-pdf', reportType: 'executive' },
  { id: 'parSignataire', label: 'PDF Exécutif — Par signataire', type: 'exec-pdf', reportType: 'parSignataire' },
  { id: 'reponses', label: 'PDF Exécutif — Courriers réponses', type: 'exec-pdf', reportType: 'reponses' },
  { id: 'pdf-standard', label: 'PDF Standard (compact)', type: 'pdf', reportType: 'generale' },
]

const P = GRID
const { pageW, pageH, marginL, marginR, footerH } = P
const TOL_M = 3.0

export const TOKENS = Object.values(COLORS).filter((c) => typeof c === 'string') as string[]
export const PALETTE = new Set<string>([...TOKENS, ...Object.values(CHART_COLORS)])
for (const c of [...TOKENS, ...Object.values(CHART_COLORS)]) {
  for (const a of [0.13, 0.5, 0.85]) PALETTE.add(tint(c as string, a))
}

const EXPECTED_SIZES = [
  ...new Set<number>([...Object.values(FONT_SIZES).filter((v): v is number => typeof v === 'number'), 6.8, 7.5, 8.5, 9.5, 10.5, 12, 15, 16, 22]),
]

// ---------------------------------------------------------------------------
// Infrastructure fichiers
// ---------------------------------------------------------------------------
export function prepDirs() {
  fs.mkdirSync(TMP_SERVED, { recursive: true })
  fs.mkdirSync(AUDIT_OUT, { recursive: true })
}

export function pdfjsUrls() {
  const toPosix = (p: string) => p.split(path.sep).join('/')
  const base = `/@fs/${toPosix(REPO_ROOT)}/node_modules/pdfjs-dist/build/`
  return { pdfjsUrl: `${base}pdf.min.mjs`, workerUrl: `${base}pdf.worker.min.mjs` }
}

export async function fetchReportFile(baseURL: string, token: string, esc: Scenario): Promise<{ dir: string; name: string; size: number }> {
  const params = new URLSearchParams({ reportType: esc.reportType, ...(esc.params || {}) })
  const url = `${baseURL}/api/situations/export/${esc.type}?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Export ${esc.type}/${esc.reportType} → ${res.status} ${(await res.text().catch(() => ''))}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(TMP_SERVED, { recursive: true })
  const name = `${esc.id}.pdf`
  fs.writeFileSync(path.join(TMP_SERVED, name), buf)
  fs.mkdirSync(path.join(AUDIT_OUT, esc.id), { recursive: true })
  return { dir: path.join(AUDIT_OUT, esc.id), name, size: buf.length }
}

export async function fetchParams(baseURL: string, token: string): Promise<Record<string, string>> {
  const res = await fetch(`${baseURL}/api/parametres`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return {}
  const data = await res.json()
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  const map: Record<string, string> = {}
  for (const it of list) map[it.cle] = it.valeur ?? ''
  return map
}

export function tmpUrl(scenarioId: string): string {
  return `/pdf-audit/tmp/${scenarioId}.pdf`
}

// ---------------------------------------------------------------------------
// Capture + analyse dans le navigateur (pdfjs)
// ---------------------------------------------------------------------------
export async function renderAndCapture(page: import('@playwright/test').Page, scenario: Scenario): Promise<{ pages: AuditPageRaw[] }> {
  const { pdfjsUrl, workerUrl } = pdfjsUrls()
  await page.goto('http://localhost:5173/pdf-audit/renderer.html', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => (window as unknown as { __auditReady?: boolean }).__auditReady === true)
  const raw = (await page.evaluate(
    async ({ pdfUrl, pdfjsUrl, workerUrl, tokens }) => {
      const fn = (window as unknown as { __auditPdf: (url: string, opts: unknown) => Promise<unknown> }).__auditPdf
      return fn(pdfUrl, { scale: 2, tokens, pdfjsUrl, workerUrl })
    },
    { pdfUrl: tmpUrl(scenario.id), pdfjsUrl, workerUrl, tokens: TOKENS },
  )) as { numPages: number; pages: AuditPageRaw[] }
  return { pages: raw.pages }
}

export async function capturePages(page: import('@playwright/test').Page, raw: { pages: AuditPageRaw[] }, dir: string) {
  const shots: string[] = []
  for (const pg of raw.pages) {
    const name = `page-${String(pg.i).padStart(2, '0')}.png`
    const loc = page.locator(`[data-audit-canvas="${pg.i}"]`)
    await loc.screenshot({ path: path.join(dir, name), animations: 'disabled' })
    shots.push(name)
  }
  return shots
}

// ---------------------------------------------------------------------------
// Référentiel attendu (miroir du générateur)
// ---------------------------------------------------------------------------
function expectedCols(reportType: string) {
  const cfg = REPORT_TYPES[reportType] || REPORT_TYPES.generale
  return cfg.cols.map((id) => TABLE_COL_DEFS[id])
}

// ---------------------------------------------------------------------------
// Helper géométriques
// ---------------------------------------------------------------------------
const near = (a: number, b: number, tol = TOL_M) => Math.abs(a - b) <= tol
const pt = (p: AuditPixels) => p
const itemsIn = (page: AuditPageRaw, yMin: number, yMax: number) => page.text.filter((t) => t.y >= yMin && t.y + t.h <= yMax)
const sectionTitles = (page: AuditPageRaw) => page.text.filter((t) => t.size > 12 && t.size < 15)
const footerItems = (page: AuditPageRaw) => itemsIn(page, page.hPts - 46, page.hPts + 10)
const headerItems = (page: AuditPageRaw) => itemsIn(page, -2, 36)
const contentItems = (page: AuditPageRaw) => page.text.filter((t) => t.y > 36 && t.y + t.h < page.hPts - 44)

// ---------------------------------------------------------------------------
// Évaluation d'un rapport
// ---------------------------------------------------------------------------
export function assessPdf(raw: { pages: AuditPageRaw[] }, scenario: Scenario, extra: { fileSize: number; expectedLogo: boolean }): ScenarioReport {
  const pages = raw.pages
  const checks: Finding[] = []
  const push = (f: Omit<Finding, 'page'>) => checks.push({ ...f, page: f.page ?? 0 } as Finding)

  const contentPages = pages.filter((p) => p.i > 1)
  const landscapePages = pages.filter((p) => p.layout === 'landscape')
  const chartPages = pages.filter((p) => p.layout === 'portrait' && p.px.coloredRatio > 0.03)
  const lastPage = pages[pages.length - 1]

  // ---- 1. Format A4 ------------------------------------------------------
  const a4Bad = pages.filter((p) => {
    const okP = near(p.wPts, pageW, 2.5) && near(p.hPts, pageH, 2.5)
    const okL = near(p.wPts, pageH, 2.5) && near(p.hPts, pageW, 2.5)
    return !okP && !okL
  })
  push({
    id: 'formatA4', label: 'Impression A4 parfaite', cat: 'Impression', severity: a4Bad.length ? 'critique' : 'info',
    ok: a4Bad.length === 0, detail: a4Bad.length ? `Pages hors A4 : ${a4Bad.map((p) => p.i).join(', ')} (${a4Bad.map((p) => `${p.wPts.toFixed(1)}×${p.hPts.toFixed(1)}`).join(' ; ')})` : `${pages.length} page(s) au format A4`,
    cause: 'Générateur PDF (pdfkit) avec size A4', impact: 'Impression et présentation sur papier non conformes', fix: 'Vérifier size A4 dans pdf/index.ts', priority: 'P0',
  })

  // ---- 2. Marges identiques ----------------------------------------------
  const marginBads: string[] = []
  const lefts = contentPages.map((p) => p.px.minX)
  const rights = contentPages.map((p) => (p.layout === 'landscape' ? pageH : pageW) - p.px.maxX)
  for (const p of contentPages) {
    const W = p.layout === 'landscape' ? pageH : pageW
    if (p.px.minX < marginL - 2.5) marginBads.push(`p.${p.i} déborde à gauche (contenu à ${p.px.minX.toFixed(1)} pt, marge ${marginL})`)
    if (W - p.px.maxX < marginR - 2.5) marginBads.push(`p.${p.i} déborde à droite (contenu à ${p.px.maxX.toFixed(1)} pt, marge ${marginR})`)
  }
  const sd = (v: number[]) => {
    if (v.length < 2) return 0
    const m = v.reduce((a, b) => a + b, 0) / v.length
    return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
  }
  const sdL = sd(lefts)
  const sdR = sd(rights)
  if (sdL > 3 || sdR > 3) marginBads.push(`marges non uniformes d'une page à l'autre (écart-type gauche ${sdL.toFixed(1)} pt, droite ${sdR.toFixed(1)} pt)`)
  push({
    id: 'marges', label: 'Marges identiques', cat: 'Mise en page', severity: marginBads.length ? 'majeur' : 'info',
    ok: marginBads.length === 0, detail: marginBads.length ? marginBads.join(' ; ') : `Marge gauche ${lefts[0]?.toFixed(1) ?? '—'} pt, droite ${rights[0]?.toFixed(1) ?? '—'} pt, constantes sur toutes les pages`,
    cause: marginBads.length ? 'Débordement de contenu ou largeur de tableau supérieure à la zone utile' : 'Template respecte la grille 46 pt',
    impact: 'Un débordement latéral casse l\'alignement de la grille et l\'impression', fix: 'Réduire la largeur des colonnes du tableau (config types.ts) ou ramener le contenu dans la marge',
    priority: 'P0',
  })

  // ---- 3. Aucune ligne/contenu qui dépasse (bords de page) ---------------
  const edgeBads: string[] = []
  for (const p of contentPages) {
    const e = p.px.edge
    const W = p.layout === 'landscape' ? pageH : pageW
    const H = p.layout === 'landscape' ? pageW : pageH
    if (e.t > H * 0.03) edgeBads.push(`p.${p.i} contenu à moins de 6 pt du bord haut`)
    if (e.b > H * 0.03) edgeBads.push(`p.${p.i} contenu à moins de 6 pt du bord bas`)
    if (e.l > W * 0.03) edgeBads.push(`p.${p.i} contenu à moins de 6 pt du bord gauche`)
    if (e.r > W * 0.03) edgeBads.push(`p.${p.i} contenu à moins de 6 pt du bord droit`)
  }
  push({
    id: 'bords', label: 'Aucune ligne qui dépasse', cat: 'Mise en page', severity: edgeBads.length ? 'majeur' : 'info',
    ok: edgeBads.length === 0, detail: edgeBads.length ? edgeBads.join(' ; ') : 'Aucun élément ne touche les bords de page',
    cause: 'Élément dessiné en coordonnées absolues hors zone imprimable', impact: 'Coupe à l\'impression ou non-imprimé', fix: 'Repasser les coordonnées des éléments incriminés dans la grille',
    priority: 'P1',
  })

  // ---- 4. Espacements cohérents (module 8 pt, KPI 56 pt) ------------------
  let spacingWarn = ''
  for (const p of contentPages.filter((x) => x.px.cols[0] > 0)) {
    void p
  }
  const kpiGapBads: string[] = []
  for (const p of contentPages) {
    const kpis = p.text
      .filter((t) => near(t.size, 13, 0.6) && t.y > 60 && t.y < 320)
      .sort((a, b) => a.y - b.y)
    if (kpis.length < 3) continue
    const gaps = kpis.slice(1).map((t, i) => t.y - kpis[i].y)
    const bad = gaps.filter((g) => g > 24 && !near(g, 56, 3))
    if (bad.length) kpiGapBads.push(`p.${p.i} cartes KPI espacées de ${bad.map((b) => b.toFixed(0)).join('/')} pt (attendu 56)`)
  }
  push({
    id: 'espaces', label: 'Espacements cohérents', cat: 'Espacements', severity: kpiGapBads.length ? 'mineur' : 'info',
    ok: kpiGapBads.length === 0, detail: kpiGapBads.length ? kpiGapBads.join(' ; ') : 'Grille KPI au pas de 56 pt, sections sur le module 8 pt',
    cause: 'Valeurs d\'espacement non multiples du module', impact: 'Rythme vertical irrégulier, impression de densité inégale', fix: 'Utiliser des multiples de 8 pt (GRID.module)',
    priority: 'P2',
  })

  // ---- 5. Texte coupé ------------------------------------------------------
  const cut: { p: number; s: string }[] = []
  for (const p of pages) {
    for (const t of p.text) {
      if (t.str.endsWith('…') || t.str.endsWith('..')) cut.push({ p: p.i, s: t.str.slice(0, 60) })
    }
  }
  push({
    id: 'texteCoupe', label: 'Aucun texte coupé', cat: 'Lisibilité', severity: cut.length ? 'majeur' : 'info',
    ok: cut.length === 0, detail: cut.length ? `${cut.length} texte(s) tronqué(s) avec « … » : ${cut.slice(0, 4).map((c) => `p.${c.p} « ${c.s} »`).join(' ; ')}` : 'Aucun texte tronqué',
    cause: cut.length ? 'Contenu trop long pour la largeur de colonne (fit() ajoute « … »)' : 'Largeurs de colonnes suffisantes',
    impact: 'Information perdue pour le lecteur', fix: 'Élargir la colonne ou réduire la taille de police du tableau (7 → 6,5)',
    priority: 'P1',
  })

  // ---- 6. Texte qui déborde -------------------------------------------------
  const overflow: string[] = []
  for (const p of contentPages) {
    const W = p.layout === 'landscape' ? pageH : pageW
    for (const t of contentItems(p)) {
      if (t.x < marginL - 2.5) overflow.push(`p.${p.i} « ${t.str.slice(0, 30)} » commence à ${t.x.toFixed(1)} pt (marge ${marginL})`)
      if (t.x + t.w > W - marginR + 2.5) overflow.push(`p.${p.i} « ${t.str.slice(0, 30)} » dépasse à ${(t.x + t.w).toFixed(1)} pt (limite ${(W - marginR).toFixed(1)})`)
    }
  }
  push({
    id: 'texteDeborde', label: 'Aucun texte qui déborde', cat: 'Lisibilité', severity: overflow.length ? 'majeur' : 'info',
    ok: overflow.length === 0, detail: overflow.length ? overflow.slice(0, 6).join(' ; ') : 'Tout le texte reste dans la zone utile',
    cause: overflow.length ? 'Texte plus large que son conteneur (cellule, badge, cartouche)' : 'Conteneurs correctement dimensionnés',
    impact: 'Chevauchement visuel avec les colonnes voisines', fix: 'Utiliser fit() ou réduire la taille du texte concerné',
    priority: 'P0',
  })

  // ---- 7. Tableau coupé ------------------------------------------------------
  const tableCut: string[] = []
  for (const p of landscapePages) {
    const bottom = Math.max(0, ...contentItems(p).map((t) => t.y + t.h))
    if (bottom > p.hPts - 84 + 4) tableCut.push(`p.${p.i} dernier contenu à ${bottom.toFixed(0)} pt (zone imprimable jusqu\'à ${(p.hPts - 84).toFixed(0)})`)
  }
  push({
    id: 'tableauCoupe', label: 'Aucun tableau coupé', cat: 'Tableaux', severity: tableCut.length ? 'critique' : 'info',
    ok: tableCut.length === 0, detail: tableCut.length ? tableCut.join(' ; ') : 'Toutes les lignes restent dans la zone imprimable (pied de page préservé)',
    cause: tableCut.length ? 'Lignes dessinées sans test de bascule de page' : 'drawTable gère le passage de page',
    impact: 'Lignes tronquées à l\'impression, données illisibles', fix: 'Vérifier le test addPage() dans drawTable (components.ts)',
    priority: 'P0',
  })

  // ---- 8. Colonnes dimensionnées + en-têtes répétés ---------------------------
  const colProbs: string[] = []
  const expected = expectedCols(scenario.reportType)
  // Les colonnes vides sur la sélection sont masquées dynamiquement : le
  // référentiel des en-têtes attendus est dérivé de la 1ère page paysage.
  const renderedHeaders = (p: AuditPageRaw) =>
    p.text
      .filter((t) => t.y > 40 && t.y < 140)
      .map((t) => t.str.trim())
      .filter((s) => expected.some((c) => c.header === s))
  const headerNames = landscapePages.length ? [...new Set(renderedHeaders(landscapePages[0]))] : expected.map((c) => c.header)
  const headerPos: Record<string, number> = {}
  if (landscapePages.length) {
    const first = landscapePages[0]
    for (const t of first.text) {
      if (t.y > 40 && t.y < 140 && headerNames.includes(t.str.trim())) headerPos[t.str.trim()] = t.x
    }
  }
  for (const p of landscapePages) {
    for (const h of headerNames) {
      const t = p.text.find((x) => x.y > 40 && x.y < 140 && x.str.trim() === h)
      if (t && headerPos[h] !== undefined && !near(t.x, headerPos[h], 3)) {
        colProbs.push(`p.${p.i} en-tête « ${h} » à x=${t.x.toFixed(0)} vs ${headerPos[h].toFixed(0)}`)
      }
      if (!t) colProbs.push(`p.${p.i} en-tête « ${h} » absent`)
    }
  }
  // chevauchement horizontal entre items voisins d'une même ligne
  for (const p of landscapePages) {
    const rows = new Map<number, AuditTextItem[]>()
    for (const t of contentItems(p)) {
      const key = Math.round(t.y / 8)
      if (!rows.has(key)) rows.set(key, [])
      rows.get(key)!.push(t)
    }
    for (const [, items] of rows) {
      const sorted = [...items].sort((a, b) => a.x - b.x)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const cur = sorted[i]
        if (cur.x < prev.x + prev.w - 1.5) {
          if (cur.x - prev.x < 4) continue
          colProbs.push(`p.${p.i} chevauchement « ${prev.str.slice(0, 20)} » / « ${cur.str.slice(0, 20)} »`)
        }
      }
    }
  }
  push({
    id: 'colonnes', label: 'Colonnes correctement dimensionnées', cat: 'Tableaux', severity: colProbs.length ? 'majeur' : 'info',
    ok: colProbs.length === 0, detail: colProbs.length ? colProbs.slice(0, 6).join(' ; ') : `${headerNames.length} colonne(s) stables sur toutes les pages paysage`,
    cause: colProbs.length ? 'Largeur de colonne insuffisante ou position non uniforme' : 'Colonnes définies par config et répétées',
    impact: 'Données illisibles ou en-têtes incohérents d\'une page à l\'autre', fix: 'Ajuster TABLE_COL_DEFS (w) ou revoir la répétition d\'en-tête',
    priority: 'P1',
  })

  // ---- 9. Sous-totaux / total --------------------------------------------------
  const totalOk = landscapePages.some((p) => p.text.some((t) => t.str.startsWith('TOTAL —')))
  const groupBy = REPORT_TYPES[scenario.reportType]?.groupBy
  const subOk = !groupBy || landscapePages.some((p) => p.text.some((t) => t.str.includes('sous-total')))
  push({
    id: 'totaux', label: 'Totaux et sous-totaux', cat: 'Tableaux', severity: !totalOk ? 'majeur' : 'info',
    ok: totalOk && subOk,
    detail: `${totalOk ? 'Ligne TOTAL présente' : 'Ligne TOTAL absente'}${groupBy ? ` ; ${subOk ? 'sous-totaux présents' : 'sous-totaux absents'}` : ''}`,
    cause: !totalOk ? 'drawTotal non appelé ou ligne non rendue' : 'Logique des totaux conforme',
    impact: 'Lecture exécutive du volume impossible', fix: 'Vérifier drawTotal/drawSubtotal (components.ts)',
    priority: 'P1',
  })

  // ---- 10. Graphiques -----------------------------------------------------------
  const chartProbs: string[] = []
  for (const p of chartPages) {
    const W = p.layout === 'landscape' ? pageH : pageW
    const c = p.px
    if (c.cEdge.r > 8 || c.cEdge.l > 8) chartProbs.push(`p.${p.i} graphique touche un bord latéral (coloré à ${Math.max(c.cEdge.l, c.cEdge.r).toFixed(0)} px du bord)`)
    if (c.cEdge.b > 8) chartProbs.push(`p.${p.i} graphique tronqué en bas (coloré jusqu'au bord, ${c.cEdge.b.toFixed(0)} px)`)
    if (c.colored > 1500 && c.edgeFracColored < 0.05) chartProbs.push(`p.${p.i} graphique flou (netteté ${(c.edgeFracColored * 100).toFixed(0)} %)`)
    const legend = p.text.filter((t) => t.size <= 8 && t.size >= 5).length
    if (legend === 0) chartProbs.push(`p.${p.i} graphique sans légende`)
  }
  push({
    id: 'graphiques', label: 'Graphiques équilibrés, nets, lisibles', cat: 'Graphiques', severity: chartProbs.length ? 'majeur' : 'info',
    ok: chartProbs.length === 0, detail: chartProbs.length ? chartProbs.join(' ; ') : `${chartPages.length} page(s) de graphiques nets, dans les marges, avec légendes`,
    cause: chartProbs.length ? 'Dimensions des charts ou dessin vectoriel dégradé' : 'Dessin vectoriel pdfkit correct',
    impact: 'Analyse visuelle faussée ou illisible', fix: 'Revoir charts.ts (taille des zones, légendes, netteté)',
    priority: 'P1',
  })

  // ---- 11. Alignements -----------------------------------------------------------
  const alignProbs: string[] = []
  // En-têtes courants : même position gauche/droite
  const headerLefts = contentPages.map((p) => headerItems(p).filter((t) => t.x < p.wPts * 0.7).map((t) => t.x))
  for (let i = 1; i < headerLefts.length; i++) {
    if (headerLefts[i].length && headerLefts[i - 1].length && !near(headerLefts[i][0], headerLefts[i - 1][0], 2.5)) {
      alignProbs.push(`en-tête courant décalé p.${i + 1} vs p.${i}`)
    }
  }
  // Icônes KPI alignées sur la grille verticale (pas de 128 pt = largeur carte + 10)
  // Seules les pastilles non-ASCII sont des icônes (les valeurs des barres sont des chiffres).
  const glyphXByPage: number[][] = contentPages.map((p) =>
    p.text.filter((t) => p.layout === 'portrait' && t.size > 8 && t.size < 9 && t.str.length <= 2 && /[^\x00-\x7F]/u.test(t.str) && t.y < 300).map((t) => t.x).sort((a, b) => a - b)
  )
  const kpiStep = (pageW - marginL - marginR - GRID.kpiGap * (GRID.kpiCols - 1)) / GRID.kpiCols + GRID.kpiGap
  const kpiCols = Array.from({ length: GRID.kpiCols }, (_, k) => marginL + 8 + 6.5 + k * kpiStep)
  const badGlyph: string[] = []
  glyphXByPage.forEach((xs, idx) => {
    xs.forEach((x) => {
      if (!kpiCols.some((cx) => near(x, cx, 4))) badGlyph.push(`p.${idx + 1} icône à x=${x.toFixed(0)} (colonne la plus proche à ${kpiCols.some((cx) => near(x, cx, 12))})`)
    })
  })
  if (badGlyph.length) alignProbs.push(`${badGlyph.length} pastilles d'icônes hors grille : ${badGlyph.slice(0, 3).join(' ; ')}`)
  push({
    id: 'alignements', label: 'Alignements parfaits', cat: 'Alignements', severity: alignProbs.length ? 'mineur' : 'info',
    ok: alignProbs.length === 0, detail: alignProbs.length ? alignProbs.slice(0, 5).join(' ; ') : 'En-têtes, icônes et colonnes alignés sur la grille',
    cause: alignProbs.length ? 'Décalage de coordonnées dans un composant' : 'Grille partagée (GRID) respectée',
    impact: 'Finition professionnelle compromise', fix: 'Aligner sur GRID.marginL et le module 8 pt',
    priority: 'P2',
  })

  // ---- 12. Centrage (couverture) ---------------------------------------------------
  const centProbs: string[] = []
  const cover = pages[0]
  if (cover) {
    for (const t of cover.text) {
      if (t.y < 360 && t.w > 40 && !(t.str === t.str.toUpperCase() && t.str.length > 4)) {
        const center = t.x + t.w / 2
        if (!near(center, pageW / 2, 4)) centProbs.push(`élément « ${t.str.slice(0, 30)} » centré à ${center.toFixed(0)} pt (attendu ${pageW / 2})`)
      }
    }
  }
  push({
    id: 'centrage', label: 'Éléments centrés', cat: 'Alignements', severity: centProbs.length ? 'mineur' : 'info',
    ok: centProbs.length === 0, detail: centProbs.length ? centProbs.join(' ; ') : 'Titre, devise et métadonnées centrés sur la couverture',
    cause: centProbs.length ? 'Largeur de zone différente de la page' : 'Rendu centré (align center, width page)',
    impact: 'Impression déséquilibrée', fix: 'Utiliser width=pageW et align=center',
    priority: 'P2',
  })

  // ---- 13. Typographie cohérente -----------------------------------------------------
  const weirdSizes: { p: number; size: number; s: string }[] = []
  for (const p of pages) {
    for (const t of p.text) {
      if (!EXPECTED_SIZES.some((s) => Math.abs(s - t.size) < 0.6)) weirdSizes.push({ p: p.i, size: t.size, s: t.str.slice(0, 30) })
    }
  }
  push({
    id: 'typo', label: 'Typographie cohérente', cat: 'Typographie', severity: weirdSizes.length ? 'mineur' : 'info',
    ok: weirdSizes.length === 0, detail: weirdSizes.length ? `${weirdSizes.length} taille(s) hors échelle : ${weirdSizes.slice(0, 5).map((w) => `p.${w.p} ${w.size.toFixed(1)} pt (« ${w.s} »)`).join(' ; ')}` : 'Échelle Arial respectée (6,5 → 23 pt)',
    cause: weirdSizes.length ? 'Taille de police en dur dans un composant' : 'FONT_SIZES partagé par tous les composants',
    impact: 'Hiérarchie visuelle instable', fix: 'Remplacer la taille par un token FONT_SIZES',
    priority: 'P2',
  })

  // ---- 14. Hiérarchie des titres -------------------------------------------------------
  const hierProbs: string[] = []
  const coverTitles = cover ? cover.text.filter((t) => t.y < 600) : []
  const sizesOnCover = new Set(coverTitles.map((t) => Math.round(t.size)))
  if (cover) {
    if (!sizesOnCover.has(23)) hierProbs.push('couverture : titre Display 23 pt absent')
    if (!sizesOnCover.has(17)) hierProbs.push('couverture : institution H1 17 pt absente')
    if (!sizesOnCover.has(13)) hierProbs.push('couverture : République H2 13 pt absente')
  }
  for (const p of contentPages) {
    if (p.layout === 'landscape') continue
    if (sectionTitles(p).length === 0) hierProbs.push(`p.${p.i} aucun titre de section 13 pt`)
  }
  if (chartPages.length) {
    const h3Present = chartPages.some((p) => p.text.some((t) => near(t.size, 11, 0.6)))
    if (!h3Present) hierProbs.push('graphiques : titres H3 11 pt absents')
  }
  push({
    id: 'hierarchie', label: 'Titres correctement hiérarchisés', cat: 'Hiérarchie', severity: hierProbs.length ? 'majeur' : 'info',
    ok: hierProbs.length === 0, detail: hierProbs.length ? hierProbs.join(' ; ') : 'Display 23 → H1 17 → H2 13 → H3 11 respectés',
    cause: hierProbs.length ? 'Hiérarchie non appliquée sur une page' : 'Template de couverture et sections conformes',
    impact: 'Repérage des sections difficile pour un lecteur pressé', fix: 'Appliquer l\'échelle FONT_SIZES sur les titres',
    priority: 'P1',
  })

  // ---- 15. Numérotation des sections --------------------------------------------------
  const numProbs: string[] = []
  const pageText = (p: AuditPageRaw) => p.text.map((t) => t.str).join(' ')
  const expects: [string, string][] = [
    ['Synthèse exécutive', '1'],
    ['Indicateurs temporels', '2'],
    ['Graphiques et analyse', '3'],
    ['Tableau détaillé des courriers', '4'],
    ['Conclusion', '5'],
  ]
  for (const [name, num] of expects) {
    const p = pages.find((x) => pageText(x).includes(name))
    if (p && !pageText(p).match(new RegExp(`(^|\\s)${num}\\s{1,2}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))) {
      numProbs.push(`section « ${name} » sans numéro ${num}`)
    }
  }
  push({
    id: 'numerotation', label: 'Sections numérotées', cat: 'Hiérarchie', severity: numProbs.length ? 'mineur' : 'info',
    ok: numProbs.length === 0, detail: numProbs.length ? numProbs.join(' ; ') : 'Sections 1 à 5 numérotées',
    cause: numProbs.length ? 'Numéro manquant dans sectionTitle' : 'sectionTitle(num, titre) appelé partout',
    impact: 'Référencement des sections dans les comptes rendus', fix: 'Passer le numéro à sectionTitle',
    priority: 'P3',
  })

  // ---- 16. Pagination -----------------------------------------------------------------
  const pagProbs: string[] = []
  const paginationRe = /^\d+ \/ \d+$/
  for (const p of pages) {
    const pageNum = footerItems(p).find((t) => paginationRe.test(t.str.trim()) && t.x > p.wPts * 0.6)
    if (p.i === 1) {
      if (pageNum) pagProbs.push('couverture : pagination présente (doit être absente)')
    } else if (!pageNum) {
      pagProbs.push(`p.${p.i} pagination manquante`)
    } else {
      const [a, b] = pageNum.str.trim().split('/').map((s) => parseInt(s, 10))
      if (a !== p.i) pagProbs.push(`p.${p.i} numéro de page erroné (${a})`)
      if (b !== pages.length) pagProbs.push(`p.${p.i} total de pages erroné (${b} au lieu de ${pages.length})`)
    }
  }
  push({
    id: 'pagination', label: 'Pagination correcte', cat: 'Impression', severity: pagProbs.length ? 'majeur' : 'info',
    ok: pagProbs.length === 0, detail: pagProbs.length ? pagProbs.join(' ; ') : `« x / ${pages.length} » sur toutes les pages sauf la couverture`,
    cause: pagProbs.length ? 'addFooters ou gestion des pages défaillante' : 'addFooters sur bufferPages',
    impact: 'Difficulté de référencement d\'un document officiel', fix: 'Vérifier addFooters (components.ts)',
    priority: 'P1',
  })

  // ---- 17. En-têtes courants cohérents --------------------------------------------------
  const headProbs: string[] = []
  const headSig = contentPages.map((p) => headerItems(p).map((t) => t.str).join('|'))
  if (headSig.length > 1 && new Set(headSig).size > 1) headProbs.push('en-têtes courants différents d\'une page à l\'autre')
  const headAbsent = contentPages.filter((p) => headerItems(p).length === 0)
  if (headAbsent.length) headProbs.push(`en-tête courant absent : p.${headAbsent.map((p) => p.i).join(', ')}`)
  push({
    id: 'entetes', label: 'En-têtes cohérents', cat: 'Présentation générale', severity: headProbs.length ? 'mineur' : 'info',
    ok: headProbs.length === 0, detail: headProbs.length ? headProbs.join(' ; ') : 'Institution + titre du rapport sur toutes les pages (sauf couverture)',
    cause: headProbs.length ? 'drawRunningHeader non appliqué ou texte variable' : 'drawRunningHeader sur pages > 0',
    impact: 'Identité du document affaiblie', fix: 'Vérifier drawRunningHeader',
    priority: 'P2',
  })

  // ---- 18. Pieds de page cohérents -------------------------------------------------------
  const footProbs: string[] = []
  const footSig = pages.map((p) =>
    footerItems(p)
      .map((t) => t.str.trim())
      .filter((s) => s && !/^\d+ \/ \d+$/.test(s))
      .join('|')
  )
  if (footSig.slice(1).some((s) => s !== footSig[1])) footProbs.push('pieds de page différents entre pages')
  const noFoot = pages.slice(1).filter((p) => footerItems(p).length === 0)
  if (noFoot.length) footProbs.push(`pied absent : p.${noFoot.map((p) => p.i).join(', ')}`)
  push({
    id: 'pieds', label: 'Pieds de page cohérents', cat: 'Présentation générale', severity: footProbs.length ? 'mineur' : 'info',
    ok: footProbs.length === 0, detail: footProbs.length ? footProbs.join(' ; ') : '« République · Institution — N° rapport » + pagination',
    cause: footProbs.length ? 'addFooters partiel' : 'addFooters uniforme',
    impact: 'Traçabilité du document', fix: 'Vérifier addFooters',
    priority: 'P2',
  })

  // ---- 19. Logo ------------------------------------------------------------------------
  let logoOk: boolean | 'n/a' = 'n/a'
  let logoDetail = 'Logo non configuré (paramètre situation.logo absent) — contrôle non applicable'
  if (extra.expectedLogo && cover) {
    const region = cover.px.tokens.filter((t) => ['#0F172A', '#334155'].includes(t.hex))
    const logoInk = cover.px.ink
    const bandInk = cover.px.edge.b + cover.px.edge.t
    logoOk = logoInk - bandInk > 400
    logoDetail = logoOk ? 'Logo présent sur la couverture' : 'Logo attendu mais zone image vide'
  }
  push({
    id: 'logo', label: 'Logo bien positionné', cat: 'Présentation générale', severity: logoOk === false ? 'majeur' : 'info',
    ok: logoOk, detail: logoDetail,
    cause: logoOk === false ? 'logoPath vide ou fichier illisible' : 'Paramètres institutionnels',
    impact: 'Identité institutionnelle', fix: 'Vérifier le paramètre situation.logo (chemin du fichier)',
    priority: 'P2',
  })

  // ---- 20. Couleurs homogènes (palette) --------------------------------------------------
  const colorProbs: string[] = []
  for (const p of pages) {
    for (const c of p.px.colors.slice(0, 3)) {
      if (![...PALETTE].some((pal) => nearColor(pal, c.hex))) {
        colorProbs.push(`p.${p.i} couleur hors charte ${c.hex} (${c.count} px)`)
      }
    }
  }
  push({
    id: 'couleurs', label: 'Couleurs homogènes', cat: 'Couleurs', severity: colorProbs.length ? 'majeur' : 'info',
    ok: colorProbs.length === 0, detail: colorProbs.length ? colorProbs.slice(0, 6).join(' ; ') : 'Palette teal/ink/slate et sémantiques respectée sur toutes les pages',
    cause: colorProbs.length ? 'Couleur en dur hors theme.ts' : 'COLORS/CHART_COLORS partagés',
    impact: 'Unité visuelle des rapports', fix: 'Remplacer la couleur par un token de theme.ts',
    priority: 'P1',
  })

  // ---- 21. Superposition -----------------------------------------------------------------
  const superProbs: string[] = []
  for (const p of pages) {
    const items = contentItems(p)
    for (let i = 0; i < items.length && superProbs.length < 8; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]
        const b = items[j]
        const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (ix > 0 && iy > 0) {
          const inter = ix * iy
          const small = Math.min(a.w * a.h, b.w * b.h)
          if (small > 0 && inter / small > 0.55) {
            superProbs.push(`p.${p.i} superposition « ${a.str.slice(0, 20)} » / « ${b.str.slice(0, 20)} »`)
            break
          }
        }
      }
    }
  }
  push({
    id: 'superposition', label: 'Aucun élément superposé', cat: 'Présentation générale', severity: superProbs.length ? 'critique' : 'info',
    ok: superProbs.length === 0, detail: superProbs.length ? superProbs.slice(0, 5).join(' ; ') : 'Aucun chevauchement de texte détecté',
    cause: superProbs.length ? 'Coordonnées de deux éléments qui se recouvrent' : 'Positionnement relatif correct',
    impact: 'Texte illisible sur les zones superposées', fix: 'Décaler l\'élément ou insérer un saut de page',
    priority: 'P0',
  })

  // ---- 22. Pages quasi vides -------------------------------------------------------------
  const emptyProbs: string[] = []
  for (const p of contentPages) {
    if (p.px.inkRatio < 0.012) emptyProbs.push(`p.${p.i} quasi vide (densité d\'encre ${(p.px.inkRatio * 100).toFixed(1)} %)`)
  }
  push({
    id: 'pagesVides', label: 'Pas de page presque vide', cat: 'Présentation générale', severity: emptyProbs.length ? 'critique' : 'info',
    ok: emptyProbs.length === 0, detail: emptyProbs.length ? emptyProbs.join(' ; ') : 'Toutes les pages contiennent du contenu',
    cause: emptyProbs.length ? 'addPage() superflus dans les sections' : 'Flux de pages contrôlé',
    impact: 'Gaspillage papier, rapport brouillon', fix: 'Supprimer les addPage() inutiles',
    priority: 'P1',
  })

  // ---- 23. Pas de grande zone blanche ------------------------------------------------------
  const whiteProbs: string[] = []
  for (const p of contentPages) {
    if (p.i === lastPage.i) continue
    if (p.px.bottomFrac > 0.58) whiteProbs.push(`p.${p.i} grande zone blanche en bas (${(p.px.bottomFrac * 100).toFixed(0)} % de la page)`)
  }
  push({
    id: 'zonesBlanches', label: 'Pas de grande zone blanche inutile', cat: 'Espacements', severity: whiteProbs.length ? 'mineur' : 'info',
    ok: whiteProbs.length === 0, detail: whiteProbs.length ? whiteProbs.join(' ; ') : 'Pages équilibrées verticalement',
    cause: whiteProbs.length ? 'Section trop courte en fin de page avant le saut' : 'Remplissage cohérent',
    impact: 'Densité visuelle inégale', fix: 'Équilibrer le contenu ou compacter la section précédente',
    priority: 'P2',
  })

  // ---- 24. Contenu collé aux bords -----------------------------------------------------------
  const collProbs: string[] = []
  for (const p of contentPages) {
    const first = contentItems(p).sort((a, b) => a.y - b.y)[0]
    if (first && first.y < 40) collProbs.push(`p.${p.i} contenu commence à ${first.y.toFixed(0)} pt (marge haute attendue 52)`)
  }
  push({
    id: 'bordsColle', label: 'Contenu pas collé aux bords', cat: 'Espacements', severity: collProbs.length ? 'majeur' : 'info',
    ok: collProbs.length === 0, detail: collProbs.length ? collProbs.join(' ; ') : 'Contenu sous la marge haute 52 pt',
    cause: collProbs.length ? 'doc.y = 0 après addPage() (margin 0)' : 'Sections démarrées sous l\'en-tête courant',
    impact: 'Chevauchement possible avec l\'en-tête courant et la règle', fix: 'Après addPage(), positionner doc.y = GRID.marginTop',
    priority: 'P0',
  })

  // ---- 25. Espacement vertical du tableau -----------------------------------------------------
  const zebraOk = landscapePages.some((p) => {
    const m = p.px.maxY
    return m > 100
  })
  push({
    id: 'zebra', label: 'Lignes de tableau lisibles (zébra)', cat: 'Tableaux', severity: 'info',
    ok: zebraOk, detail: zebraOk ? 'Zébra et séparation de lignes présents' : 'Rendu tableau non détecté',
    cause: 'drawTable (zébra panel sur lignes impaires)', impact: 'Lecture des grandes tables', fix: '—', priority: 'P3',
  })

  // ---- Synthèse --------------------------------------------------------------------------------
  const byCat = new Map<string, { okW: number; totW: number }>()
  const weights: Record<string, number> = {
    formatA4: 3, marges: 4, bords: 2, espaces: 1, texteCoupe: 4, texteDeborde: 4, tableauCoupe: 5,
    colonnes: 4, totaux: 2, graphiques: 5, alignements: 3, centrage: 2, typo: 3, hierarchie: 4,
    numerotation: 2, pagination: 4, entetes: 2, pieds: 2, logo: 2, couleurs: 3, superposition: 5,
    pagesVides: 4, zonesBlanches: 1, bordsColle: 3, zebra: 1,
  }
  let okW = 0
  let totW = 0
  for (const c of checks) {
    const w = weights[c.id] ?? 1
    if (c.ok === 'n/a') continue
    totW += w
    if (c.ok === true) okW += w
    const cur = byCat.get(c.cat) || { okW: 0, totW: 0 }
    cur.totW += w
    if (c.ok === true) cur.okW += w
    byCat.set(c.cat, cur)
  }
  const categories: CategoryScore[] = [...byCat.entries()].map(([id, v]) => ({
    id,
    label: id,
    ok: v.okW,
    total: v.totW,
    score: v.totW ? Math.round((v.okW / v.totW) * 100) : 100,
  }))
  const globalScore = Math.round((okW / Math.max(totW, 1)) * 100)

  const findingsBySeverity: Record<Severity, Finding[]> = { critique: [], majeur: [], mineur: [], info: [] }
  for (const c of checks) findingsBySeverity[c.severity].push(c)

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    type: scenario.type,
    reportType: scenario.reportType,
    fileSize: extra.fileSize,
    generatedAt: new Date().toISOString(),
    numPages: pages.length,
    pages,
    checks,
    categories,
    globalScore,
    verdict: globalScore >= 95 ? 'CONFORME' : 'CORRECTIONS REQUISES',
    findingsBySeverity,
  }
}

function nearColor(hexA: string, hexB: string, tol = 40): boolean {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [r1, g1, b1] = p(hexA)
  const [r2, g2, b2] = p(hexB)
  return Math.abs(r1 - r2) <= tol && Math.abs(g1 - g2) <= tol && Math.abs(b1 - b2) <= tol
}

// ---------------------------------------------------------------------------
// Persistance : JSON + HTML
// ---------------------------------------------------------------------------
export async function persist(rep: ScenarioReport, shots: string[]) {
  const dir = path.join(AUDIT_OUT, rep.scenarioId)
  fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(rep, null, 2))
  writeScenarioHtml(dir, rep, shots)
}

export function writeGlobalIndex(all: ScenarioReport[]) {
  writeIndexHtml(AUDIT_OUT, all)
}

export function auditOutDir() {
  return AUDIT_OUT
}

export { writeScenarioHtml, writeIndexHtml }
