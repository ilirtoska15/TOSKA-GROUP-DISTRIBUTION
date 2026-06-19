'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MapPin, Navigation, Phone, Route, CheckCircle,
  AlertTriangle, Zap, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  optimizeRoute, calculateDistanceKm, formatDistanceKm, totalRouteKm,
  type RouteStop,
} from '@/lib/route-optimization'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

// Coordinates returned by the API already include lat/lng on the nested customer
interface RouteStop_ {
  id: string
  status: string
  order: {
    reference: string
    totalAmount: number
    customer: {
      id: string
      businessName: string
      phone?: string | null
      businessAddress?: string | null
      city?: string | null
      lat?: number | null
      lng?: number | null
    }
  }
}

// Shape that satisfies Locatable
interface LocatableDelivery {
  id: string
  lat?: number | null
  lng?: number | null
  raw: RouteStop_
}

const ACTIVE_STATUSES  = ['ASSIGNED', 'LOADED', 'IN_DELIVERY']
const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Caktuar', LOADED: 'Ngarkuar', IN_DELIVERY: 'Në Dërgim',
  DELIVERED: 'Dorëzuar', FAILED: 'Dështoi',
}
const STATUS_NEXT: Record<string, { status: string; label: string }> = {
  ASSIGNED:    { status: 'LOADED',      label: 'Ngarko Mallin' },
  LOADED:      { status: 'IN_DELIVERY', label: 'Niso Dërgimin' },
  IN_DELIVERY: { status: 'DELIVERED',   label: 'Konfirmo Dorëzimin' },
}

// Default start: Tiranë center (used when GPS is unavailable)
const DEFAULT_LAT = 41.3275
const DEFAULT_LNG = 19.8187

