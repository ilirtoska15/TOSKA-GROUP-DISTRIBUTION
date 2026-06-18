'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, Search, Plus, Phone, Mail, MapPin, Edit2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface Supplier {
  id: string
  name: string
  contact?: string
  phone?: string
  email?: string
  address?: string
  status: string
  _count?: { supplierProducts: number }
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', contact: '', phone: '', email: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ search })
    const res = await fetch(`/api/suppliers?${params}`)
    const data = await res.json()
    setSuppliers(data.suppliers ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [search])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', contact: '', phone: '', email: '', address: '' })
    setShowForm(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({ name: s.name, contact: s.contact ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Emri i furnizuesit kërkohet'); return }
    setSubmitting(true)
    try {
      const url = editing ? `/api/suppliers/${editing.id}` : '/api/suppliers'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success(editing ? 'Furnizuesi u përditësua' : 'Furnizuesi u shtua')
        setShowForm(false)
        fetchSuppliers()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Furnizuesit</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />Furnizues i Ri
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? 'Edito Furnizuesin' : 'Furnizues i Ri'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Emri *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Emri i kompanisë" />
              </div>
              <div>
                <Label>Kontakti</Label>
                <Input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="Emri i personit kontakt" />
              </div>
              <div>
                <Label>Telefoni</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+355..." />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@furnizues.al" />
              </div>
              <div className="sm:col-span-2">
                <Label>Adresa</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresa e plotë" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button onClick={handleSubmit} loading={submitting}>{editing ? 'Ruaj Ndryshimet' : 'Shto Furnizuesin'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Kërko furnizues..." className="pl-9"
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-gray-50" />)}</div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u shtua asnjë furnizues</p>
          </div>
        ) : (
          <div className="divide-y">
            {suppliers.map(s => (
              <div key={s.id} className="px-4 py-4 hover:bg-gray-50 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{s.name}</span>
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {s.status === 'ACTIVE' ? 'Aktiv' : 'Joaktiv'}
                    </Badge>
                    {s._count && (
                      <span className="text-xs text-gray-400">{s._count.supplierProducts} produkte</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {s.contact && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{s.contact}</span>}
                    {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                    {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                    {s.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.address}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
