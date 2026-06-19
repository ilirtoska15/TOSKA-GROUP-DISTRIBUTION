'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, MapPin, Phone, User, AlertTriangle, Clock, Calendar, Package, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Customer {
  id: string
  code: string
  businessName: string
  businessAddress: string
  city: string
  phone: string
  phone2?: string
  contactPerson?: string
  status: string
  debtLimit: number
  paymentTermDays: number
  notes?: string
  currentDebt: number
  isBusinessGroup?: boolean
  parentCustomer?: { id: string; businessName: string } | null
  units?: Array<{ id: string; code: string; businessName: string; unitName?: string; status: string }>
  agent?: { name: string } | null
  orders: Array<{ id: string; reference: string; status: string; totalAmount: number; createdAt: string }>
  visits: Array<{ id: string; reference: string; status: string; openedAt: string; scheduledDate?: string; scheduledTime?: string; agent: { name: string } }>
  topProducts: Array<{ productId: string; name: string; code: string; totalQty: number; totalValue: number }>
  purchaseCalendar?: { totalOrders: number; avgDaysBetween: number | null; daysSinceLast: number | null; lastOrderAt: string | null; status: 'NORMAL' | 'AFËR' | 'VONUAR' }
  growthTracker?: { currPeriodSales: number; prevPeriodSales: number; growthPct: number | null; trend: string }
}

