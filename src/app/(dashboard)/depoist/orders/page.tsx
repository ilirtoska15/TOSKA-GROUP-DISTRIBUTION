'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, CheckCircle, Truck, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface OrderLine {
  id: string
  productName: string
  quantityCopje: number
  unit: string
  salesPrice: number
}

interface Order {
  id: string
  code: string
  status: string
  totalAmount: number
  createdAt: string
  customer: { name: string; code: string }
  agent: { name: string }
  orderLines: OrderLine[]
}

const STATUS_LABEL: Record<string, string> = {
  APROVUAR: 'Aprovuar', PERGATITJE: 'Në Përgatitje', GATSHME: 'Gatshme',
}

export default function DepoistOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: 'APROVUAR,PERGATITJE,GATSHME', limit: '50' })
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setOrders(data.orders ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleStatus = async (id: string, status: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const label = status === 'PERGATITJE' ? 'filloi përgatitja' : status === 'GATSHME' ? 'gati për dërgim' : status
        toast.success(`Porosia u ${label}`)
        fetchOrders()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setProcessing(null)
    }
  }

  const statusVariant: Record<string, 'success' | 'purple' | 'info'> = {
    APROVUAR: 'success', PERGATITJE: 'purple', GATSHME: 'info',
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Porositë për Magazinë</h1>
        <p className="text-sm text-gray-500">{total} porosi aktive</p>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)
        ) : orders.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk ka porosi të mbetura për procesim</p>
          </div>
        ) : orders.map(o => (
          <div key={o.id} className="bg-white rounded-xl border overflow-hidden">
            <div
              className="p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpanded(expanded === o.id ? null : o.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-primary font-medium">{o.code}</span>
                    <Badge variant={statusVariant[o.status] ?? 'default'}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </div>
                  <p className="font-semibold text-gray-900">{o.customer.name}</p>
                  <p className="text-xs text-gray-500">{o.agent.name} · {formatDate(o.createdAt)}</p>
                </div>
                <p className="font-bold text-gray-900">{formatCurrency(o.totalAmount)}</p>
              </div>
            </div>

            {expanded === o.id && (
              <div className="border-t bg-gray-50 p-4">
                <div className="space-y-1.5 mb-4">
                  {o.orderLines.map(l => (
                    <div key={l.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-700">{l.productName}</span>
                      </div>
                      <span className="font-medium text-gray-900">{l.quantityCopje} copë</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {o.status === 'APROVUAR' && (
                    <Button size="sm" loading={processing === o.id} onClick={() => handleStatus(o.id, 'PERGATITJE')} className="flex-1">
                      <Package className="h-3.5 w-3.5 mr-1" />Fillo Përgatitjen
                    </Button>
                  )}
                  {o.status === 'PERGATITJE' && (
                    <Button size="sm" variant="success" loading={processing === o.id} onClick={() => handleStatus(o.id, 'GATSHME')} className="flex-1">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />Shëno Gatshme
                    </Button>
                  )}
                  {o.status === 'GATSHME' && (
                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                      <Truck className="h-4 w-4" />Pret Shoferin
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
