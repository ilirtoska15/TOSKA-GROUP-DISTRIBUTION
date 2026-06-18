import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ShoppingCart, DollarSign, MapPin, TrendingUp, Plus, Users, Package
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getAgentStats(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    visitsToday,
    ordersToday,
    salesToday,
    paymentsToday,
    openVisit,
    monthSales,
    target,
    pendingOrders,
  ] = await Promise.all([
    db.visit.count({ where: { agentId: userId, createdAt: { gte: today } } }),
    db.order.count({ where: { createdById: userId, createdAt: { gte: today }, status: { notIn: ['DRAFT'] } } }),
    db.order.aggregate({
      where: { createdById: userId, createdAt: { gte: today }, status: { notIn: ['DRAFT', 'ANULUAR'] } },
      _sum: { totalAmount: true },
    }),
    db.payment.aggregate({
      where: { collectedById: userId, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    db.visit.findFirst({ where: { agentId: userId, status: 'OPEN' }, include: { customer: { select: { businessName: true, businessAddress: true } } } }),
    db.order.aggregate({
      where: {
        createdById: userId,
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        status: { notIn: ['DRAFT', 'ANULUAR'] },
      },
      _sum: { totalAmount: true },
    }),
    db.target.findFirst({
      where: { userId, month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    }),
    db.order.count({ where: { createdById: userId, status: { in: ['SUBMITTED', 'PRET_APROVIM'] } } }),
  ])

  const monthlySalesValue = monthSales._sum.totalAmount ?? 0
  const targetValue = target?.salesTarget ?? 0
  const realization = targetValue > 0 ? (monthlySalesValue / targetValue) * 100 : 0

  return {
    visitsToday,
    ordersToday,
    salesToday: salesToday._sum.totalAmount ?? 0,
    paymentsToday: paymentsToday._sum.amount ?? 0,
    openVisit,
    monthlySalesValue,
    targetValue,
    realization,
    pendingOrders,
  }
}

export default async function AgentDashboard() {
  const session = await auth()
  if (!session?.user) return null

  const stats = await getAgentStats(session.user.id)

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Mirë se vini, {session.user.name}</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Open Visit Alert */}
      {stats.openVisit && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800">Vizitë e hapur:</p>
          <p className="text-sm text-blue-700">{stats.openVisit.customer.businessName}</p>
          <Link href="/agjent/visits">
            <button className="mt-2 text-xs text-blue-600 underline">Menaxho vizitën</button>
          </Link>
        </div>
      )}

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Vizita Sot" value={String(stats.visitsToday)} icon={MapPin} color="blue" href="/agjent/visits" />
        <StatCard title="Porosi Sot" value={String(stats.ordersToday)} icon={ShoppingCart} color="green" href="/agjent/orders" />
        <StatCard title="Shitje Sot" value={formatCurrency(stats.salesToday)} icon={TrendingUp} color="emerald" href="/agjent/orders" />
        <StatCard title="Inkaso Sot" value={formatCurrency(stats.paymentsToday)} icon={DollarSign} color="yellow" href="/agjent/payments" />
      </div>

      {/* Monthly Target */}
      {stats.targetValue > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Targeti Mujor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between mb-2">
              <span className="text-2xl font-bold text-gray-900">{Math.round(stats.realization)}%</span>
              <div className="text-right">
                <p className="text-xs text-gray-500">Realizuar</p>
                <p className="text-sm font-semibold">{formatCurrency(stats.monthlySalesValue)}</p>
                <p className="text-xs text-gray-400">/ {formatCurrency(stats.targetValue)}</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-primary rounded-full h-2.5 transition-all"
                style={{ width: `${Math.min(100, stats.realization)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/agjent/visits">
          <QuickAction icon={MapPin} label="Fillo Vizitë" color="blue" />
        </Link>
        <Link href="/agjent/orders/new">
          <QuickAction icon={Plus} label="Porosi e Re" color="green" />
        </Link>
        <Link href="/agjent/catalog">
          <QuickAction icon={Package} label="Katalog" color="purple" />
        </Link>
        <Link href="/agjent/customers">
          <QuickAction icon={Users} label="Klientët e Mi" color="indigo" />
        </Link>
      </div>

      {/* Pending Orders Alert */}
      {stats.pendingOrders > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800">
            {stats.pendingOrders} porosi në pritje
          </p>
          <Link href="/agjent/orders?status=PRET_APROVIM">
            <p className="text-xs text-yellow-600 underline mt-1">Shih porositë</p>
          </Link>
        </div>
      )}
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

function QuickAction({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  }
  return (
    <div className={`${colorMap[color]} rounded-xl p-4 text-white flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity`}>
      <Icon className="h-5 w-5" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}
