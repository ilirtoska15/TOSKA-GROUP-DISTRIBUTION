'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Search, CheckCircle, XCircle, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Return {
  id: string
  reference: string
  status: string
  notes?: string
  createdAt: string
  customer: { businessName: string; code: string }
  createdBy: { name: string }
  lines: { id: string; quantity: number; product: { name: string } }[]
}

const STATUS_LABEL: Record<string, string> = {
  NE_PRITJE: 'Pret', APROVUAR: 'Aprovuar', REFUZUAR: 'Refuzuar', KTHYER_NE_DEPO: 'Magazinë',
}
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'info'> = {
  NE_PRITJE: 'warning', APROVUAR: 'success', REFUZUAR: 'destructive', KTHYER_NE_DEPO: 'info',
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30', search, status })
    const res = await fetch(`/api/returns?${params}`)
    const data = await res.json()
    setReturns(data.returns ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search, status])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'warehouse') => {
    const actionMap: Record<string, string> = { approve: 'APROVUAR', reject: 'REFUZUAR', warehouse: 'KTHYER_NE_DEPO' }
    setProcessing(id)
    try {
      const res = await fetch(`/api/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: actionMap[action] }),
      })
      if (res.ok) {
        const label = { approve: 'aprovuar', reject: 'refuzuar', warehouse: 'dërguar në magazinë' }[action]
        toast.success(`Kthimi u ${label}`)
        fetchReturns()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setProcessing(null)
    }
  }

  const totalPages = Math.ceil(total / 30)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kthimet</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Kërko klient ose kod..." className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Të gjitha statuset</option>
          <option value="NE_PRITJE">Pret</option>
          <option value="APROVUAR">Aprovuar</option>
          <option value="REFUZUAR">Refuzuar</option>
          <option value="KTHYER_NE_DEPO">Magazinë</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50" />)}</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <RotateCcw className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë kthim</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kodi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Klienti</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Arsyeja</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Vlera</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statusi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{r.reference}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.customer.businessName}</div>
                      <div className="text-xs text-gray-400">{r.createdBy.name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[150px] truncate">{r.notes}</td>
                    <td className="px-4 py-3 font-medium text-gray-600">—</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'NE_PRITJE' && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="success" loading={processing === r.id}
                            onClick={() => handleAction(r.id, 'approve')}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />Aprovo
                          </Button>
                          <Button size="sm" variant="destructive" loading={processing === r.id}
                            onClick={() => handleAction(r.id, 'reject')}>
                            <XCircle className="h-3.5 w-3.5 mr-1" />Refuzo
                          </Button>
                        </div>
                      )}
                      {r.status === 'APROVUAR' && (
                        <Button size="sm" variant="outline" loading={processing === r.id}
                          onClick={() => handleAction(r.id, 'warehouse')}>
                          <Package className="h-3.5 w-3.5 mr-1" />Magazinë
                        </Button>
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
