'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Package, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Return {
  id: string
  reference: string
  status: string
  notes?: string
  createdAt: string
  customer: { businessName: string }
  createdBy: { name: string }
  lines: { id: string; quantity: number; product: { name: string } }[]
}

const STATUS_LABEL: Record<string, string> = {
  KTHYER_NE_DEPO: 'Magazinë', APROVUAR: 'Aprovuar', NE_PRITJE: 'Pret', PERFUNDUAR: 'Procesuar',
}
const STATUS_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'secondary'> = {
  KTHYER_NE_DEPO: 'info', APROVUAR: 'success', NE_PRITJE: 'warning', PERFUNDUAR: 'secondary',
}

const FILTER_OPTIONS = [
  { value: 'KTHYER_NE_DEPO', label: 'Magazinë' },
  { value: 'APROVUAR', label: 'Aprovuar' },
  { value: 'NE_PRITJE', label: 'Pret' },
]

export default function DepoistReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState('KTHYER_NE_DEPO')

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: activeFilter, limit: '50' })
    const res = await fetch(`/api/returns?${params}`)
    const data = await res.json()
    setReturns(data.returns ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [activeFilter])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  const handleProcess = async (id: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PERFUNDUAR', warehouseAction: 'RETURN_TO_STOCK' }),
      })
      if (res.ok) {
        toast.success('Kthimi u procesua — stoku u rikthye')
        fetchReturns()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Kthimet në Magazinë</h1>
        <p className="text-sm text-gray-500">{total} kthime</p>
      </div>

      <div className="flex gap-2">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFilter === opt.value ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : returns.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <RotateCcw className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ka kthime</p>
          </div>
        ) : returns.map(r => (
          <div key={r.id} className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-primary">{r.reference}</span>
                  <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'} className="text-xs">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
                <p className="font-semibold text-gray-900">{r.customer.businessName}</p>
                <p className="text-xs text-gray-500">{r.createdBy.name} · {r.notes && `${r.notes} · `}{formatDate(r.createdAt)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.lines.map(l => (
                <div key={l.id} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded-lg">
                  <Package className="h-3 w-3 text-gray-400" />
                  {l.product.name} × {l.quantity}
                </div>
              ))}
            </div>
            {r.status === 'KTHYER_NE_DEPO' && (
              <Button size="sm" variant="success" className="w-full" loading={processing === r.id}
                onClick={() => handleProcess(r.id)}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />Prono Mallin — Rikthe Stokun
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
