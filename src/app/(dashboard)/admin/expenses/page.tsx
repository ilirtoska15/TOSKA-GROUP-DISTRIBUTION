'use client'

import { useState, useEffect, useCallback } from 'react'
import { Receipt, Plus, CheckCircle, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Expense {
  id: string
  code: string
  type: string
  amount: number
  description: string
  status: string
  receiptUrl?: string
  expenseDate: string
  requestedBy: { name: string }
  approvedBy?: { name: string } | null
}

const EXPENSE_TYPES = ['FUEL', 'MAINTENANCE', 'TOLL', 'ACCOMMODATION', 'FOOD', 'OTHER']
const TYPE_LABEL: Record<string, string> = {
  FUEL: 'Karburant', MAINTENANCE: 'Mirëmbajtje', TOLL: 'Taksa Rruge', ACCOMMODATION: 'Akomodim', FOOD: 'Ushqim', OTHER: 'Tjetër',
}
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'info'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive', PAID: 'info',
}

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'FUEL', amount: '', description: '', expenseDate: new Date().toISOString().slice(0, 10) })
  const [submitting, setSubmitting] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30', status })
    const res = await fetch(`/api/expenses?${params}`)
    const data = await res.json()
    setExpenses(data.expenses ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, status])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Shuma duhet të jetë pozitive'); return }
    if (!form.description.trim()) { toast.error('Shkruaj përshkrimin'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      if (res.ok) {
        toast.success('Shpenzimi u regjistrua')
        setShowForm(false)
        setForm({ type: 'FUEL', amount: '', description: '', expenseDate: new Date().toISOString().slice(0, 10) })
        fetchExpenses()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (id: string, newStatus: string) => {
    setProcessing(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(newStatus === 'APPROVED' ? 'Shpenzimi u aprovua' : 'Shpenzimi u refuzua')
        fetchExpenses()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setProcessing(null)
    }
  }

  const totalPages = Math.ceil(total / 30)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shpenzimet</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />Shpenzim i Ri
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Regjistro Shpenzim</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lloji</Label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {EXPENSE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div>
                <Label>Shuma (ALL) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label>Data e Shpenzimit</Label>
                <Input type="date" value={form.expenseDate}
                  onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Përshkrimi *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Përshkruaj shpenzimin..." />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button onClick={handleSubmit} loading={submitting}>Regjistro</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <select className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">Të gjitha statuset</option>
          <option value="PENDING">Pret</option>
          <option value="APPROVED">Aprovuar</option>
          <option value="REJECTED">Refuzuar</option>
          <option value="PAID">Paguar</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="divide-y">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse bg-gray-50" />)}</div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Receipt className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u regjistrua asnjë shpenzim</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kodi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Lloji</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Shuma</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kërkuesi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statusi</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{e.code}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[e.type] ?? e.type}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(e.expenseDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{e.requestedBy.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[e.status] ?? 'default'}>
                        {e.status === 'PENDING' ? 'Pret' : e.status === 'APPROVED' ? 'Aprovuar' : e.status === 'REJECTED' ? 'Refuzuar' : 'Paguar'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {e.status === 'PENDING' && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="success" loading={processing === e.id}
                            onClick={() => handleAction(e.id, 'APPROVED')}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="destructive" loading={processing === e.id}
                            onClick={() => handleAction(e.id, 'REJECTED')}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Para</Button>
          <span className="text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Pas</Button>
        </div>
      )}
    </div>
  )
}
