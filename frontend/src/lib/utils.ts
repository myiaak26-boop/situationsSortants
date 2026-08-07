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
