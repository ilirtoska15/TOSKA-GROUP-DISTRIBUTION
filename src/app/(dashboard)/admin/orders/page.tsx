'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel, debounce } from '@/lib/utils'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Order {
  id: string
  reference: string
  status: string
  totalAmount: number
  createdAt: string
  customer: { businessName: string; code: string }
  createdBy: { name: string }
  _count: { lines: number }
}

const STATUS_OPTIONS = [
  { value: '', label: 'Të gjitha' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Dërguar' },
  { value: 'PRET_APROVIM', label: 'Pret Aprovim' },
  { value: 'APROVUAR', label: 'Aprovuar' },
  { value: 'NE_PERGATITJE', label: 'Në Përgatitje' },
  { value: 'GATI_PER_NGARKIM', label: 'Gati Ngarkim' },
  { value: 'NE_DERGESE', label: 'Në Dërgesë' },
  { value: 'DORËZUAR', label: 'Dorëzuar' },
  { value: 'DESHTUAR', label: 'Dështuar' },
  { value: 'ANULUAR', label: 'Anuluar' },
]

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search, status: statusFilter })
      const res = await fetch(`/api/orders?${params}`)
      if (!res.ok) {
        console.error('[orders] fetch error:', res.status)
        setOrders([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('[orders] fetch failed:', e)
      setOrders([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const debouncedSearch = debounce((v: string) => { setSearch(v); setPage(1) }, 400)
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Porositë</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Link href="/agjent/orders/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Porosi e Re</span>
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko referencën, klientin..."
            className="pl-9"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Statusi" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referenca</TableHead>
                <TableHead>Klienti</TableHead>
                <TableHead className="hidden md:table-cell">Krijuar Nga</TableHead>
                <TableHead className="hidden md:table-cell">Data</TableHead>
                <TableHead className="text-right">Shuma</TableHead>
                <TableHead>Statusi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">Nuk ka porosi</TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-sm text-primary hover:underline">
                        {o.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/customers/${o.customer.code}`} className="text-sm font-medium text-gray-900 hover:text-primary">
                        {o.customer.businessName}
                      </Link>
                      <p className="text-xs text-gray-400">{o.customer.code}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">{o.createdBy.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">{formatDateTime(o.createdAt)}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCurrency(o.totalAmount)}</TableCell>
                    <TableCell>
                      <span className={`badge text-xs ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Faqja {page} / {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Para</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Pas</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
