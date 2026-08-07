import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Users,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingState } from '@/components/ui/feedback'
import {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  permissionsToArray,
  isWildcard,
  WILDCARD_PERMISSION,
} from '@/lib/permissions'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string
  createdAt: string
  _count?: { users: number }
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/roles',
  component: RolesPage,
})

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function RolesPage() {
  const session = useSession()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPerms, setFormPerms] = useState<string[]>([])
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/roles')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRoles(data as Role[]); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditingRole(null); setFormName(''); setFormDesc(''); setFormPerms([WILDCARD_PERMISSION]); setFormError(''); setShowModal(true)
  }

  const openEdit = (role: Role) => {
    setEditingRole(role)
    setFormName(role.name)
    setFormDesc(role.description || '')
    setFormPerms(permissionsToArray(role.permissions))
    setFormError('')
    setShowModal(true)
  }

  const togglePerm = (perm: string) => {
    setFormPerms((prev) => {
      if (isWildcard(prev)) return ALL_PERMISSIONS.filter((p) => p !== perm)
      return prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    })
  }

  const toggleGroup = (keys: string[]) => {
    setFormPerms((prev) => {
      if (isWildcard(prev)) return ALL_PERMISSIONS.filter((p) => !keys.includes(p))
      const allChecked = keys.every((k) => prev.includes(k))
      return allChecked ? prev.filter((p) => !keys.includes(p)) : [...prev, ...keys.filter((k) => !prev.includes(k))]
    })
  }

  const handleSave = async () => {
    if (!formName.trim()) { setFormError('Le nom est requis'); return }
    setSaving(true)
    try {
      const perms: string[] = formPerms

      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles'
      const method = editingRole ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null, permissions: perms }),
      })
      if (!res.ok) { const err = await res.json(); setFormError(err.error || 'Erreur'); return }
      setShowModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/roles/${deleteId}`, { method: 'DELETE' })
      if (res.ok) { setDeleteId(null); load() }
      else { const err = await res.json(); setFormError(err.error); setDeleteId(null) }
    } catch {}
  }

if (loading) return <LoadingState />

  return (
    <Guard session={session} permission="role:read">
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Rôles"
        description={`${roles.length} rôle${roles.length > 1 ? 's' : ''}`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Ajouter</Button>}
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {roles.map((role, i) => {
          let perms: string[] = []
          try { perms = JSON.parse(role.permissions) } catch {}

          return (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="transition-all hover:shadow-card-hover">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{role.name}</h3>
                    {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(role)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(role.id)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{role._count?.users ?? 0} utilisateur{(role._count?.users ?? 0) > 1 ? 's' : ''}</span>
              </div>

              {perms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {perms.map((p) => (
                    <span key={p} className="rounded-md bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                      {p}
                    </span>
                  ))}
                </div>
              )}
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}>
        <div className="space-y-4">
          {formError && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30"><AlertTriangle className="h-4 w-4 shrink-0" />{formError}</div>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Nom</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" placeholder="Nom du rôle" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
            <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20" placeholder="Description optionnelle" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Permissions</label>
              <Checkbox
                checked={isWildcard(formPerms)}
                onChange={() => setFormPerms(isWildcard(formPerms) ? [] : [WILDCARD_PERMISSION])}
                label="Toutes les permissions"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => {
                const keys = group.permissions.map((p) => p.key)
                const selected = keys.filter((k) => formPerms.includes(k) || isWildcard(formPerms))
                const groupChecked = selected.length === keys.length
                const groupIndeterminate = selected.length > 0 && selected.length < keys.length
                return (
                  <div key={group.title} className="rounded-lg border border-border bg-muted/20 p-3">
                    <Checkbox
                      checked={groupChecked}
                      indeterminate={groupIndeterminate}
                      onChange={() => toggleGroup(keys)}
                      label={group.title}
                      className="mb-2 font-semibold"
                    />
                    <div className="space-y-1.5 border-t border-border pt-2">
                      {group.permissions.map((p) => (
                        <Checkbox
                          key={p.key}
                          checked={formPerms.includes(p.key) || isWildcard(formPerms)}
                          onChange={() => togglePerm(p.key)}
                          label={p.label}
                          className="pl-1 text-muted-foreground"
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRole ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Confirmer la suppression">
        <p className="mb-6 text-sm text-muted-foreground">Êtes-vous sûr de vouloir supprimer ce rôle ?</p>
        {formError && <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"><AlertTriangle className="h-4 w-4 shrink-0" />{formError}</div>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annuler</Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>Supprimer</Button>
        </div>
</Modal>
    </div>
    </Guard>
  )
}

export default RolesPage
