'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Search, Calendar, User, Clock, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface Visit {
  id: string
  reference: string
  status: string
  openedAt: string
  closedAt?: string
  noOrderReason?: string
  openedLat?: number
  openedLng?: number
  customer: { businessName: string; code: string }
  agent: { name: string }
}

interface Meta { total: number; page: number; limit: number }

export default function AdminVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 30 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30', search, status, date })
    const res = await fetch(`/api/visits?${params}`)
    const data = await res.json()
    setVisits(data.visits ?? [])
    setMeta(data)
    setLoading(false)
  }, [page, search, status, date])

  useEffect(() => { fetchVisits() }, [fetchVisits])

  const totalPages = Math.ceil(meta.total / meta.limit)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vizitat</h1>
          <p className="text-sm text-gray-500">{meta.total} gjithsej</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko klient ose agjent..."
            className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">Të gjitha statuset</option>
          <option value="OPEN">Hapur</option>
          <option value="CLOSED">Mbyllur</option>
        </select>
        <input
          type="date"
          className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1) }}
        />
        {date && (
          <Button variant="ghost" size="sm" onClick={() => setDate('')}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë vizitë</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kodi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Klienti</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Agjenti</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Filloi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mbylli</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statusi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">GPS</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{v.reference}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{v.customer.businessName}</div>
                      <div className="text-xs text-gray-400">{v.customer.code}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        {v.agent.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(v.openedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {v.closedAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(v.closedAt)}
                        </div>
                      ) : (
                        <span className="text-amber-500">Aktive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.status === 'OPEN' ? (
                        <Badge variant="warning">Hapur</Badge>
                      ) : (
                        <Badge variant="success">Mbyllur</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {v.openedLat ? (
                        <a
                          href={`https://www.google.com/maps?q=${v.openedLat},${v.openedLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3" />
                          Harta
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Para
          </Button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Pas
          </Button>
        </div>
      )}
    </div>
  )
}
