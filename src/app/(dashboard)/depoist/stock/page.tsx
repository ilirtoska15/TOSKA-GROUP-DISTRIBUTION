'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Search, AlertTriangle, TrendingDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

interface Product {
  id: string
  code: string
  name: string
  photo: string
  stockCopje: number
  pakoCopje?: number
  status: string
  category?: { name: string } | null
  brand?: { name: string } | null
}

export default function DepoistStockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ search, page: String(page), limit: '30' })
    const res = await fetch(`/api/products?${params}`)
    const data = await res.json()
    let all = data.products ?? []
    if (filter === 'out') all = all.filter((p: Product) => p.stockCopje <= 0)
    else if (filter === 'low') all = all.filter((p: Product) => p.stockCopje > 0 && p.stockCopje <= 20)
    setProducts(all)
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [search, filter, page])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const stockStatus = (stock: number) => {
    if (stock <= 0) return { label: 'Pa Stok', variant: 'destructive' as const }
    if (stock <= 20) return { label: 'Stok i Ulët', variant: 'warning' as const }
    return { label: 'Në Stok', variant: 'success' as const }
  }

  const outCount = products.filter(p => p.stockCopje <= 0).length
  const lowCount = products.filter(p => p.stockCopje > 0 && p.stockCopje <= 20).length

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stoku i Magazinës</h1>
        <p className="text-sm text-gray-500">{total} produkte gjithsej</p>
      </div>

      {(outCount > 0 || lowCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {outCount > 0 && <><strong>{outCount}</strong> produkte pa stok</>}
              {outCount > 0 && lowCount > 0 && ' · '}
              {lowCount > 0 && <><strong>{lowCount}</strong> me stok të ulët</>}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Kërko produkt..." className="pl-9"
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
          value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1) }}>
          <option value="all">Të gjitha</option>
          <option value="out">Pa Stok</option>
          <option value="low">Stok i Ulët</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)
        ) : products.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p>Nuk u gjet asnjë produkt</p>
          </div>
        ) : products.map(p => {
          const s = stockStatus(p.stockCopje)
          return (
            <div key={p.id} className="bg-white rounded-xl border p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {p.photo ? (
                  <Image src={p.photo} alt={p.name} width={48} height={48} className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 m-3 text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 font-mono">{p.code}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1 justify-end mb-0.5">
                  {p.stockCopje <= 20 && p.stockCopje > 0 && <TrendingDown className="h-3.5 w-3.5 text-amber-500" />}
                  <span className={`font-bold text-lg ${p.stockCopje <= 0 ? 'text-red-600' : p.stockCopje <= 20 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {p.stockCopje}
                  </span>
                  <span className="text-xs text-gray-400">copë</span>
                </div>
                {p.pakoCopje && (
                  <p className="text-xs text-gray-400">{Math.floor(p.stockCopje / p.pakoCopje)} pako</p>
                )}
              </div>
              <Badge variant={s.variant} className="text-xs flex-shrink-0">{s.label}</Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
