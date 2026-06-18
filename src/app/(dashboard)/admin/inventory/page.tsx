'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Calendar, User, Package2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface InventoryLine {
  id: string
  productName: string
  expectedQty: number
  countedQty: number
  diffQty: number
  diffReason?: string
}

interface InventoryRecord {
  id: string
  code: string
  status: string
  type: string
  startedAt: string
  completedAt?: string
  conductedBy: { name: string }
  lines: InventoryLine[]
  totalLines: number
  discrepancies: number
}

export default function AdminInventoryPage() {
  const [records, setRecords] = useState<InventoryRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    const res = await fetch(`/api/inventory?${params}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const totalPages = Math.ceil(total / 20)

  const typeLabel: Record<string, string> = { FULL: 'E Plotë', PARTIAL: 'Pjesore', SPOT: 'Spot' }
  const statusVariant: Record<string, 'warning' | 'success' | 'info'> = {
    IN_PROGRESS: 'warning', COMPLETED: 'success', DRAFT: 'info',
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventarizimi</h1>
          <p className="text-sm text-gray-500">{total} sesione gjithsej</p>
        </div>
        <Link href="/depoist/inventory">
          <Button className="gap-2">
            <Package2 className="h-4 w-4" />
            Inventarizim i Ri
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse bg-gray-50" />)}</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u krye asnjë inventarizim ende</p>
          </div>
        ) : (
          <div className="divide-y">
            {records.map(r => (
              <div key={r.id}>
                <div
                  className="px-4 py-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-primary font-medium">{r.code}</span>
                        <Badge variant="outline">{typeLabel[r.type] ?? r.type}</Badge>
                        <Badge variant={statusVariant[r.status] ?? 'default'}>
                          {r.status === 'IN_PROGRESS' ? 'Në progres' : r.status === 'COMPLETED' ? 'Kompletuar' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{r.conductedBy.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{formatDate(r.startedAt)}
                        </span>
                        <span>{r.totalLines} produkte</span>
                        {r.discrepancies > 0 && (
                          <span className="text-amber-600 font-medium">{r.discrepancies} diferencë</span>
                        )}
                      </div>
                    </div>
                    <button className="text-gray-400 text-xs hover:text-gray-600">
                      {expanded === r.id ? 'Mbyll ▲' : 'Detaje ▼'}
                    </button>
                  </div>
                </div>
                {expanded === r.id && r.lines?.length > 0 && (
                  <div className="px-4 pb-4 bg-gray-50 border-t">
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-1.5 font-medium">Produkti</th>
                          <th className="text-right py-1.5 font-medium">Pritshmëria</th>
                          <th className="text-right py-1.5 font-medium">Numëruar</th>
                          <th className="text-right py-1.5 font-medium">Diferenca</th>
                          <th className="text-left py-1.5 font-medium pl-2">Arsyeja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {r.lines.map(l => (
                          <tr key={l.id} className={l.diffQty !== 0 ? 'bg-amber-50' : ''}>
                            <td className="py-1.5">{l.productName}</td>
                            <td className="py-1.5 text-right">{l.expectedQty}</td>
                            <td className="py-1.5 text-right">{l.countedQty}</td>
                            <td className={`py-1.5 text-right font-medium ${l.diffQty > 0 ? 'text-green-600' : l.diffQty < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {l.diffQty > 0 ? '+' : ''}{l.diffQty}
                            </td>
                            <td className="py-1.5 pl-2 text-gray-500">{l.diffReason ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
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
