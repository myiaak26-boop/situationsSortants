export interface PermissionDef {
  key: string
  label: string
}

export interface PermissionGroup {
  title: string
  permissions: PermissionDef[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Courriers',
    permissions: [
      { key: 'courrier:read', label: 'Consulter les courriers' },
      { key: 'courrier:create', label: 'Créer un courrier' },
      { key: 'courrier:write', label: 'Modifier un courrier' },
      { key: 'courrier:edit-official', label: 'Modifier un courrier officiel' },
      { key: 'courrier:update-situation', label: 'Mettre à jour la situation' },
      { key: 'courrier:delete', label: 'Supprimer un courrier' },
      { key: 'courrier:history', label: "Consulter l'historique" },
      { key: 'courrier:print', label: 'Imprimer un courrier' },
    ],
  },
  {
    title: 'Workflow',
    permissions: [{ key: 'workflow:manage', label: 'Gérer les workflows' }],
  },
  {
    title: 'Import',
    permissions: [{ key: 'import', label: 'Importer des données Excel' }],
  },
  {
    title: 'Situations',
    permissions: [
      { key: 'situation:read', label: 'Consulter les situations' },
      { key: 'situation:export', label: 'Exporter (PDF / XLSX / CSV)' },
    ],
  },
  {
    title: 'Statistiques',
    permissions: [{ key: 'statistique:read', label: 'Consulter les statistiques' }],
  },
  {
    title: 'Utilisateurs',
    permissions: [
      { key: 'utilisateur:read', label: 'Consulter les utilisateurs' },
      { key: 'utilisateur:write', label: 'Modifier les utilisateurs' },
      { key: 'utilisateur:delete', label: 'Supprimer des utilisateurs' },
    ],
  },
  {
    title: 'Rôles',
    permissions: [
      { key: 'role:read', label: 'Consulter les rôles' },
      { key: 'role:write', label: 'Modifier les rôles' },
      { key: 'role:delete', label: 'Supprimer des rôles' },
    ],
  },
  {
    title: 'Paramètres',
    permissions: [
      { key: 'parametre:read', label: 'Consulter les paramètres' },
      { key: 'parametre:write', label: 'Modifier les paramètres' },
    ],
  },
  {
    title: 'Audit',
    permissions: [{ key: 'audit:read', label: "Consulter le journal d'audit" }],
  },
]

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key))

export const WILDCARD_PERMISSION = '*'

export function permissionsToArray(permissions: string): string[] {
  try {
    const parsed = JSON.parse(permissions)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function isWildcard(permissions: string[]): boolean {
  return permissions.includes(WILDCARD_PERMISSION)
}
