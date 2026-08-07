export interface SignataireInfo {
  code: string
  nom: string
  ordre: number
}

function normalize(nom: string): string {
  return nom.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function buildSignataireMap(signataires: { code: string; nom: string }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const s of signataires) {
    const nom = s.nom?.trim()
    if (nom) map.set(normalize(nom), s.code)
  }
  return map
}

export function signataireCode(nom: string | null | undefined, map: Map<string, string>): string {
  if (!nom) return 'Inconnu'
  const code = map.get(normalize(nom))
  return code ?? nom
}

export function hasSignataireCode(nom: string | null | undefined, map: Map<string, string>): boolean {
  if (!nom) return false
  return map.has(normalize(nom))
}
