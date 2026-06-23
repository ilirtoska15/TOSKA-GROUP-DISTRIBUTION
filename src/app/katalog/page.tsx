'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import {
  Search, ShoppingCart, Plus, Minus, X, Package, Check, CheckCircle2, ArrowLeft, Store,
} from 'lucide-react'
import { formatCurrency, debounce } from '@/lib/utils'

type Unit = 'COPE' | 'PAKO'

interface Product {
  id: string
  code: string
  name: string
  description?: string | null
  photo: string
  pakoCopje?: number | null
  promotionActive?: boolean
  promotionText?: string | null
  brand?: { name: string } | null
  category?: { id: string; name: string } | null
  price: number | null
  discountPercent: number
  available: boolean
}
interface Category { id: string; name: string }
interface CartLine { productId: string; unit: Unit; quantity: number }

type View = 'catalog' | 'checkout' | 'success'

export default function PublicKatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [cart, setCart] = useState<CartLine[]>([])
  const [units, setUnits] = useState<Record<string, Unit>>({})
  const [showCart, setShowCart] = useState(false)
  const [view, setView] = useState<View>('catalog')

  // checkout form
  const [form, setForm] = useState({ businessName: '', contactName: '', phone: '', address: '', city: '', notes: '', website: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [successRef, setSuccessRef] = useState<string | null>(null)

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, categoryId })
      const res = await fetch(`/api/public/catalog?${params}`)
      const data = await res.json()
      setProducts(data.products ?? [])
      setCategories(data.categories ?? [])
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [search, categoryId])

  useEffect(() => { fetchCatalog() }, [fetchCatalog])
  const debouncedSearch = useMemo(() => debounce((v: string) => setSearch(v), 400), [])

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const getUnit = (p: Product): Unit => units[p.id] ?? (p.pakoCopje && p.pakoCopje > 1 ? 'PAKO' : 'COPE')
  const setUnit = (p: Product, u: Unit) => {
    setUnits((m) => ({ ...m, [p.id]: u }))
    setCart((prev) => prev.filter((l) => l.productId !== p.id))
  }
  const qtyOf = (id: string) => cart.find((l) => l.productId === id)?.quantity ?? 0
  const setQty = (p: Product, qty: number) => {
    const unit = getUnit(p)
    const clamped = Math.max(0, Math.min(qty, 9999))
    setCart((prev) => {
      const rest = prev.filter((l) => l.productId !== p.id)
      return clamped === 0 ? rest : [...rest, { productId: p.id, unit, quantity: clamped }]
    })
  }

  const priceInUnit = (p: Product, unit: Unit): number | null => {
    if (p.price == null) return null
    return unit === 'COPE' ? p.price : p.price * (p.pakoCopje ?? 1)
  }

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0)
  const cartTotal = cart.reduce((sum, l) => {
    const p = productMap.get(l.productId)
    if (!p) return sum
    const pr = priceInUnit(p, l.unit)
    return pr == null ? sum : sum + pr * l.quantity
  }, 0)
  const anyPrices = cart.some((l) => productMap.get(l.productId)?.price != null)

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (cart.length === 0) { setFormError('Shporta është bosh'); return }
    if (!form.businessName.trim() || !form.phone.trim() || !form.address.trim() || !form.contactName.trim() || !form.city.trim()) {
      setFormError('Plotësoni fushat e detyrueshme')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          notes: form.notes || undefined,
          website: form.website, // honeypot
          items: cart.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(data.error ?? 'Gabim gjatë dërgimit'); return }
      setSuccessRef(data.reference ?? null)
      setCart([])
      setView('success')
    } catch {
      setFormError('Gabim i papritur')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── SUCCESS ───
  if (view === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Porosia juaj u pranua</h1>
          <p className="text-sm text-gray-600">
            Ekipi i TOSKA DISTRIBUTION do t&apos;ju kontaktojë për konfirmim.
          </p>
          {successRef && <p className="text-xs text-gray-400 font-mono">Referenca: {successRef}</p>}
          <button
            onClick={() => { setView('catalog'); setForm({ businessName: '', contactName: '', phone: '', address: '', city: '', notes: '', website: '' }) }}
            className="mt-2 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90"
          >
            Kthehu te Katalogu
          </button>
        </div>
      </div>
    )
  }

  // ─── CHECKOUT ───
  if (view === 'checkout') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setView('catalog')} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="font-bold text-gray-900">Plotëso të dhënat</h1>
          </div>
        </div>

        <form onSubmit={submitOrder} className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {/* Cart summary */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">{cart.length} produkte · {cartCount} artikuj</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {cart.map((l) => {
                const p = productMap.get(l.productId)
                if (!p) return null
                return (
                  <div key={l.productId} className="flex justify-between text-xs text-gray-600">
                    <span className="truncate pr-2">{p.name} <span className="text-gray-400">×{l.quantity} {l.unit === 'PAKO' ? 'pako' : 'copë'}</span></span>
                  </div>
                )
              })}
            </div>
            {anyPrices && (
              <div className="flex justify-between mt-3 pt-3 border-t font-bold text-gray-900">
                <span>Total (orientues)</span><span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <Field label="Emri i Biznesit *"><input className={inputCls} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
            <Field label="Personi Kontaktues *"><input className={inputCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Telefoni *"><input className={inputCls} inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Adresa *"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Qyteti *"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Shënime"><textarea className={`${inputCls} h-20 resize-none`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            {/* Honeypot — hidden from humans */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="absolute left-[-9999px] w-px h-px opacity-0"
            />
          </div>

          {formError && <p className="text-sm text-red-600 text-center">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="h-5 w-5" />
            {submitting ? 'Duke dërguar...' : 'Dërgo Kërkesën'}
          </button>
        </form>
      </div>
    )
  }

  // ─── CATALOG ───
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><span className="font-black">TD</span></div>
            <div>
              <h1 className="text-lg font-bold">TOSKA DISTRIBUTION</h1>
              <p className="text-blue-100 text-xs">Katalog & Porosi Online</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Kërko produkt..."
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <Chip active={!categoryId} onClick={() => setCategoryId('')}>Të Gjitha</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}>{c.name}</Chip>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">{products.length} produkte</p>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-56 bg-gray-200 rounded-xl animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Nuk u gjet asnjë produkt</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => {
              const unit = getUnit(p)
              const qty = qtyOf(p.id)
              const hasPako = !!p.pakoCopje && p.pakoCopje > 1
              const pr = priceInUnit(p, unit)
              return (
                <div key={p.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col ${qty > 0 ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100'}`}>
                  <div className="relative h-32 bg-gray-50">
                    <Image src={p.photo} alt={p.name} fill className="object-contain p-2" sizes="200px"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }} />
                    {p.promotionActive && <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">PROMO</span>}
                    <span className={`absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${p.available ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                      {p.available ? 'Në dispozicion' : 'Pa stok'}
                    </span>
                  </div>
                  <div className="p-2.5 flex flex-col flex-1">
                    <p className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{[p.category?.name, p.brand?.name].filter(Boolean).join(' · ')}</p>

                    {hasPako && (
                      <div className="flex rounded-md border border-gray-200 overflow-hidden mt-1.5 self-start">
                        <button onClick={() => setUnit(p, 'PAKO')} className={`px-2 h-6 text-[10px] font-semibold ${unit === 'PAKO' ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>Pako×{p.pakoCopje}</button>
                        <button onClick={() => setUnit(p, 'COPE')} className={`px-2 h-6 text-[10px] font-semibold border-l ${unit === 'COPE' ? 'bg-primary text-white' : 'bg-white text-gray-600'}`}>Copë</button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1 mt-auto pt-2">
                      {pr != null ? (
                        <span className="text-sm font-bold text-primary">{formatCurrency(pr)}</span>
                      ) : <span className="text-[11px] text-gray-400">Çmimi me kërkesë</span>}

                      {qty === 0 ? (
                        <button onClick={() => setQty(p, 1)} className="h-8 px-2.5 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-primary/90">
                          <Plus className="h-3.5 w-3.5" />Shto
                        </button>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setQty(p, qty - 1)} className="w-7 h-8 rounded-lg border flex items-center justify-center"><Minus className="h-3.5 w-3.5 text-gray-700" /></button>
                          <span className="w-7 text-center text-xs font-bold">{qty}</span>
                          <button onClick={() => setQty(p, qty + 1)} className="w-7 h-8 rounded-lg border flex items-center justify-center"><Plus className="h-3.5 w-3.5 text-gray-700" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t shadow-lg px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">{cartCount} artikuj · {cart.length} produkte</p>
              {anyPrices && <p className="font-bold text-gray-900 leading-tight">{formatCurrency(cartTotal)}</p>}
            </div>
            <button onClick={() => setShowCart(true)} className="h-11 px-5 rounded-xl bg-primary text-white font-semibold flex items-center gap-2 hover:bg-primary/90">
              <ShoppingCart className="h-4 w-4" />Shporta
            </button>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowCart(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-white flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="font-bold text-gray-900">Shporta ({cart.length})</h2>
              <button onClick={() => setShowCart(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                  Shporta është bosh
                </div>
              ) : cart.map((l) => {
                const p = productMap.get(l.productId)
                if (!p) return null
                const pr = priceInUnit(p, l.unit)
                return (
                  <div key={l.productId} className="flex gap-3 border rounded-xl p-2.5">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {p.photo ? <Image src={p.photo} alt={p.name} fill className="object-cover" sizes="56px" /> : <Package className="h-5 w-5 text-gray-300 m-auto" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold line-clamp-2 leading-tight">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{l.unit === 'PAKO' ? `Pako×${p.pakoCopje}` : 'Copë'}{pr != null ? ` · ${formatCurrency(pr)}` : ''}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setQty(p, l.quantity - 1)} className="w-7 h-7 rounded-md border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                          <span className="w-7 text-center text-xs font-bold">{l.quantity}</span>
                          <button onClick={() => setQty(p, l.quantity + 1)} className="w-7 h-7 rounded-md border flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                        </div>
                        <button onClick={() => setQty(p, 0)} className="text-red-400 hover:text-red-600 p-1"><X className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t p-4 space-y-3">
              {anyPrices && (
                <div className="flex justify-between font-bold text-gray-900">
                  <span>Total (orientues)</span><span className="text-primary">{formatCurrency(cartTotal)}</span>
                </div>
              )}
              <button
                disabled={cart.length === 0}
                onClick={() => { setShowCart(false); setView('checkout') }}
                className="w-full h-12 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Store className="h-5 w-5" />Vazhdo me Kërkesën
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}
