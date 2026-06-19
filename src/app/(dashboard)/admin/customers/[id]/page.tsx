'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, MapPin, Phone, Building2, User, Edit, AlertTriangle, CheckCircle,
  Ban, Package, Layers, RotateCcw, Calendar, TrendingUp, TrendingDown,
  ShoppingCart, DollarSign, Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getStatusLabel, cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import dynamicImport from 'next/dynamic'

export const dynamic = 'force-dynamic'

const LeafletMap = dynamicImport(() => import('@/components/ui/leaflet-map').then(m => m.LeafletMap), { ssr: false })

interface Customer {
  id: string
  code: string
  businessName: string
  businessAddress: string
  city: string
  phone: string
  phone2?: string
  contactPerson?: string
  businessNumber?: string
  vatNumber?: string
  status: string
  debtLimit: number
  paymentTermDays: number
  notes?: string
  lat?: number
  lng?: number
  currentDebt: number
  isBusinessGroup?: boolean
  parentCustomerId?: string
  unitName?: string
  unitType?: string
  agent?: { name: string } | null
  region?: { name: string } | null
  zone?: { name: string } | null
  parentCustomer?: { id: string; code: string; businessName: string } | null
  units?: Array<{ id: string; code: string; businessName: string; unitName?: string; unitType?: string; status: string }>
  orders: Array<{ id: string; reference: string; status: string; totalAmount: number; createdAt: string }>
  visits: Array<{ id: string; reference: string; status: string; openedAt: string; agent: { name: string } }>
  payments: Array<{ id: string; reference: string; amount: number; method: string; createdAt: string }>
  returns: Array<{ id: string; reference: string; status: string; totalAmount: number; createdAt: string }>
  topProducts: Array<{ productId: string; name: string; code: string; totalQty: number; totalValue: number }>
  purchaseCalendar?: {
    totalOrders: number; avgDaysBetween: number | null; daysSinceLast: number | null
    lastOrderAt: string | null; status: 'NORMAL' | 'AFËR' | 'VONUAR'
  }
  growthTracker?: { currPeriodSales: number; prevPeriodSales: number; growthPct: number | null; trend: string }
}

type Tab = 'overview' | 'history' | 'analytics' | 'contact'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',   label: 'Përmbledhje' },
  { key: 'history',    label: 'Histori' },
  { key: 'analytics',  label: 'Analitikë' },
  { key: 'contact',    label: 'Kontakt / Njësi' },
]

