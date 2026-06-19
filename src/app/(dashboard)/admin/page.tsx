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
export const runtime = 'nodejs'

const SAFE_STATS = {
  ordersToday: 0,
  salesToday: 0,
  collectionsToday: 0,
  totalCustomers: 0,
  pendingApprovals: 0,
  pendingReturns: 0,
  activeDeliveries: 0,
  visitedToday: 0,
  outOfStock: 0,
  lowStock: 0,
  nearExpiryCount: 0,
  totalDebt: 0,
  recentOrders: [] as Awaited<ReturnType<typeof fetchRecentOrders>>,
  blockedCustomers: 0,
  failedDeliveries: 0,
}

async function fetchRecentOrders() {
  return db.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { businessName: true } },
      createdBy: { select: { name: true } },
    },
  })
}

async function getAdminStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  try {
    const [
      ordersToday,
      salesToday,
      collectionsToday,
      totalCustomers,
      pendingApprovals,
      pendingReturns,
      activeDeliveries,
      visitedToday,
      allActiveProducts,
      nearExpiryProducts,
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
      db.product.findMany({
        where: { status: 'ACTIVE' },
        take: 100,
        select: { id: true },
      }),
      db.product.findMany({
        where: {
          status: 'ACTIVE',
          expiryDate: { not: null, gte: today, lte: in30Days },
        },
        take: 5,
        select: { id: true, name: true, expiryDate: true },
      }),
      fetchRecentOrders(),
      db.customer.count({ where: { status: 'BLOCKED' } }),
      db.delivery.count({ where: { status: 'FAILED', createdAt: { gte: today } } }),
    ])

    // Stock levels (separate, after the batch)
    let outOfStock = 0
    let lowStock = 0
    if (allActiveProducts.length > 0) {
      try {
        const stockMap = await getMultipleStockLevels(allActiveProducts.map((p) => p.id))
        for (const id of allActiveProducts.map((p) => p.id)) {
          const stock = stockMap[id] ?? 0
          if (stock === 0) outOfStock++
          else if (stock < 20) lowStock++
        }
      } catch {
        // stock calculation failure is non-fatal
      }
    }

    // Total debt
    let totalDebt = 0
    try {
      const [deliveredOrders, totalCollected] = await Promise.all([
        db.order.aggregate({ where: { status: 'DORËZUAR' }, _sum: { totalAmount: true } }),
        db.payment.aggregate({ _sum: { amount: true } }),
      ])
      totalDebt = Math.max(0, (deliveredOrders._sum.totalAmount ?? 0) - (totalCollected._sum.amount ?? 0))
    } catch {
      // debt calculation failure is non-fatal
    }

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
      totalDebt,
      recentOrders,
      blockedCustomers,
      failedDeliveries,
    }
  } catch (err) {
    console.error('[admin] getAdminStats error:', err)
    return SAFE_STATS
  }
}

