'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Globe, Phone, MapPin, X, Check, Ban, Search, Building2, Plus, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Item { productId: string; name: string; code?: string; unit: string; quantity: number; finalUnitPrice?: number; lineTotal?: number }
interface PublicRequest {
  id: string
  reference: string
  businessName: string
  contactName: string
  phone: string
  address: string
  city: string
  notes?: string | null
  items: Item[]
  totalAmount: number
  status: string
  orderId?: string | null
  customerId?: string | null
  reviewNote?: string | null
  createdAt: string
}

const STATUS_TABS = [
  { key: 'PENDING', label: 'Në pritje' },
  { key: 'APPROVED', label: 'Aprovuara' },
  { key: 'REJECTED', label: 'Refuzuara' },
  { key: '', label: 'Të gjitha' },
]

function statusBadge(s: string) {
  if (s === 'PENDING') return 'bg-amber-100 text-amber-700'
  if (s === 'APPROVED') return 'bg-green-100 text-green-700'
  return 'bg-red-100 text-red-700'
}
function statusLabel(s: string) {
  return s === 'PENDING' ? 'Në pritje' : s === 'APPROVED' ? 'Aprovuar' : 'Refuzuar'
}

export default function PublicOrdersPage() {
  const [requests, setRequests] = useState<PublicRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PublicRequest | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/public-orders?status=${statusFilter}&limit=50`)
      const data = await res.json()
      setRequests(data.requests ?? [])
      setPendingCount(data.pendingCount ?? 0)
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader title="Kërkesa Online" count={pendingCount} />

      {/* Status tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition-colors ${
              statusFilter === t.key ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
            {t.key === 'PENDING' && pendingCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Globe} title="Nuk ka kërkesa" description="Kërkesat nga katalogu publik shfaqen këtu" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.businessName}</p>
                  <p className="text-xs text-gray-400 font-mono">{r.reference}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadge(r.status)}`}>{statusLabel(r.status)}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-gray-500">{r.items?.length ?? 0} produkte</span>
                <span className="font-bold text-gray-900">{formatCurrency(r.totalAmount)}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(r.createdAt)}</p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ReviewModal request={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); fetchRequests() }} />
      )}
    </div>
  )
}

