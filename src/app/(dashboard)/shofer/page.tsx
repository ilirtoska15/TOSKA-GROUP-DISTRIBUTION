import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'

import { Truck, MapPin, DollarSign, RotateCcw, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getDriverStats(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [todayDeliveries, pendingDeliveries, inDelivery, delivered, collectionsToday] = await Promise.all([
    db.delivery.count({ where: { driverId: userId, assignedAt: { gte: today } } }),
    db.delivery.count({ where: { driverId: userId, status: { in: ['ASSIGNED', 'LOADED'] } } }),
    db.delivery.count({ where: { driverId: userId, status: 'IN_DELIVERY' } }),
    db.delivery.count({ where: { driverId: userId, status: 'DELIVERED', deliveredAt: { gte: today } } }),
    db.payment.aggregate({ where: { collectedById: userId, createdAt: { gte: today } }, _sum: { amount: true } }),
  ])

  return { todayDeliveries, pendingDeliveries, inDelivery, delivered, collectionsToday: collectionsToday._sum.amount ?? 0 }
}

export default async function ShoferDashboard() {
  const session = await auth()
  if (!session?.user) return null

  const stats = await getDriverStats(session.user.id)

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mirë se vini, {session.user.name}</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Dërgesa Sot" value={String(stats.todayDeliveries)} icon={Truck} color="blue" href="/shofer/deliveries" />
        <StatCard title="Dorëzuar" value={String(stats.delivered)} icon={CheckCircle} color="green" href="/shofer/deliveries?status=DELIVERED" />
        <StatCard title="Në Pritje" value={String(stats.pendingDeliveries)} icon={Clock} color="yellow" href="/shofer/rruga" />
        <StatCard title="Inkaso Sot" value={formatCurrency(stats.collectionsToday)} icon={DollarSign} color="emerald" href="/shofer/payments" />
      </div>

      {stats.inDelivery > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="font-semibold text-blue-800 text-sm">Jeni aktualisht në dërgesë</p>
          <Link href="/shofer/deliveries?status=IN_DELIVERY">
            <p className="text-xs text-blue-600 underline mt-1">Shiko dërgesen aktive</p>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/shofer/rruga">
          <div className="bg-primary rounded-xl p-4 text-white flex items-center gap-3 cursor-pointer hover:opacity-90">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-semibold">Rruga Sot</span>
          </div>
        </Link>
        <Link href="/shofer/returns">
          <div className="bg-orange-500 rounded-xl p-4 text-white flex items-center gap-3 cursor-pointer hover:opacity-90">
            <RotateCcw className="h-5 w-5" />
            <span className="text-sm font-semibold">Kthimet</span>
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
    emerald: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-yellow-50 text-yellow-600',
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
