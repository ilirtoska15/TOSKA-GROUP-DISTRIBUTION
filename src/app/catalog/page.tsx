'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { formatCurrency, debounce } from '@/lib/utils'
import Image from 'next/image'

interface Product {
  id: string
  name: string
  description?: string
  photo: string
  salesPrice?: number | null
  showPricePublic: boolean
  promotionActive: boolean
  promotionText?: string
  brand?: { name: string } | null
  category?: { name: string } | null
}

interface Category { id: string; name: string }
interface Brand { id: string; name: string }

export default function PublicCatalogPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ search, categoryId, brandId })
    const res = await fetch(`/api/catalog?${params}`)
    const data = await res.json()
    setProducts(data.products ?? [])
    setCategories(data.categories ?? [])
    setBrands(data.brands ?? [])
    setLoading(false)
  }, [search, categoryId, brandId])

  useEffect(() => { fetchCatalog() }, [fetchCatalog])
  const debouncedSearch = debounce((v: string) => setSearch(v), 400)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="font-black text-lg">TD</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">TOSKA DISTRIBUTION</h1>
              <p className="text-blue-100 text-sm">Katalog Produktesh</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Kërko produkt..."
              className="pl-9 bg-white"
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-40 bg-white">
                <SelectValue placeholder="Kategoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Të gjitha</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {brands.length > 0 && (
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-full sm:w-40 bg-white">
                <SelectValue placeholder="Brendi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Të gjitha</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <p className="text-sm text-gray-500">{products.length} produkte</p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">Nuk u gjet asnjë produkt</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="relative h-36 bg-gray-50">
                  <Image
                    src={p.photo}
                    alt={p.name}
                    fill
                    className="object-contain p-3"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.png' }}
                  />
                  {p.promotionActive && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                      PROMO
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                  {p.brand && <p className="text-xs text-gray-400 mt-0.5">{p.brand.name}</p>}
                  {p.category && <p className="text-xs text-gray-400">{p.category.name}</p>}
                  {p.promotionText && <p className="text-xs text-red-600 mt-1">{p.promotionText}</p>}
                  {p.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                  )}
                  {p.salesPrice != null && (
                    <p className="text-sm font-bold text-primary mt-2">{formatCurrency(p.salesPrice)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center py-6 text-xs text-gray-400">
        © TOSKA DISTRIBUTION — Katalog i vetëm për lexim
      </div>
    </div>
  )
}
