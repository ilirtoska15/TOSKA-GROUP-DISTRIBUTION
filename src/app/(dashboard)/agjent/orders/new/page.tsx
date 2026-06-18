'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft, ShoppingCart, Search, X, Plus, Minus,
  AlertTriangle, Save, Send, Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Unit = 'COPE' | 'PAKO'

interface Product {
  id: string
  code: string
  name: string
  photo: string
  salesPrice: number
  pakoCopje: number | null
  stockCopje: number
  status: string
  brand?: { name: string } | null
  category?: { name: string } | null
}

interface Customer {
  id: string
  code: string
  businessName: string
  status: string
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

function priceInUnit(p: Product, unit: Unit): number {
  if (unit === 'COPE') return p.salesPrice
  return p.salesPrice * (p.pakoCopje ?? 1)
}


export default function NewOrderPage() {
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [notes, setNotes] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const draftRestored = useRef(false)

  // Load customers
  useEffect(() => {
    fetch('/api/customers?limit=500')
      .then(r => {
        if (!r.ok) throw new Error(`customers ${r.status}`)
        return r.json()
      })
      .then(d => setCustomers(d.customers ?? []))
      .catch(e => console.error('[orders/new] customers fetch:', e))
      .finally(() => setLoadingCustomers(false))
  }, [])

  // Load products
  useEffect(() => {
    fetch('/api/products?status=ACTIVE&limit=500')
      .then(r => {
        if (!r.ok) throw new Error(`products ${r.status}`)
        return r.json()
      })
      .then(d => setProducts(d.products ?? []))
      .catch(e => console.error('[orders/new] products fetch:', e))
      .finally(() => setLoadingProducts(false))
  }, [])

  // Restore draft once products are loaded
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

  // Autosave draft on change
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ customerId, notes, lines: cart }))
    } catch { /* storage full — ignore */ }
  }, [customerId, notes, cart])

  useEffect(() => { saveDraft() }, [saveDraft])

  const selectedCustomer = customers.find(c => c.id === customerId)

  const getUnit = (productId: string): Unit => units[productId] ?? 'COPE'

  function setUnit(productId: string, unit: Unit) {
    setUnits(u => ({ ...u, [productId]: unit }))
    // Reset qty in cart when switching unit to avoid over-stock
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  function getCartQty(productId: string): number {
    return cart.find(l => l.productId === productId)?.quantity ?? 0
  }

  function setQty(product: Product, qty: number) {
    const unit = getUnit(product.id)
    const maxStock = stockInUnit(product, unit)
    const clamped = Math.max(0, Math.min(qty, maxStock))
    setCart(prev => {
      const rest = prev.filter(l => l.productId !== product.id)
      if (clamped === 0) return rest
      return [...rest, { productId: product.id, unit, quantity: clamped }]
    })
  }

  const cartTotal = cart.reduce((sum, line) => {
    const product = products.find(p => p.id === line.productId)
    if (!product) return sum
    return sum + priceInUnit(product, line.unit) * line.quantity
  }, 0)

  const filteredProducts = products.filter(p => {
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
      // Send raw display quantity in selected unit.
      // Backend does the copje conversion and fetches prices from DB.
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
        toast.error(
          typeof data.error === 'string'
            ? data.error
            : 'Gabim gjatë ruajtjes së porosisë'
        )
        return
      }

      localStorage.removeItem(DRAFT_KEY)

      // API returns the order object directly (not wrapped in { order: ... })
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
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/agjent/orders">
            <button className="p-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Porosi e Re</h1>
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative p-2 rounded-xl bg-primary text-white"
          >
            <ShoppingCart className="h-5 w-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cart Panel */}
      {showCart && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setShowCart(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-900">Shporta ({cart.length})</h2>
              <button onClick={() => setShowCart(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Shporta është bosh</p>
              ) : cart.map(line => {
                const product = products.find(p => p.id === line.productId)
                if (!product) return null
                return (
                  <div key={line.productId} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {product.photo ? (
                        <Image src={product.photo} alt={product.name} fill className="object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-gray-400 m-2.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">
                        {line.quantity} {line.unit === 'COPE' ? 'copë' : 'pako'} × {formatCurrency(priceInUnit(product, line.unit))}
                      </p>
                      <p className="text-xs font-semibold text-primary">
                        {formatCurrency(priceInUnit(product, line.unit) * line.quantity)}
                      </p>
                    </div>
                    <button
                      onClick={() => setQty(product, 0)}
                      className="p-1 hover:bg-red-100 rounded-lg text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="border-t p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(cartTotal)}</span>
              </div>

              <textarea
                placeholder="Shënime për porosinë..."
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowCart(false); handleSubmit('DRAFT') }}
                  disabled={submitting || !customerId || cart.length === 0}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Ruaj Draft
                </Button>
                <Button
                  onClick={() => { setShowCart(false); handleSubmit('SUBMITTED') }}
                  disabled={submitting || !customerId || cart.length === 0 || selectedCustomer?.status === 'BLOCKED'}
                  className="gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  Dërgo
                </Button>
              </div>

              {selectedCustomer?.status === 'BLOCKED' && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Ky klient është bllokuar. Nuk mund të dërgosh porosi.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 space-y-4 pb-24">
        {/* Customer selector */}
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <label className="text-sm font-medium text-gray-700">Klienti *</label>
          {loadingCustomers ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
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
          {selectedCustomer?.status === 'BLOCKED' && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Klienti është bllokuar — porosia nuk mund të dërgohet
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko produkte..."
            className="pl-9 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Product grid */}
        {loadingProducts ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë produkt</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(product => {
              const unit = getUnit(product.id)
              const qty = getCartQty(product.id)
              const maxStock = stockInUnit(product, unit)
              const price = priceInUnit(product, unit)
              const hasPako = !!product.pakoCopje && product.pakoCopje > 1
              const inCart = qty > 0

              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl border overflow-hidden flex flex-col transition-all ${inCart ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'border-gray-200'}`}
                >
                  {/* Photo */}
                  <div className="relative aspect-square bg-gray-50">
                    {product.photo ? (
                      <Image
                        src={product.photo}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 200px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="h-10 w-10 text-gray-300" />
                      </div>
                    )}
                    {maxStock === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-xs font-bold bg-red-500 px-2 py-0.5 rounded">Pa Stok</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{product.name}</p>
                      {product.brand && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{product.brand.name}</p>
                      )}
                    </div>

                    {/* Unit toggle */}
                    {hasPako && (
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-medium">
                        <button
                          className={`flex-1 py-1 transition-colors ${unit === 'COPE' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                          onClick={() => setUnit(product.id, 'COPE')}
                        >
                          Cope
                        </button>
                        <button
                          className={`flex-1 py-1 transition-colors ${unit === 'PAKO' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                          onClick={() => setUnit(product.id, 'PAKO')}
                          disabled={maxStock === 0 && unit !== 'PAKO'}
                        >
                          Pako×{product.pakoCopje}
                        </button>
                      </div>
                    )}

                    {/* Price + stock */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{formatCurrency(price)}</span>
                      <span className={`text-[10px] ${maxStock === 0 ? 'text-red-500' : maxStock < 5 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {maxStock > 0 ? `${maxStock} ${unit === 'COPE' ? 'cp' : 'pk'}` : 'Pa stok'}
                      </span>
                    </div>

                    {/* Qty controls */}
                    {maxStock > 0 && (
                      qty === 0 ? (
                        <button
                          className="w-full bg-primary text-white rounded-lg py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
                          onClick={() => setQty(product, 1)}
                        >
                          <Plus className="h-3.5 w-3.5 inline mr-1" />
                          Shto
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            className="flex-none w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                            onClick={() => setQty(product, qty - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={maxStock}
                            value={qty}
                            onChange={e => setQty(product, parseInt(e.target.value) || 0)}
                            className="flex-1 h-8 text-center text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 w-0"
                          />
                          <button
                            className="flex-none w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                            onClick={() => setQty(product, qty + 1)}
                            disabled={qty >= maxStock}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar when cart has items */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t shadow-lg px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500">{cart.length} produkte</p>
            <p className="font-bold text-gray-900">{formatCurrency(cartTotal)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSubmit('DRAFT')}
            disabled={submitting || !customerId}
            className="gap-1.5 shrink-0"
          >
            <Save className="h-4 w-4" />
            Draft
          </Button>
          <Button
            size="sm"
            onClick={() => handleSubmit('SUBMITTED')}
            disabled={submitting || !customerId || selectedCustomer?.status === 'BLOCKED'}
            className="gap-1.5 shrink-0"
          >
            <Send className="h-4 w-4" />
            Dërgo
          </Button>
        </div>
      )}
    </div>
  )
}
