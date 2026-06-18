'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ShoppingCart, Plus, Minus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, debounce } from '@/lib/utils'
import { toast } from 'sonner'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Category { id: string; name: string }

interface Product {
  id: string
  code: string
  name: string
  photo: string
  salesPrice: number
  discountPercent?: number
  stockCopje: number
  pakoCopje?: number
  promotionActive: boolean
  promotionText?: string
  brand?: { name: string } | null
  category?: { name: string } | null
}

interface CartItem {
  productId: string
  name: string
  photo: string
  salesPrice: number
  discountPercent: number
  unit: 'COPE' | 'PAKO'
  quantity: number
  pakoCopje?: number
  stockCopje: number
}

interface CartStore {
  customerId: string
  items: CartItem[]
}

// Persist draft order to localStorage
const CART_KEY = 'toska_draft_cart'

function saveCart(cart: CartStore) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

function loadCart(): CartStore | null {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function finalPrice(salesPrice: number, discountPercent: number): number {
  return salesPrice * (1 - discountPercent / 100)
}

export default function AgentCatalogPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartStore>({ customerId: '', items: [] })
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<Record<string, 'COPE' | 'PAKO'>>({})
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const debouncedSearch = debounce((v: string) => setSearch(v), 400)

  useEffect(() => {
    const saved = loadCart()
    if (saved) setCart(saved)
  }, [])

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50', search })
      if (categoryId) params.set('categoryId', categoryId)
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }))
        console.error('[catalog] products fetch error:', err)
        setProducts([])
        return
      }
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch (e) {
      console.error('[catalog] products fetch failed:', e)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [search, categoryId])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const getUnit = (productId: string): 'COPE' | 'PAKO' => selectedUnit[productId] ?? 'COPE'
  const getQty = (productId: string): number => quantities[productId] ?? 1

  const addToCart = (product: Product) => {
    const unit = getUnit(product.id)
    const qty = getQty(product.id)

    if (unit === 'PAKO' && !product.pakoCopje) {
      toast.error('Ky produkt nuk ka Pako')
      return
    }

    const quantityCopje = unit === 'PAKO' ? qty * (product.pakoCopje ?? 1) : qty

    if (quantityCopje > product.stockCopje) {
      toast.error(`Stok i pamjaftueshëm. Disponibël: ${product.stockCopje} copë`)
      return
    }

    const discount = product.discountPercent ?? 0
    const updatedCart = { ...cart }
    const existing = updatedCart.items.findIndex((i) => i.productId === product.id && i.unit === unit)

    if (existing >= 0) {
      updatedCart.items[existing].quantity += qty
    } else {
      updatedCart.items.push({
        productId: product.id,
        name: product.name,
        photo: product.photo,
        salesPrice: product.salesPrice,
        discountPercent: discount,
        unit,
        quantity: qty,
        pakoCopje: product.pakoCopje,
        stockCopje: product.stockCopje,
      })
    }

    setCart(updatedCart)
    saveCart(updatedCart)
    toast.success(`${product.name} u shtua`, { duration: 1500 })
  }

  const removeFromCart = (index: number) => {
    const updated = { ...cart, items: cart.items.filter((_, i) => i !== index) }
    setCart(updated)
    saveCart(updated)
  }

  const cartTotal = cart.items.reduce((sum, item) => {
    const copje = item.unit === 'PAKO' ? item.quantity * (item.pakoCopje ?? 1) : item.quantity
    return sum + copje * finalPrice(item.salesPrice, item.discountPercent)
  }, 0)

  const saveOfflineOrder = async (payload: object) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('toska-offline', 1)
      req.onupgradeneeded = (e) => {
        const idb = (e.target as IDBOpenDBRequest).result
        if (!idb.objectStoreNames.contains('pendingOrders')) {
          idb.createObjectStore('pendingOrders', { keyPath: 'id' })
        }
      }
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
      req.onerror = () => reject(req.error)
    })
    const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pendingOrders', 'readwrite')
      tx.objectStore('pendingOrders').add({ id, data: payload, createdAt: new Date().toISOString() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready
      await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-orders').catch(() => null)
    }
    return id
  }

  const submitOrder = async () => {
    if (!cart.customerId) {
      toast.error('Zgjedh klientin para se të dërgosh porosinë')
      return
    }
    if (cart.items.length === 0) {
      toast.error('Shto produkte në porosi')
      return
    }

    setSubmitting(true)
    const payload = {
      customerId: cart.customerId,
      status: 'SUBMITTED',
      lines: cart.items.map((item) => ({
        productId: item.productId,
        unit: item.unit,
        quantity: item.quantity,
      })),
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim në dërgimin e porosisë')
        return
      }

      const order = await res.json()
      toast.success(`Porosi ${order.reference} u dërgua me sukses!`)
      localStorage.removeItem(CART_KEY)
      setCart({ customerId: '', items: [] })
      setCartOpen(false)
      router.push(`/agjent/orders`)
    } catch {
      // Network unavailable — save offline
      try {
        await saveOfflineOrder(payload)
        toast.warning('Pa lidhje interneti. Porosia u ruajt dhe do të dërgohet automatikisht kur të ktheheni online.', { duration: 6000 })
        localStorage.removeItem(CART_KEY)
        setCart({ customerId: '', items: [] })
        setCartOpen(false)
      } catch {
        toast.error('Gabim në ruajtjen offline të porosisë')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const saveDraft = async () => {
    if (!cart.customerId || cart.items.length === 0) {
      toast.error('Zgjedh klientin dhe shto produkte')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: cart.customerId,
          status: 'DRAFT',
          lines: cart.items.map((item) => ({
            productId: item.productId,
            unit: item.unit,
            quantity: item.quantity,
          })),
        }),
      })

      if (res.ok) {
        toast.success('Draft u ruajt')
        localStorage.removeItem(CART_KEY)
        setCart({ customerId: '', items: [] })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4 relative pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Katalogu</h1>
        <button
          onClick={() => setCartOpen(true)}
          className="relative p-2.5 bg-primary rounded-xl text-white"
        >
          <ShoppingCart className="h-5 w-5" />
          {cart.items.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">
              {cart.items.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko produktin..."
            className="pl-9 h-12 text-base"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="h-12 px-3 rounded-lg border border-gray-200 text-sm bg-white min-w-[130px]"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Të gjitha</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-56 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => {
            const unit = getUnit(p.id)
            const qty = getQty(p.id)
            const hasStock = p.stockCopje > 0
            const hasPako = !!p.pakoCopje
            const discount = p.discountPercent ?? 0
            const fp = finalPrice(p.salesPrice, discount)

            return (
              <div key={p.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${!hasStock ? 'opacity-60' : ''}`}>
                <div className="relative h-28 bg-gray-50">
                  <Image
                    src={p.photo}
                    alt={p.name}
                    fill
                    className="object-contain p-2"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }}
                  />
                  {p.promotionActive && (
                    <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">PROMO</span>
                  )}
                  {discount > 0 && (
                    <span className="absolute top-1 right-1 bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">-{discount}%</span>
                  )}
                  {!hasStock && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">Pa Stok</span>
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                    {p.category && <p className="text-[10px] text-blue-500">{p.category.name}</p>}
                    {p.brand && <p className="text-xs text-gray-400">{p.brand.name}</p>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-primary">{formatCurrency(fp)}</span>
                      {discount > 0 && (
                        <span className="text-[10px] text-gray-400 line-through ml-1">{formatCurrency(p.salesPrice)}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{p.stockCopje} copë</span>
                  </div>

                  {hasPako && (
                    <div className="flex gap-1">
                      {(['COPE', 'PAKO'] as const).map((u) => (
                        <button
                          key={u}
                          onClick={() => setSelectedUnit((prev) => ({ ...prev, [p.id]: u }))}
                          className={`flex-1 py-1 text-xs rounded-lg border font-medium transition-colors ${
                            unit === u ? 'bg-primary text-white border-primary' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantities((prev) => ({ ...prev, [p.id]: Math.max(1, getQty(p.id) - 1) }))}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <Input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="h-8 text-center text-sm px-1 flex-1"
                    />
                    <button
                      onClick={() => setQuantities((prev) => ({ ...prev, [p.id]: getQty(p.id) + 1 }))}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Button
                    className="w-full h-9 text-xs"
                    disabled={!hasStock}
                    onClick={() => addToCart(p)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Shto
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold">Porosia ({cart.items.length})</h2>
              <button onClick={() => setCartOpen(false)} className="p-2 -m-2 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            {/* Customer selector */}
            <div className="p-4 border-b">
              <CustomerSelector
                value={cart.customerId}
                onChange={(id) => { setCart((prev) => ({ ...prev, customerId: id })); saveCart({ ...cart, customerId: id }) }}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.items.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Nuk ka produkte</p>
              ) : (
                cart.items.map((item, i) => {
                  const fp = finalPrice(item.salesPrice, item.discountPercent)
                  const copje = item.unit === 'PAKO' ? item.quantity * (item.pakoCopje ?? 1) : item.quantity
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                      <div className="relative w-12 h-12 bg-gray-50 rounded-lg shrink-0">
                        <Image src={item.photo} alt={item.name} fill className="object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.quantity} {item.unit} × {formatCurrency(fp)}
                          {item.discountPercent > 0 && ` (-${item.discountPercent}%)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(fp * copje)}</p>
                        <button onClick={() => removeFromCart(i)} className="p-1.5 -m-1.5 text-red-400 hover:text-red-600 rounded-lg">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t p-4 space-y-3">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Totali</span>
                <span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={saveDraft} loading={submitting}>
                  Ruaj Draft
                </Button>
                <Button className="flex-1" onClick={submitOrder} loading={submitting}>
                  <Check className="h-4 w-4 mr-1" />
                  Dërgo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomerSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [customers, setCustomers] = useState<{ id: string; businessName: string; code: string }[]>([])

  useEffect(() => {
    fetch('/api/customers?limit=100')
      .then((r) => r.json())
      .then((data) => setCustomers(data.customers ?? []))
  }, [])

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">Klienti *</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder="Zgjedh klientin..." />
        </SelectTrigger>
        <SelectContent>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.businessName} <span className="text-gray-400 ml-1">({c.code})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
