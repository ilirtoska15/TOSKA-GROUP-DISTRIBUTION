'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Upload, Layers, Building2, Users, Store, CornerDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getStatusColor, getStatusLabel, debounce } from '@/lib/utils'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'

interface Unit {
  id: string
  code: string
  businessName: string
  unitName?: string | null
  unitType?: string | null
  city: string
  phone: string
  businessAddress?: string
  status: string
  agent?: { name: string } | null
  _count?: { orders: number }
}

interface Customer {
  id: string
  code: string
  businessName: string
  city: string
  phone: string
  status: string
  isBusinessGroup: boolean
  parentCustomerId?: string | null
  unitName?: string | null
  agent?: { name: string } | null
  parentCustomer?: { id: string; code: string; businessName: string } | null
  units?: Unit[]
  _count: { orders: number; visits: number; units: number }
  createdAt: string
}

// ─── Badges ────────────────────────────────────────────────────
function BizBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
      <Store className="h-2.5 w-2.5" />BIZNES
    </span>
  )
}
function UnitBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
      <Building2 className="h-2.5 w-2.5" />NJËSI
    </span>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
        status: statusFilter,
        type: typeFilter,
        topLevel: '1',
      })
      const res = await fetch(`/api/customers?${params}`)
      if (!res.ok) {
        console.error('[customers] fetch error:', res.status)
        setCustomers([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setCustomers(data.customers ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('[customers] fetch failed:', e)
      setCustomers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, typeFilter])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const debouncedSearch = debounce((value: string) => {
    setSearch(value)
    setPage(1)
  }, 400)

  const totalPages = Math.ceil(total / 20)

  // Render an indented unit row beneath a group (or as a search result with parent context)
  const renderUnitRow = (u: Unit, opts?: { parent?: { id: string; businessName: string } | null }) => (
    <TableRow key={u.id} className="cursor-pointer bg-gray-50/60 hover:bg-gray-100/70">
      <TableCell className="py-2">
        <Link href={`/admin/customers/${u.id}`} className="text-gray-500 font-mono text-xs hover:underline">
          {u.code}
        </Link>
      </TableCell>
      <TableCell className="py-2">
        <div className="flex items-start gap-1.5 pl-5">
          <CornerDownRight className="h-3.5 w-3.5 text-gray-300 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/admin/customers/${u.id}`} className="text-sm font-medium text-gray-700 hover:text-primary">
                {u.unitName || u.businessName}
              </Link>
              <UnitBadge />
              {u.unitType && <span className="text-[10px] text-gray-400 uppercase">{u.unitType}</span>}
            </div>
            {opts?.parent && (
              <p className="text-[11px] text-gray-400">Pjesë e: {opts.parent.businessName}</p>
            )}
            {u.businessAddress && !opts?.parent && (
              <p className="text-[11px] text-gray-400 truncate">{u.businessAddress}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-gray-500 text-sm py-2">{u.city || '—'}</TableCell>
      <TableCell className="hidden md:table-cell text-gray-500 text-sm py-2">{u.phone || '—'}</TableCell>
      <TableCell className="hidden lg:table-cell text-gray-500 text-sm py-2">{u.agent?.name ?? '-'}</TableCell>
      <TableCell className="hidden lg:table-cell text-center text-sm py-2">{u._count?.orders ?? 0}</TableCell>
      <TableCell className="py-2">
        <span className={`badge ${getStatusColor(u.status)}`}>{getStatusLabel(u.status)}</span>
      </TableCell>
    </TableRow>
  )

  const renderMainRow = (c: Customer) => {
    const isUnit = !!c.parentCustomerId
    const hasUnits = !isUnit && c._count.units > 0
    return (
      <TableRow key={c.id} className={`cursor-pointer hover:bg-gray-50 ${hasUnits ? 'bg-blue-50/30' : ''}`}>
        <TableCell>
          <Link href={`/admin/customers/${c.id}`} className="text-primary font-mono text-sm hover:underline">
            {c.code}
          </Link>
        </TableCell>
        <TableCell>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnits && <Layers className="h-4 w-4 text-blue-500 shrink-0" />}
              <Link href={`/admin/customers/${c.id}`} className="font-semibold text-gray-900 hover:text-primary">
                {c.businessName}
              </Link>
              {isUnit ? <UnitBadge /> : <BizBadge />}
              {hasUnits && (
                <span className="text-[11px] font-medium text-blue-600">
                  {c._count.units} njësi
                </span>
              )}
            </div>
            {isUnit && c.parentCustomer && (
              <p className="text-[11px] text-gray-400">Pjesë e: {c.parentCustomer.businessName}</p>
            )}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell text-gray-500 text-sm">{c.city || '—'}</TableCell>
        <TableCell className="hidden md:table-cell text-gray-500 text-sm">{c.phone || '—'}</TableCell>
        <TableCell className="hidden lg:table-cell text-gray-500 text-sm">{c.agent?.name ?? '-'}</TableCell>
        <TableCell className="hidden lg:table-cell text-center text-sm">{c._count.orders}</TableCell>
        <TableCell>
          <span className={`badge ${getStatusColor(c.status)}`}>{getStatusLabel(c.status)}</span>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Klientët / Tregjet"
        count={total}
        action={
          <>
            <Link href="/admin/customers/import">
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importo Excel</span>
              </Button>
            </Link>
            <Link href="/admin/customers/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Klient i Ri</span>
              </Button>
            </Link>
          </>
        }
      />

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
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Statusi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Të gjithë</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="INACTIVE">Joaktiv</SelectItem>
            <SelectItem value="BLOCKED">Bllokuar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Lloji" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Të gjithë</SelectItem>
            <SelectItem value="CUSTOMER">Klientë të vetëm</SelectItem>
            <SelectItem value="GROUP">Grupe biznesesh</SelectItem>
            <SelectItem value="UNIT">Njësi / Pika</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kodi</TableHead><TableHead>Emri i Biznesit</TableHead>
                  <TableHead className="hidden md:table-cell">Qyteti</TableHead>
                  <TableHead className="hidden md:table-cell">Telefon</TableHead>
                  <TableHead className="hidden lg:table-cell">Agjent</TableHead>
                  <TableHead className="hidden lg:table-cell">Porosi</TableHead>
                  <TableHead>Statusi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="Nuk u gjet asnjë klient" description="Shtoni klientin e parë ose ndryshoni filtrat e kërkimit" />
        ) : (
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
                {customers.map((c) => {
                  const rows = [renderMainRow(c)]
                  // A business renders its units indented immediately beneath (skip in UNIT filter, where units are the main rows)
                  if (typeFilter !== 'UNIT' && !c.parentCustomerId && c.units && c.units.length > 0) {
                    c.units.forEach((u) => rows.push(renderUnitRow(u)))
                  }
                  return rows
                })}
              </TableBody>
            </Table>
          </div>
        )}

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
