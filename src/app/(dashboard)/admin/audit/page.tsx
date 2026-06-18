'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'

interface AuditLog {
  id: string
  module: string
  action: string
  recordId?: string
  prevValue?: string
  newValue?: string
  ipAddress?: string
  createdAt: string
  user?: { name: string; role: string } | null
}

const MODULE_OPTIONS = [
  '', 'products', 'customers', 'orders', 'payments', 'deliveries',
  'returns', 'damage', 'inventory', 'users', 'permissions', 'config', 'expenses',
]

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [moduleFilter, setModuleFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (moduleFilter) params.set('module', moduleFilter)
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) {
        console.error('[audit] fetch error:', res.status)
        setLogs([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('[audit] fetch failed:', e)
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, moduleFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / 50)

  const actionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-700'
    if (action.includes('UPDATE') || action.includes('ASSIGN')) return 'bg-blue-100 text-blue-700'
    if (action.includes('DELETE') || action.includes('ANUL')) return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Log Auditimi
          </h1>
          <p className="text-sm text-gray-500">{total} regjistrime gjithsej</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={moduleFilter}
          onChange={(e) => { setModuleFilter(e.target.value); setPage(1) }}
        >
          <option value="">Të gjitha modulet</option>
          {MODULE_OPTIONS.filter(Boolean).map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse bg-gray-50 mx-4 my-2 rounded" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Shield className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ka regjistrime</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Koha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Përdoruesi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Moduli</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Veprimi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">ID Rekordit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div>
                          <p className="font-medium text-gray-900">{log.user.name}</p>
                          <p className="text-xs text-gray-400">{log.user.role}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Sistem</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {log.recordId && (
                        <span className="font-mono text-xs text-gray-500">
                          {log.recordId.slice(-8).toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                      {log.ipAddress ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Faqja {page} / {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Para
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Pas
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
