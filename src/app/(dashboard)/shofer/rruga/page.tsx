'use client'

import { useState, useEffect } from 'react'
import { MapPin, Navigation, Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface RouteStop {
  id: string
  status: string
  order: {
    reference: string
    totalAmount: number
    customer: {
      businessName: string
      phone?: string | null
      businessAddress?: string | null
      lat?: number | null
      lng?: number | null
    }
  }
}

export default function ShoferRrugaPage() {
  const [stops, setStops] = useState<RouteStop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deliveries?limit=100')
      .then(r => r.json())
      .then(d => {
        setStops(d.deliveries ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const inProgress = stops.filter(s => s.status === 'IN_DELIVERY')
  const pending = stops.filter(s => ['ASSIGNED', 'LOADED'].includes(s.status))

  const openMaps = (lat: number, lng: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`
    window.open(url, '_blank')
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rruga e Sotme</h1>
        <p className="text-sm text-gray-500">{stops.length} ndalesa gjithsej</p>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)
      ) : stops.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
          <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>Nuk ke ndalesa caktuar sot</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inProgress.map((s, i) => (
            <div key={s.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900">{s.order.customer.businessName}</p>
                      <Badge variant="info" className="text-xs">Në Dërgesë</Badge>
                    </div>
                    {s.order.customer.businessAddress && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />{s.order.customer.businessAddress}
                      </p>
                    )}
                    {s.order.customer.phone && (
                      <a href={`tel:${s.order.customer.phone}`} className="text-sm text-primary flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />{s.order.customer.phone}
                      </a>
                    )}
                    <p className="text-xs text-gray-500 mt-1 font-mono">{s.order.reference} · {formatCurrency(s.order.totalAmount)}</p>
                  </div>
                </div>
                {s.order.customer.lat && (
                  <Button size="sm" variant="outline" onClick={() => openMaps(s.order.customer.lat!, s.order.customer.lng!, s.order.customer.businessName)}>
                    <Navigation className="h-3.5 w-3.5 mr-1" />GPS
                  </Button>
                )}
              </div>
            </div>
          ))}
          {pending.map((s, i) => (
            <div key={s.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {inProgress.length + i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{s.order.customer.businessName}</p>
                    {s.order.customer.businessAddress && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />{s.order.customer.businessAddress}
                      </p>
                    )}
                    {s.order.customer.phone && (
                      <a href={`tel:${s.order.customer.phone}`} className="text-sm text-primary flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />{s.order.customer.phone}
                      </a>
                    )}
                    <p className="text-xs text-gray-500 mt-1 font-mono">{s.order.reference} · {formatCurrency(s.order.totalAmount)}</p>
                  </div>
                </div>
                {s.order.customer.lat && (
                  <Button size="sm" variant="outline" onClick={() => openMaps(s.order.customer.lat!, s.order.customer.lng!, s.order.customer.businessName)}>
                    <Navigation className="h-3.5 w-3.5 mr-1" />GPS
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
