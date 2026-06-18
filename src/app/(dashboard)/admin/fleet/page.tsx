'use client'

import { useState, useEffect, useCallback } from 'react'
import { Truck, Plus, Edit2, AlertTriangle, Calendar, Hash } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Vehicle {
  id: string
  plate: string
  make: string
  model: string
  year: number
  status: string
  insuranceExpiry?: string
  registrationExpiry?: string
  driver?: { name: string } | null
}

export default function AdminFleetPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState({ plate: '', make: '', model: '', year: new Date().getFullYear().toString(), insuranceExpiry: '', registrationExpiry: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fleet')
    const data = await res.json()
    setVehicles(data.vehicles ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchVehicles() }, [fetchVehicles])

  const now = new Date()
  const isExpiringSoon = (date?: string) => {
    if (!date) return false
    const d = new Date(date)
    const days = (d.getTime() - now.getTime()) / 86400000
    return days < 30 && days > 0
  }
  const isExpired = (date?: string) => {
    if (!date) return false
    return new Date(date) < now
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ plate: '', make: '', model: '', year: String(new Date().getFullYear()), insuranceExpiry: '', registrationExpiry: '' })
    setShowForm(true)
  }

  const openEdit = (v: Vehicle) => {
    setEditing(v)
    setForm({
      plate: v.plate, make: v.make, model: v.model, year: String(v.year),
      insuranceExpiry: v.insuranceExpiry ? v.insuranceExpiry.slice(0, 10) : '',
      registrationExpiry: v.registrationExpiry ? v.registrationExpiry.slice(0, 10) : '',
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.plate || !form.make || !form.model) { toast.error('Plotëso fushat e detyrueshme'); return }
    setSubmitting(true)
    try {
      const url = editing ? `/api/fleet/${editing.id}` : '/api/fleet'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, year: Number(form.year) }),
      })
      if (res.ok) {
        toast.success(editing ? 'Mjeti u përditësua' : 'Mjeti u shtua')
        setShowForm(false)
        fetchVehicles()
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
          <h1 className="text-2xl font-bold text-gray-900">Flota e Mjeteve</h1>
          <p className="text-sm text-gray-500">{vehicles.length} mjete gjithsej</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />Mjeti i Ri
        </Button>
      </div>

      {vehicles.some(v => isExpired(v.insuranceExpiry) || isExpired(v.registrationExpiry) || isExpiringSoon(v.insuranceExpiry) || isExpiringSoon(v.registrationExpiry)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Kujdes: Disa mjete kanë dokumenta të skaduara ose që skadojnë së shpejti.
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? 'Edito Mjetin' : 'Mjet i Ri'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Targa *</Label>
                <Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} placeholder="AA 000 BB" />
              </div>
              <div>
                <Label>Marka *</Label>
                <Input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="Mercedes" />
              </div>
              <div>
                <Label>Modeli *</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Sprinter" />
              </div>
              <div>
                <Label>Viti</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              </div>
              <div>
                <Label>Skadenca e Sigurimit</Label>
                <Input type="date" value={form.insuranceExpiry} onChange={e => setForm(f => ({ ...f, insuranceExpiry: e.target.value }))} />
              </div>
              <div>
                <Label>Skadenca e Lejes</Label>
                <Input type="date" value={form.registrationExpiry} onChange={e => setForm(f => ({ ...f, registrationExpiry: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button onClick={handleSubmit} loading={submitting}>{editing ? 'Ruaj' : 'Shto Mjetin'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />)
        ) : vehicles.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-xl border text-gray-500">
            <Truck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u shtua asnjë mjet</p>
          </div>
        ) : vehicles.map(v => (
          <div key={v.id} className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-bold text-gray-900">{v.plate}</span>
                </div>
                <p className="text-sm text-gray-600">{v.make} {v.model} · {v.year}</p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={v.status === 'ACTIVE' ? 'success' : 'secondary'}>
                  {v.status === 'ACTIVE' ? 'Aktiv' : 'Joaktiv'}
                </Badge>
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(v)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {v.driver && (
              <p className="text-xs text-gray-500">Shoferi: <span className="font-medium text-gray-700">{v.driver.name}</span></p>
            )}
            <div className="space-y-1 pt-1 border-t">
              {v.insuranceExpiry && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" />Sigurimi</span>
                  <span className={isExpired(v.insuranceExpiry) ? 'text-red-600 font-medium' : isExpiringSoon(v.insuranceExpiry) ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                    {formatDate(v.insuranceExpiry)}
                    {isExpired(v.insuranceExpiry) && ' ⚠ Skaduar'}
                    {isExpiringSoon(v.insuranceExpiry) && ' ⚠ Skaden shpejt'}
                  </span>
                </div>
              )}
              {v.registrationExpiry && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1"><Hash className="h-3 w-3" />Leja</span>
                  <span className={isExpired(v.registrationExpiry) ? 'text-red-600 font-medium' : isExpiringSoon(v.registrationExpiry) ? 'text-amber-600 font-medium' : 'text-gray-600'}>
                    {formatDate(v.registrationExpiry)}
                    {isExpired(v.registrationExpiry) && ' ⚠ Skaduar'}
                    {isExpiringSoon(v.registrationExpiry) && ' ⚠ Skaden shpejt'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
