'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Return {
  id: string
  reference: string
  status: string
  notes?: string
  createdAt: string
  customer: { businessName: string }
  lines: { id: string; quantity: number; product: { name: string } }[]
}

interface Customer { id: string; businessName: string; code: string }
interface Product { id: string; name: string; code: string; salesPrice: number; pakoCopje?: number }

const STATUS_LABEL: Record<string, string> = { NE_PRITJE: 'Pret', APROVUAR: 'Aprovuar', REFUZUAR: 'Refuzuar', KTHYER_NE_DEPO: 'Magazinë' }
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'info'> = {
  NE_PRITJE: 'warning', APROVUAR: 'success', REFUZUAR: 'destructive', KTHYER_NE_DEPO: 'info',
}

export default function AgjentReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({ customerId: '', notes: '' })
  const [lines, setLines] = useState([{ productId: '', quantity: 1, unit: 'cope' }])
  const [submitting, setSubmitting] = useState(false)

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/returns?limit=30')
    const data = await res.json()
    setReturns(data.returns ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchReturns() }, [fetchReturns])

  useEffect(() => {
    if (showForm) {
      if (customers.length === 0) fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers ?? []))
      if (products.length === 0) fetch('/api/products?limit=200').then(r => r.json()).then(d => setProducts(d.products ?? []))
    }
  }, [showForm, customers.length, products.length])

  const addLine = () => setLines(prev => [...prev, { productId: '', quantity: 1, unit: 'cope' }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, key: string, value: string | number) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: value } : l))
  }

  const handleSubmit = async () => {
    if (!form.customerId) { toast.error('Zgjidh klientin'); return }
    if (lines.some(l => !l.productId || l.quantity <= 0)) { toast.error('Plotëso të gjitha linjat'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: form.customerId, notes: form.notes || undefined, lines }),
      })
      if (res.ok) {
        toast.success('Kthimi u regjistrua')
        setShowForm(false)
        setForm({ customerId: '', notes: '' })
        setLines([{ productId: '', quantity: 1, unit: 'cope' }])
        fetchReturns()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kthimet e Mia</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />Kthim i Ri
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Kthim i Ri</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Klienti *</Label>
              <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                <option value="">-- Zgjidh --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
            </div>
            <div>
              <Label>Shënim</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Arsyeja e kthimit (opsionale)..." />
            </div>
            <div className="space-y-2">
              <Label>Produktet</Label>
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="flex-1 h-9 px-2 rounded-lg border border-gray-200 text-sm bg-white text-xs"
                    value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)}>
                    <option value="">-- Zgjidh --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input type="number" min="1" className="w-20 h-9 text-sm" value={line.quantity}
                    onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
                  <select className="h-9 px-2 rounded-lg border border-gray-200 text-xs bg-white"
                    value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)}>
                    <option value="cope">Copë</option>
                    <option value="pako">Pako</option>
                  </select>
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3.5 w-3.5 mr-1" />Shto
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button size="sm" loading={submitting} onClick={handleSubmit}>Regjistro Kthimin</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : returns.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <RotateCcw className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë kthim</p>
          </div>
        ) : returns.map(r => (
          <div key={r.id} className="bg-white rounded-xl border p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-primary">{r.reference}</span>
                  <Badge variant={STATUS_VARIANT[r.status] ?? 'default'} className="text-xs">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <p className="font-medium text-gray-900">{r.customer.businessName}</p>
                <p className="text-xs text-gray-500">{r.notes} · {formatDate(r.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
