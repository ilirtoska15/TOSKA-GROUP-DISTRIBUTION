import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ShoppingCart, DollarSign, MapPin, TrendingUp, Plus, Users, Package
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const SAFE_AGENT_STATS = {
  visitsToday: 0,
  ordersToday: 0,
  salesToday: 0,
  paymentsToday: 0,
  openVisit: null as null | { customer: { businessName: string; businessAddress: string } },
  monthlySalesValue: 0,
  targetValue: 0,
  realization: 0,
  pendingOrders: 0,
}

async function getAgentStats(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  try {
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
  } catch (err) {
    console.error('[agjent] getAgentStats error:', err)
    return SAFE_AGENT_STATS
  }
}

export default async function AgentDashboard() {
  const session = await auth()
  if (!session?.user) return null

  const stats = await getAgentStats(session.user.id)

  const realizationPct = Math.min(100, Math.round(stats.realization))
  const realizationColor = realizationPct >= 80 ? 'bg-green-500' : realizationPct >= 50 ? 'bg-primary' : 'bg-orange-500'

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

      {/* Open Visit Alert */}
      {stats.openVisit && (
        <Link href="/agjent/visits">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Vizitë e Hapur</p>
              <p className="text-sm font-bold text-blue-900 truncate">{stats.openVisit.customer.businessName}</p>
            </div>
            <span className="text-xs text-blue-600 font-semibold shrink-0">Menaxho →</span>
          </div>
        </Link>
      )}

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Vizita Sot"  value={String(stats.visitsToday)}          icon={MapPin}      color="blue"    href="/agjent/visits" />
        <StatCard title="Porosi Sot"  value={String(stats.ordersToday)}           icon={ShoppingCart} color="green"  href="/agjent/orders" />
        <StatCard title="Shitje Sot"  value={formatCurrency(stats.salesToday)}    icon={TrendingUp}  color="emerald" href="/agjent/orders" />
        <StatCard title="Inkaso Sot"  value={formatCurrency(stats.paymentsToday)} icon={DollarSign}  color="yellow"  href="/agjent/payments" />
      </div>

      {/* Monthly Target */}
      {stats.targetValue > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-sm font-semibold text-gray-700">Targeti Mujor</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <span className="text-3xl font-bold text-gray-900">{realizationPct}%</span>
                <span className="text-sm text-slate-400 ml-1">realizuar</span>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-gray-900">{formatCurrency(stats.monthlySalesValue)}</p>
                <p className="text-xs text-slate-400">nga {formatCurrency(stats.targetValue)}</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`${realizationColor} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${realizationPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Veprime të Shpejta</p>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/agjent/visits">
            <QuickAction icon={MapPin}      label="Fillo Vizitë"  sublabel="Regjistro vizitë" color="blue" />
          </Link>
          <Link href="/agjent/orders/new">
            <QuickAction icon={Plus}        label="Porosi e Re"   sublabel="Krijo porosi"     color="green" />
          </Link>
          <Link href="/agjent/catalog">
            <QuickAction icon={Package}     label="Katalog"       sublabel="Shiko produktet"  color="purple" />
          </Link>
          <Link href="/agjent/customers">
            <QuickAction icon={Users}       label="Klientët e Mi" sublabel="Lista e klientëve" color="indigo" />
          </Link>
        </div>
      </div>

      {/* Pending Orders Alert */}
      {stats.pendingOrders > 0 && (
        <Link href="/agjent/orders?status=PRET_APROVIM">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-yellow-100 transition-colors">
            <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-yellow-900">{stats.pendingOrders} porosi në pritje</p>
              <p className="text-xs text-yellow-700">Pret aprovim nga admin</p>
            </div>
            <span className="text-xs text-yellow-700 font-semibold shrink-0">Shih →</span>
          </div>
        </Link>
      )}
    </div>
  )
}


function QuickAction({ icon: Icon, label, sublabel, color }: { icon: React.ElementType; label: string; sublabel: string; color: string }) {
  const colorMap: Record<string, { bg: string; hover: string }> = {
    blue:   { bg: 'bg-blue-500',   hover: 'hover:bg-blue-600' },
    green:  { bg: 'bg-green-500',  hover: 'hover:bg-green-600' },
    purple: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600' },
    indigo: { bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600' },
  }
  const c = colorMap[color] ?? colorMap.blue
  return (
    <div className={`${c.bg} ${c.hover} rounded-2xl p-4 text-white cursor-pointer active:scale-[0.97] transition-all duration-150 shadow-sm`}>
      <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-2.5">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm font-bold leading-tight">{label}</p>
      <p className="text-[11px] text-white/70 mt-0.5">{sublabel}</p>
    </div>
  )
}