function mapsUrl(lat: number | null | undefined, lng: number | null | undefined, address: string | null | undefined) {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((address ?? '') + ', Shqipëri')}`
}

export default function ShoferRrugaPage() {
  const [allDeliveries, setAllDeliveries] = useState<RouteStop_[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [optimized, setOptimized] = useState(false)
  const [routeStops, setRouteStops] = useState<RouteStop<LocatableDelivery>[]>([])
  const [startLat, setStartLat] = useState(DEFAULT_LAT)
  const [startLng, setStartLng] = useState(DEFAULT_LNG)
  const [expandedDone, setExpandedDone] = useState(false)

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deliveries?limit=100')
      const data = await res.json()
      setAllDeliveries(data.deliveries ?? [])
    } catch {
      toast.error('Gabim në ngarkimin e dërgesave')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDeliveries() }, [fetchDeliveries])

  // Try to get driver's current position
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => { setStartLat(pos.coords.latitude); setStartLng(pos.coords.longitude) },
      () => { /* fall back to default */ },
      { timeout: 5000 },
    )
  }, [])

  const active = allDeliveries.filter(d => ACTIVE_STATUSES.includes(d.status))
  const done   = allDeliveries.filter(d => !ACTIVE_STATUSES.includes(d.status))

  // Build Locatable wrappers for the optimizer
  const toLocatable = (d: RouteStop_): LocatableDelivery => ({
    id: d.id,
    lat: d.order.customer.lat,
    lng: d.order.customer.lng,
    raw: d,
  })

  function handleOptimize() {
    if (active.length === 0) { toast.info('Nuk ka dërgesa aktive për të optimizuar'); return }
    const located = active.filter(d => d.order.customer.lat != null && d.order.customer.lng != null)
    if (located.length === 0) { toast.info('Asnjë dërgese nuk ka koordinata GPS'); return }
    const stops = optimizeRoute(active.map(toLocatable), startLat, startLng)
    setRouteStops(stops)
    setOptimized(true)
    const total = totalRouteKm(stops)
    toast.success(`Rruga u optimizua — ${formatDistanceKm(total)} gjithsej (rrugë ajrore)`)
  }

  function resetOptimization() {
    setOptimized(false)
    setRouteStops([])
  }

  async function handleStatusUpdate(deliveryId: string, newStatus: string) {
    setProcessing(deliveryId)
    try {
      const gps = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!navigator.geolocation) { resolve({}); return }
        navigator.geolocation.getCurrentPosition(
          pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 4000 },
        )
      })
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', status: newStatus, ...gps }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Gabim'); return
      }
      toast.success(
        newStatus === 'DELIVERED' ? 'Dërgesa u konfirmua ✓'
          : newStatus === 'IN_DELIVERY' ? 'Nisi dërgimi'
            : 'Statusi u ndryshua',
      )
      await fetchDeliveries()
      if (optimized) resetOptimization()
    } finally {
      setProcessing(null)
    }
  }

  async function handleFail(deliveryId: string) {
    setProcessing(deliveryId)
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', status: 'FAILED' }),
      })
      if (!res.ok) { toast.error('Gabim'); return }
      toast.success('Dërgesa u shënua si e dështuar')
      await fetchDeliveries()
      if (optimized) resetOptimization()
    } finally {
      setProcessing(null)
    }
  }

  // Build display list: either optimized or natural order
  const displayStops: Array<{ delivery: RouteStop_; distanceFromPrevKm: number | null; hasLocation: boolean }> =
    optimized
      ? routeStops.map(s => ({
        delivery: s.item.raw,
        distanceFromPrevKm: s.distanceFromPrevKm,
        hasLocation: s.hasLocation,
      }))
      : active.map(d => ({
        delivery: d,
        distanceFromPrevKm: null,
        hasLocation: d.order.customer.lat != null && d.order.customer.lng != null,
      }))

  const totalKm = optimized
    ? totalRouteKm(routeStops)
    : active.reduce((sum, d, i) => {
      if (i === 0 || !d.order.customer.lat) return sum
      const prev = active[i - 1]
      if (!prev.order.customer.lat) return sum
      return sum + calculateDistanceKm(
        prev.order.customer.lat!, prev.order.customer.lng!,
        d.order.customer.lat, d.order.customer.lng!,
      )
    }, 0)

  const today = new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rruga e Sotme</h1>
          <p className="text-xs text-gray-400 capitalize">{today}</p>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-full px-3 py-1.5 text-xs font-semibold">
            <Route className="h-3.5 w-3.5" />
            {active.length} dërgesa aktive
          </div>
          {done.length > 0 && (
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 rounded-full px-3 py-1.5 text-xs font-semibold">
              <CheckCircle className="h-3.5 w-3.5" />
              {done.length} të kryera
            </div>
          )}
          {totalKm > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-100 text-gray-600 rounded-full px-3 py-1.5 text-xs font-semibold">
              <Navigation className="h-3.5 w-3.5" />
              ~{formatDistanceKm(totalKm)} {optimized ? '(optimizuar)' : ''}
            </div>
          )}
        </div>

        {/* Optimize button */}
        {!loading && active.length > 1 && (
          <div className="flex gap-2">
            {!optimized ? (
              <Button onClick={handleOptimize} className="gap-2 w-full sm:w-auto">
                <Zap className="h-4 w-4" />
                Optimizo Rrugën
              </Button>
            ) : (
              <Button variant="outline" onClick={resetOptimization} className="gap-2 text-gray-600">
                Rendi Origjinal
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && active.length === 0 && done.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
          <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nuk ke dërgesa caktuar</p>
          <p className="text-xs text-gray-400 mt-1">Kontakto administratorin për caktim dërgese.</p>
        </div>
      )}

      {/* Active deliveries */}
      {!loading && displayStops.length > 0 && (
        <div className="space-y-3">
          {displayStops.map((stop, idx) => {
            const d = stop.delivery
            const cust = d.order.customer
            const next = STATUS_NEXT[d.status]
            const isProcessing = processing === d.id
            const hasGps = cust.lat != null && cust.lng != null

            return (
              <div
                key={d.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  d.status === 'IN_DELIVERY' ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'
                }`}
              >
                {/* Distance connector (only after first stop in optimized mode) */}
                {optimized && idx > 0 && stop.distanceFromPrevKm != null && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">
                      {formatDistanceKm(stop.distanceFromPrevKm)} nga pika paraprake
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Top row: stop number + name + badges */}
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
                      d.status === 'IN_DELIVERY'
                        ? 'bg-blue-500 text-white'
                        : d.status === 'LOADED'
                          ? 'bg-amber-400 text-white'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{cust.businessName}</p>
                        <span className={`badge text-[10px] shrink-0 ${
                          d.status === 'IN_DELIVERY' ? 'bg-blue-100 text-blue-700'
                            : d.status === 'LOADED'  ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {STATUS_LABEL[d.status] ?? d.status}
                        </span>
                        {!hasGps && (
                          <span className="badge bg-orange-100 text-orange-600 text-[10px] shrink-0 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />Pa lokacion
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{d.order.reference}</p>
                    </div>
                    <span className="font-bold text-gray-900 text-sm shrink-0">
                      {formatCurrency(d.order.totalAmount)}
                    </span>
                  </div>

                  {/* Address + phone */}
                  <div className="space-y-1.5 pl-12">
                    {cust.businessAddress && (
                      <p className="text-sm text-gray-600 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                        {cust.businessAddress}{cust.city ? `, ${cust.city}` : ''}
                      </p>
                    )}
                    {cust.phone && (
                      <a
                        href={`tel:${cust.phone}`}
                        className="text-sm text-primary flex items-center gap-1.5 hover:underline w-fit"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {cust.phone}
                      </a>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1 border-t border-gray-50 flex-wrap">
                    {/* Maps */}
                    <a
                      href={mapsUrl(cust.lat, cust.lng, cust.businessAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      {hasGps ? 'GPS' : 'Harto Adresën'}
                    </a>

                    {/* Primary status action */}
                    {next && (
                      <Button
                        size="sm"
                        loading={isProcessing}
                        onClick={() => handleStatusUpdate(d.id, next.status)}
                        className="flex-1 min-w-0"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {next.label}
                      </Button>
                    )}

                    {/* Fail action */}
                    {d.status === 'IN_DELIVERY' && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={isProcessing}
                        onClick={() => handleFail(d.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                      >
                        Dështoi
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed deliveries (collapsible) */}
      {!loading && done.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpandedDone(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Clock className="h-4 w-4" />
            Të Kryera ({done.length})
            {expandedDone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expandedDone && (
            <div className="space-y-2 mt-2">
              {done.map((d, idx) => (
                <div key={d.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">
                    {active.length + idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 truncate">{d.order.customer.businessName}</p>
                    <p className="text-xs text-gray-400 font-mono">{d.order.reference}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-gray-600">{formatCurrency(d.order.totalAmount)}</span>
                    <Badge variant={d.status === 'DELIVERED' ? 'success' : 'destructive'}>
                      {d.status === 'DELIVERED' ? 'Dorëzuar' : 'Dështoi'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
