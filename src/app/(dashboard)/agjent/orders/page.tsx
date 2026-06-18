'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Order {
  id: string
  reference: string
  status: string
  totalAmount: number
  createdAt: string
  customer: { businessName: string; code: string }
  _count: { lines: number }
}

export default function AgjentOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search, status })
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) {
        console.error('[agjent/orders] fetch error:', res.status)
        setOrders([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('[agjent/orders] fetch failed:', e)
      setOrders([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const totalPages = Math.ceil(total / 20)

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    PRET_APROVIM: 'bg-amber-100 text-amber-700',
    APROVUAR: 'bg-green-100 text-green-700',
    NE_PERGATITJE: 'bg-purple-100 text-purple-700',
    GATI_PER_NGARKIM: 'bg-teal-100 text-teal-700',
    NE_DERGESE: 'bg-blue-100 text-blue-700',
    DORËZUAR: 'bg-emerald-100 text-emerald-700',
    ANULUAR: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Porositë e Mia</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Link href="/agjent/orders/new">
          <Button className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Porosi e Re
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Kërko porosi..." className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Të gjitha</option>
          <option value="SUBMITTED">Dërguar</option>
          <option value="PRET_APROVIM">Pret Aprovim</option>
          <option value="APROVUAR">Aprovuar</option>
          <option value="DORËZUAR">Dorëzuar</option>
          <option value="ANULUAR">Anuluar</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : orders.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë porosi</p>
          </div>
        ) : orders.map(o => (
          <div key={o.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-primary font-medium">{o.reference}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {getStatusLabel(o.status)}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{o.customer.businessName}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>{formatDate(o.createdAt)}</span>
                  <span>{o._count?.lines ?? 0} artikuj</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{formatCurrency(o.totalAmount)}</p>
              </div>
            </div>
          </div>
        ))}
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
