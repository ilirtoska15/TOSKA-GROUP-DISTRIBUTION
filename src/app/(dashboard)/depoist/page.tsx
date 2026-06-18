import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, Warehouse, AlertTriangle, RotateCcw, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { getMultipleStockLevels } from '@/lib/stock'

export const dynamic = 'force-dynamic'

async function getDepositStats() {
  const [
    ordersToPrep,
    ordersReady,
    ordersInPrep,
    pendingReturns,
    allProducts,
  ] = await Promise.all([
    db.order.count({ where: { status: 'APROVUAR' } }),
    db.order.count({ where: { status: 'GATI_PER_NGARKIM' } }),
    db.order.count({ where: { status: 'NE_PERGATITJE' } }),
    db.return.count({ where: { status: { in: ['MARRE_NGA_SHOFERI', 'APROVUAR'] } } }),
    db.product.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true, code: true, expiryDate: true } }),
  ])

  const stockMap = await getMultipleStockLevels(allProducts.map((p) => p.id))
  let outOfStock = 0
  let lowStock = 0
  let nearExpiry = 0

  const threshold30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  for (const p of allProducts) {
    const stock = stockMap[p.id] ?? 0
    if (stock === 0) outOfStock++
    else if (stock < 20) lowStock++
    if (p.expiryDate && new Date(p.expiryDate) <= threshold30) nearExpiry++
  }

  return { ordersToPrep, ordersReady, ordersInPrep, pendingReturns, outOfStock, lowStock, nearExpiry }
}

export default async function DepositDashboard() {
  const session = await auth()
  if (!session?.user) return null

  const stats = await getDepositStats()

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mirë se vini, {session.user.name}</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Alerts */}
      {(stats.outOfStock > 0 || stats.nearExpiry > 0) && (
        <div className="space-y-2">
          {stats.outOfStock > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 font-medium">{stats.outOfStock} produkte pa stok</p>
              <Link href="/depoist/stock?filter=out" className="ml-auto text-xs text-red-600 underline">Shiko</Link>
            </div>
          )}
          {stats.nearExpiry > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <p className="text-sm text-orange-700 font-medium">{stats.nearExpiry} produkte afër skadimit</p>
              <Link href="/depoist/stock?filter=expiry" className="ml-auto text-xs text-orange-600 underline">Shiko</Link>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Porosi për Prep." value={String(stats.ordersToPrep)} icon={ClipboardList} color="blue" href="/depoist/orders?status=APROVUAR" />
        <StatCard title="Në Përgatitje" value={String(stats.ordersInPrep)} icon={Warehouse} color="purple" href="/depoist/orders?status=NE_PERGATITJE" />
        <StatCard title="Gati për Ngarkim" value={String(stats.ordersReady)} icon={CheckCircle} color="green" href="/depoist/orders?status=GATI_PER_NGARKIM" />
        <StatCard title="Kthime Pendues" value={String(stats.pendingReturns)} icon={RotateCcw} color="orange" href="/depoist/returns" />
      </div>

      {/* Stock summary */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Gjendja e Stokut</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Pa stok</span>
            <span className={`font-semibold ${stats.outOfStock > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.outOfStock}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Stok i ulët (&lt;20 copë)</span>
            <span className={`font-semibold ${stats.lowStock > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{stats.lowStock}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Afër skadimit (30d)</span>
            <span className={`font-semibold ${stats.nearExpiry > 0 ? 'text-orange-600' : 'text-green-600'}`}>{stats.nearExpiry}</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/depoist/inventory">
          <div className="bg-primary rounded-xl p-4 text-white flex items-center gap-3 cursor-pointer hover:opacity-90">
            <Warehouse className="h-5 w-5" />
            <span className="text-sm font-semibold">Inventar i Shpejtë</span>
          </div>
        </Link>
        <Link href="/depoist/orders">
          <div className="bg-green-600 rounded-xl p-4 text-white flex items-center gap-3 cursor-pointer hover:opacity-90">
            <ClipboardList className="h-5 w-5" />
            <span className="text-sm font-semibold">Porosi Sot</span>
          </div>
        </Link>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, href }: { title: string; value: string; icon: React.ElementType; color: string; href: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{title}</p>
      </div>
    </Link>
  )
}