// ─── Review modal ──────────────────────────────────────────────
function ReviewModal({ request, onClose, onDone }: { request: PublicRequest; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'NEW' | 'LINK'>('NEW')
  const [reviewNote, setReviewNote] = useState('')
  const [busy, setBusy] = useState(false)

  // existing-customer picker
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; code: string; businessName: string; city?: string }[]>([])
  const [picked, setPicked] = useState<{ id: string; businessName: string } | null>(null)
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const isPending = request.status === 'PENDING'

  useEffect(() => {
    if (mode !== 'LINK') return
    const t = setTimeout(async () => {
      try {
        const url = search.trim()
          ? `/api/customers?search=${encodeURIComponent(search)}&topLevel=1&limit=20`
          : `/api/customers?topLevel=1&limit=20`
        const r = await fetch(url)
        const d = r.ok ? await r.json() : { customers: [] }
        setResults((d.customers ?? []).filter((c: { parentCustomerId?: string | null }) => !c.parentCustomerId))
      } catch { setResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [search, mode])

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  async function act(action: 'APPROVE' | 'REJECT') {
    if (action === 'APPROVE' && mode === 'LINK' && !picked) { toast.error('Zgjidh klientin ekzistues'); return }
    setBusy(true)
    try {
      const body: Record<string, unknown> = { action, reviewNote: reviewNote || undefined }
      if (action === 'APPROVE' && mode === 'LINK' && picked) body.customerId = picked.id
      const res = await fetch(`/api/admin/public-orders/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Gabim'); return }
      toast.success(action === 'APPROVE' ? `Aprovuar — porosi ${data.orderReference ?? ''}` : 'Kërkesa u refuzua')
      onDone()
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{request.businessName}</h2>
            <p className="text-xs text-gray-400 font-mono">{request.reference}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 shrink-0"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Contact */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Kontakti" value={request.contactName} />
            <Info label="Telefoni" value={request.phone} />
            <Info label="Qyteti" value={request.city} />
            <Info label="Adresa" value={request.address} />
          </div>
          {request.notes && <Info label="Shënime" value={request.notes} />}

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Produktet ({request.items?.length ?? 0})</p>
            <div className="border rounded-xl divide-y">
              {(request.items ?? []).map((it, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-gray-800">{it.name}</p>
                    <p className="text-[11px] text-gray-400">{it.quantity} {it.unit === 'PAKO' ? 'pako' : 'copë'}</p>
                  </div>
                  {it.lineTotal != null && <span className="text-gray-700 font-medium shrink-0">{formatCurrency(it.lineTotal)}</span>}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 font-bold text-gray-900">
              <span>Total</span><span className="text-primary">{formatCurrency(request.totalAmount)}</span>
            </div>
          </div>

          {/* If already processed */}
          {!isPending && (
            <div className={`rounded-xl p-3 text-sm ${statusBadge(request.status)}`}>
              <p className="font-semibold">{statusLabel(request.status)}</p>
              {request.reviewNote && <p className="text-xs mt-0.5">{request.reviewNote}</p>}
              {request.orderId && (
                <Link href={`/admin/orders/${request.orderId}`} className="text-xs underline mt-1 inline-flex items-center gap-1">
                  <ShoppingCart className="h-3 w-3" />Shiko porosinë
                </Link>
              )}
            </div>
          )}

          {/* Actions (only pending) */}
          {isPending && (
            <div className="space-y-3 pt-1">
              {/* Customer linking */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Klienti</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode('NEW')} className={`flex items-center gap-1.5 p-2.5 rounded-xl border-2 text-left text-xs font-semibold ${mode === 'NEW' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'}`}>
                    <Plus className="h-4 w-4" />Krijo klient të ri
                  </button>
                  <button onClick={() => setMode('LINK')} className={`flex items-center gap-1.5 p-2.5 rounded-xl border-2 text-left text-xs font-semibold ${mode === 'LINK' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600'}`}>
                    <Building2 className="h-4 w-4" />Lidh me ekzistues
                  </button>
                </div>

                {mode === 'NEW' && (
                  <p className="text-[11px] text-gray-400 mt-1.5">Do të krijohet klient i ri nga të dhënat e kërkesës.</p>
                )}

                {mode === 'LINK' && (
                  <div className="relative mt-2" ref={pickerRef}>
                    {picked ? (
                      <div className="flex items-center justify-between h-11 px-3 rounded-xl border border-primary bg-primary/5">
                        <span className="text-sm font-medium truncate">{picked.businessName}</span>
                        <button onClick={() => setPicked(null)}><X className="h-4 w-4 text-gray-400" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            placeholder="Kërko klient..."
                            className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
                            onFocus={() => setOpen(true)}
                          />
                        </div>
                        {open && (
                          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                            {results.length === 0 ? (
                              <div className="p-3 text-center text-sm text-gray-400">Nuk u gjet asnjë klient</div>
                            ) : results.map((c) => (
                              <button key={c.id} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0"
                                onClick={() => { setPicked({ id: c.id, businessName: c.businessName }); setOpen(false) }}>
                                <p className="text-sm font-medium truncate">{c.businessName}</p>
                                <p className="text-xs text-gray-400 font-mono">{c.code}{c.city ? ` · ${c.city}` : ''}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Shënim (opsional)</p>
                <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isPending && (
          <div className="border-t p-4 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => act('REJECT')} disabled={busy} className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5">
              <Ban className="h-4 w-4" />Refuzo
            </Button>
            <Button onClick={() => act('APPROVE')} disabled={busy} className="gap-1.5">
              <Check className="h-4 w-4" />Aprovo & Krijo Porosi
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}
