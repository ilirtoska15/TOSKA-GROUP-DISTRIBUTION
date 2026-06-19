'use client'

import { useState, useEffect, useCallback } from 'react'
import { Truck, MapPin, CheckCircle, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Delivery {
  id: string
  status: string
  order: { reference: string; totalAmount: number; customer: { businessName: string; phone?: string | null; businessAddress?: string | null } }
}

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Caktuar', LOADED: 'Ngarkuar', IN_DELIVERY: 'Marrë', DELIVERED: 'Dorëzuar', FAILED: 'Dështoi',
}
const STATUS_NEXT: Record<string, string> = { ASSIGNED: 'LOADED', LOADED: 'IN_DELIVERY', IN_DELIVERY: 'DELIVERED' }
const STATUS_NEXT_LABEL: Record<string, string> = { ASSIGNED: 'Ngarko Mallin', LOADED: 'Niso Dërgimin', IN_DELIVERY: 'Konfirmo Dorëzimin' }

export default function ShoferDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/deliveries?limit=50')
    const data = await res.json()
    setDeliveries(data.deliveries ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchDeliveries() }, [fetchDeliveries])

  const getGPS = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), { timeout: 5000 }
      )
    })

  const handleUpdate = async (id: string, newStatus: string) => {
    setProcessing(id)
    const gps = await getGPS()
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', status: newStatus, ...gps }),
      })
      if (res.ok) {
        toast.success(newStatus === 'IN_DELIVERY' ? 'Nisi dërgimi' : 'Dërgesa u konfirmua')
        fetchDeliveries()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setProcessing(null)
    }
  }

  const handleFail = async (id: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', status: 'FAILED' }),
      })
      if (res.ok) {
        toast.success('Dërgesa u shënua si e dështuar')
        fetchDeliveries()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setProcessing(null)
    }
  }

  const active = deliveries.filter(d => ['ASSIGNED', 'LOADED', 'IN_DELIVERY'].includes(d.status))
  const done = deliveries.filter(d => ['DELIVERED', 'FAILED'].includes(d.status))

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dërgesat e Mia</h1>
        <p className="text-sm text-gray-500">{total} gjithsej</p>
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Aktive</h2>
          <div className="space-y-3">
            {active.map(d => (
              <div key={d.id} className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-primary shrink-0">{d.order.reference}</span>
                      <Badge variant={d.status === 'IN_DELIVERY' ? 'info' : 'warning'}>{STATUS_LABEL[d.status]}</Badge>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{d.order.customer.businessName}</p>
                    {d.order.customer.businessAddress && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />{d.order.customer.businessAddress}
                      </p>
                    )}
                    {d.order.customer.phone && (
                      <a href={`tel:${d.order.customer.phone}`} className="text-sm text-primary flex items-center gap-1 mt-0.5 hover:underline">
                        <Phone className="h-3.5 w-3.5" />{d.order.customer.phone}
                      </a>
                    )}
                  </div>
                  <p className="font-bold text-gray-900 shrink-0">{formatCurrency(d.order.totalAmount)}</p>
                </div>
                <div className="flex gap-2 pt-1 border-t">
                  {STATUS_NEXT[d.status] && (
                    <Button
                      size="sm"
                      loading={processing === d.id}
                      onClick={() => handleUpdate(d.id, STATUS_NEXT[d.status])}
                      className="flex-1"
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      {STATUS_NEXT_LABEL[d.status]}
                    </Button>
                  )}
                  {d.status === 'IN_DELIVERY' && (
                    <Button size="sm" variant="destructive" loading={processing === d.id} onClick={() => handleFail(d.id)}>
                      Dështoi
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Të Kryera</h2>
          <div className="space-y-2">
            {done.map(d => (
              <div key={d.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-gray-400">{d.order.reference}</span>
                    <p className="font-medium text-gray-700 truncate">{d.order.customer.businessName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-gray-600">{formatCurrency(d.order.totalAmount)}</span>
                    <Badge variant={d.status === 'DELIVERED' ? 'success' : 'destructive'}>
                      {d.status === 'DELIVERED' ? 'Dorëzuar' : 'Dështoi'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && deliveries.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
          <Truck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>Nuk ke dërgesa caktuar</p>
        </div>
      )}
    </div>
  )
}
