import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

import { Truck, MapPin, DollarSign, RotateCcw, CheckCircle, Clock } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
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
          {[
            { href: '/shofer/rruga',       Icon: MapPin,     bg: 'bg-primary hover:bg-primary/90',       label: 'Rruga Ime',  sub: 'Shiko itinerarin' },
            { href: '/shofer/deliveries',  Icon: Truck,      bg: 'bg-blue-600 hover:bg-blue-700',        label: 'Dërgesat',   sub: 'Ngarko / dorëzo' },
            { href: '/shofer/payments',    Icon: DollarSign, bg: 'bg-emerald-600 hover:bg-emerald-700',  label: 'Pagesat',    sub: 'Regjistroi inkaso' },
            { href: '/shofer/returns',     Icon: RotateCcw,  bg: 'bg-orange-500 hover:bg-orange-600',    label: 'Kthimet',    sub: 'Regjistro kthim' },
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