export default async function AdminDashboard() {
  const session = await auth()
  const stats = await getAdminStats()

  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mirë se vini, <span className="font-semibold text-gray-700">{session?.user?.name}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-slate-500 capitalize">
            {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Alerts Banner */}
      {(stats.pendingApprovals > 0 || stats.outOfStock > 0 || stats.blockedCustomers > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap gap-3">
          {stats.pendingApprovals > 0 && (
            <Link href="/admin/orders?status=PRET_APROVIM" className="flex items-center gap-1.5 text-amber-800 text-sm font-semibold bg-amber-100 px-3 py-1.5 rounded-xl hover:bg-amber-200 transition-colors">
              <Clock className="h-3.5 w-3.5" />
              {stats.pendingApprovals} porosi pret aprovim
            </Link>
          )}
          {stats.outOfStock > 0 && (
            <Link href="/admin/products?stock=out" className="flex items-center gap-1.5 text-red-800 text-sm font-semibold bg-red-100 px-3 py-1.5 rounded-xl hover:bg-red-200 transition-colors">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.outOfStock} produkte pa stok
            </Link>
          )}
          {stats.blockedCustomers > 0 && (
            <Link href="/admin/customers?status=BLOCKED" className="flex items-center gap-1.5 text-red-800 text-sm font-semibold bg-red-100 px-3 py-1.5 rounded-xl hover:bg-red-200 transition-colors">
              <Users className="h-3.5 w-3.5" />
              {stats.blockedCustomers} klientë bllokuar
            </Link>
          )}
        </div>
      )}

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Porosi Sot"   value={formatNumber(stats.ordersToday)}      icon={ShoppingCart} color="blue"    href="/admin/orders" />
        <StatCard title="Shitje Sot"   value={formatCurrency(stats.salesToday)}      icon={TrendingUp}   color="green"   href="/admin/reports" />
        <StatCard title="Inkaso Sot"   value={formatCurrency(stats.collectionsToday)} icon={DollarSign}  color="emerald" href="/admin/payments" />
        <StatCard title="Borxh Total"  value={formatCurrency(stats.totalDebt)}        icon={DollarSign}  color="red"     href="/admin/payments?type=debt" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Klientë Aktiv"    value={formatNumber(stats.totalCustomers)}  icon={Users}      color="indigo"  href="/admin/customers" />
        <StatCard title="Vizita Sot"       value={formatNumber(stats.visitedToday)}    icon={MapPin}     color="purple"  href="/admin/visits" />
        <StatCard title="Dërgesa Aktive"   value={formatNumber(stats.activeDeliveries)} icon={Truck}     color="orange"  href="/admin/deliveries" />
        <StatCard title="Kthime në Pritje" value={formatNumber(stats.pendingReturns)}  icon={RotateCcw}  color="yellow"  href="/admin/returns" />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Porositë e Fundit</CardTitle>
              <Link href="/admin/orders" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                Shih të gjitha →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-2">
              {stats.recentOrders.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Nuk ka porosi</p>
              ) : (
                stats.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-all duration-150 hover:border-gray-200 hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{order.reference}</p>
                      <p className="text-xs text-slate-500 truncate">{order.customer.businessName}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(order.totalAmount)}</p>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Health Check */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Kontrolli i Sistemit</CardTitle>
              <Link href="/admin/health" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                Detaje →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="divide-y divide-gray-50">
              <HealthItem label="Porosi Pret Aprovim"    value={stats.pendingApprovals} href="/admin/orders?status=PRET_APROVIM"   severity={stats.pendingApprovals > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Produkte Pa Stok"       value={stats.outOfStock}       href="/admin/products?stock=out"           severity={stats.outOfStock > 0 ? 'error' : 'ok'} />
              <HealthItem label="Stok i Ulët"            value={stats.lowStock}         href="/admin/products?stock=low"           severity={stats.lowStock > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Afër Skadimit"          value={stats.nearExpiryCount}  href="/admin/products?expiry=soon"         severity={stats.nearExpiryCount > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Kthime në Pritje"       value={stats.pendingReturns}   href="/admin/returns"                      severity={stats.pendingReturns > 0 ? 'warning' : 'ok'} />
              <HealthItem label="Dërgesa Dështuar Sot"   value={stats.failedDeliveries} href="/admin/deliveries?status=FAILED"     severity={stats.failedDeliveries > 0 ? 'error' : 'ok'} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, href }: {
  title: string; value: string; icon: React.ElementType; color: string; href: string
}) {
  const colorMap: Record<string, { grad: string; icon: string; border: string }> = {
    blue:    { grad: 'from-blue-50 to-white',    icon: 'bg-blue-500',    border: 'border-blue-100' },
    green:   { grad: 'from-green-50 to-white',   icon: 'bg-green-500',   border: 'border-green-100' },
    emerald: { grad: 'from-emerald-50 to-white', icon: 'bg-emerald-500', border: 'border-emerald-100' },
    red:     { grad: 'from-red-50 to-white',     icon: 'bg-red-500',     border: 'border-red-100' },
    indigo:  { grad: 'from-indigo-50 to-white',  icon: 'bg-indigo-500',  border: 'border-indigo-100' },
    purple:  { grad: 'from-purple-50 to-white',  icon: 'bg-purple-500',  border: 'border-purple-100' },
    orange:  { grad: 'from-orange-50 to-white',  icon: 'bg-orange-500',  border: 'border-orange-100' },
    yellow:  { grad: 'from-yellow-50 to-white',  icon: 'bg-yellow-500',  border: 'border-yellow-100' },
  }
  const c = colorMap[color] ?? colorMap.blue
  return (
    <Link href={href}>
      <div className={`bg-gradient-to-br ${c.grad} rounded-2xl border ${c.border} p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200`}>
        <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center shadow-sm mb-3`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-1.5 uppercase tracking-wide">{title}</p>
      </div>
    </Link>
  )
}

function HealthItem({ label, value, href, severity }: {
  label: string; value: number; href: string; severity: 'ok' | 'warning' | 'error'
}) {
  const map = {
    ok:      { badge: 'bg-green-100 text-green-700',   Icon: CheckCircle,   iconCls: 'text-green-500' },
    warning: { badge: 'bg-yellow-100 text-yellow-700', Icon: Clock,         iconCls: 'text-yellow-500' },
    error:   { badge: 'bg-red-100 text-red-700',       Icon: AlertTriangle, iconCls: 'text-red-500' },
  }
  const { badge, Icon, iconCls } = map[severity]
  return (
    <Link href={href} className="flex items-center justify-between py-2.5 hover:bg-gray-50 rounded-xl px-2 -mx-2 transition-colors group">
      <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>{value}</span>
        <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} />
      </div>
    </Link>
  )
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'secondary', SUBMITTED: 'info', PRET_APROVIM: 'warning', APROVUAR: 'success',
    NE_PERGATITJE: 'purple', GATI_PER_NGARKIM: 'info', NE_DERGESE: 'info',
    DORËZUAR: 'success', DESHTUAR: 'destructive', ANULUAR: 'destructive',
  }
  const labels: Record<string, string> = {
    DRAFT: 'Draft', SUBMITTED: 'Dërguar', PRET_APROVIM: 'Pret Aprovim', APROVUAR: 'Aprovuar',
    NE_PERGATITJE: 'Në Përgatitje', GATI_PER_NGARKIM: 'Gati Ngarkim', NE_DERGESE: 'Në Dërgesë',
    DORËZUAR: 'Dorëzuar', DESHTUAR: 'Dështuar', ANULUAR: 'Anuluar',
  }
  return (
    <Badge variant={(map[status] as 'secondary' | 'info' | 'warning' | 'success' | 'purple' | 'destructive' | undefined) ?? 'secondary'} className="text-[10px]">
      {labels[status] ?? status}
    </Badge>
  )
}
