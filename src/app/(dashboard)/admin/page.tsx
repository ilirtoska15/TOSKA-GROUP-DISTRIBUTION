import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart, DollarSign, Users, Truck, AlertTriangle,
  TrendingUp, TrendingDown, RotateCcw, Clock, CheckCircle, MapPin, Trophy, Globe, AlertOctagon,
  Activity, Target
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
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

async function fetchProductLeaderboard() {
  try {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const raw = await db.orderLine.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: startOfMonth }, status: { notIn: ['DRAFT', 'ANULUAR'] } } },
      _sum: { lineTotal: true, quantityCopje: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 5,
    })
    if (raw.length === 0) return []
    const products = await db.product.findMany({ where: { id: { in: raw.map(r => r.productId) } }, select: { id: true, name: true } })
    const nm = Object.fromEntries(products.map(p => [p.id, p.name]))
    return raw.map((r, i) => ({ rank: i + 1, name: nm[r.productId] ?? r.productId, totalValue: r._sum.lineTotal ?? 0, totalQty: r._sum.quantityCopje ?? 0 }))
  } catch { return [] }
}

async function fetchTerritoryTop() {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const zones = await db.zone.findMany({
      include: { customers: { where: { status: 'ACTIVE' }, select: { id: true } } },
      orderBy: { name: 'asc' },
    })
    const allCustomerIds = zones.flatMap(z => z.customers.map(c => c.id))
    if (allCustomerIds.length === 0) return []
    const statusFilter = { notIn: ['DRAFT', 'ANULUAR'] as string[] }
    const [currOrders, prevOrders] = await Promise.all([
      db.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: allCustomerIds }, createdAt: { gte: startOfMonth }, status: statusFilter },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      db.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: allCustomerIds }, createdAt: { gte: startOfPrevMonth, lt: startOfMonth }, status: statusFilter },
        _sum: { totalAmount: true },
      }),
    ])
    const salesMap: Record<string, number> = {}
    const ordersMap: Record<string, number> = {}
    for (const r of currOrders) { salesMap[r.customerId] = r._sum.totalAmount ?? 0; ordersMap[r.customerId] = r._count.id }
    const prevSalesMap: Record<string, number> = {}
    for (const r of prevOrders) prevSalesMap[r.customerId] = r._sum.totalAmount ?? 0
    return zones
      .filter(z => z.customers.length > 0)
      .map(z => {
        const currTotal = z.customers.reduce((s, c) => s + (salesMap[c.id] ?? 0), 0)
        const prevTotal = z.customers.reduce((s, c) => s + (prevSalesMap[c.id] ?? 0), 0)
        const orderCount = z.customers.reduce((s, c) => s + (ordersMap[c.id] ?? 0), 0)
        const growthPct = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : null
        return { name: z.name, total: currTotal, orderCount, growthPct }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  } catch { return [] }
}

async function fetchPenetrationTop() {
  try {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const [totalActive, orderLines] = await Promise.all([
      db.customer.count({ where: { status: 'ACTIVE' } }),
      db.orderLine.findMany({
        where: { order: { createdAt: { gte: startOfMonth }, status: { notIn: ['DRAFT', 'ANULUAR'] } } },
        select: { productId: true, order: { select: { customerId: true } } },
        take: 20000,
      }),
    ])
    if (totalActive === 0 || orderLines.length === 0) return []
    const productData: Record<string, Set<string>> = {}
    for (const line of orderLines) {
      if (!productData[line.productId]) productData[line.productId] = new Set()
      productData[line.productId].add(line.order.customerId)
    }
    const topIds = Object.entries(productData)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5)
      .map(([id]) => id)
    const products = await db.product.findMany({
      where: { id: { in: topIds } },
      select: { id: true, name: true },
    })
    const nameMap = Object.fromEntries(products.map(p => [p.id, p.name]))
    return topIds.map(id => ({
      name: nameMap[id] ?? id,
      customers: productData[id].size,
      penetrationPct: Math.round((productData[id].size / totalActive) * 100),
    }))
  } catch { return [] }
}

