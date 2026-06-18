'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface DamageLine { id: string; quantity: number; product: { name: string; code: string } }
interface Damage {
  id: string
  code: string
  reason: string
  createdAt: string
  damagedBy: { name: string }
  damageLines: DamageLine[]
}
interface Product { id: string; name: string; code: string }
interface NewLine { productId: string; quantity: number; unit: string }

export default function DepoistDamagePage() {
  const [damages, setDamages] = useState<Damage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<NewLine[]>([{ productId: '', quantity: 1, unit: 'cope' }])
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)

  const fetchDamages = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    const res = await fetch(`/api/damage?${params}`)
    const data = await res.json()
    setDamages(data.damages ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { fetchDamages() }, [fetchDamages])

  useEffect(() => {
    if (showForm && products.length === 0) {
      fetch('/api/products?limit=200').then(r => r.json()).then(d => setProducts(d.products ?? []))
    }
  }, [showForm, products.length])

  const addLine = () => setLines(prev => [...prev, { productId: '', quantity: 1, unit: 'cope' }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))
  const updateLine = (i: number, key: keyof NewLine, value: string | number) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [key]: value } : l))
  }

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('Shkruaj arsyen e dëmtimit'); return }
    if (lines.some(l => !l.productId || l.quantity <= 0)) { toast.error('Plotëso të gjitha linjat'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/damage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, lines }),
      })
      if (res.ok) {
        toast.success('Dëmtimi u regjistrua — stoku u zbritur')
        setShowForm(false)
        setReason('')
        setLines([{ productId: '', quantity: 1, unit: 'cope' }])
        fetchDamages()
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
          <h1 className="text-xl font-bold text-gray-900">Dëmtimet</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />Regjistro Dëmtim
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Dëmtim i Ri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Arsyeja *</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Arsyeja e dëmtimit..." />
            </div>
            <div className="space-y-2">
              <Label>Produktet e Dëmtuara</Label>
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                    value={line.productId} onChange={e => updateLine(i, 'productId', e.target.value)}>
                    <option value="">-- Zgjidh produkt --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input type="number" min="1" className="w-24" value={line.quantity}
                    onChange={e => updateLine(i, 'quantity', Number(e.target.value))} />
                  <select className="h-10 px-2 rounded-lg border border-gray-200 text-sm bg-white"
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
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Anulo</Button>
              <Button onClick={handleSubmit} loading={submitting}>Regjistro Dëmtimin</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : damages.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u regjistrua asnjë dëmtim</p>
          </div>
        ) : damages.map(d => (
          <div key={d.id} className="bg-white rounded-xl border p-3">
            <div className="flex items-start gap-2 mb-1.5">
              <span className="font-mono text-xs text-primary">{d.code}</span>
              <span className="text-xs text-gray-400">• {d.damagedBy.name} • {formatDate(d.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{d.reason}</p>
            <div className="flex flex-wrap gap-1.5">
              {d.damageLines.map(l => (
                <Badge key={l.id} variant="destructive" className="text-xs">
                  {l.product.name} × {l.quantity}
                </Badge>
              ))}
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
