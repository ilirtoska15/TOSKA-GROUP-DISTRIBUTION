'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { formatCurrency, debounce } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'

interface Product {
  id: string
  code: string
  name: string
  photo: string
  salesPrice: number
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
  const [loading, setLoading] = useState(true)
  const [_viewMode, _setViewMode] = useState<'grid' | 'table'>('grid')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '24', search })
    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()
    setProducts(data.products)
    setTotal(data.total)
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const debouncedSearch = debounce((value: string) => { setSearch(value); setPage(1) }, 400)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produktet</h1>
          <p className="text-sm text-gray-500">{total} gjithsej</p>
        </div>
        <Link href="/admin/products/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Produkt i Ri</span>
          </Button>
        </Link>
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
          {products.map((p) => (
            <Link key={p.id} href={`/admin/products/${p.id}`}>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
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
                  {p.stockCopje === 0 && (
                    <span className="absolute top-2 right-2 bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      PA STOK
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight mt-0.5">{p.name}</p>
                  {p.brand && <p className="text-xs text-gray-400 mt-0.5">{p.brand.name}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-primary">{formatCurrency(p.salesPrice)}</span>
                    <span className={`text-xs font-medium ${p.stockCopje < 20 ? 'text-red-500' : 'text-green-600'}`}>
                      {p.stockCopje} copë
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
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
    </div>
  )
}
