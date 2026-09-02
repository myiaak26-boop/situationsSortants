export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatDateFull(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateTime(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function delaiJours(dateEnvoi: string, dateRetrait?: string | null): number {
  const envoi = new Date(dateEnvoi).getTime()
  const fin = dateRetrait ? new Date(dateRetrait).getTime() : Date.now()
  return Math.floor((fin - envoi) / 86400000)
}

export function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function getAlertLevel(jours: number, seuils: { normal: number; attention: number; urgent: number }) {
  if (jours >= seuils.urgent) return 'urgent'
  if (jours >= seuils.attention) return 'attention'
  return 'normal'
}

// Durée de traitement (jours) → « 7 jours », « 6 j 20 h 26 min », « — »
export function formatDureeTraitement(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0) return '—'
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

export function formatDureeCourt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${Math.round(n * 10) / 10}`.replace('.', ',')
}
