'use client'

import { useState, useEffect, useCallback } from 'react'
import { Truck, Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Delivery {
  id: string
  status: string
  assignedAt?: string
  deliveredAt?: string
  order: { id: string; reference: string; totalAmount: number; customer: { businessName: string; businessAddress: string } }
  driver?: { id: string; name: string } | null
}

interface Driver { id: string; name: string }

export default function AdminDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [assigning, setAssigning] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30', search, status })
      const [delRes, drvRes] = await Promise.all([
        fetch(`/api/deliveries?${params}`),
        fetch('/api/users?role=SHOFER'),
      ])
      if (!delRes.ok) {
        console.error('[deliveries] fetch error:', delRes.status)
        setDeliveries([])
        setTotal(0)
      } else {
        const delData = await delRes.json()
        setDeliveries(delData.deliveries ?? [])
        setTotal(delData.total ?? 0)
      }
      if (drvRes.ok) {
        const drvData = await drvRes.json()
        // users endpoint returns array directly
        setDrivers(Array.isArray(drvData) ? drvData : (drvData.users ?? []))
      }
    } catch (e) {
      console.error('[deliveries] fetch failed:', e)
      setDeliveries([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAssign = async (deliveryId: string) => {
    const driverId = selectedDriver[deliveryId]
    if (!driverId) { toast.error('Zgjidh shoferin'); return }
    setAssigning(deliveryId)
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', driverId }),
      })
      if (res.ok) {
        toast.success('Shofer u caktua')
        fetchData()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setAssigning(null)
    }
  }

  const statusLabel: Record<string, string> = {
    ASSIGNED: 'Caktuar', LOADED: 'Ngarkuar', IN_DELIVERY: 'Në Dërgesë', DELIVERED: 'Dorëzuar', FAILED: 'Dështoi',
  }
  const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'destructive'> = {
    ASSIGNED: 'info', LOADED: 'info', IN_DELIVERY: 'warning', DELIVERED: 'success', FAILED: 'destructive',
  }

  const totalPages = Math.ceil(total / 30)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dërgesat</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Kërko porosi ose klient..." className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Të gjitha statuset</option>
          <option value="ASSIGNED">Caktuar</option>
          <option value="LOADED">Ngarkuar</option>
          <option value="IN_DELIVERY">Në Dërgesë</option>
          <option value="DELIVERED">Dorëzuar</option>
          <option value="FAILED">Dështoi</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50" />)}</div>
        ) : deliveries.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Truck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë dërgesë</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kodi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Porosia</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Klienti</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statusi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Shoferi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cakto Shofer</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{d.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium font-mono text-xs">{d.order.reference}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.order.customer.businessName}</div>
                      <div className="text-xs text-gray-400">{d.order.customer.businessAddress}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[d.status] ?? 'default'}>{statusLabel[d.status] ?? d.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.driver ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                          {d.driver.name}
                        </div>
                      ) : <span className="text-gray-300 text-xs">Pa shofer</span>}
                    </td>
                    <td className="px-4 py-3">
                      {['ASSIGNED', 'LOADED'].includes(d.status) && (
                        <div className="flex items-center gap-2">
                          <select
                            className="h-8 px-2 rounded border border-gray-200 text-xs bg-white"
                            value={selectedDriver[d.id] ?? ''}
                            onChange={(e) => setSelectedDriver(prev => ({ ...prev, [d.id]: e.target.value }))}
                          >
                            <option value="">-- Zgjidh --</option>
                            {drivers.map(dr => <option key={dr.id} value={dr.id}>{dr.name}</option>)}
                          </select>
                          <Button
                            size="sm"
                            loading={assigning === d.id}
                            disabled={!selectedDriver[d.id] || assigning === d.id}
                            onClick={() => handleAssign(d.id)}
                          >
                            Cakto
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Para</Button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Pas</Button>
        </div>
      )}
    </div>
  )
}
