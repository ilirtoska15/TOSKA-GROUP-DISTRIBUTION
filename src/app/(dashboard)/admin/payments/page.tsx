'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

interface Payment {
  id: string; reference: string; amount: number; method: string; status?: string
  createdAt: string; customer: { businessName: string; code: string }
  collectedBy: { name: string }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), search, method: methodFilter })
      const res = await fetch(`/api/payments?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }))
        console.error('[payments]', err)
        setPayments([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setPayments(data.payments ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('[payments] fetch failed:', e)
      setPayments([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, methodFilter])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const totalPages = Math.ceil(total / 20)
  const pageTotal = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Pagesat"
        count={total}
        action={
          <Link href="/admin/payments/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Pagesë e Re</span>
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko referencën, klientin..."
            className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Metoda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Të gjitha</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="BANK">Bankë</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Page total summary */}
      {!loading && payments.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Totali i faqes ({payments.length} pagesa{methodFilter ? ` · ${methodFilter === 'CASH' ? 'Cash' : 'Bankë'}` : ''}):
          </span>
          <span className="text-base font-bold text-emerald-700">{formatCurrency(pageTotal)}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referenca</TableHead><TableHead>Klienti</TableHead>
                  <TableHead>Shuma</TableHead><TableHead>Metoda</TableHead>
                  <TableHead className="hidden md:table-cell">Mbledhur Nga</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : payments.length === 0 ? (
          <EmptyState icon={DollarSign} title="Nuk ka pagesa" description="Regjistro pagesën e parë duke klikuar 'Pagesë e Re'" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referenca</TableHead>
                  <TableHead>Klienti</TableHead>
                  <TableHead>Shuma</TableHead>
                  <TableHead>Metoda</TableHead>
                  <TableHead className="hidden md:table-cell">Mbledhur Nga</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><span className="font-mono text-sm text-primary">{p.reference}</span></TableCell>
                    <TableCell className="text-sm font-medium">{p.customer?.businessName}</TableCell>
                    <TableCell><span className="text-sm font-bold text-green-700">{formatCurrency(p.amount)}</span></TableCell>
                    <TableCell><span className={`badge ${getStatusColor(p.method)}`}>{getStatusLabel(p.method)}</span></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">{p.collectedBy?.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">{formatDateTime(p.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">Faqja {page} / {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Para</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Pas</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