const TIMELINE_CONFIG = {
  ORDER:   { label: 'Porosi', cls: 'bg-blue-100 text-blue-700',    Icon: ShoppingCart },
  PAYMENT: { label: 'Pagesë', cls: 'bg-green-100 text-green-700',  Icon: DollarSign },
  VISIT:   { label: 'Vizitë', cls: 'bg-purple-100 text-purple-700', Icon: MapPin },
  RETURN:  { label: 'Kthim',  cls: 'bg-orange-100 text-orange-700', Icon: RotateCcw },
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then(setCustomer)
      .catch(() => toast.error('Gabim në ngarkimin e klientit'))
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (status: string) => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer((prev) => prev ? { ...prev, status: updated.status } : null)
      toast.success('Statusi u ndryshua')
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!customer) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Klienti nuk u gjet</p>
    </div>
  )

  // Timeline — computed from existing data, no new API call
  const timeline = [
    ...customer.orders.map(o => ({
      type: 'ORDER' as const, id: o.id, ref: o.reference,
      date: o.createdAt, status: o.status, amount: o.totalAmount,
      href: `/admin/orders/${o.id}`,
    })),
    ...customer.payments.map(p => ({
      type: 'PAYMENT' as const, id: p.id, ref: p.reference,
      date: p.createdAt, status: p.method, amount: p.amount,
      href: null as string | null,
    })),
    ...customer.visits.map(v => ({
      type: 'VISIT' as const, id: v.id, ref: v.reference,
      date: v.openedAt, status: v.status, amount: null as number | null,
      href: null as string | null,
    })),
    ...(customer.returns ?? []).map(r => ({
      type: 'RETURN' as const, id: r.id, ref: r.reference,
      date: r.createdAt, status: r.status, amount: r.totalAmount,
      href: null as string | null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/customers">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{customer.businessName}</h1>
              <span className={`badge ${getStatusColor(customer.status)}`}>{getStatusLabel(customer.status)}</span>
            </div>
            <p className="text-sm text-gray-500 font-mono">{customer.code}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/admin/customers/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edito</span>
            </Button>
          </Link>
          {customer.status !== 'BLOCKED' ? (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('BLOCKED')}
              className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
              <Ban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Blloko</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('ACTIVE')}
              className="text-green-600 border-green-200 hover:bg-green-50 gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aktivizo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Debt Alert — always visible */}
      {customer.currentDebt > 0 && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${
          customer.debtLimit > 0 && customer.currentDebt > customer.debtLimit
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <AlertTriangle className={`h-5 w-5 shrink-0 ${
            customer.debtLimit > 0 && customer.currentDebt > customer.debtLimit
              ? 'text-red-600' : 'text-yellow-600'
          }`} />
          <div className="flex-1">
            <p className="text-sm font-semibold">Borxh aktual: {formatCurrency(customer.currentDebt)}</p>
            {customer.debtLimit > 0 && (
              <p className="text-xs text-gray-600">Limit: {formatCurrency(customer.debtLimit)}</p>
            )}
          </div>
          <Link href={`/admin/payments?customerId=${id}`}>
            <Button size="sm">Regjistro Pagesë</Button>
          </Link>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 -mx-4 sm:-mx-6 px-4 sm:px-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PËRMBLEDHJE ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Porosi Gjithsej', value: formatCurrency(customer.orders.reduce((s, o) => s + o.totalAmount, 0)), sub: `${customer.orders.length} porosi` },
              { label: 'Pagesa Gjithsej', value: formatCurrency(customer.payments.reduce((s, p) => s + p.amount, 0)), sub: `${customer.payments.length} pagesa` },
              { label: 'Borxhi Aktual', value: formatCurrency(customer.currentDebt), sub: customer.debtLimit > 0 ? `Limit: ${formatCurrency(customer.debtLimit)}` : 'Pa limit' },
              { label: 'Agjent', value: customer.agent?.name ?? '—', sub: customer.zone?.name ?? customer.region?.name ?? '' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 truncate">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Recent orders preview */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Porositë e Fundit</CardTitle>
                <Link href={`/admin/orders?customerId=${id}`} className="text-xs font-semibold text-primary hover:text-primary/80">
                  Shih të gjitha →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {customer.orders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nuk ka porosi</p>
              ) : (
                <div className="space-y-2">
                  {customer.orders.slice(0, 3).map(o => (
                    <Link key={o.id} href={`/admin/orders/${o.id}`}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors">
                      <div>
                        <p className="text-sm font-semibold font-mono">{o.reference}</p>
                        <p className="text-xs text-gray-400">{formatDate(o.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(o.totalAmount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent payments preview */}
          {customer.payments.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Pagesat e Fundit</CardTitle>
                  <Link href={`/admin/payments?customerId=${id}`} className="text-xs font-semibold text-primary hover:text-primary/80">
                    Shih të gjitha →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2">
                  {customer.payments.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{p.reference}</p>
                        <p className="text-xs text-gray-400">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-700">{formatCurrency(p.amount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(p.method)}`}>{getStatusLabel(p.method)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: HISTORI ─────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Timeline */}
          {timeline.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />Aktiviteti i Fundit
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-1">
                  {timeline.map(item => {
                    const cfg = TIMELINE_CONFIG[item.type]
                    const Icon = cfg.Icon
                    const inner = (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.cls}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cfg.cls}`}>
                              {cfg.label}
                            </span>
                            <p className="text-sm font-medium font-mono text-gray-900 truncate">{item.ref}</p>
                          </div>
                          <p className="text-xs text-gray-400">{formatDateTime(item.date)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {item.amount != null && <p className="text-sm font-bold text-gray-700">{formatCurrency(item.amount)}</p>}
                          <span className={`badge text-[10px] ${getStatusColor(item.status)}`}>{getStatusLabel(item.status)}</span>
                        </div>
                      </div>
                    )
                    return item.href ? (
                      <Link key={`${item.type}-${item.id}`} href={item.href}>{inner}</Link>
                    ) : (
                      <div key={`${item.type}-${item.id}`}>{inner}</div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* All Orders */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Porositë ({customer.orders.length})</CardTitle>
                <Link href={`/admin/orders?customerId=${id}`} className="text-xs font-semibold text-primary hover:text-primary/80">
                  Shih të gjitha →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {customer.orders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nuk ka porosi</p>
              ) : (
                <div className="space-y-2">
                  {customer.orders.map(o => (
                    <Link key={o.id} href={`/admin/orders/${o.id}`}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors">
                      <div>
                        <p className="text-sm font-medium font-mono">{o.reference}</p>
                        <p className="text-xs text-gray-400">{formatDate(o.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(o.totalAmount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Visits */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Vizitat ({customer.visits.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {customer.visits.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nuk ka vizita</p>
              ) : (
                <div className="space-y-2">
                  {customer.visits.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{v.reference}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(v.openedAt)} · {v.agent.name}</p>
                      </div>
                      <span className={`badge text-[10px] ${getStatusColor(v.status)}`}>{getStatusLabel(v.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Payments */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-base font-semibold">Pagesat ({customer.payments.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {customer.payments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nuk ka pagesa</p>
              ) : (
                <div className="space-y-2">
                  {customer.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{p.reference}</p>
                        <p className="text-xs text-gray-400">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-700">{formatCurrency(p.amount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(p.method)}`}>{getStatusLabel(p.method)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Returns */}
          {customer.returns && customer.returns.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-orange-500" />Kthimet ({customer.returns.length})
                  </CardTitle>
                  <Link href={`/admin/returns?customerId=${id}`} className="text-xs font-semibold text-primary hover:text-primary/80">
                    Shih të gjitha →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2">
                  {customer.returns.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{r.reference}</p>
                        <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-orange-600">{formatCurrency(r.totalAmount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(r.status)}`}>{getStatusLabel(r.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: ANALITIKË ───────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products */}
          {customer.topProducts && customer.topProducts.length > 0 ? (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />Produktet Kryesore
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2">
                  {customer.topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(p.totalValue)}</p>
                        <p className="text-xs text-gray-400">{p.totalQty} copë</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Nuk ka produkte të shitura</p>
              </CardContent>
            </Card>
          )}

          {/* Calendar + Growth */}
          <div className="space-y-4">
            {/* Purchase Calendar */}
            {customer.purchaseCalendar && customer.purchaseCalendar.totalOrders > 0 && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3 px-5 pt-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />Kalendari i Blerjeve
                    </CardTitle>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      customer.purchaseCalendar.status === 'VONUAR' ? 'bg-red-100 text-red-700' :
                      customer.purchaseCalendar.status === 'AFËR' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {customer.purchaseCalendar.status === 'VONUAR' ? 'VONUAR' : customer.purchaseCalendar.status === 'AFËR' ? 'AFËR AFATIT' : 'NORMAL'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl bg-gray-50">
                      <p className="text-lg font-bold text-gray-900">{customer.purchaseCalendar.totalOrders}</p>
                      <p className="text-[10px] text-gray-500">Porosi gjithsej</p>
                    </div>
                    <div className="p-2 rounded-xl bg-gray-50">
                      <p className="text-lg font-bold text-gray-900">{customer.purchaseCalendar.avgDaysBetween ?? '—'}</p>
                      <p className="text-[10px] text-gray-500">Ditë mes porosive</p>
                    </div>
                    <div className="p-2 rounded-xl bg-gray-50">
                      <p className={`text-lg font-bold ${
                        customer.purchaseCalendar.daysSinceLast !== null &&
                        customer.purchaseCalendar.avgDaysBetween !== null &&
                        customer.purchaseCalendar.daysSinceLast > customer.purchaseCalendar.avgDaysBetween * 1.5
                          ? 'text-red-600' : 'text-gray-900'
                      }`}>{customer.purchaseCalendar.daysSinceLast ?? '—'}</p>
                      <p className="text-[10px] text-gray-500">Ditë nga e fundit</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Growth Tracker */}
            {customer.growthTracker && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-3 px-5 pt-5">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {customer.growthTracker.trend === 'UP'
                      ? <TrendingUp className="h-4 w-4 text-green-500" />
                      : customer.growthTracker.trend === 'DOWN'
                      ? <TrendingDown className="h-4 w-4 text-red-500" />
                      : <TrendingUp className="h-4 w-4 text-gray-400" />
                    }
                    Rritja (30 ditë)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 rounded-xl bg-gray-50">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(customer.growthTracker.currPeriodSales)}</p>
                      <p className="text-[10px] text-gray-500">30 ditët e fundit</p>
                    </div>
                    <div className="p-2 rounded-xl bg-gray-50">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(customer.growthTracker.prevPeriodSales)}</p>
                      <p className="text-[10px] text-gray-500">30 ditët para</p>
                    </div>
                    <div className="p-2 rounded-xl bg-gray-50">
                      {customer.growthTracker.growthPct === null ? (
                        <p className="text-sm font-bold text-gray-400">—</p>
                      ) : (
                        <p className={`text-sm font-bold ${customer.growthTracker.growthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {customer.growthTracker.growthPct >= 0 ? '+' : ''}{customer.growthTracker.growthPct}%
                        </p>
                      )}
                      <p className="text-[10px] text-gray-500">Ndryshimi</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: KONTAKT / NJËSI ─────────────────────────────────────────── */}
      {tab === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Address + Map */}
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm font-semibold">Adresa & Kontakti</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{customer.businessAddress}</p>
                    <p className="text-xs text-gray-500">{customer.city}</p>
                  </div>
                </div>
                {customer.lat && customer.lng && (
                  <LeafletMap
                    center={[customer.lat, customer.lng]}
                    zoom={15}
                    markers={[{ lat: customer.lat, lng: customer.lng, title: customer.businessName, popup: customer.businessAddress }]}
                    height="200px"
                    className="border border-gray-100 rounded-xl"
                  />
                )}
                <Separator />
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a href={`tel:${customer.phone}`} className="text-sm text-primary hover:underline">{customer.phone}</a>
                </div>
                {customer.phone2 && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${customer.phone2}`} className="text-sm text-primary hover:underline">{customer.phone2}</a>
                  </div>
                )}
                {customer.contactPerson && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <p className="text-sm">{customer.contactPerson}</p>
                  </div>
                )}
                {customer.businessNumber && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <p className="text-xs text-gray-600">Nr. Biznesi: {customer.businessNumber}</p>
                  </div>
                )}
                {customer.vatNumber && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <p className="text-xs text-gray-600">TVSH: {customer.vatNumber}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {customer.notes && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2 px-5 pt-5">
                  <CardTitle className="text-sm font-semibold">Shënime</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 text-sm text-gray-600">{customer.notes}</CardContent>
              </Card>
            )}
          </div>

          {/* Right: Commercial Terms + Business Structure */}
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm font-semibold">Kushtet Tregtare</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2.5 text-sm">
                {[
                  { label: 'Agjent',        value: customer.agent?.name ?? '—' },
                  { label: 'Zona',          value: customer.zone?.name ?? '—' },
                  { label: 'Rajoni',        value: customer.region?.name ?? '—' },
                  { label: 'Limit Borxhi',  value: formatCurrency(customer.debtLimit) },
                  { label: 'Afati Pagesës', value: `${customer.paymentTermDays} ditë` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Business Structure */}
            {(customer.isBusinessGroup || customer.parentCustomer) && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2 px-5 pt-5">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-500" />Struktura e Biznesit
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3">
                  {customer.isBusinessGroup && (
                    <div className="px-3 py-2 bg-blue-50 rounded-xl text-blue-700 text-xs font-semibold">Grup Biznesi</div>
                  )}
                  {customer.parentCustomer && (
                    <div>
                      <span className="text-xs text-gray-500">Grupi Prind</span>
                      <Link href={`/admin/customers/${customer.parentCustomer.id}`}
                        className="block mt-0.5 text-primary hover:underline text-sm font-medium">
                        {customer.parentCustomer.businessName}
                      </Link>
                    </div>
                  )}
                  {customer.unitName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Emër Njësie</span>
                      <span className="font-medium">{customer.unitName}</span>
                    </div>
                  )}
                  {customer.units && customer.units.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 font-medium">{customer.units.length} Njësi</p>
                      {customer.units.map(u => (
                        <Link key={u.id} href={`/admin/customers/${u.id}`}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div>
                            <p className="text-xs font-medium">{u.businessName}</p>
                            {u.unitName && <p className="text-[10px] text-gray-400">{u.unitName}</p>}
                          </div>
                          <span className={`badge text-[10px] ${getStatusColor(u.status)}`}>{getStatusLabel(u.status)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
