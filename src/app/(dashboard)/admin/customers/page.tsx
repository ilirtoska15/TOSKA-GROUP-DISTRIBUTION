'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getStatusColor, getStatusLabel, debounce } from '@/lib/utils'
import Link from 'next/link'

interface Customer {
  id: string
  code: string
  businessName: string
  city: string
  phone: string
  status: string
  agent?: { name: string } | null
  _count: { orders: number; visits: number }
  createdAt: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      search,
      status: statusFilter,
    })
    const res = await fetch(`/api/customers?${params}`)
    const data = await res.json()
    setCustomers(data.customers)
    setTotal(data.total)
    setLoading(false)
  }, [page, search, statusFilter])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const debouncedSearch = debounce((value: string) => {
    setSearch(value)
    setPage(1)
  }, 400)

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klientët / Tregjet</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Link href="/admin/customers/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Klient i Ri</span>
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko emrin, kodin, telefonin..."
            className="pl-9"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Statusi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Të gjithë</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="INACTIVE">Joaktiv</SelectItem>
            <SelectItem value="BLOCKED">Bllokuar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kodi</TableHead>
                <TableHead>Emri i Biznesit</TableHead>
                <TableHead className="hidden md:table-cell">Qyteti</TableHead>
                <TableHead className="hidden md:table-cell">Telefon</TableHead>
                <TableHead className="hidden lg:table-cell">Agjent</TableHead>
                <TableHead className="hidden lg:table-cell">Porosi</TableHead>
                <TableHead>Statusi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Nuk u gjet asnjë klient
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <Link href={`/admin/customers/${c.id}`} className="text-primary font-mono text-sm hover:underline">
                        {c.code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-gray-900 hover:text-primary">
                        {c.businessName}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500 text-sm">{c.city}</TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500 text-sm">{c.phone}</TableCell>
                    <TableCell className="hidden lg:table-cell text-gray-500 text-sm">{c.agent?.name ?? '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-center text-sm">{c._count.orders}</TableCell>
                    <TableCell>
                      <span className={`badge ${getStatusColor(c.status)}`}>
                        {getStatusLabel(c.status)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Faqja {page} / {totalPages} ({total} gjithsej)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Para
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Pas
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