export default function AgjentCustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then(r => r.json())
      .then(setCustomer)
      .catch(() => toast.error('Gabim në ngarkimin e klientit'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!customer) return (
    <div className="p-6 text-center text-gray-500">Klienti nuk u gjet</div>
  )

  const debtPct = customer.debtLimit > 0 ? (customer.currentDebt / customer.debtLimit) * 100 : 0

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/agjent/customers">
          <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{customer.businessName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-gray-400">{customer.code}</span>
            <Badge variant={customer.status === 'ACTIVE' ? 'success' : customer.status === 'BLOCKED' ? 'destructive' : 'secondary'}>
              {customer.status === 'ACTIVE' ? 'Aktiv' : customer.status === 'BLOCKED' ? 'Bllokuar' : 'Joaktiv'}
            </Badge>
          </div>
        </div>
        <Link href={`/agjent/orders/new?customerId=${id}`}>
          <Button size="sm">Porosi e Re</Button>
        </Link>
      </div>

      {/* Debt Banner */}
      {customer.currentDebt > 0 && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${
          debtPct >= 100 ? 'bg-red-50 border border-red-200' :
          debtPct >= 80 ? 'bg-orange-50 border border-orange-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <AlertTriangle className={`h-5 w-5 shrink-0 ${debtPct >= 100 ? 'text-red-500' : debtPct >= 80 ? 'text-orange-500' : 'text-yellow-500'}`} />
          <div className="flex-1">
            <p className="text-sm font-semibold">Borxh: {formatCurrency(customer.currentDebt)}</p>
            {customer.debtLimit > 0 && (
              <p className="text-xs text-gray-600">Limit: {formatCurrency(customer.debtLimit)} ({debtPct.toFixed(0)}% e zënë)</p>
            )}
          </div>
        </div>
      )}

      {/* Contact Info */}
      <Card>
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{customer.businessAddress}</p>
              <p className="text-xs text-gray-500">{customer.city}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="h-4 w-4 text-gray-400" />
            <a href={`tel:${customer.phone}`} className="text-sm text-primary">{customer.phone}</a>
          </div>
          {customer.phone2 && (
            <div className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-gray-400" />
              <a href={`tel:${customer.phone2}`} className="text-sm text-primary">{customer.phone2}</a>
            </div>
          )}
          {customer.contactPerson && (
            <div className="flex items-center gap-2.5">
              <User className="h-4 w-4 text-gray-400" />
              <p className="text-sm">{customer.contactPerson}</p>
            </div>
          )}
          {customer.paymentTermDays > 0 && (
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-600">Afat pagese: {customer.paymentTermDays} ditë</p>
            </div>
          )}
          {customer.notes && (
            <p className="text-xs text-gray-500 italic border-t pt-2 mt-1">{customer.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Business Units (for GROUP customers) */}
      {customer.units && customer.units.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Njësitë e Biznesit ({customer.units.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {customer.units.map(u => (
              <Link key={u.id} href={`/agjent/customers/${u.id}`} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium">{u.businessName}</p>
                  {u.unitName && <p className="text-xs text-gray-400">{u.unitName}</p>}
                  <p className="text-xs font-mono text-gray-300">{u.code}</p>
                </div>
                <Badge variant={u.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-[10px]">
                  {u.status === 'ACTIVE' ? 'Aktiv' : 'Joaktiv'}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Parent group link for UNIT customers */}
      {customer.parentCustomer && (
        <Link href={`/agjent/customers/${customer.parentCustomer.id}`} className="block">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            Pjesë e grupit: <span className="font-semibold">{customer.parentCustomer.businessName}</span>
          </div>
        </Link>
      )}

      {/* Upcoming/recent visits */}
      {customer.visits && customer.visits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-500" />Vizitat</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.visits.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100">
                <div>
                  <p className="text-xs font-mono text-gray-500">{v.reference}</p>
                  <p className="text-xs text-gray-400">
                    {v.scheduledDate ? formatDate(v.scheduledDate) : formatDateTime(v.openedAt)}
                  </p>
                </div>
                <Badge variant={
                  v.status === 'OPEN' ? 'warning' :
                  v.status === 'CLOSED' ? 'success' :
                  v.status === 'PLANNED' ? 'secondary' :
                  v.status === 'MISSED' ? 'destructive' : 'secondary'
                } className="text-[10px]">
                  {v.status === 'OPEN' ? 'Hapur' : v.status === 'CLOSED' ? 'Mbyllur' : v.status === 'PLANNED' ? 'Planifikuar' : v.status === 'MISSED' ? 'E humbur' : v.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      {customer.orders && customer.orders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Porositë e Fundit</CardTitle>
              <Link href={`/agjent/orders?customerId=${id}`} className="text-xs text-primary hover:underline">Shih të gjitha</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.orders.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium font-mono">{o.reference}</p>
                  <p className="text-xs text-gray-400">{formatDate(o.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(o.totalAmount)}</p>
                  <span className={`badge text-[10px] ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Purchase Calendar */}
      {customer.purchaseCalendar && customer.purchaseCalendar.totalOrders > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />Kalendari i Blerjeve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                customer.purchaseCalendar.status === 'VONUAR' ? 'bg-red-100 text-red-700' :
                customer.purchaseCalendar.status === 'AFËR' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {customer.purchaseCalendar.status === 'VONUAR' ? 'VONUAR' : customer.purchaseCalendar.status === 'AFËR' ? 'AFËR AFATIT' : 'NORMAL'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="p-2 rounded-lg bg-gray-50">
                <p className="font-bold text-gray-900">{customer.purchaseCalendar.totalOrders}</p>
                <p className="text-[10px] text-gray-500">Porosi</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-50">
                <p className="font-bold text-gray-900">{customer.purchaseCalendar.avgDaysBetween ?? '—'}</p>
                <p className="text-[10px] text-gray-500">Ditë mes</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-50">
                <p className={`font-bold ${
                  customer.purchaseCalendar.daysSinceLast !== null && customer.purchaseCalendar.avgDaysBetween !== null && customer.purchaseCalendar.daysSinceLast > customer.purchaseCalendar.avgDaysBetween * 1.5
                    ? 'text-red-600' : 'text-gray-900'
                }`}>{customer.purchaseCalendar.daysSinceLast ?? '—'}</p>
                <p className="text-[10px] text-gray-500">Ditë pa porosi</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Growth Tracker */}
      {customer.growthTracker && customer.growthTracker.growthPct !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {customer.growthTracker.trend === 'UP'
                ? <TrendingUp className="h-4 w-4 text-green-500" />
                : <TrendingDown className="h-4 w-4 text-red-500" />
              }
              Rritja 30 Ditë
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Ky muaj</p>
                <p className="text-sm font-semibold">{formatCurrency(customer.growthTracker.currPeriodSales)}</p>
              </div>
              <div className={`text-xl font-bold ${customer.growthTracker.growthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {customer.growthTracker.growthPct >= 0 ? '+' : ''}{customer.growthTracker.growthPct}%
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Periudha para</p>
                <p className="text-sm font-semibold">{formatCurrency(customer.growthTracker.prevPeriodSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products */}
      {customer.topProducts && customer.topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />Produktet Kryesore
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {customer.topProducts.slice(0, 5).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                <span className="text-xs font-bold text-gray-400 w-4 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.totalQty} copë</p>
                </div>
                <p className="text-sm font-semibold shrink-0">{formatCurrency(p.totalValue)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
