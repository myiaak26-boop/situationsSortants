// -----------------------------------------------------------------------------
// Durée de traitement : normalisation et formatage
//
// Les cellules Excel de la colonne « Durée de traitement » peuvent contenir :
//   - un nombre (7 ou 7.5)                         → jours
//   - un texte « 7 », « 7 jours », « 7 jour(s) »   → jours
//   - un texte « 6 Jrs 20 h 26 min »               → jours (6,8514…)
//   - une valeur vide / NULL                       → NULL
//   - une date Excel formatée comme une date       → NULL (ce n'est PAS une durée)
//
// La valeur normalisée est TOUJOURS un nombre de jours (ou NULL), stockée dans
// une colonne numérique en base pour permettre les calculs (min, max, moyenne,
// répartition par tranches).
// -----------------------------------------------------------------------------

export interface CellMeta {
  t?: string
  z?: string | null
}

// Formats de cellule Excel interprétés comme des dates (ex. « dd/mm/yyyy »,
// « jj/mm/aaaa », « m/d/yy »). Un format contenant une unité de temps
// (« [h]:mm », « h:mm ») reste une durée.
const DATE_FORMAT_RE = /(dd|jj|mm|yy)/i
const TIME_FORMAT_RE = /(h|min|s)/i

export function normalizeDuration(value: unknown, cell?: CellMeta | null): number | null {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return null

  if (typeof value === 'number' && isFinite(value)) {
    // Une cellule numérique formatée comme une date Excel est une DATE, pas une
    // durée. Exemple : 07/08/2026 → 46241 en série Excel. Ne jamais convertir
    // aveuglément une valeur numérique en durée.
    // Un format contenant une unité de temps (« [h]:mm », « h:mm ») reste une
    // durée — il prime sur les motifs de date (« mm » apparaît aussi dans les
    // formats d'heures).
    if (cell?.t === 'n' && cell.z) {
      if (TIME_FORMAT_RE.test(cell.z)) return roundJours(value)
      if (DATE_FORMAT_RE.test(cell.z)) return null
    }
    // Série de date sans format associé (valeur > 100 ans) : invraisemblable
    // comme durée de traitement.
    if (value > 36500) return null
    return roundJours(value)
  }

  const s = String(value).trim()
  if (!s) return null

  const parsed = parseDurationText(s)
  return parsed === null ? null : roundJours(parsed)
}

function parseDurationText(raw: string): number | null {
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!s) return null

  // « 7 » / « 7,5 » / « 7.5 »
  let m = s.match(/^(\d+(?:[.,]\d+)?)$/)
  if (m) return Number(m[1].replace(',', '.'))

  // « 7 jours » / « 7 jour(s) » / « 7 j » / « 7 jr » / « 7 jrs » / « 7 d »
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(jours?|jour\(s\)?|j|jr|jrs|d)$/)
  if (m) return Number(m[1].replace(',', '.'))

  // « 6 Jrs 20 h 26 min » / « 3 Jrs 12 h » / « 2 Jrs 5 h » / « 7 jours 8 h 30 min »
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(jours?|jour\(s\)?|j|jr|jrs|d)\s+(\d{1,2})\s*h(?:eures?)?(?:\s+(\d{1,2})\s*(?:min(?:utes?)?|m))?$/)
  if (m) {
    const h = Number(m[3])
    const min = m[4] ? Number(m[4]) : 0
    if (h > 23 || min > 59) return null
    return Number(m[1].replace(',', '.')) + h / 24 + min / 1440
  }

  // « 20 h » / « 12 heures » / « 8 h 30 »
  m = s.match(/^(\d{1,2})\s*h(?:eures?)?(?:\s+(\d{1,2})\s*(?:min(?:utes?)?|m))?$/)
  if (m) {
    const h = Number(m[1])
    const min = m[2] ? Number(m[2]) : 0
    if (h > 23 || min > 59) return null
    return h / 24 + min / 1440
  }

  // « 26 min »
  m = s.match(/^(\d{1,3})\s*(?:min(?:utes?)?|m)$/)
  if (m) return Number(m[1]) / 1440

  return null
}

function roundJours(n: number): number {
  return Math.round(n * 10000) / 10000
}

// Affichage : « 7 jours », « 6 j 20 h 26 min »…
export function formatDureeJours(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n) || n < 0) return '—'
  if (Number.isInteger(n)) return n === 1 ? '1 jour' : `${n} jours`
  const d = Math.floor(n)
  const restH = (n - d) * 24
  let h = Math.floor(restH)
  let m = Math.round((restH - h) * 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  if (d === 0 && h === 0 && m === 0) return "Moins d'une heure"
  const parts: string[] = []
  if (d > 0) parts.push(`${d} j`)
  if (h > 0) parts.push(`${h} h`)
  if (m > 0) parts.push(`${m} min`)
  return parts.join(' ')
}

// Affichage court pour les exports : « 7 » / « 6,9 »
export function formatDureeCourt(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return ''
  return String(Math.round(n * 10) / 10).replace('.', ',')
}