'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Search, MapPin, Phone, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Customer {
  id: string
  code: string
  businessName: string
  phone: string
  businessAddress: string
  status: string
  debtBalance: number
  debtLimit: number
}

export default function AgjentCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetch_customers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20', search })
    const res = await fetch(`/api/customers?${params}`)
    const data = await res.json()
    setCustomers(data.customers ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetch_customers() }, [fetch_customers])

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Klientët e Mi</h1>
        <p className="text-sm text-gray-500">{total} gjithsej</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Kërko klient..." className="pl-9"
          onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : customers.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë klient</p>
          </div>
        ) : customers.map(c => (
          <Link key={c.id} href={`/admin/customers/${c.id}`}>
            <div className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{c.businessName}</span>
                    <span className="font-mono text-xs text-gray-400">{c.code}</span>
                    {c.debtBalance > 0 && c.debtLimit > 0 && c.debtBalance / c.debtLimit > 0.8 && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c.businessAddress && <span className="flex items-center gap-1 truncate max-w-[200px]"><MapPin className="h-3 w-3" />{c.businessAddress}</span>}
                  </div>
                </div>
                <div className="text-right">
                  {c.debtBalance > 0 && (
                    <p className="text-sm font-semibold text-red-600">{formatCurrency(c.debtBalance)}</p>
                  )}
                  <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'BLOCKED' ? 'destructive' : 'secondary'} className="text-xs">
                    {c.status === 'ACTIVE' ? 'Aktiv' : c.status === 'BLOCKED' ? 'Bllokuar' : 'Joaktiv'}
                  </Badge>
                </div>
              </div>
            </div>
          </Link>
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
