import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, Warehouse, AlertTriangle, RotateCcw, CheckCircle, Boxes } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import Link from 'next/link'
import { getMultipleStockLevels } from '@/lib/stock'

export const dynamic = 'force-dynamic'

const SAFE_DEPOSIT_STATS = {
  ordersToPrep: 0,
  ordersReady: 0,
  ordersInPrep: 0,
  pendingReturns: 0,
  outOfStock: 0,
  lowStock: 0,
  nearExpiry: 0,
}

async function getDepositStats() {
  try {
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

    let outOfStock = 0
    let lowStock = 0
    let nearExpiry = 0

    if (allProducts.length > 0) {
      try {
        const stockMap = await getMultipleStockLevels(allProducts.map((p) => p.id))
        const threshold30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        for (const p of allProducts) {
          const stock = stockMap[p.id] ?? 0
          if (stock === 0) outOfStock++
          else if (stock < 20) lowStock++
          if (p.expiryDate && new Date(p.expiryDate) <= threshold30) nearExpiry++
        }
      } catch {
        // stock calculation failure is non-fatal
      }
    }

    return { ordersToPrep, ordersReady, ordersInPrep, pendingReturns, outOfStock, lowStock, nearExpiry }
  } catch (err) {
    console.error('[depoist] getDepositStats error:', err)
    return SAFE_DEPOSIT_STATS
  }
}

export default async function DepositDashboard() {
  const session = await auth()
  if (!session?.user) return null

  const stats = await getDepositStats()

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Mirë se vini, <span className="text-primary">{session.user.name}</span>
          </h1>
          <p className="text-sm text-slate-500 capitalize">
            {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {(stats.outOfStock > 0 || stats.nearExpiry > 0) && (
        <div className="space-y-2">
          {stats.outOfStock > 0 && (
            <Link href="/depoist/stock?filter=out">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-center gap-3 hover:bg-red-100 transition-colors">
                <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm text-red-800 font-semibold flex-1">{stats.outOfStock} produkte pa stok</p>
                <span className="text-xs text-red-600 font-semibold shrink-0">Shiko →</span>
              </div>
            </Link>
          )}
          {stats.nearExpiry > 0 && (
            <Link href="/depoist/stock?filter=expiry">
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3.5 flex items-center gap-3 hover:bg-orange-100 transition-colors">
                <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm text-orange-800 font-semibold flex-1">{stats.nearExpiry} produkte afër skadimit</p>
                <span className="text-xs text-orange-600 font-semibold shrink-0">Shiko →</span>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Për Përgatitje"   value={String(stats.ordersToPrep)}   icon={ClipboardList} color="blue"   href="/depoist/orders?status=APROVUAR" />
        <StatCard title="Në Përgatitje"    value={String(stats.ordersInPrep)}   icon={Warehouse}     color="purple" href="/depoist/orders?status=NE_PERGATITJE" />
        <StatCard title="Gati për Ngarkim" value={String(stats.ordersReady)}    icon={CheckCircle}   color="green"  href="/depoist/orders?status=GATI_PER_NGARKIM" />
        <StatCard title="Kthime në Pritje" value={String(stats.pendingReturns)} icon={RotateCcw}     color="orange" href="/depoist/returns" />
      </div>

      {/* Stock summary */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2 px-5 pt-5">
          <CardTitle className="text-sm font-semibold text-gray-700">Gjendja e Stokut</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-1">
          {[
            { label: 'Pa stok',                value: stats.outOfStock, color: stats.outOfStock > 0 ? 'bg-red-100 text-red-700'     : 'bg-green-100 text-green-700', href: '/depoist/stock?filter=out' },
            { label: 'Stok i ulët (<20 copë)', value: stats.lowStock,   color: stats.lowStock > 0  ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700', href: '/depoist/stock?filter=low' },
            { label: 'Afër skadimit (30d)',     value: stats.nearExpiry, color: stats.nearExpiry > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700', href: '/depoist/stock?filter=expiry' },
          ].map(({ label, value, color, href }) => (
            <Link key={label} href={href} className="flex items-center justify-between py-2 px-1 -mx-1 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-sm text-gray-700">{label}</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{value}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Veprime të Shpejta</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/depoist/inventory', Icon: Warehouse,    bg: 'bg-primary hover:bg-primary/90',         label: 'Inventari',  sub: 'Numërim i shpejtë' },
            { href: '/depoist/returns',   Icon: RotateCcw,    bg: 'bg-orange-500 hover:bg-orange-600',      label: 'Kthimet',    sub: 'Preno kthimet' },
            { href: '/depoist/damage',    Icon: AlertTriangle, bg: 'bg-red-600 hover:bg-red-700',           label: 'Dëmtimet',   sub: 'Regjistro dëmtim' },
            { href: '/depoist/stock',     Icon: Boxes,        bg: 'bg-indigo-600 hover:bg-indigo-700',      label: 'Stoku',      sub: 'Kontrollo nivelet' },
          ].map(({ href, Icon, bg, label, sub }) => (
            <Link key={href} href={href}>
              <div className={`${bg} rounded-2xl p-4 text-white cursor-pointer active:scale-[0.97] transition-all shadow-sm`}>
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-2.5">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-bold">{label}</p>
                <p className="text-[11px] text-white/70 mt-0.5">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

