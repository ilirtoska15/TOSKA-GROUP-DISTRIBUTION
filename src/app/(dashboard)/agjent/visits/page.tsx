'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Plus, Clock, CheckCircle, Navigation } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

interface Visit {
  id: string
  reference: string
  status: string
  openedAt: string
  closedAt?: string
  noOrderReason?: string
  customer: { id: string; businessName: string; code: string }
}

interface Customer { id: string; businessName: string; code: string }

export default function AgjentVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [closingId, setClosingId] = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openVisit, setOpenVisit] = useState<Visit | null>(null)

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/visits?limit=30')
    const data = await res.json()
    const all = data.visits ?? []
    setVisits(all)
    setTotal(data.total ?? 0)
    setOpenVisit(all.find((v: Visit) => v.status === 'OPEN') ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchVisits() }, [fetchVisits])

  useEffect(() => {
    if (showForm && customers.length === 0) {
      fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers ?? []))
    }
  }, [showForm, customers.length])

  const getGPS = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      )
    })

  const handleOpen = async () => {
    if (!selectedCustomer) { toast.error('Zgjidh klientin'); return }
    if (openVisit) { toast.error('Ke tashmë një vizitë të hapur'); return }
    setSubmitting(true)
    const gps = await getGPS()
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', customerId: selectedCustomer, ...gps }),
      })
      if (res.ok) {
        toast.success('Vizita u hap')
        setShowForm(false)
        setSelectedCustomer('')
        fetchVisits()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async (id: string) => {
    setSubmitting(true)
    const gps = await getGPS()
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', visitId: id, reason: closeReason || undefined, ...gps }),
      })
      if (res.ok) {
        toast.success('Vizita u mbyll')
        setClosingId(null)
        setCloseReason('')
        fetchVisits()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vizitat e Mia</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        {!openVisit && (
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" />Hap Vizitë
          </Button>
        )}
      </div>

      {openVisit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Navigation className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-amber-800">Vizitë Aktive</span>
              </div>
              <p className="text-sm text-amber-700">{openVisit.customer.businessName}</p>
              <p className="text-xs text-amber-600 mt-0.5">Filloi: {formatDateTime(openVisit.openedAt)}</p>
            </div>
            <Button size="sm" variant="warning" onClick={() => setClosingId(openVisit.id)}>
              Mbyll Vizitën
            </Button>
          </div>
          {closingId === openVisit.id && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                placeholder="Arsyeja (opsionale)..."
                className="w-full h-9 px-3 rounded-lg border border-amber-200 text-sm bg-white"
                value={closeReason}
                onChange={e => setCloseReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setClosingId(null)}>Anulo</Button>
                <Button size="sm" loading={submitting} onClick={() => handleClose(openVisit.id)}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />Konfirmo Mbylljen
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && !openVisit && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-medium text-gray-900">Vizitë e Re</h3>
          <select
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
            value={selectedCustomer}
            onChange={e => setSelectedCustomer(e.target.value)}
          >
            <option value="">-- Zgjidh Klientin --</option>
            {customers.map((c: { id: string; businessName: string; code: string }) => <option key={c.id} value={c.id}>{c.businessName} ({c.code})</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Anulo</Button>
            <Button size="sm" loading={submitting} onClick={handleOpen}>
              <Navigation className="h-3.5 w-3.5 mr-1" />Hap Vizitën
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : visits.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ke asnjë vizitë të regjistruar</p>
          </div>
        ) : visits.map(v => (
          <div key={v.id} className="bg-white rounded-xl border p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-gray-900">{v.customer.businessName}</span>
                  <span className="font-mono text-xs text-gray-400">{v.reference}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(v.openedAt)}
                  {v.closedAt && ` — ${formatDateTime(v.closedAt)}`}
                </div>
              </div>
              <Badge variant={v.status === 'OPEN' ? 'warning' : 'success'}>
                {v.status === 'OPEN' ? 'Hapur' : 'Mbyllur'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
