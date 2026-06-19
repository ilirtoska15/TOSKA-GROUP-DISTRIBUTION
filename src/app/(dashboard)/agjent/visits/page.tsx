'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Plus, Clock, CheckCircle, Navigation, Calendar, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Visit {
  id: string
  reference: string
  status: string
  openedAt: string
  closedAt?: string
  scheduledDate?: string
  scheduledTime?: string
  priority?: string
  noOrderReason?: string
  gpsStatus?: string
  gpsDistanceM?: number | null
  openedLat?: number
  openedLng?: number
  customer: { id: string; businessName: string; code: string }
}

interface Customer { id: string; businessName: string; code: string }

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  NORMAL: 'bg-blue-50 text-blue-700 border-blue-200',
  LOW: 'bg-gray-50 text-gray-600 border-gray-200',
}

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
  const [plannedToday, setPlannedToday] = useState<Visit[]>([])

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    const [allRes, plannedRes] = await Promise.all([
      fetch('/api/visits?limit=30'),
      fetch('/api/visits?status=PLANNED&upcoming=1&limit=20'),
    ])
    const allData = await allRes.json()
    const plannedData = await plannedRes.json()

    const all = allData.visits ?? []
    setVisits(all)
    setTotal(allData.total ?? 0)
    setOpenVisit(all.find((v: Visit) => v.status === 'OPEN') ?? null)

    // Today's planned visits
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const todayPlanned = (plannedData.visits ?? []).filter((v: Visit) => {
      if (!v.scheduledDate) return false
      const d = new Date(v.scheduledDate)
      return d >= today && d < tomorrow
    })
    setPlannedToday(todayPlanned)
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
        body: JSON.stringify({ action: 'close', visitId: id, noOrderReason: closeReason || undefined, ...gps }),
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

  const handleStart = async (visitId: string) => {
    if (openVisit) { toast.error('Ke tashmë një vizitë të hapur. Mbylleni para'); return }
    setSubmitting(true)
    const gps = await getGPS()
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', visitId, ...gps }),
      })
      if (res.ok) {
        toast.success('Vizita filloi')
        fetchVisits()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleMissed = async (visitId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_missed', visitId }),
      })
      if (res.ok) {
        toast.info('Vizita u shënua si e pamundur')
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

      {/* Today's planned visits */}
      {plannedToday.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-700">Vizitat e Planifikuara Sot ({plannedToday.length})</h3>
          </div>
          {plannedToday.map(v => (
            <div
              key={v.id}
              className={`rounded-xl border p-4 ${PRIORITY_COLORS[v.priority ?? 'NORMAL']}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-semibold text-sm">{v.customer.businessName}</span>
                    {v.priority === 'HIGH' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">URGJENT</span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-gray-500 ml-5">{v.customer.code}</p>
                  {v.scheduledTime && (
                    <p className="text-xs ml-5 mt-0.5">
                      <Clock className="h-3 w-3 inline mr-1" />{v.scheduledTime}
                    </p>
                  )}
                  {v.noOrderReason && (
                    <p className="text-xs text-gray-600 mt-1 italic">{v.noOrderReason}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleStart(v.id)}
                    disabled={!!openVisit || submitting}
                    className="gap-1 h-8"
                  >
                    <Navigation className="h-3.5 w-3.5" />Fillo
                  </Button>
                  <button
                    onClick={() => handleMissed(v.id)}
                    disabled={submitting}
                    className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 h-8 px-2"
                  >
                    <X className="h-3.5 w-3.5" />E pamundur
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active open visit */}
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
                placeholder="Arsyeja nëse nuk u bë porosi (opsionale)..."
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

      {/* Open new visit form */}
      {showForm && !openVisit && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-medium text-gray-900">Vizitë e Re</h3>
          <select
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
            value={selectedCustomer}
            onChange={e => setSelectedCustomer(e.target.value)}
          >
            <option value="">-- Zgjidh Klientin --</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.businessName} ({c.code})</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Anulo</Button>
            <Button size="sm" loading={submitting} onClick={handleOpen}>
              <Navigation className="h-3.5 w-3.5 mr-1" />Hap Vizitën
            </Button>
          </div>
        </div>
      )}

      {/* Visit history */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : visits.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ke asnjë vizitë të regjistruar</p>
          </div>
        ) : visits.map(v => {
          if (v.status === 'PLANNED') return null // shown above in planned section
          return (
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
                  {/* GPS status badge */}
                  {v.gpsStatus && v.gpsStatus !== 'NO_GPS' && (
                    <div className="mt-0.5">
                      {v.gpsStatus === 'GPS_VERIFIED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          <MapPin className="h-2.5 w-2.5" />GPS Verifikuar{v.gpsDistanceM != null ? ` (${v.gpsDistanceM}m)` : ''}
                        </span>
                      )}
                      {v.gpsStatus === 'NEAR_LOCATION' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                          <MapPin className="h-2.5 w-2.5" />Afër Klientit{v.gpsDistanceM != null ? ` (${v.gpsDistanceM}m)` : ''}
                        </span>
                      )}
                      {v.gpsStatus === 'OUTSIDE_LOCATION' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          <MapPin className="h-2.5 w-2.5" />Jashtë Lokacionit{v.gpsDistanceM != null ? ` (${v.gpsDistanceM}m)` : ''}
                        </span>
                      )}
                      {v.gpsStatus === 'HAS_GPS' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                          <MapPin className="h-2.5 w-2.5" />GPS OK
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    v.status === 'OPEN' ? 'warning' :
                    v.status === 'CLOSED' ? 'success' :
                    v.status === 'MISSED' ? 'destructive' :
                    'secondary'
                  }>
                    {v.status === 'OPEN' ? 'Hapur' :
                     v.status === 'CLOSED' ? 'Mbyllur' :
                     v.status === 'MISSED' ? 'E humbur' :
                     v.status === 'CANCELLED' ? 'Anuluar' : v.status}
                  </Badge>
                  {v.status === 'OPEN' && v.id !== openVisit?.id && (
                    <button
                      onClick={() => { setClosingId(v.id); setCloseReason('') }}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Mbyll
                    </button>
                  )}
                </div>
              </div>
              {closingId === v.id && v.status === 'OPEN' && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    placeholder="Arsyeja nëse nuk u bë porosi..."
                    className="w-full h-9 px-3 rounded-lg border text-sm bg-white border-gray-200"
                    value={closeReason}
                    onChange={e => setCloseReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setClosingId(null)}>Anulo</Button>
                    <Button size="sm" loading={submitting} onClick={() => handleClose(v.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />Konfirmo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
