'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, Search, Calendar, User, Clock, XCircle, Plus, X, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Visit {
  id: string
  reference: string
  status: string
  openedAt: string
  closedAt?: string
  scheduledDate?: string
  scheduledTime?: string
  priority?: string
  noOrderReason?: string
  openedLat?: number
  openedLng?: number
  customer: { businessName: string; code: string }
  agent: { name: string }
}

interface Meta { total: number; page: number; limit: number }
interface Agent { id: string; name: string }
interface CustomerResult { id: string; code: string; businessName: string; city?: string }

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Hapur', CLOSED: 'Mbyllur', PLANNED: 'Planifikuar',
  MISSED: 'E humbur', CANCELLED: 'Anuluar',
}
const PRIORITY_LABELS: Record<string, string> = { LOW: 'E ulët', NORMAL: 'Normale', HIGH: 'E lartë' }
const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700', NORMAL: 'bg-blue-100 text-blue-700', LOW: 'bg-gray-100 text-gray-600',
}

export default function AdminVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 30 })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Plan form state
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [planAgentId, setPlanAgentId] = useState('')
  const [planCustomerId, setPlanCustomerId] = useState('')
  const [planCustomerName, setPlanCustomerName] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [planTime, setPlanTime] = useState('')
  const [planPriority, setPlanPriority] = useState<'LOW' | 'NORMAL' | 'HIGH'>('NORMAL')
  const [planNotes, setPlanNotes] = useState('')
  const [planSubmitting, setPlanSubmitting] = useState(false)

  // Customer picker in plan form
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<CustomerResult[]>([])
  const [custLoading, setCustLoading] = useState(false)
  const [custOpen, setCustOpen] = useState(false)
  const custRef = useRef<HTMLDivElement>(null)

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30', search, status, date })
    const res = await fetch(`/api/visits?${params}`)
    const data = await res.json()
    setVisits(data.visits ?? [])
    setMeta(data)
    setLoading(false)
  }, [page, search, status, date])

  useEffect(() => { fetchVisits() }, [fetchVisits])

  useEffect(() => {
    if (!showPlanForm || agents.length > 0) return
    fetch('/api/users?role=AGJENT')
      .then(r => r.ok ? r.json() : [])
      .then(d => setAgents(Array.isArray(d) ? d : d.users ?? []))
      .catch(() => {})
  }, [showPlanForm, agents.length])

  // Debounced customer search
  useEffect(() => {
    if (!custOpen && !custSearch) return
    const t = setTimeout(async () => {
      setCustLoading(true)
      try {
        const url = custSearch.trim()
          ? `/api/customers?search=${encodeURIComponent(custSearch)}&limit=20`
          : `/api/customers?limit=20`
        const r = await fetch(url)
        const d = r.ok ? await r.json() : { customers: [] }
        setCustResults(d.customers ?? [])
      } catch {
        setCustResults([])
      } finally {
        setCustLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, custOpen])

  // Click outside picker
  useEffect(() => {
    if (!custOpen) return
    const fn = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setCustOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [custOpen])

  const handlePlan = async () => {
    if (!planAgentId) { toast.error('Zgjidh agjentin'); return }
    if (!planCustomerId) { toast.error('Zgjidh klientin'); return }
    if (!planDate) { toast.error('Zgjidh datën'); return }
    setPlanSubmitting(true)
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'plan',
          agentId: planAgentId,
          customerId: planCustomerId,
          scheduledDate: planDate,
          scheduledTime: planTime || undefined,
          priority: planPriority,
          notes: planNotes || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Vizita u planifikua')
        setShowPlanForm(false)
        setPlanAgentId(''); setPlanCustomerId(''); setPlanCustomerName('')
        setPlanDate(''); setPlanTime(''); setPlanNotes('')
        fetchVisits()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setPlanSubmitting(false)
    }
  }

  const handleCancel = async (id: string) => {
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', visitId: id }),
    })
    if (res.ok) { toast.success('Vizita u anulua'); fetchVisits() }
    else { const e = await res.json(); toast.error(e.error ?? 'Gabim') }
  }

  const totalPages = Math.ceil(meta.total / meta.limit)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vizitat</h1>
          <p className="text-sm text-gray-500">{meta.total} gjithsej</p>
        </div>
        <Button onClick={() => setShowPlanForm(!showPlanForm)} className="gap-2">
          <Plus className="h-4 w-4" />Krijo Plan Vizite
        </Button>
      </div>

      {/* Plan form */}
      {showPlanForm && (
        <div className="bg-white border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Planifiko Vizitë të Re</h3>
            <button onClick={() => setShowPlanForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Agjenti *</Label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                value={planAgentId}
                onChange={e => setPlanAgentId(e.target.value)}
              >
                <option value="">— Zgjidh agjentin —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Klienti *</Label>
              <div className="relative mt-1" ref={custRef}>
                {planCustomerId ? (
                  <div className="flex items-center justify-between h-10 px-3 rounded-lg border border-primary bg-primary/5 text-sm">
                    <span className="font-medium truncate">{planCustomerName}</span>
                    <button onClick={() => { setPlanCustomerId(''); setPlanCustomerName('') }}>
                      <X className="h-4 w-4 text-gray-400 ml-2" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        placeholder="Kërko klientin..."
                        className="pl-9 h-10"
                        value={custSearch}
                        autoComplete="off"
                        onChange={e => { setCustSearch(e.target.value); setCustOpen(true) }}
                        onFocus={() => setCustOpen(true)}
                      />
                    </div>
                    {custOpen && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                        {custLoading ? (
                          <div className="p-3 text-sm text-gray-400 animate-pulse">Duke kërkuar...</div>
                        ) : custResults.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400">Nuk u gjet asnjë klient</div>
                        ) : custResults.map(c => (
                          <button
                            key={c.id}
                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0 border-gray-100 text-sm"
                            onClick={() => { setPlanCustomerId(c.id); setPlanCustomerName(c.businessName); setCustOpen(false); setCustSearch('') }}
                          >
                            <span className="font-medium">{c.businessName}</span>
                            <span className="text-gray-400 text-xs ml-2 font-mono">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div>
              <Label>Data e Planifikuar *</Label>
              <input
                type="date"
                min={today}
                className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                value={planDate}
                onChange={e => setPlanDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Ora (opsionale)</Label>
              <input
                type="time"
                className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                value={planTime}
                onChange={e => setPlanTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Prioriteti</Label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                value={planPriority}
                onChange={e => setPlanPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH')}
              >
                <option value="LOW">E ulët</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">E lartë</option>
              </select>
            </div>
            <div>
              <Label>Shënime</Label>
              <Input
                placeholder="Qëllimi i vizitës..."
                className="mt-1 h-10"
                value={planNotes}
                onChange={e => setPlanNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowPlanForm(false)}>Anulo</Button>
            <Button loading={planSubmitting} onClick={handlePlan}>Planifiko Vizitën</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko klient ose agjent..."
            className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select
          className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
        >
          <option value="">Të gjitha statuset</option>
          <option value="PLANNED">Planifikuar</option>
          <option value="OPEN">Hapur</option>
          <option value="CLOSED">Mbyllur</option>
          <option value="MISSED">E humbur</option>
          <option value="CANCELLED">Anuluar</option>
        </select>
        <input
          type="date"
          className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1) }}
        />
        {date && (
          <Button variant="ghost" size="sm" onClick={() => setDate('')}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : visits.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <MapPin className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë vizitë</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kodi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Klienti</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Agjenti</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data / Ora</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statusi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">GPS</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{v.reference}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{v.customer.businessName}</div>
                      <div className="text-xs text-gray-400">{v.customer.code}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        {v.agent.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {v.scheduledDate ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-blue-500" />
                            <span className="text-blue-700 font-medium">
                              {new Date(v.scheduledDate).toLocaleDateString('sq-AL')}
                              {v.scheduledTime ? ` ${v.scheduledTime}` : ''}
                            </span>
                          </div>
                          {v.priority && v.priority !== 'NORMAL' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${PRIORITY_COLORS[v.priority]}`}>
                              {PRIORITY_LABELS[v.priority]}
                            </span>
                          )}
                        </div>
                      ) : v.openedAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(v.openedAt)}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                        v.status === 'CLOSED' ? 'bg-green-100 text-green-700' :
                        v.status === 'PLANNED' ? 'bg-blue-100 text-blue-700' :
                        v.status === 'MISSED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {v.openedLat ? (
                        <a
                          href={`https://www.google.com/maps?q=${v.openedLat},${v.openedLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3" />Harta
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {v.status === 'PLANNED' && (
                        <button
                          onClick={() => handleCancel(v.id)}
                          className="text-xs text-red-500 hover:underline flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />Anulo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Para
          </Button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Pas
          </Button>
        </div>
      )}
    </div>
  )
}
