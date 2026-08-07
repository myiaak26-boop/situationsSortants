import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import {
  KeyRound,
  Save,
  Loader2,
  Check,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/feedback'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string
}

const ALL_PERMISSIONS = [
  { key: 'courrier:read', label: 'Voir les courriers' },
  { key: 'courrier:create', label: 'Créer un courrier' },
  { key: 'courrier:write', label: 'Modifier le suivi (observation, retrait)' },
  { key: 'courrier:edit-official', label: 'Modifier les données officielles' },
  { key: 'courrier:update-situation', label: 'Mettre à jour la situation' },
  { key: 'courrier:delete', label: 'Supprimer un courrier' },
  { key: 'courrier:history', label: "Consulter l'historique" },
  { key: 'courrier:print', label: 'Imprimer la fiche' },
  { key: 'statistique:read', label: 'Lecture statistiques' },
  { key: 'workflow:manage', label: 'Gérer le moteur de workflow (modes, situations, transitions)' },
  { key: 'import', label: 'Import Excel' },
  { key: 'situation:read', label: 'Lecture situations' },
  { key: 'situation:export', label: 'Export situations' },
  { key: 'utilisateur:read', label: 'Lecture utilisateurs' },
  { key: 'utilisateur:write', label: 'Écriture utilisateurs' },
  { key: 'utilisateur:delete', label: 'Suppression utilisateurs' },
  { key: 'role:read', label: 'Lecture rôles' },
  { key: 'role:write', label: 'Écriture rôles' },
  { key: 'role:delete', label: 'Suppression rôles' },
  { key: 'parametre:read', label: 'Lecture paramètres' },
  { key: 'parametre:write', label: 'Écriture paramètres' },
  { key: 'audit:read', label: 'Lecture journal audit' },
]

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/permissions',
  component: PermissionsPage,
})

function PermissionsPage() {
  const session = useSession()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissionsMap, setPermissionsMap] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedRole, setSavedRole] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/roles')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRoles(data as Role[])
          const map: Record<string, Set<string>> = {}
          for (const role of data) {
            try { map[role.id] = new Set(JSON.parse(role.permissions)) } catch { map[role.id] = new Set() }
          }
          setPermissionsMap(map)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggle = (roleId: string, perm: string) => {
    setPermissionsMap((prev) => {
      const next = { ...prev }
      const set = new Set(next[roleId] || [])
      if (set.has(perm)) set.delete(perm)
      else set.add(perm)
      next[roleId] = set
      return next
    })
  }

  const hasWildcard = (roleId: string) => permissionsMap[roleId]?.has('*') ?? false
  const isChecked = (roleId: string, perm: string) => hasWildcard(roleId) || (permissionsMap[roleId]?.has(perm) ?? false)
  const isIndeterminate = (roleId: string) => {
    const set = permissionsMap[roleId]
    if (!set || set.size === 0 || hasWildcard(roleId)) return false
    return set.size > 0 && set.size < ALL_PERMISSIONS.length
  }

  const handleSave = async (role: Role) => {
    setSaving(true)
    const perms = Array.from(permissionsMap[role.id] || [])
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      })
      if (res.ok) {
        setSavedRole(role.id)
        setTimeout(() => setSavedRole(null), 2000)
      }
    } finally { setSaving(false) }
  }

if (loading) return <LoadingState />

  return (
    <Guard session={session} permission="role:read">
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader title="Permissions" description="Gérer les permissions par rôle" />

      <div className="space-y-4">
        {roles.map((role, ri) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ri * 0.05 }}
          >
            <Card>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{role.name}</h2>
                {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
              </div>
              <Button size="sm" onClick={() => handleSave(role)} disabled={saving} variant={savedRole === role.id ? 'secondary' : 'ghost'}>
                {savedRole === role.id ? (
                  <><Check className="h-3.5 w-3.5" /> Enregistré</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> Enregistrer</>
                )}
              </Button>
            </div>
            <div className="p-4">
              <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasWildcard(role.id)}
                  onChange={() => toggle(role.id, '*')}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="font-medium text-foreground">Toutes les permissions (*)</span>
              </label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ALL_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.key}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                      isChecked(role.id, perm.key)
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked(role.id, perm.key)}
                      onChange={() => toggle(role.id, perm.key)}
                      disabled={hasWildcard(role.id)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 disabled:opacity-40"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{perm.label}</p>
                      <p className="text-2xs text-muted-foreground font-mono">{perm.key}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            </Card>
          </motion.div>
        ))}
</div>
    </div>
    </Guard>
  )
}

export default PermissionsPage
