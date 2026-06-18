'use client'

import { useState, useEffect } from 'react'
import { Plus, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getStatusColor, getStatusLabel } from '@/lib/utils'
import { ALL_PERMISSIONS, PERMISSION_LABELS, type Permission } from '@/lib/permissions'
import { toast } from 'sonner'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface UserData {
  id: string
  name: string
  email: string
  role: string
  status: string
  phone?: string
  createdAt: string
  permissions: Array<{ permission: string; enabled: boolean }>
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [permOpen, setPermOpen] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGJENT' })

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  const createUser = async () => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const user = await res.json()
      setUsers((prev) => [...prev, user])
      setNewUserOpen(false)
      toast.success('Përdoruesi u krijua')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Gabim')
    }
  }

  const toggleStatus = async (userId: string, status: string) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : u))
    }
  }

  const togglePermission = async (userId: string, permission: string, currentEnabled: boolean) => {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: [{ permission, enabled: !currentEnabled }] }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => {
        if (u.id !== userId) return u
        const existing = u.permissions.find((p) => p.permission === permission)
        if (existing) return { ...u, permissions: u.permissions.map((p) => p.permission === permission ? { ...p, enabled: !currentEnabled } : p) }
        return { ...u, permissions: [...u.permissions, { permission, enabled: !currentEnabled }] }
      }))
      toast.success('Leja u ndryshua')
    }
  }

  const selectedUser = users.find((u) => u.id === permOpen)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Përdoruesit</h1>
          <p className="text-sm text-gray-500">{users.length} gjithsej</p>
        </div>
        <Button onClick={() => setNewUserOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Përdorues i Ri</span>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <Card key={u.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{u.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="badge bg-blue-100 text-blue-800 text-xs">{u.role}</span>
                    <span className={`badge ${getStatusColor(u.status)} text-xs`}>{getStatusLabel(u.status)}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1 text-xs"
                    onClick={() => setPermOpen(u.id)}
                  >
                    <Shield className="h-3 w-3" />
                    Lejet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => toggleStatus(u.id, u.status)}
                  >
                    {u.status === 'ACTIVE' ? 'Çaktivizo' : 'Aktivizo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New User Dialog */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Përdorues i Ri</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Emri</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Fjalëkalimi</Label>
              <Input className="mt-1" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <Label>Roli</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="AGJENT">Agjent</SelectItem>
                  <SelectItem value="SHOFER">Shofer</SelectItem>
                  <SelectItem value="DEPOIST">Depoist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserOpen(false)}>Anulo</Button>
            <Button onClick={createUser}>Krijo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      {selectedUser && (
        <Dialog open={!!permOpen} onOpenChange={() => setPermOpen(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lejet — {selectedUser.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {selectedUser.role === 'ADMIN' ? (
                <p className="text-sm text-gray-500 text-center py-4">Admin ka të gjitha lejet automatikisht.</p>
              ) : (
                ALL_PERMISSIONS.map((perm) => {
                  const override = selectedUser.permissions.find((p) => p.permission === perm)
                  const enabled = override?.enabled ?? false
                  return (
                    <div key={perm} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm text-gray-700">{PERMISSION_LABELS[perm as Permission]}</span>
                      <button
                        onClick={() => togglePermission(selectedUser.id, perm, enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
