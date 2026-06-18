import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart, DollarSign, Users, Truck, AlertTriangle,
  TrendingUp, RotateCcw, Clock, CheckCircle, MapPin
} from 'lucide-react'
import Link from 'next/link'
import { getMultipleStockLevels } from '@/lib/stock'

export const dynamic = 'force-dynamic'

async function getAdminStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [
    ordersToday,
    salesToday,
    collectionsToday,
    totalCustomers,
    pendingApprovals,
    pendingReturns,
    activeDeliveries,
    visitedToday,
    _totalActive,
    lowStockProducts,
    nearExpiryProducts,
    _paymentsByCustomer,
    recentOrders,
    blockedCustomers,
    failedDeliveries,
  ] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: today } } }),
    db.order.aggregate({
      where: { createdAt: { gte: today }, status: { notIn: ['DRAFT', 'ANULUAR'] } },
      _sum: { totalAmount: true },
    }),
    db.payment.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    db.customer.count({ where: { status: 'ACTIVE' } }),
    db.order.count({ where: { status: 'PRET_APROVIM' } }),
    db.return.count({ where: { status: { in: ['NE_PRITJE', 'APROVUAR'] } } }),
    db.delivery.count({ where: { status: { in: ['ASSIGNED', 'LOADED', 'IN_DELIVERY'] } } }),
    db.visit.count({ where: { createdAt: { gte: today } } }),
    db.product.count({ where: { status: 'ACTIVE' } }),
    db.product.findMany({ where: { status: 'ACTIVE' }, take: 100, select: { id: true, name: true, code: true } }),
    db.product.findMany({
      where: { status: 'ACTIVE', expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      take: 5, select: { id: true, name: true, expiryDate: true },
    }),
    db.payment.groupBy({
      by: ['customerId'],
      _sum: { amount: true },
    }),
    db.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { businessName: true } }, createdBy: { select: { name: true } } },
    }),
    db.customer.count({ where: { status: 'BLOCKED' } }),
    db.delivery.count({ where: { status: 'FAILED', createdAt: { gte: today } } }),
  ])

  // Calculate out-of-stock
  let outOfStock = 0
  let lowStock = 0
  if (lowStockProducts.length > 0) {
    const stockMap = await getMultipleStockLevels(lowStockProducts.map((p) => p.id))
    for (const p of lowStockProducts) {
      const stock = stockMap[p.id] ?? 0
      if (stock === 0) outOfStock++
      else if (stock < 20) lowStock++
    }
  }

  // Calculate total debt (delivered orders - payments)
  const deliveredOrders = await db.order.aggregate({
    where: { status: 'DORËZUAR' },
    _sum: { totalAmount: true },
  })
  const totalCollected = await db.payment.aggregate({ _sum: { amount: true } })
  const totalDebt = (deliveredOrders._sum.totalAmount ?? 0) - (totalCollected._sum.amount ?? 0)

  return {
    ordersToday,
    salesToday: salesToday._sum.totalAmount ?? 0,
    collectionsToday: collectionsToday._sum.amount ?? 0,
    totalCustomers,
    pendingApprovals,
    pendingReturns,
    activeDeliveries,
    visitedToday,
    outOfStock,
    lowStock,
    nearExpiryCount: nearExpiryProducts.length,
    totalDebt: Math.max(0, totalDebt),
    recentOrders,
    blockedCustomers,
    failedDeliveries,
  }
}

