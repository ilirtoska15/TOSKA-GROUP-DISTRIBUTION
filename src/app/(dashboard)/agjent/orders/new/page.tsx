'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, ShoppingCart, Search, X, Plus, Minus, Check, ZoomIn,
  AlertTriangle, Save, Send, Package,
  MapPin, Phone, Building2, CreditCard, Calendar, User, Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Unit = 'COPE' | 'PAKO'

interface Category { id: string; name: string }

interface Product {
  id: string
  code: string
  name: string
  photo: string
  salesPrice: number
  discountPercent?: number | null
  pakoCopje: number | null
  stockCopje: number
  status: string
  brand?: { name: string } | null
  category?: { id: string; name: string } | null
}

interface Customer {
  id: string
  code: string
  businessName: string
  status: string
}

interface CustomerDetail {
  id: string
  code: string
  businessName: string
  businessAddress: string
  city: string
  phone: string
  businessNumber: string | null
  vatNumber: string | null
  status: string
  debtLimit: number
  paymentTermDays: number
  currentDebt: number
  agent: { id: string; name: string } | null
  zone: { id: string; name: string } | null
  region: { id: string; name: string } | null
}

interface CartLine {
  productId: string
  unit: Unit
  quantity: number
}

const DRAFT_KEY = 'toska_order_draft'

function stockInUnit(p: Product, unit: Unit): number {
  if (unit === 'COPE') return p.stockCopje
  if (!p.pakoCopje) return 0
  return Math.floor(p.stockCopje / p.pakoCopje)
}

function finalUnitPrice(p: Product): number {
  const discount = p.discountPercent ?? 0
  return p.salesPrice * (1 - discount / 100)
}

function priceInUnit(p: Product, unit: Unit): number {
  const fp = finalUnitPrice(p)
  if (unit === 'COPE') return fp
  return fp * (p.pakoCopje ?? 1)
}

