'use client'

import { useState, useEffect, useCallback } from 'react'
import { Target, Plus, User, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

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
  agent: { id: string; name: string }
}

interface Agent { id: string; name: string }

const MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor', 'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor']

export default function AdminTargetsPage() {
  const [targets, setTargets] = useState<TargetRecord[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const now = new Date()
  const [form, setForm] = useState({
    agentId: '', month: String(now.getMonth() + 1), year: String(now.getFullYear()),
    targetAmount: '', targetVisits: '', targetOrders: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [tRes, aRes] = await Promise.all([
      fetch('/api/targets'),
      fetch('/api/users?role=AGJENT'),
    ])
    const tData = await tRes.json()
    const aData = await aRes.json()
    setTargets(tData.targets ?? [])
    setAgents(aData.users ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!form.agentId) { toast.error('Zgjidh agentin'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: form.agentId,
          month: Number(form.month), year: Number(form.year),
          targetAmount: form.targetAmount ? Number(form.targetAmount) : undefined,
          targetVisits: form.targetVisits ? Number(form.targetVisits) : undefined,
          targetOrders: form.targetOrders ? Number(form.targetOrders) : undefined,
        }),
      })
      if (res.ok) {
        toast.success('Targeti u ruajt')
        setShowForm(false)
        fetchData()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const pct = (achieved: number, target: number) => target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Targetat</h1>
          <p className="text-sm text-gray-500">Menaxho targetat mujore të agjentëve</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />Cakto Target
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Target i Ri</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Agjenti *</Label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value={form.agentId} onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}>
                  <option value="">-- Zgjidh --</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Muaji</Label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label>Viti</Label>
                <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              </div>
              <div>
                <Label>Target Shitje (ALL)</Label>
                <Input type="number" min="0" value={form.targetAmount} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} />
              </div>
              <div>
                <Label>Target Vizita</Label>
                <Input type="number" min="0" value={form.targetVisits} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, targetVisits: e.target.value }))} />
              </div>
              <div>
                <Label>Target Porosi</Label>
                <Input type="number" min="0" value={form.targetOrders} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, targetOrders: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button onClick={handleSubmit} loading={submitting}>Ruaj Targetin</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />)
        ) : targets.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <Target className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u caktua asnjë target</p>
          </div>
        ) : targets.map(t => (
          <div key={t.id} className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-semibold text-gray-900">{t.agent.name}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Calendar className="h-3.5 w-3.5" />
                {MONTHS[t.month - 1]} {t.year}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {t.targetAmount > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Shitjet</span>
                    <span>{pct(t.achievedAmount, t.targetAmount)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct(t.achievedAmount, t.targetAmount)}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(t.achievedAmount)} / {formatCurrency(t.targetAmount)}</p>
                </div>
              )}
              {t.targetVisits > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Vizita</span>
                    <span>{pct(t.achievedVisits, t.targetVisits)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct(t.achievedVisits, t.targetVisits)}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{t.achievedVisits} / {t.targetVisits}</p>
                </div>
              )}
              {t.targetOrders > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Porosi</span>
                    <span>{pct(t.achievedOrders, t.targetOrders)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct(t.achievedOrders, t.targetOrders)}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{t.achievedOrders} / {t.targetOrders}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
