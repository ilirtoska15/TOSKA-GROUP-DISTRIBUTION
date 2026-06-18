'use client'

export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'

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
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/payments?page=${page}&search=${search}`)
    const data = await res.json()
    setPayments(data.payments ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchPayments() }, [fetchPayments])
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagesat</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Link href="/admin/payments/new"><Button className="gap-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Pagesë e Re</span></Button></Link>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Kërko referencën..." className="pl-9" onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
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
              {loading ? (
                Array.from({length: 5}).map((_,i) => <TableRow key={i}>{Array.from({length:6}).map((_,j) => <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse"/></TableCell>)}</TableRow>)
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">Nuk ka pagesa</TableCell></TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><span className="font-mono text-sm text-primary">{p.reference}</span></TableCell>
                    <TableCell className="text-sm font-medium">{p.customer?.businessName}</TableCell>
                    <TableCell><span className="text-sm font-bold text-green-700">{formatCurrency(p.amount)}</span></TableCell>
                    <TableCell><span className={`badge ${getStatusColor(p.method)}`}>{getStatusLabel(p.method)}</span></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">{p.collectedBy?.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">{formatDateTime(p.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">Faqja {page} / {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Para</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Pas</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
