'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Payment {
  id: string
  code: string
  amount: number
  method: string
  createdAt: string
  customer: { name: string; code: string }
  order?: { code: string } | null
}

interface Customer { id: string; name: string; code: string }

const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', BANK: 'Bankë', CHECK: 'Çek', OTHER: 'Tjetër' }

export default function AgjentPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState({ customerId: '', amount: '', method: 'CASH', note: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    const res = await fetch(`/api/payments?${params}`)
    const data = await res.json()
    setPayments(data.payments ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  useEffect(() => {
    if (showForm && customers.length === 0) {
      fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers ?? []))
    }
  }, [showForm, customers.length])

  const handleSubmit = async () => {
    if (!form.customerId) { toast.error('Zgjidh klientin'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Shuma duhet të jetë pozitive'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: form.customerId, amount: Number(form.amount), method: form.method, note: form.note || undefined }),
      })
      if (res.ok) {
        toast.success('Pagesa u regjistrua')
        setShowForm(false)
        setForm({ customerId: '', amount: '', method: 'CASH', note: '' })
        fetchPayments()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pagesat e Mia</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />Regjistro Pagesë
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pagesë e Re</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Klienti *</Label>
              <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                <option value="">-- Zgjidh --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Shuma (ALL) *</Label>
                <Input type="number" min="0.01" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label>Mënyra</Label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë</option>
                  <option value="CHECK">Çek</option>
                  <option value="OTHER">Tjetër</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Shënim</Label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Opsional..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button size="sm" loading={submitting} onClick={handleSubmit}>Regjistro</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : payments.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <Wallet className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë pagesë</p>
          </div>
        ) : payments.map(p => (
          <div key={p.id} className="bg-white rounded-xl border p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-primary">{p.code}</span>
                  <Badge variant="outline" className="text-xs">{METHOD_LABEL[p.method] ?? p.method}</Badge>
                </div>
                <p className="font-medium text-gray-900">{p.customer.name}</p>
                <p className="text-xs text-gray-500">{formatDate(p.createdAt)}</p>
              </div>
              <p className="font-bold text-green-600">{formatCurrency(p.amount)}</p>
            </div>
          </div>
        ))}
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