async function fetchRecoveryOpportunities() {
  try {
    const now = new Date()
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const prev60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const filter = { status: { notIn: ['DRAFT', 'ANULUAR'] as string[] } }
    const [curr, prev] = await Promise.all([
      db.order.groupBy({ by: ['customerId'], where: { ...filter, createdAt: { gte: last30 } }, _sum: { totalAmount: true } }),
      db.order.groupBy({ by: ['customerId'], where: { ...filter, createdAt: { gte: prev60, lt: last30 } }, _sum: { totalAmount: true } }),
    ])
    const currMap: Record<string, number> = {}
    for (const r of curr) currMap[r.customerId] = r._sum.totalAmount ?? 0
    const prevMap: Record<string, number> = {}
    for (const r of prev) prevMap[r.customerId] = r._sum.totalAmount ?? 0

    const declining = Object.keys(prevMap)
      .map(cid => {
        const p = prevMap[cid], c = currMap[cid] ?? 0
        if (p === 0) return null
        const g = Math.round(((c - p) / p) * 100)
        if (g >= -20) return null
        return { customerId: cid, growthPct: g, status: g <= -40 ? 'CRITICAL' : 'WARNING' }
      })
      .filter(Boolean)
      .sort((a, b) => a!.growthPct - b!.growthPct)
      .slice(0, 4) as Array<{ customerId: string; growthPct: number; status: string }>

    if (declining.length === 0) return []
    const customers = await db.customer.findMany({
      where: { id: { in: declining.map(d => d.customerId) } },
      select: { id: true, businessName: true },
    })
    const nm = Object.fromEntries(customers.map(c => [c.id, c.businessName]))
    return declining.map(d => ({ ...d, name: nm[d.customerId] ?? d.customerId }))
  } catch { return [] }
}

