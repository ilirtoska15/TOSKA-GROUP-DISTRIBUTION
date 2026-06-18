'use client'

import { useState, useEffect } from 'react'
import { Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle, Package, Users, ShoppingCart, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface HealthData {
  status: 'ok' | 'warning' | 'critical'
  checks: {
    db: boolean
    outOfStock: number
    lowStock: number
    nearExpiry: number
    openOrders: number
    pendingApproval: number
    pendingReturns: number
    overdueDebt: number
    openVisits: number
    failedDeliveries: number
  }
  summary: {
    totalProducts: number
    totalCustomers: number
    totalActiveOrders: number
    totalUnpaidDebt: number
    pendingReturns: number
  }
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setHealth(data)
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHealth() }, [])

  const statusColor = health?.status === 'ok' ? 'text-green-600' : health?.status === 'warning' ? 'text-amber-600' : 'text-red-600'
  const statusIcon = health?.status === 'ok' ? <CheckCircle className="h-5 w-5" /> : health?.status === 'warning' ? <AlertTriangle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900">Gjendja e Sistemit</h1>
          {health && (
            <div className={`flex items-center gap-1.5 font-medium ${statusColor}`}>
              {statusIcon}
              {health.status === 'ok' ? 'Normal' : health.status === 'warning' ? 'Paralajmërim' : 'Kritike'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && <p className="text-xs text-gray-400">Rifreskuar: {lastUpdate.toLocaleTimeString()}</p>}
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading && !health ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : health ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Package className="h-4 w-4" /><span className="text-xs">Produkte</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{health.summary.totalProducts}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="h-4 w-4" /><span className="text-xs">Klientë</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{health.summary.totalCustomers}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <ShoppingCart className="h-4 w-4" /><span className="text-xs">Porosi Aktive</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{health.summary.totalActiveOrders}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Wallet className="h-4 w-4" /><span className="text-xs">Borxh Total</span>
              </div>
              <p className="text-xl font-bold text-red-600">{formatCurrency(health.summary.totalUnpaidDebt)}</p>
            </div>
          </div>

          {/* Alert Checks */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h2 className="font-semibold text-gray-700">Kontrollet e Alarmit</h2>
            </div>
            <div className="divide-y">
              {[
                { label: 'Baza e të dhënave', ok: health.checks.db, value: health.checks.db ? 'Lidhur' : 'Jo e lidhur' },
                { label: 'Produkte pa stok', ok: health.checks.outOfStock === 0, value: `${health.checks.outOfStock} produkte` },
                { label: 'Stok i ulët', ok: health.checks.lowStock === 0, value: `${health.checks.lowStock} produkte` },
                { label: 'Afër skadencës', ok: health.checks.nearExpiry === 0, value: `${health.checks.nearExpiry} produkte` },
                { label: 'Porosi pret aprovim', ok: health.checks.pendingApproval === 0, value: `${health.checks.pendingApproval} porosi` },
                { label: 'Kthime në pritje', ok: health.checks.pendingReturns === 0, value: `${health.checks.pendingReturns} kthime` },
                { label: 'Borxh i vonuar', ok: health.checks.overdueDebt === 0, value: `${health.checks.overdueDebt} klientë` },
                { label: 'Vizita të hapura', ok: health.checks.openVisits === 0, value: `${health.checks.openVisits} vizita` },
                { label: 'Dërgesa të dështuara', ok: health.checks.failedDeliveries === 0, value: `${health.checks.failedDeliveries} dërgesa` },
              ].map((check, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {check.ok ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm text-gray-700">{check.label}</span>
                  </div>
                  <Badge variant={check.ok ? 'success' : 'warning'}>{check.value}</Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-gray-500">
          <XCircle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>Nuk u arrit të ngarkoheshin të dhënat</p>
        </div>
      )}
    </div>
  )
}
