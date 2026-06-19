import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

import { Truck, MapPin, DollarSign, RotateCcw, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const SAFE_DRIVER_STATS = {
  todayDeliveries: 0,
  pendingDeliveries: 0,
  inDelivery: 0,
  delivered: 0,
  collectionsToday: 0,
}

async function getDriverStats(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
    const [todayDeliveries, pendingDeliveries, inDelivery, delivered, collectionsToday] = await Promise.all([
      db.delivery.count({ where: { driverId: userId, assignedAt: { gte: today } } }),
      db.delivery.count({ where: { driverId: userId, status: { in: ['ASSIGNED', 'LOADED'] } } }),
      db.delivery.count({ where: { driverId: userId, status: 'IN_DELIVERY' } }),
      db.delivery.count({ where: { driverId: userId, status: 'DELIVERED', deliveredAt: { gte: today } } }),
      db.payment.aggregate({ where: { collectedById: userId, createdAt: { gte: today } }, _sum: { amount: true } }),
    ])

    return { todayDeliveries, pendingDeliveries, inDelivery, delivered, collectionsToday: collectionsToday._sum.amount ?? 0 }
  } catch (err) {
    console.error('[shofer] getDriverStats error:', err)
    return SAFE_DRIVER_STATS
  }
}

export default async function ShoferDashboard() {
  const session = await auth()
  if (!session?.user) return null

  const stats = await getDriverStats(session.user.id)

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

      {/* Active delivery banner */}
      {stats.inDelivery > 0 && (
        <Link href="/shofer/deliveries?status=IN_DELIVERY">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shrink-0 animate-pulse">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900">Aktualisht Në Dërgesë</p>
              <p className="text-xs text-blue-700">Kliko për të parë detajet</p>
            </div>
            <span className="text-xs text-blue-600 font-semibold shrink-0">Shiko →</span>
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Dërgesa Sot" value={String(stats.todayDeliveries)}       icon={Truck}        color="blue"    href="/shofer/deliveries" />
        <StatCard title="Dorëzuar"    value={String(stats.delivered)}              icon={CheckCircle}  color="green"   href="/shofer/deliveries?status=DELIVERED" />
        <StatCard title="Në Pritje"   value={String(stats.pendingDeliveries)}      icon={Clock}        color="yellow"  href="/shofer/rruga" />
        <StatCard title="Inkaso Sot"  value={formatCurrency(stats.collectionsToday)} icon={DollarSign} color="emerald" href="/shofer/payments" />
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Veprime të Shpejta</p>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/shofer/rruga">
            <div className="bg-primary hover:bg-primary/90 rounded-2xl p-4 text-white cursor-pointer active:scale-[0.97] transition-all shadow-sm">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-2.5">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-bold">Rruga Sot</p>
              <p className="text-[11px] text-white/70 mt-0.5">Shiko itinerarin</p>
            </div>
          </Link>
          <Link href="/shofer/returns">
            <div className="bg-orange-500 hover:bg-orange-600 rounded-2xl p-4 text-white cursor-pointer active:scale-[0.97] transition-all shadow-sm">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-2.5">
                <RotateCcw className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-bold">Kthimet</p>
              <p className="text-[11px] text-white/70 mt-0.5">Regjistro kthim</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, href }: { title: string; value: string; icon: React.ElementType; color: string; href: string }) {
  const colorMap: Record<string, { grad: string; icon: string; border: string }> = {
    blue:    { grad: 'from-blue-50 to-white',    icon: 'bg-blue-500',    border: 'border-blue-100' },
    green:   { grad: 'from-green-50 to-white',   icon: 'bg-green-500',   border: 'border-green-100' },
    emerald: { grad: 'from-emerald-50 to-white', icon: 'bg-emerald-500', border: 'border-emerald-100' },
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