export default async function AdminDashboard() {
  const session = await auth()
  const stats = await getAdminStats()

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mirë se vini, {session?.user.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Alerts Banner */}
      {(stats.pendingApprovals > 0 || stats.outOfStock > 0 || stats.blockedCustomers > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap gap-3">
          {stats.pendingApprovals > 0 && (
            <Link href="/admin/orders?status=PRET_APROVIM" className="flex items-center gap-2 text-amber-700 text-sm font-medium hover:underline">
              <Clock className="h-4 w-4" />
              {stats.pendingApprovals} porosi pret aprovim
            </Link>
          )}
          {stats.outOfStock > 0 && (
            <Link href="/admin/products?stock=out" className="flex items-center gap-2 text-red-700 text-sm font-medium hover:underline">
              <AlertTriangle className="h-4 w-4" />
              {stats.outOfStock} produkte pa stok
            </Link>
          )}
          {stats.blockedCustomers > 0 && (
            <Link href="/admin/customers?status=BLOCKED" className="flex items-center gap-2 text-red-700 text-sm font-medium hover:underline">
              <Users className="h-4 w-4" />
              {stats.blockedCustomers} klientë bllokuar
            </Link>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Porosi Sot"
          value={formatNumber(stats.ordersToday)}
          icon={ShoppingCart}
          color="blue"
          href="/admin/orders"
        />
        <StatCard
          title="Shitje Sot"
          value={formatCurrency(stats.salesToday)}
          icon={TrendingUp}
          color="green"
          href="/admin/reports"
        />
        <StatCard
          title="Inkaso Sot"
          value={formatCurrency(stats.collectionsToday)}
          icon={DollarSign}
          color="emerald"
          href="/admin/payments"
        />
        <StatCard
          title="Borxh Total"
          value={formatCurrency(stats.totalDebt)}
          icon={DollarSign}
          color="red"
          href="/admin/payments?type=debt"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Klientë Aktiv"
          value={formatNumber(stats.totalCustomers)}
          icon={Users}
          color="indigo"
          href="/admin/customers"
        />
        <StatCard
          title="Vizita Sot"
          value={formatNumber(stats.visitedToday)}
          icon={MapPin}
          color="purple"
          href="/admin/visits"
        />
        <StatCard
          title="Dërgesa Aktive"
          value={formatNumber(stats.activeDeliveries)}
          icon={Truck}
          color="orange"
          href="/admin/deliveries"
        />
        <StatCard
          title="Kthime në Pritje"
          value={formatNumber(stats.pendingReturns)}
          icon={RotateCcw}
          color="yellow"
          href="/admin/returns"
        />
      </div>

      {/* Quick Action + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Porositë e Fundit</CardTitle>
              <Link href="/admin/orders" className="text-sm text-primary hover:underline">
                Shih të gjitha
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nuk ka porosi</p>
              ) : (
                stats.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.reference}</p>
                      <p className="text-xs text-gray-500">{order.customer.businessName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Check */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Kontrolli i Shëndetit</CardTitle>
              <Link href="/admin/health" className="text-sm text-primary hover:underline">
                Shih detaje
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <HealthItem
                label="Porosi Pret Aprovim"
                value={stats.pendingApprovals}
                href="/admin/orders?status=PRET_APROVIM"
                severity={stats.pendingApprovals > 0 ? 'warning' : 'ok'}
              />
              <HealthItem
                label="Produkte Pa Stok"
                value={stats.outOfStock}
                href="/admin/products?stock=out"
                severity={stats.outOfStock > 0 ? 'error' : 'ok'}
              />
              <HealthItem
                label="Produkte Stok i Ulët"
                value={stats.lowStock}
                href="/admin/products?stock=low"
                severity={stats.lowStock > 0 ? 'warning' : 'ok'}
              />
              <HealthItem
                label="Produkte Afër Skadimit"
                value={stats.nearExpiryCount}
                href="/admin/products?expiry=soon"
                severity={stats.nearExpiryCount > 0 ? 'warning' : 'ok'}
              />
              <HealthItem
                label="Kthime në Pritje"
                value={stats.pendingReturns}
                href="/admin/returns"
                severity={stats.pendingReturns > 0 ? 'warning' : 'ok'}
              />
              <HealthItem
                label="Dërgesa Dështuar Sot"
                value={stats.failedDeliveries}
                href="/admin/deliveries?status=FAILED"
                severity={stats.failedDeliveries > 0 ? 'error' : 'ok'}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title, value, icon: Icon, color, href,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: string
  href: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  }

  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${colorMap[color] ?? 'bg-gray-50 text-gray-600'}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

function HealthItem({
  label, value, href, severity,
}: {
  label: string
  value: number
  href: string
  severity: 'ok' | 'warning' | 'error'
}) {
  const colors = {
    ok: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  }

  return (
    <Link href={href} className="flex items-center justify-between py-1.5 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${colors[severity]}`}>{value}</span>
        {severity === 'ok' ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : severity === 'warning' ? (
          <Clock className="h-4 w-4 text-yellow-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
      </div>
    </Link>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'secondary',
    SUBMITTED: 'info',
    PRET_APROVIM: 'warning',
    APROVUAR: 'success',
    NE_PERGATITJE: 'purple',
    GATI_PER_NGARKIM: 'info',
    NE_DERGESE: 'info',
    DORËZUAR: 'success',
    DESHTUAR: 'destructive',
    ANULUAR: 'destructive',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Dërguar',
    PRET_APROVIM: 'Pret Aprovim',
    APROVUAR: 'Aprovuar',
    NE_PERGATITJE: 'Në Përgatitje',
    GATI_PER_NGARKIM: 'Gati Ngarkim',
    NE_DERGESE: 'Në Dërgesë',
    DORËZUAR: 'Dorëzuar',
    DESHTUAR: 'Dështuar',
    ANULUAR: 'Anuluar',
  }
  return (
    <Badge variant={(map[status] as 'secondary' | 'info' | 'warning' | 'success' | 'purple' | 'destructive' | undefined) ?? 'secondary'} className="text-[10px]">
      {labels[status] ?? status}
    </Badge>
  )
}