async function fetchDecliningProducts() {
  try {
    const now = new Date()
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const prev14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const filter = { status: { notIn: ['DRAFT', 'ANULUAR'] as string[] } }
    const [curr, prev] = await Promise.all([
      db.orderLine.groupBy({ by: ['productId'], where: { order: { ...filter, createdAt: { gte: last7 } } }, _sum: { quantityCopje: true } }),
      db.orderLine.groupBy({ by: ['productId'], where: { order: { ...filter, createdAt: { gte: prev14, lt: last7 } } }, _sum: { quantityCopje: true } }),
    ])
    const prevMap: Record<string, number> = {}
    for (const r of prev) prevMap[r.productId] = r._sum.quantityCopje ?? 0
    const currMap: Record<string, number> = {}
    for (const r of curr) currMap[r.productId] = r._sum.quantityCopje ?? 0

    const declining = Object.keys(prevMap)
      .map(pid => {
        const p = prevMap[pid], c = currMap[pid] ?? 0
        if (p === 0) return null
        const g = ((c - p) / p) * 100
        if (g >= 0) return null
        return { productId: pid, growthPct: Math.round(g), severity: g < -25 ? 'SEVERE' : g < -10 ? 'WARNING' : 'NORMAL' }
      })
      .filter(Boolean)
      .sort((a, b) => a!.growthPct - b!.growthPct)
      .slice(0, 4) as Array<{ productId: string; growthPct: number; severity: string }>

    if (declining.length === 0) return []
    const products = await db.product.findMany({ where: { id: { in: declining.map(d => d.productId) } }, select: { id: true, name: true } })
    const nm = Object.fromEntries(products.map(p => [p.id, p.name]))
    return declining.map(d => ({ ...d, name: nm[d.productId] ?? d.productId }))
  } catch { return [] }
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

interface ActivityItem {
  id: string
  type: 'ORDER' | 'PAYMENT' | 'VISIT' | 'RETURN'
  title: string
  subtitle: string
  amount?: number
  status: string
  href: string
  createdAt: Date
}

async function fetchActivityFeed(): Promise<ActivityItem[]> {
  try {
    const [orders, payments, visits, returns] = await Promise.all([
      db.order.findMany({
        take: 5, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { businessName: true } }, createdBy: { select: { name: true } } },
      }),
      db.payment.findMany({
        take: 4, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { businessName: true } }, collectedBy: { select: { name: true } } },
      }),
      db.visit.findMany({
        take: 3, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { businessName: true } }, agent: { select: { name: true } } },
      }),
      db.return.findMany({
        take: 3, orderBy: { createdAt: 'desc' },
        include: { customer: { select: { businessName: true } } },
      }),
    ])

    const items: ActivityItem[] = [
      ...orders.map(o => ({
        id: o.id, type: 'ORDER' as const,
        title: o.reference,
        subtitle: `${o.customer.businessName} · ${o.createdBy.name}`,
        amount: o.totalAmount, status: o.status,
        href: `/admin/orders/${o.id}`, createdAt: o.createdAt,
      })),
      ...payments.map(p => ({
        id: p.id, type: 'PAYMENT' as const,
        title: p.reference,
        subtitle: `${p.customer.businessName} · ${p.collectedBy.name}`,
        amount: p.amount, status: p.method,
        href: `/admin/payments`, createdAt: p.createdAt,
      })),
      ...visits.map(v => ({
        id: v.id, type: 'VISIT' as const,
        title: v.reference ?? v.id.slice(0, 8),
        subtitle: `${v.customer.businessName} · ${v.agent?.name ?? ''}`.replace(/ · $/, ''),
        status: v.status,
        href: `/admin/visits`, createdAt: v.createdAt,
      })),
      ...returns.map(r => ({
        id: r.id, type: 'RETURN' as const,
        title: r.reference,
        subtitle: r.customer.businessName,
        amount: (r as { totalAmount?: number }).totalAmount,
        status: r.status,
        href: `/admin/returns`, createdAt: r.createdAt,
      })),
    ]

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10)
  } catch {
    return []
  }
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
  const [stats, topProducts, decliningProducts, territoryTop, recoveryOpps, activityFeed, penetrationTop] = await Promise.all([
    getAdminStats(),
    fetchProductLeaderboard(),
    fetchDecliningProducts(),
    fetchTerritoryTop(),
    fetchRecoveryOpportunities(),
    fetchActivityFeed(),
    fetchPenetrationTop(),
  ])

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

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: '+ Klient i Ri',  href: '/admin/customers/new', cls: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
          { label: '+ Produkt i Ri', href: '/admin/products/new',  cls: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100' },
          { label: '+ Porosi e Re',  href: '/agjent/orders/new',   cls: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' },
          { label: '+ Pagesë e Re',  href: '/admin/payments/new',  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
        ].map(({ label, href, cls }) => (
          <Link key={href} href={href}>
            <div className={`px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors ${cls}`}>
              {label}
            </div>
          </Link>
        ))}
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

      {/* Product Analytics */}
      {(topProducts.length > 0 || decliningProducts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />Top Produktet (Ky Muaj)
                  </CardTitle>
                  <Link href="/admin/reports?type=product_leaderboard" className="text-xs font-semibold text-primary hover:text-primary/80">
                    Raporti i plotë →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {topProducts.map(p => (
                  <div key={p.rank} className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-gray-400 shrink-0">#{p.rank}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.totalQty.toLocaleString()} copë</p>
                    </div>
                    <p className="text-sm font-bold shrink-0">{formatCurrency(p.totalValue)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Declining Products */}
          {decliningProducts.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />Produkte në Rënie (7 ditë)
                  </CardTitle>
                  <Link href="/admin/reports?type=declining_products" className="text-xs font-semibold text-primary hover:text-primary/80">
                    Raporti i plotë →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {decliningProducts.map(p => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      p.severity === 'SEVERE' ? 'bg-red-100 text-red-700' :
                      p.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {p.severity === 'SEVERE' ? 'KRITIK' : p.severity === 'WARNING' ? 'KUJDES' : 'NORMAL'}
                    </span>
                    <p className="text-sm font-medium flex-1 min-w-0 truncate">{p.name}</p>
                    <p className="text-sm font-bold text-red-600 shrink-0">{p.growthPct}%</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Territory & Recovery */}
      {(territoryTop.length > 0 || recoveryOpps.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {territoryTop.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />Top 5 Territore (Ky Muaj)
                  </CardTitle>
                  <Link href="/admin/reports?type=territory" className="text-xs font-semibold text-primary hover:text-primary/80">
                    Raporti i plotë →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {territoryTop.map((z, i) => (
                  <div key={z.name} className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-gray-400 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{z.name}</p>
                      <p className="text-xs text-gray-400">{z.orderCount} porosi</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(z.total)}</p>
                      {z.growthPct !== null && (
                        <p className={`text-xs font-semibold ${z.growthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {z.growthPct >= 0 ? '+' : ''}{z.growthPct}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {recoveryOpps.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-orange-500" />Mundësi Rikuperimi
                  </CardTitle>
                  <Link href="/admin/reports?type=recovery_opportunities" className="text-xs font-semibold text-primary hover:text-primary/80">
                    Të gjitha →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-2">
                {recoveryOpps.map(c => (
                  <div key={c.customerId} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      c.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.status === 'CRITICAL' ? 'KRITIK' : 'KUJDES'}
                    </span>
                    <p className="text-sm font-medium flex-1 min-w-0 truncate">{c.name}</p>
                    <p className="text-sm font-bold text-red-600 shrink-0">{c.growthPct}%</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Product Penetration */}
      {penetrationTop.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />Penetrimi i Produkteve (Ky Muaj)
              </CardTitle>
              <Link href="/admin/reports?type=product_penetration" className="text-xs font-semibold text-primary hover:text-primary/80">
                Raporti i plotë →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {penetrationTop.map((p, i) => (
              <div key={p.name} className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-bold text-gray-400 shrink-0">#{i + 1}</span>
                  <p className="text-sm font-medium flex-1 min-w-0 truncate">{p.name}</p>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-purple-700">{p.penetrationPct}%</span>
                    <span className="text-xs text-gray-400 ml-1">({p.customers} klientë)</span>
                  </div>
                </div>
                <div className="ml-9 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${p.penetrationPct >= 80 ? 'bg-green-500' : p.penetrationPct >= 50 ? 'bg-blue-500' : p.penetrationPct >= 20 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(p.penetrationPct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      {activityFeed.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />Aktiviteti i Fundit
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-1">
              {activityFeed.map(item => {
                const typeConfig = {
                  ORDER:   { label: 'Porosi',  cls: 'bg-blue-100 text-blue-700',    Icon: ShoppingCart },
                  PAYMENT: { label: 'Pagesë',  cls: 'bg-green-100 text-green-700',  Icon: DollarSign },
                  VISIT:   { label: 'Vizitë',  cls: 'bg-purple-100 text-purple-700', Icon: MapPin },
                  RETURN:  { label: 'Kthim',   cls: 'bg-orange-100 text-orange-700', Icon: RotateCcw },
                }[item.type]
                const TypeIcon = typeConfig.Icon
                return (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.href}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.cls}`}>
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${typeConfig.cls}`}>
                          {typeConfig.label}
                        </span>
                        <p className="text-sm font-medium text-gray-900 font-mono truncate">{item.title}</p>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {item.amount != null && (
                        <p className="text-sm font-bold text-gray-700">{formatCurrency(item.amount)}</p>
                      )}
                      <p className="text-[10px] text-gray-400">{formatDateTime(item.createdAt.toISOString())}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
