'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Package, User, MapPin, FileText,
  CheckCircle, XCircle, Truck, Clock, Printer
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

interface OrderLine {
  id: string
  unit: string
  quantity: number
  quantityCopje: number
  salesPrice: number
  lineTotal: number
  product: { id: string; name: string; photo: string; code: string }
}

interface Order {
  id: string
  reference: string
  status: string
  totalAmount: number
  notes?: string
  createdAt: string
  updatedAt: string
  isLocked: boolean
  rejectionNote?: string
  customer: {
    id: string
    code: string
    businessName: string
    businessAddress: string
    phone: string
    city: string
  }
  createdBy: { id: string; name: string }
  lines: OrderLine[]
  delivery?: {
    id: string
    status: string
    driverId?: string
    assignedAt: string
    deliveredAt?: string
    driver?: { id: string; name: string } | null
  } | null
  payments: Array<{ id: string; reference: string; amount: number; method: string; createdAt: string; collectedBy: { name: string } }>
  returns: Array<{ id: string; reference: string; status: string; createdAt: string }>
}

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; variant: 'default' | 'outline' }[]> = {
  SUBMITTED: [
    { label: 'Aprovo', next: 'APROVUAR', variant: 'default' },
    { label: 'Anulo', next: 'ANULUAR', variant: 'outline' },
  ],
  PRET_APROVIM: [
    { label: 'Aprovo', next: 'APROVUAR', variant: 'default' },
    { label: 'Anulo', next: 'ANULUAR', variant: 'outline' },
  ],
  APROVUAR: [
    { label: 'Në Përgatitje', next: 'NE_PERGATITJE', variant: 'default' },
    { label: 'Anulo', next: 'ANULUAR', variant: 'outline' },
  ],
  NE_PERGATITJE: [
    { label: 'Gati për Ngarkim', next: 'GATI_PER_NGARKIM', variant: 'default' },
  ],
  GATI_PER_NGARKIM: [
    { label: 'Dërguar', next: 'NE_DERGESE', variant: 'default' },
  ],
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(setOrder)
      .catch(() => toast.error('Gabim në ngarkimin e porosisë'))
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (status: string) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gabim' }))
        toast.error(err.error ?? 'Gabim gjatë ndryshimit')
        return
      }
      const updated = await res.json()
      setOrder(prev => prev ? { ...prev, status: updated.status } : null)
      toast.success('Statusi u ndryshua')
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!order) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Porosia nuk u gjet</p>
      <Link href="/admin/orders" className="text-primary text-sm hover:underline mt-2 inline-block">
        Kthehu tek lista
      </Link>
    </div>
  )

  const transitions = STATUS_TRANSITIONS[order.status] ?? []
  const payments = order.payments ?? []
  const returns = order.returns ?? []
  const lines = order.lines ?? []
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, order.totalAmount - totalPaid)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 no-print">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 font-mono">{order.reference}</h1>
              <span className={`badge ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
              {order.isLocked && (
                <span className="badge bg-gray-100 text-gray-600 text-[10px]">Bllokuar</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 no-print"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Printo
          </Button>
          {transitions.length > 0 && !order.isLocked && transitions.map(t => (
            <Button
              key={t.next}
              variant={t.variant}
              size="sm"
              className={`no-print${t.next === 'ANULUAR' ? ' text-red-600 border-red-200 hover:bg-red-50' : ''}`}
              onClick={() => handleStatusChange(t.next)}
              disabled={updating}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {order.rejectionNote && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Arsyeja e Anulimit</p>
            <p className="text-sm text-red-700">{order.rejectionNote}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <User className="h-4 w-4 text-gray-400" />
                Klienti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href={`/admin/customers/${order.customer.id}`} className="font-semibold text-primary hover:underline">
                {order.customer.businessName}
              </Link>
              <p className="text-xs text-gray-400 font-mono">{order.customer.code}</p>
              <Separator />
              <div className="flex items-start gap-1.5 text-gray-600">
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                <span>{order.customer.businessAddress}, {order.customer.city}</span>
              </div>
              <p className="text-gray-600">{order.customer.phone}</p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-gray-400" />
                Detaje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Krijuar nga</span>
                <span className="font-medium">{order.createdBy.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Totali</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paguar</span>
                <span className="text-green-700">{formatCurrency(totalPaid)}</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Mbetur</span>
                  <span className="text-red-600 font-medium">{formatCurrency(remaining)}</span>
                </div>
              )}
              {order.notes && (
                <>
                  <Separator />
                  <p className="text-gray-600 text-xs">{order.notes}</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Delivery */}
          {order.delivery && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-gray-400" />
                  Dërgesa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Statusi</span>
                  <span className={`badge ${getStatusColor(order.delivery.status)}`}>
                    {getStatusLabel(order.delivery.status)}
                  </span>
                </div>
                {order.delivery.driver && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shoferi</span>
                    <span className="font-medium">{order.delivery.driver.name}</span>
                  </div>
                )}
                {order.delivery.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Dorëzuar</span>
                    <span>{formatDateTime(order.delivery.deliveredAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order lines */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Package className="h-4 w-4 text-gray-400" />
                Artikujt e Porosisë ({lines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {lines.map(line => (
                  <div key={line.id} className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                      {line.product.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.product.photo} alt={line.product.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{line.product.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{line.product.code}</p>
                      <p className="text-xs text-gray-500">
                        {line.quantity} {line.unit === 'COPE' ? 'copë' : 'pako'} × {formatCurrency(line.salesPrice)}
                        {line.unit === 'PAKO' && ` (${line.quantityCopje} copë)`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(line.lineTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t px-4 py-3 bg-gray-50 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Totali</span>
                <span className="text-base font-bold text-primary">{formatCurrency(order.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payments */}
          {payments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                  Pagesat ({payments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-sm font-medium font-mono">{p.reference}</p>
                      <p className="text-xs text-gray-500">{p.collectedBy.name} • {formatDateTime(p.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700">{formatCurrency(p.amount)}</p>
                      <span className={`badge text-[10px] ${getStatusColor(p.method)}`}>{getStatusLabel(p.method)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Returns */}
          {returns.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-gray-400" />
                  Kthimet ({returns.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {returns.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-sm font-medium font-mono">{r.reference}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(r.createdAt)}</p>
                    </div>
                    <span className={`badge ${getStatusColor(r.status)}`}>{getStatusLabel(r.status)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
