'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

interface Return {
  id: string
  code: string
  status: string
  reason: string
  totalAmount: number
  createdAt: string
  customer: { name: string }
  returnLines: { id: string; quantity: number; product: { name: string } }[]
}

const STATUS_LABEL: Record<string, string> = { PENDING: 'Pret', APPROVED: 'Aprovuar', REJECTED: 'Refuzuar', WAREHOUSE: 'Magazinë' }
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'info'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', WAREHOUSE: 'info',
}

export default function ShoferReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/returns?limit=30')
    const data = await res.json()
    setReturns(data.returns ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  const handlePickup = async (id: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WAREHOUSE' }),
      })
      if (res.ok) {
        toast.success('Kthimi u dërgua në magazinë')
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
        <h1 className="text-xl font-bold text-gray-900">Kthimet</h1>
        <p className="text-sm text-gray-500">{total} gjithsej</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : returns.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <RotateCcw className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ka kthime për të tërhequr</p>
          </div>
        ) : returns.map(r => (
          <div key={r.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-primary">{r.code}</span>
                  <Badge variant={STATUS_VARIANT[r.status] ?? 'default'} className="text-xs">
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <p className="font-semibold text-gray-900">{r.customer.name}</p>
                <p className="text-xs text-gray-500">{r.reason}</p>
              </div>
              <p className="font-bold text-gray-800">{formatCurrency(r.totalAmount)}</p>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {r.returnLines.map(l => (
                <span key={l.id} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                  {l.product.name} × {l.quantity}
                </span>
              ))}
            </div>
            {r.status === 'APPROVED' && (
              <Button size="sm" className="w-full gap-1.5" loading={processing === r.id}
                onClick={() => handlePickup(r.id)}>
                <Package className="h-3.5 w-3.5" />Tërhiq dhe Dërgoje në Magazinë
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
