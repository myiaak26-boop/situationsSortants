// Types du moteur d'audit des rapports DEX (PDF + XLSX)

export interface AuditTextItem {
  str: string
  x: number
  y: number
  w: number
  h: number
  size: number
}

export interface AuditPixels {
  ink: number
  colored: number
  total: number
  inkRatio: number
  coloredRatio: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  cMinX: number
  cMinY: number
  cMaxX: number
  cMaxY: number
  cEdge: { l: number; r: number; t: number; b: number }
  edgeFracColored: number
  bands: number[]
  cols: number[]
  edge: { l: number; r: number; t: number; b: number }
  bottomFrac: number
  sharpAll: number
  sharpColored: number
  centerMassX: number
  colors: { hex: string; count: number }[]
  tokens: { hex: string; count: number }[]
}

export interface AuditPageRaw {
  i: number
  wPts: number
  hPts: number
  layout: 'portrait' | 'landscape'
  px: AuditPixels
  text: AuditTextItem[]
}

export type Severity = 'critique' | 'majeur' | 'mineur' | 'info'

export interface Finding {
  id: string
  label: string
  cat: string
  page: number
  severity: Severity
  ok: boolean | 'n/a'
  detail: string
  cause: string
  impact: string
  fix: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
}

export interface CategoryScore {
  id: string
  label: string
  ok: number
  total: number
  score: number
}

export interface ScenarioReport {
  scenarioId: string
  label: string
  type: string
  reportType: string
  fileSize: number
  generatedAt: string
  numPages: number
  pages: AuditPageRaw[]
  checks: Finding[]
  categories: CategoryScore[]
  globalScore: number
  verdict: 'CONFORME' | 'CORRECTIONS REQUISES'
  findingsBySeverity: Record<Severity, Finding[]>
}
