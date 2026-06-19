'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Package, Upload, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency, debounce } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Category { id: string; name: string }

interface Product {
  id: string
  code: string
  name: string
  photo: string
  salesPrice: number
  discountPercent?: number
  status: string
  stockCopje: number
  pakoCopje?: number
  promotionActive: boolean
  brand?: { name: string } | null
  category?: { name: string } | null
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [_viewMode, _setViewMode] = useState<'grid' | 'table'>('grid')

  // Quick stock adjustment state
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null)
  const [adjustStock, setAdjustStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  function openAdjust(p: Product) {
    setAdjustTarget(p)
    setAdjustStock(String(p.stockCopje))
    setAdjustReason('')
  }

  async function handleStockAdjust() {
    if (!adjustTarget) return
    const newStock = parseInt(adjustStock, 10)
    if (isNaN(newStock) || newStock < 0) {
      toast.error('Stoku i ri duhet të jetë numër i plotë jo negativ')
      return
    }
    if (adjustReason.trim().length < 3) {
      toast.error('Arsyeja duhet të ketë të paktën 3 karaktere')
      return
    }
    setAdjusting(true)
    try {
      const res = await fetch(`/api/products/${adjustTarget.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStock, reason: adjustReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gabim gjatë rregullimit'); return }
      if (data.diff === 0) {
        toast.info('Stoku është i njëjtë — nuk u bë asnjë ndryshim')
      } else {
        const sign = data.diff > 0 ? '+' : ''
        toast.success(`${adjustTarget.name}: ${data.previousStock} → ${data.newStock} (${sign}${data.diff})`)
        setProducts(prev => prev.map(p => p.id === adjustTarget.id ? { ...p, stockCopje: data.newStock } : p))
      }
      setAdjustTarget(null)
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setAdjusting(false)
    }
  }

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24', search })
      if (categoryId) params.set('categoryId', categoryId)
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) {
        console.error('[products] fetch error:', res.status)
        setProducts([])
        setTotal(0)
        return
      }
      const data = await res.json()
      setProducts(data.products ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      console.error('[products] fetch failed:', e)
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryId])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const debouncedSearch = debounce((value: string) => { setSearch(value); setPage(1) }, 400)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produktet</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products/import">
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importo Excel</span>
            </Button>
          </Link>
          <Link href="/admin/products/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Produkt i Ri</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Kërko emrin, kodin, barkodin..."
            className="pl-9"
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white min-w-[160px]"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}
          >
            <option value="">Të gjitha kategorit</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nuk u gjet asnjë produkt</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {products.map((p) => {
            const discount = p.discountPercent ?? 0
            const finalPrice = p.salesPrice * (1 - discount / 100)
            return (
              <div key={p.id} className="relative group">
                <Link href={`/admin/products/${p.id}`}>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative h-32 bg-gray-50">
                      <Image
                        src={p.photo}
                        alt={p.name}
                        fill
                        className="object-contain p-2"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }}
                      />
                      {p.promotionActive && (
                        <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          PROMO
                        </span>
                      )}
                      {discount > 0 && (
                        <span className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          -{discount}%
                        </span>
                      )}
                      {p.stockCopje === 0 && (
                        <span className="absolute bottom-1 right-1 bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          PA STOK
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 pb-1">
                      <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight mt-0.5">{p.name}</p>
                      {p.category && <p className="text-xs text-blue-500 mt-0.5">{p.category.name}</p>}
                      {p.brand && <p className="text-xs text-gray-400">{p.brand.name}</p>}
                      <div className="flex items-center justify-between mt-2 mb-2">
                        <div>
                          {discount > 0 ? (
                            <>
                              <span className="text-sm font-bold text-primary">{formatCurrency(finalPrice)}</span>
                              <span className="text-[10px] text-gray-400 line-through ml-1">{formatCurrency(p.salesPrice)}</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-primary">{formatCurrency(p.salesPrice)}</span>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${p.stockCopje < 20 ? 'text-red-500' : 'text-green-600'}`}>
                          {p.stockCopje} copë
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
                {/* Quick stock adjust button */}
                <button
                  onClick={(e) => { e.preventDefault(); openAdjust(p) }}
                  className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 h-7 bg-primary/90 text-white text-[10px] font-semibold rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Ndrysho Stokun"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Ndrysho Stokun
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {Math.ceil(total / 24) > 1 && (
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Para
          </Button>
          <span className="flex items-center text-sm text-gray-500">Faqja {page} / {Math.ceil(total / 24)}</span>
          <Button variant="outline" onClick={() => setPage((p) => Math.min(Math.ceil(total / 24), p + 1))} disabled={page === Math.ceil(total / 24)}>
            Pas
          </Button>
        </div>
      )}

      {/* Quick stock adjust dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(open) => { if (!open) setAdjustTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ndrysho Stokun</DialogTitle>
          </DialogHeader>
          {adjustTarget && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{adjustTarget.name}</span>
                <span className="text-xs text-gray-400 font-mono ml-2">{adjustTarget.code}</span>
              </p>
              <p className="text-sm text-gray-500">
                Stok aktual: <span className={`font-bold ${adjustTarget.stockCopje < 20 ? 'text-red-600' : 'text-green-700'}`}>{adjustTarget.stockCopje} copë</span>
              </p>
              <div>
                <Label htmlFor="adj-stock">Stoku i Ri (copë)</Label>
                <Input
                  id="adj-stock"
                  type="number"
                  min="0"
                  value={adjustStock}
                  onChange={(e) => setAdjustStock(e.target.value)}
                  className="mt-1 h-11 rounded-xl"
                  autoFocus
                />
                {adjustStock !== '' && !isNaN(parseInt(adjustStock)) && (
                  <p className="text-xs mt-1 font-medium">
                    {parseInt(adjustStock) > adjustTarget.stockCopje
                      ? <span className="text-green-600">+{parseInt(adjustStock) - adjustTarget.stockCopje} copë</span>
                      : parseInt(adjustStock) < adjustTarget.stockCopje
                        ? <span className="text-red-600">{parseInt(adjustStock) - adjustTarget.stockCopje} copë</span>
                        : <span className="text-gray-400">Pa ndryshim</span>
                    }
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="adj-reason">Arsyeja *</Label>
                <Input
                  id="adj-reason"
                  placeholder="p.sh. inventar, korrigjim, dëmtim..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="mt-1 h-11 rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Anulo</Button>
            <Button onClick={handleStockAdjust} loading={adjusting}>Ruaj Stokun</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