// ─── Customer Card ─────────────────────────────────────────────
function CustomerCard({
  customer,
  loading,
  onClear,
}: {
  customer: CustomerDetail | null
  loading: boolean
  onClear: () => void
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-4 space-y-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mt-1" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-2 bg-gray-100 rounded-full mt-2" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="bg-white rounded-2xl border p-4 flex items-center justify-between">
        <p className="text-sm text-red-500">Gabim gjatë ngarkimit të klientit</p>
        <button onClick={onClear} className="text-xs text-primary underline">Ndrysho</button>
      </div>
    )
  }

  const isBlocked = customer.status === 'BLOCKED'
  const ratio = customer.debtLimit > 0 ? customer.currentDebt / customer.debtLimit : 0
  const pct = Math.min(ratio * 100, 100)
  const barColor = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500'
  const debtTextColor = pct >= 80 ? 'text-red-600' : pct >= 50 ? 'text-amber-600' : 'text-green-600'

  const dash = (v: string | null | undefined) => v || '—'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${isBlocked ? 'border-red-200' : 'border-gray-200'}`}>
      {/* Header */}
      <div className={`flex items-start justify-between gap-2 px-4 pt-4 pb-3 ${isBlocked ? 'bg-red-50/60 rounded-t-2xl' : ''}`}>
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isBlocked ? 'bg-red-100' : 'bg-primary/10'}`}>
            <Store className={`h-5 w-5 ${isBlocked ? 'text-red-500' : 'text-primary'}`} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-base leading-tight truncate">{customer.businessName}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{customer.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isBlocked
              ? 'bg-red-100 text-red-700'
              : customer.status === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
          }`}>
            {isBlocked ? 'Bllokuar' : customer.status === 'ACTIVE' ? 'Aktiv' : 'Joaktiv'}
          </span>
        </div>
      </div>

      {/* Blocked warning */}
      {isBlocked && (
        <div className="mx-4 mb-3 flex items-start gap-2 bg-red-100 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Klienti është i bllokuar.</p>
            <p className="text-xs text-red-600">Nuk mund të krijohen porosi.</p>
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="px-4 pb-3 space-y-1.5">
        {customer.businessAddress && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600">
              {customer.businessAddress}{customer.city ? `, ${customer.city}` : ''}
              {customer.zone ? ` · ${customer.zone.name}` : ''}
            </p>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-600">{customer.phone}</p>
          </div>
        )}
        {customer.businessNumber && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-600">Nr Biznesit: {dash(customer.businessNumber)}</p>
          </div>
        )}
        {customer.agent && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-600">Agjenti: {customer.agent.name}</p>
          </div>
        )}
      </div>

      {/* Debt section */}
      <div className="mx-4 mb-3 bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Borxhi aktual</span>
          </div>
          <span className={`text-sm font-bold ${debtTextColor}`}>
            {formatCurrency(customer.currentDebt)}
          </span>
        </div>

        {customer.debtLimit > 0 && (
          <>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {formatCurrency(customer.currentDebt)} / {formatCurrency(customer.debtLimit)}
              </span>
              <span className="text-[10px] font-medium text-gray-500">{Math.round(pct)}%</span>
            </div>
            {pct >= 80 && (
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[11px] font-medium">Klienti po afrohet limitit të borxhit</p>
              </div>
            )}
          </>
        )}

        {customer.debtLimit === 0 && (
          <p className="text-xs text-gray-400">Limit: Pa limit</p>
        )}

        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Afati i pagesës: {customer.paymentTermDays} ditë</span>
        </div>
      </div>

      {/* Change button */}
      <div className="px-4 pb-4">
        <button
          onClick={onClear}
          className="w-full h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Ndrysho Klientin
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
export default function NewOrderPage() {
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [notes, setNotes] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [selectedImageProduct, setSelectedImageProduct] = useState<Product | null>(null)
  const [inputDraft, setInputDraft] = useState<Record<string, string>>({})
  const draftRestored = useRef(false)

  // Close image modal on ESC
  useEffect(() => {
    if (!selectedImageProduct) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedImageProduct(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedImageProduct])

  useEffect(() => {
    fetch('/api/customers?limit=500')
      .then(r => { if (!r.ok) throw new Error(`customers ${r.status}`); return r.json() })
      .then(d => setCustomers(d.customers ?? []))
      .catch(e => console.error('[orders/new] customers fetch:', e))
      .finally(() => setLoadingCustomers(false))
  }, [])

  useEffect(() => {
    fetch('/api/products?status=ACTIVE&limit=500')
      .then(r => r.json().catch(() => ({ products: [], total: 0 })))
      .then(d => setProducts(Array.isArray(d.products) ? d.products : []))
      .catch(e => { console.error('[orders/new] products fetch:', e); setProducts([]) })
      .finally(() => setLoadingProducts(false))
  }, [])

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  // Fetch full customer detail when selection changes
  useEffect(() => {
    if (!customerId) { setCustomerDetail(null); return }
    setLoadingDetail(true)
    fetch(`/api/customers/${customerId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setCustomerDetail(data))
      .catch(() => setCustomerDetail(null))
      .finally(() => setLoadingDetail(false))
  }, [customerId])

  useEffect(() => {
    if (loadingProducts || draftRestored.current) return
    draftRestored.current = true
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as { customerId?: string; notes?: string; lines?: CartLine[] }
      if (draft.customerId) setCustomerId(draft.customerId)
      if (draft.notes) setNotes(draft.notes)
      if (Array.isArray(draft.lines) && draft.lines.length > 0) {
        const productIds = new Set(products.map(p => p.id))
        const validLines = draft.lines.filter(l => productIds.has(l.productId))
        if (validLines.length > 0) {
          setCart(validLines)
          const unitMap: Record<string, Unit> = {}
          validLines.forEach(l => { unitMap[l.productId] = l.unit })
          setUnits(u => ({ ...u, ...unitMap }))
          toast.info('Draft i restauruar')
        }
      }
    } catch { /* ignore malformed draft */ }
  }, [loadingProducts, products])

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ customerId, notes, lines: cart }))
    } catch { /* storage full */ }
  }, [customerId, notes, cart])

  useEffect(() => { saveDraft() }, [saveDraft])

  const isBlocked = customerDetail?.status === 'BLOCKED'
  const getUnit = (productId: string, pakoCopje?: number | null): Unit =>
    units[productId] ?? (pakoCopje && pakoCopje > 1 ? 'PAKO' : 'COPE')

  function setUnit(productId: string, unit: Unit) {
    setUnits(u => ({ ...u, [productId]: unit }))
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  function getCartQty(productId: string): number {
    return cart.find(l => l.productId === productId)?.quantity ?? 0
  }

  function setQty(product: Product, qty: number) {
    const unit = getUnit(product.id, product.pakoCopje)
    const maxStock = stockInUnit(product, unit)
    const clamped = Math.max(0, Math.min(qty, maxStock))
    setCart(prev => {
      const rest = prev.filter(l => l.productId !== product.id)
      if (clamped === 0) return rest
      return [...rest, { productId: product.id, unit, quantity: clamped }]
    })
  }

  const cartTotal = cart.reduce((sum, line) => {
    const p = products.find(p => p.id === line.productId)
    if (!p) return sum
    return sum + priceInUnit(p, line.unit) * line.quantity
  }, 0)

  const cartSubtotal = cart.reduce((sum, line) => {
    const p = products.find(p => p.id === line.productId)
    if (!p) return sum
    const base = line.unit === 'COPE' ? p.salesPrice : p.salesPrice * (p.pakoCopje ?? 1)
    return sum + base * line.quantity
  }, 0)

  const cartDiscount = Math.max(0, cartSubtotal - cartTotal)

  const cartItemCount = cart.reduce((s, l) => s + l.quantity, 0)

  const filteredProducts = products.filter(p => {
    if (categoryId && p.category?.id !== categoryId) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.brand?.name ?? '').toLowerCase().includes(q)
    )
  })

  async function handleSubmit(status: 'DRAFT' | 'SUBMITTED') {
    if (!customerId) { toast.error('Zgjidh klientin'); return }
    if (cart.length === 0) { toast.error('Shporta është bosh'); return }

    setSubmitting(true)
    try {
      const lines = cart.map(line => ({
        productId: line.productId,
        unit: line.unit,
        quantity: line.quantity,
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, lines, notes, status }),
      })

      const data = await res.json().catch(() => ({ error: 'Server error' }))

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Gabim gjatë ruajtjes së porosisë')
        return
      }

      localStorage.removeItem(DRAFT_KEY)

      if (data.status === 'PRET_APROVIM') {
        toast.warning('Porosia u dërgua — pret aprovim nga administratori (klient me borxh të lartë)')
      } else if (status === 'SUBMITTED') {
        toast.success('Porosia u dërgua me sukses')
      } else {
        toast.success('Draft u ruajt')
      }

      router.push('/agjent/orders')
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/agjent/orders">
            <button className="p-2 rounded-xl hover:bg-gray-100 w-11 h-11 flex items-center justify-center">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          </Link>
          <h1 className="flex-1 font-semibold text-gray-900">Porosi e Re</h1>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative p-2 rounded-xl bg-primary text-white w-11 h-11 flex items-center justify-center"
          >
            <ShoppingCart className="h-5 w-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Cart Slide Panel ─── */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowCart(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full sm:max-w-[420px] bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="shrink-0 flex items-start justify-between px-4 py-3 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900 text-base">Shporta</h2>
                  <span className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full leading-none">
                    {cartItemCount} artikuj
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Rishiko porosinë para dërgimit</p>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 rounded-xl text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Product list ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <ShoppingCart className="h-8 w-8 text-gray-300" />
                  </div>
                  <p className="font-semibold text-gray-700">Shporta është bosh</p>
                  <p className="text-sm text-gray-400 mt-1 max-w-[200px]">
                    Shto produkte për të krijuar porosinë
                  </p>
                </div>
              ) : cart.map(line => {
                const p = products.find(p => p.id === line.productId)
                if (!p) return null
                const unitLabel = line.unit === 'PAKO' ? `Pako×${p.pakoCopje}` : 'Copë'
                const unitPrice = priceInUnit(p, line.unit)
                const lineTotal = unitPrice * line.quantity
                const lineMaxStock = stockInUnit(p, line.unit)
                const pDiscount = p.discountPercent ?? 0
                return (
                  <div key={line.productId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="flex gap-3 p-3">
                      {/* Photo */}
                      <div className="relative w-16 h-16 min-w-[64px] rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {p.photo ? (
                          <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="64px" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                        {pDiscount > 0 && (
                          <span className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">
                            -{pDiscount}%
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-[13px] leading-tight line-clamp-2">{p.name}</p>
                            {(p.category?.name || p.brand?.name) && (
                              <p className="text-[11px] text-gray-400 truncate">
                                {[p.category?.name, p.brand?.name].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => setQty(p, 0)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-red-50 active:bg-red-100 rounded-lg text-red-400 hover:text-red-600 shrink-0 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                            {unitLabel}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {line.quantity} × {formatCurrency(unitPrice)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-auto">
                          <span className="text-sm font-bold text-primary">{formatCurrency(lineTotal)}</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                              onClick={() => setQty(p, line.quantity - 1)}
                            >
                              <Minus className="h-3 w-3 text-gray-700" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-gray-900">{line.quantity}</span>
                            <button
                              className="w-7 h-7 rounded-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40"
                              onClick={() => setQty(p, line.quantity + 1)}
                              disabled={line.quantity >= lineMaxStock}
                            >
                              <Plus className="h-3 w-3 text-gray-700" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 border-t bg-white px-4 pt-4 space-y-3 cart-footer-pb">
              {/* Totals */}
              <div className="space-y-1.5">
                {cartDiscount > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Nëntotali</span>
                      <span className="text-gray-700">{formatCurrency(cartSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600 font-medium">Rabat</span>
                      <span className="text-green-600 font-semibold">−{formatCurrency(cartDiscount)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-base">Total</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
                </div>
              </div>

              {/* Notes */}
              <textarea
                placeholder="Shënime për porosinë..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowCart(false); handleSubmit('DRAFT') }}
                  disabled={submitting || !customerId || cart.length === 0}
                  className="gap-1.5 min-h-[44px]"
                >
                  <Save className="h-4 w-4" />
                  Ruaj Draft
                </Button>
                <Button
                  onClick={() => { setShowCart(false); handleSubmit('SUBMITTED') }}
                  disabled={submitting || !customerId || cart.length === 0 || isBlocked}
                  className="gap-1.5 min-h-[44px]"
                >
                  <Send className="h-4 w-4" />
                  Dërgo Porosinën
                </Button>
              </div>

              {isBlocked && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2.5 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Ky klient është bllokuar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <div className="flex-1 px-4 py-4 space-y-4 pb-28">

        {/* ─ Customer selector OR card ─ */}
        {!customerId ? (
          <div className="bg-white rounded-2xl border p-4 space-y-2">
            <label className="text-sm font-semibold text-gray-700">Klienti *</label>
            {loadingCustomers ? (
              <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <select
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
              >
                <option value="">— Zgjidh klientin —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id} disabled={c.status === 'BLOCKED'}>
                    {c.businessName} ({c.code}){c.status === 'BLOCKED' ? ' — BLLOKUAR' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <CustomerCard
            customer={customerDetail}
            loading={loadingDetail}
            onClear={() => { setCustomerId(''); setCustomerDetail(null) }}
          />
        )}

        {/* ─ Empty state when no customer ─ */}
        {!customerId && !loadingCustomers && (
          <div className="py-14 text-center bg-white rounded-2xl border">
            <Store className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">Zgjidh klientin për të vazhduar</p>
            <p className="text-xs text-gray-400 mt-1">Produktet do të shfaqen pas zgjedhjes</p>
          </div>
        )}

        {/* ─ Products section — only when customer selected ─ */}
        {customerId && !loadingDetail && (
          <>
            {/* Search + Category */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Kërko produkte..."
                  className="pl-9 bg-white h-11 rounded-xl border-gray-200"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {categories.length > 0 && (
                <select
                  className="h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white shrink-0 max-w-[140px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  <option value="">Të gjitha</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Product count row */}
            {!loadingProducts && (
              <div className="flex items-center justify-between px-0.5">
                <span className="text-sm font-semibold text-gray-700">Produkte</span>
                <span className="text-sm text-gray-400">{filteredProducts.length} produkte</span>
              </div>
            )}

            {/* ─── Product List ─── */}
            {loadingProducts ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-32 bg-white rounded-2xl border animate-pulse" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border">
                <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">Nuk u gjet asnjë produkt</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map(product => {
                  const unit = getUnit(product.id, product.pakoCopje)
                  const qty = getCartQty(product.id)
                  const maxStock = stockInUnit(product, unit)
                  const price = priceInUnit(product, unit)
                  const hasPako = !!product.pakoCopje && product.pakoCopje > 1
                  const inCart = qty > 0
                  const discount = product.discountPercent ?? 0
                  const oldPrice = unit === 'COPE'
                    ? product.salesPrice
                    : product.salesPrice * (product.pakoCopje ?? 1)

                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                        inCart ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200'
                      } ${maxStock === 0 ? 'opacity-60' : ''}`}
                    >
                      <div className="flex gap-2.5 p-3">

                        {/* ─ Photo 110×110 ─ */}
                        <div
                          className={`relative w-[110px] h-[110px] min-w-[110px] rounded-lg overflow-hidden bg-gray-100 ${product.photo ? 'cursor-pointer group' : ''}`}
                          onClick={() => product.photo && setSelectedImageProduct(product)}
                        >
                          {product.photo ? (
                            <>
                              <Image
                                src={product.photo}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="110px"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 group-active:bg-black/35 transition-colors flex items-center justify-center pointer-events-none">
                                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Package className="h-8 w-8 text-gray-300" />
                            </div>
                          )}
                          {discount > 0 && (
                            <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                              -{discount}%
                            </span>
                          )}
                        </div>

                        {/* ─ Info column ─ */}
                        <div className="flex-1 min-w-0 flex flex-col">

                          {/* Name */}
                          <p className="font-semibold text-gray-900 text-[13px] leading-tight line-clamp-2">
                            {product.name}
                          </p>

                          {/* Category · Brand */}
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            {[product.category?.name, product.brand?.name].filter(Boolean).join(' · ')}
                          </p>

                          {/* Stock badge + Copë/Pako toggle — same row */}
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            {maxStock === 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-red-500" />
                                Pa stok
                              </span>
                            ) : maxStock < 5 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-amber-500" />
                                {maxStock} {unit === 'COPE' ? 'copë' : 'pako'} ulët
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-green-500" />
                                {maxStock} {unit === 'COPE' ? 'copë' : 'pako'}
                              </span>
                            )}
                            {hasPako && (
                              <div className="flex rounded-md border border-gray-200 overflow-hidden shrink-0">
                                <button
                                  className={`px-1.5 h-[22px] text-[10px] font-semibold transition-colors ${
                                    unit === 'PAKO' ? 'bg-primary text-white' : 'text-gray-600 bg-white hover:bg-gray-50 active:bg-gray-100'
                                  }`}
                                  onClick={() => setUnit(product.id, 'PAKO')}
                                >
                                  Pako×{product.pakoCopje}
                                </button>
                                <button
                                  className={`px-1.5 h-[22px] text-[10px] font-semibold border-l border-gray-200 transition-colors ${
                                    unit === 'COPE' ? 'bg-primary text-white' : 'text-gray-600 bg-white hover:bg-gray-50 active:bg-gray-100'
                                  }`}
                                  onClick={() => setUnit(product.id, 'COPE')}
                                >
                                  Copë
                                </button>
                              </div>
                            )}
                          </div>

                          {/* ─ Bottom row: price left + action right ─ */}
                          <div className="flex items-center justify-between gap-1 mt-auto pt-1.5">

                            {/* Price */}
                            <div className="flex items-baseline gap-1 shrink-0">
                              <span className="text-sm font-bold text-primary">{formatCurrency(price)}</span>
                              {discount > 0 && (
                                <span className="text-[11px] text-gray-400 line-through">{formatCurrency(oldPrice)}</span>
                              )}
                            </div>

                            {/* Action — compact, right-aligned */}
                            {maxStock === 0 ? (
                              <span className="text-[11px] text-gray-400 font-medium shrink-0">Pa Stok</span>
                            ) : isBlocked ? (
                              <span className="text-[11px] text-red-400 font-medium shrink-0">Bllokuar</span>
                            ) : qty === 0 && !(product.id in inputDraft) ? (
                              <button
                                className="h-10 px-3 bg-primary text-white rounded-lg text-[13px] font-semibold flex items-center gap-1 shrink-0 hover:bg-primary/90 active:bg-primary/80 transition-colors"
                                onClick={() => setQty(product, 1)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Shto
                              </button>
                            ) : (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  className="w-9 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                  onClick={() => setQty(product, qty - 1)}
                                >
                                  <Minus className="h-3.5 w-3.5 text-gray-700" />
                                </button>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  min={1}
                                  max={maxStock}
                                  value={inputDraft[product.id] ?? String(qty)}
                                  onChange={e => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '')
                                    setInputDraft(prev => ({ ...prev, [product.id]: raw }))
                                    const n = parseInt(raw, 10)
                                    if (!isNaN(n) && n > 0) setQty(product, n)
                                  }}
                                  onBlur={() => {
                                    const raw = inputDraft[product.id]
                                    if (raw !== undefined) {
                                      const n = parseInt(raw, 10)
                                      setQty(product, (!raw || isNaN(n) || n < 1) ? 1 : n)
                                      setInputDraft(prev => {
                                        const next = { ...prev }
                                        delete next[product.id]
                                        return next
                                      })
                                    }
                                  }}
                                  className="w-9 min-h-[44px] text-center text-xs font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 mx-0.5"
                                />
                                <button
                                  className="w-9 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40"
                                  onClick={() => setQty(product, qty + 1)}
                                  disabled={qty >= maxStock}
                                >
                                  <Plus className="h-3.5 w-3.5 text-gray-700" />
                                </button>
                                <div className="w-9 h-10 rounded-lg bg-green-500 text-white flex items-center justify-center ml-0.5">
                                  <Check className="h-3.5 w-3.5" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Sticky Bottom Bar ─── */}
      {cart.length > 0 && (
        <div className="fixed order-bar-bottom left-0 right-0 z-20 bg-white border-t shadow-lg px-4 pt-3 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">
                {cartItemCount} artikuj · {cart.length} {cart.length === 1 ? 'produkt' : 'produkte'}
              </p>
              <p className="font-bold text-gray-900 text-base leading-tight">
                {formatCurrency(cartTotal)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleSubmit('DRAFT')}
              disabled={submitting || !customerId}
              className="gap-1.5 shrink-0 h-11 px-4"
            >
              <Save className="h-4 w-4" />
              Draft
            </Button>
            <Button
              onClick={() => handleSubmit('SUBMITTED')}
              disabled={submitting || !customerId || isBlocked}
              className="gap-1.5 shrink-0 h-11 px-4"
            >
              <Send className="h-4 w-4" />
              Dërgo
            </Button>
          </div>
        </div>
      )}

      {/* ─── Image Preview Modal ─── */}
      {selectedImageProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedImageProduct(null)}
        >
          <div
            className="relative flex flex-col items-center gap-3 max-w-[95vw]"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              className="absolute -top-3 -right-3 z-10 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors"
              onClick={() => setSelectedImageProduct(null)}
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>

            {/* Photo */}
            <div className="relative rounded-xl overflow-hidden bg-gray-900"
              style={{ width: 'min(95vw, 480px)', height: 'min(75vh, 480px)' }}
            >
              <Image
                src={selectedImageProduct.photo}
                alt={selectedImageProduct.name}
                fill
                className="object-contain"
                sizes="min(95vw, 480px)"
                priority
              />
            </div>

            {/* Product info */}
            <div className="text-center px-2 max-w-[min(95vw,480px)]">
              <p className="text-white font-semibold text-sm leading-snug line-clamp-2">
                {selectedImageProduct.name}
              </p>
              {(selectedImageProduct.category?.name || selectedImageProduct.brand?.name) && (
                <p className="text-white/60 text-xs mt-0.5">
                  {[selectedImageProduct.category?.name, selectedImageProduct.brand?.name].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
