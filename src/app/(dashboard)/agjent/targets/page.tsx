'use client'

import { useState, useEffect } from 'react'
import { Target, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface TargetRecord {
  id: string
  month: number
  year: number
  targetAmount: number
  targetVisits: number
  targetOrders: number
  achievedAmount: number
  achievedVisits: number
  achievedOrders: number
}

const MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor']

export default function AgjentTargetsPage() {
  const [targets, setTargets] = useState<TargetRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/targets').then(r => r.json()).then(d => {
      setTargets(d.targets ?? [])
      setLoading(false)
    })
  }, [])

  const pct = (achieved: number, target: number) => target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Targetat e Mi</h1>
        <p className="text-sm text-gray-500">Progresi mujor i shitjeve</p>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)
      ) : targets.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
          <Target className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>Nuk ka targete të caktuara ende</p>
          <p className="text-xs mt-1">Kontakto administratorin për të caktuar targetat</p>
        </div>
      ) : targets.map(t => (
        <div key={t.id} className="bg-white rounded-xl border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-semibold text-gray-900">{MONTHS[t.month - 1]} {t.year}</span>
            </div>
          </div>

          {t.targetAmount > 0 && (
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <TrendingUp className="h-3.5 w-3.5" />Shitjet
                </span>
                <span className="font-medium">
                  {formatCurrency(t.achievedAmount)} / {formatCurrency(t.targetAmount)}
                  <span className="text-xs text-gray-400 ml-1">({pct(t.achievedAmount, t.targetAmount)}%)</span>
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct(t.achievedAmount, t.targetAmount) >= 100 ? 'bg-green-500' : pct(t.achievedAmount, t.targetAmount) >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
                  style={{ width: `${pct(t.achievedAmount, t.targetAmount)}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            {t.targetVisits > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {t.achievedVisits}<span className="text-sm text-gray-400">/{t.targetVisits}</span>
                </div>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3" />Vizita
                </p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct(t.achievedVisits, t.targetVisits)}%` }} />
                </div>
              </div>
            )}
            {t.targetOrders > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {t.achievedOrders}<span className="text-sm text-gray-400">/{t.targetOrders}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Porosi</p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct(t.achievedOrders, t.targetOrders)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
