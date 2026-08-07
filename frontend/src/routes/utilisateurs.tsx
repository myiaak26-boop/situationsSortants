import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '@/routes/__root'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Shield,
  Loader2,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState, EmptyState } from '@/components/ui/feedback'
import { useSession } from '@/lib/session-context'
import { Guard } from '@/components/ui/guard'

interface Role {
  id: string
  name: string
  description: string | null
}

interface User {
  id: string
  email: string
  name: string
  roleId: string
  active: boolean
  avatar: string | null
  createdAt: string
  role: { id: string; name: string; description?: string | null }
  _count?: { courriers: number }
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/utilisateurs',
  component: UtilisateursPage,
})

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function UtilisateursPage() {
  const session = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [saving, setSaving] = useState(false)

  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formRoleId, setFormRoleId] = useState('')
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/utilisateurs').then((r) => r.json()),
      fetch('/api/utilisateurs/roles').then((r) => r.json()),
    ])
      .then(([usersData, rolesData]) => {
        if (Array.isArray(usersData)) setUsers(usersData as User[])
        if (Array.isArray(rolesData)) setRoles(rolesData as Role[])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [])

  const openCreate = () => {
    setEditingUser(null)
    setFormEmail('')
    setFormName('')
    setFormRoleId(roles[0]?.id || '')
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setFormEmail(user.email)
    setFormName(user.name)
    setFormRoleId(user.roleId)
    setFormError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!formEmail.trim() || !formName.trim() || !formRoleId) {
      setFormError('Tous les champs sont requis')
      return
    }
    setSaving(true)
    try {
      const url = editingUser ? `/api/utilisateurs/${editingUser.id}` : '/api/utilisateurs'
      const method = editingUser ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail.trim(), name: formName.trim(), roleId: formRoleId }),
      })
      if (!res.ok) {
        const err = await res.json()
        setFormError(err.error || 'Erreur lors de l\'enregistrement')
        return
      }
      setShowModal(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleteError('')
    try {
      const res = await fetch(`/api/utilisateurs/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setDeleteError(err?.error || 'Suppression impossible')
        return
      }
      setDeleteId(null)
      load()
    } catch {
      setDeleteError('Erreur réseau lors de la suppression')
    }
  }

  const toggleActive = async (u: User) => {
    try {
      await fetch(`/api/utilisateurs/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !u.active }),
      })
      load()
    } catch {}
  }

if (loading) return <LoadingState />

  return (
    <Guard session={session} permission="utilisateur:read">
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Utilisateurs"
        description={`${users.length} utilisateur${users.length > 1 ? 's' : ''}`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Ajouter</Button>}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border bg-card"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rôle</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Courriers</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user, i) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.01 }}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-2xs font-medium text-primary">
                      <Shield className="h-3 w-3" />
                      {user.role.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user._count?.courriers ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-medium',
                      user.active
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {user.active ? (
                        <><Check className="h-3 w-3" /> Actif</>
                      ) : (
                        <><X className="h-3 w-3" /> Inactif</>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActive(user)}
                        title={user.active ? 'Désactiver' : 'Activer'}
                        className={cn(
                          'rounded-lg p-2 transition-colors',
                          user.active
                            ? 'text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        )}
                      >
                        {user.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setDeleteId(user.id); setDeleteError('') }}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}>
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Nom</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Nom complet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="email@exemple.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Rôle</label>
            <select
              value={formRoleId}
              onChange={(e) => setFormRoleId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          {!editingUser && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Le mot de passe par défaut est <code className="font-semibold">Dex1234</code>.
                L'utilisateur pourra le changer depuis son menu profil.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleteId !== null} onClose={() => { setDeleteId(null); setDeleteError('') }} title="Confirmer la suppression">
        <p className="mb-6 text-sm text-muted-foreground">
          Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.
        </p>
        {deleteError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {deleteError}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Annuler</Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </div>
    </Guard>
  )
}

export default UtilisateursPage
