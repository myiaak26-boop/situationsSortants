export const COLORS = {
  teal: '#0F766E',
  tealDark: '#065F46',
  ink: '#0F172A',
  slate: '#334155',
  muted: '#64748B',
  faint: '#CBD5E1',
  hair: '#E2E8F0',
  panel: '#F1F5F9',
  white: '#FFFFFF',
  green: '#059669',
  blue: '#0369A1',
  violet: '#7C3AED',
  amber: '#B45309',
  red: '#B91C1C',
  rose: '#BE123C',
} as const

export const CHART_COLORS = [
  '#0F766E',
  '#0369A1',
  '#7C3AED',
  '#B45309',
  '#DB2777',
  '#4D7C0F',
  '#64748B',
  '#0EA5E9',
  '#C026D3',
  '#DC2626',
] as const

export const FONT_SIZES = {
  display: 23,
  h1: 17,
  h2: 13,
  h3: 11,
  body: 10,
  table: 7,
  caption: 8,
  meta: 6.5,
} as const

export const GRID = {
  pageW: 595.28,
  pageH: 841.89,
  marginL: 46,
  marginR: 46,
  marginTop: 60,
  footerH: 34,
  kpiCols: 4,
  kpiGap: 10,
  kpiHeight: 46,
  radius: 4,
  module: 8,
} as const

export function usableWidth(pageW = GRID.pageW): number {
  return pageW - GRID.marginL - GRID.marginR
}

export function chartColorFor(label: string, map: Map<string, string>): string {
  const existing = map.get(label)
  if (existing) return existing
  const color = CHART_COLORS[map.size % CHART_COLORS.length]
  map.set(label, color)
  return color
}

export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const back = 255
  const mix = (c: number) => Math.round(c * alpha + back * (1 - alpha))
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
