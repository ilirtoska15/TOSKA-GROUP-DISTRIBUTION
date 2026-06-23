'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Package, Save, ToggleLeft, ToggleRight, TrendingUp, TrendingDown, Minus as MinusIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatDate, formatNumber } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  name: z.string().min(2, 'Emri duhet të jetë të paktën 2 karaktere'),
  code: z.string().min(1, 'Kodi i produktit kërkohet').max(50, 'Kodi është shumë i gjatë'),
  photo: z.string().min(1, 'Foto e produktit është e detyrueshme'),
  salesPrice: z.coerce.number().min(0.01, 'Çmimi duhet të jetë pozitiv'),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  pakoCopje: z.coerce.number().int().min(1).optional().or(z.literal('')),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  expiryDate: z.string().optional(),
  lotNumber: z.string().optional(),
  promotionActive: z.boolean().default(false),
  promotionText: z.string().optional(),
  showPricePublic: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

type FormData = z.infer<typeof schema>

interface Category { id: string; name: string }
interface Brand { id: string; name: string }
interface StockMovement { id: string; type: string; quantityCopje: number; reason?: string | null; reference?: string | null; createdAt: string }

interface Product {
  id: string
  code: string
  name: string
  photo: string
  salesPrice: number
  discountPercent: number
  status: string
  pakoCopje?: number | null
  barcode?: string | null
  description?: string | null
  expiryDate?: string | null
  lotNumber?: string | null
  promotionActive: boolean
  promotionText?: string | null
  showPricePublic: boolean
  categoryId?: string | null
  brandId?: string | null
  brand?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  stockCopje: number
  stockMovements: StockMovement[]
  createdAt: string
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wasNotFound, setWasNotFound] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [adjustStock, setAdjustStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { promotionActive: false, showPricePublic: false, status: 'ACTIVE' },
  })

  const promotionActive = watch('promotionActive')
  const currentStatus = watch('status')

  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : r.status === 404 ? null : Promise.reject(r)),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/brands').then(r => r.json()),
    ])
      .then(([prod, cats, brs]) => {
        if (!prod) { setWasNotFound(true); return }
        setProduct(prod)
        setPhotoUrl(prod.photo)
        setCategories(cats)
        setBrands(brs)
        reset({
          name: prod.name,
          code: prod.code,
          photo: prod.photo,
          salesPrice: prod.salesPrice,
          discountPercent: prod.discountPercent ?? 0,
          pakoCopje: prod.pakoCopje ?? '',
          barcode: prod.barcode ?? '',
          description: prod.description ?? '',
          categoryId: prod.categoryId ?? '',
          brandId: prod.brandId ?? '',
          expiryDate: prod.expiryDate ? prod.expiryDate.split('T')[0] : '',
          lotNumber: prod.lotNumber ?? '',
          promotionActive: prod.promotionActive,
          promotionText: prod.promotionText ?? '',
          showPricePublic: prod.showPricePublic,
          status: prod.status as 'ACTIVE' | 'INACTIVE',
        })
      })
      .catch(() => toast.error('Gabim në ngarkimin e produktit'))
      .finally(() => setLoading(false))
  }, [id, reset])

  if (wasNotFound) notFound()

  const handlePhotoChange = (url: string) => {
    setPhotoUrl(url)
    setValue('photo', url, { shouldValidate: true })
  }

  const onSubmit = async (data: FormData) => {
    if (!photoUrl) {
      toast.error('Foto e produktit është e detyrueshme')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: data.name,
        code: data.code.trim(),
        photo: photoUrl,
        salesPrice: Number(data.salesPrice),
        discountPercent: Number(data.discountPercent ?? 0),
        pakoCopje: data.pakoCopje ? Number(data.pakoCopje) : null,
        barcode: data.barcode || null,
        description: data.description || null,
        categoryId: data.categoryId || null,
        brandId: data.brandId || null,
        expiryDate: data.expiryDate || null,
        lotNumber: data.lotNumber || null,
        promotionActive: data.promotionActive,
        promotionText: data.promotionText || null,
        showPricePublic: data.showPricePublic,
        status: data.status,
      }
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(Array.isArray(err.error) ? err.error[0]?.message : (err.error ?? 'Gabim'))
        return
      }
      const updated = await res.json()
      setProduct(prev => prev ? { ...prev, ...updated } : null)
      toast.success('Produkti u ndryshua')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function reloadProduct() {
    try {
      const prod = await fetch(`/api/products/${id}`).then(r => r.json())
      setProduct(prod)
    } catch { /* noop */ }
  }

  async function handleStockAdjust() {
    const newStockNum = parseInt(adjustStock, 10)
    if (isNaN(newStockNum) || newStockNum < 0) {
      toast.error('Stoku i ri duhet të jetë numër i plotë jo negativ')
      return
    }
    if (adjustReason.trim().length < 3) {
      toast.error('Arsyeja duhet të ketë të paktën 3 karaktere')
      return
    }

    setAdjusting(true)
    try {
      const res = await fetch(`/api/products/${id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStock: newStockNum, reason: adjustReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Gabim gjatë rregullimit të stokut')
        return
      }
      if (data.diff === 0) {
        toast.info(data.message)
        return
      }
      const sign = data.diff > 0 ? '+' : ''
      toast.success(`Stoku u rregullua: ${data.previousStock} → ${data.newStock} (${sign}${data.diff})`)
      setAdjustStock('')
      setAdjustReason('')
      await reloadProduct()
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setAdjusting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!product) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/products">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">{product.name}</h1>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{product.code}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={product.status === 'ACTIVE' ? 'success' : 'secondary'}>
            {product.status === 'ACTIVE' ? 'Aktiv' : 'Joaktiv'}
          </Badge>
          <span className="text-sm font-semibold text-gray-700">
            Stok: {formatNumber(product.stockCopje)} copë
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Photo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto e Produktit *</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload value={photoUrl} onChange={handlePhotoChange} required />
            {errors.photo && <p className="text-xs text-red-500 mt-1">{errors.photo.message}</p>}
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informacioni Bazë</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="code">Kodi i Produktit *</Label>
              <Input id="code" {...register('code')} placeholder="PR000001" />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <Label htmlFor="name">Emri i Produktit *</Label>
              <Input id="name" {...register('name')} placeholder="Emri i produktit" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="categoryId">Kategoria</Label>
                <select
                  id="categoryId"
                  {...register('categoryId')}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Zgjidh Kategorinë --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="brandId">Brandi</Label>
                <select
                  id="brandId"
                  {...register('brandId')}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Zgjidh Brandin --</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Përshkrimi</Label>
              <Textarea id="description" {...register('description')} rows={3} placeholder="Përshkrimi i produktit (opsional)" />
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Units */}
        <Card>
          <CardHeader><CardTitle className="text-base">Çmimi dhe Njësia</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salesPrice">Çmimi i Shitjes *</Label>
                <Input id="salesPrice" type="number" step="0.01" min="0" {...register('salesPrice')} />
                {errors.salesPrice && <p className="text-xs text-red-500 mt-1">{errors.salesPrice.message}</p>}
              </div>
              <div>
                <Label htmlFor="discountPercent">Rabat % (Zbritje)</Label>
                <Input id="discountPercent" type="number" step="0.1" min="0" max="100" {...register('discountPercent')} placeholder="0" />
                {errors.discountPercent && <p className="text-xs text-red-500 mt-1">{errors.discountPercent.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pakoCopje">Copë për Pako</Label>
                <Input id="pakoCopje" type="number" min="1" {...register('pakoCopje')} placeholder="Lër bosh nëse vetëm copë" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="barcode">Barkodi</Label>
                <Input id="barcode" {...register('barcode')} placeholder="EAN / ISBN / kod tjetër" />
              </div>
              <div>
                <Label htmlFor="lotNumber">Numri i Lotit</Label>
                <Input id="lotNumber" {...register('lotNumber')} placeholder="Opsional" />
              </div>
            </div>
            <div>
              <Label htmlFor="expiryDate">Data e Skadencës</Label>
              <Input id="expiryDate" type="date" {...register('expiryDate')} />
            </div>
          </CardContent>
        </Card>

        {/* Promotion & Visibility */}
        <Card>
          <CardHeader><CardTitle className="text-base">Promovimi dhe Dukshmëria</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register('promotionActive')} className="w-4 h-4 rounded accent-primary" />
              <span className="text-sm font-medium text-gray-700">Produkti është në promovim</span>
            </label>
            {promotionActive && (
              <div>
                <Label htmlFor="promotionText">Teksti i Promovimit</Label>
                <Input id="promotionText" {...register('promotionText')} placeholder="p.sh. -20% këtë javë" />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register('showPricePublic')} className="w-4 h-4 rounded accent-primary" />
              <span className="text-sm font-medium text-gray-700">Shfaq çmimin në katalogun publik</span>
            </label>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Statusi i Produktit</CardTitle></CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => setValue('status', currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', { shouldDirty: true })}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors w-full text-left ${
                currentStatus === 'ACTIVE'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {currentStatus === 'ACTIVE' ? (
                <ToggleRight className="h-5 w-5 text-green-600" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {currentStatus === 'ACTIVE' ? 'Aktiv — mund të porositet' : 'Joaktiv — nuk mund të porositet'}
                </p>
                <p className="text-xs opacity-70">Kliko për të ndryshuar</p>
              </div>
            </button>
            <input type="hidden" {...register('status')} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-4">
          <Link href="/admin/products">
            <Button type="button" variant="outline">Anulo</Button>
          </Link>
          <Button type="submit" loading={saving} disabled={saving || !photoUrl}>
            <Save className="h-4 w-4 mr-1.5" />
            Ruaj Ndryshimet
          </Button>
        </div>
      </form>

      {/* ─── Stock Adjustment ─── */}
      {(() => {
        const newStockNum = parseInt(adjustStock, 10)
        const diff = !isNaN(newStockNum) && adjustStock !== '' ? newStockNum - product.stockCopje : null
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Rregullo Stokun</CardTitle>
                <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  Aktual: {formatNumber(product.stockCopje)} copë
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adj-stock">Stoku i Ri (copë) *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="adj-stock"
                      type="number"
                      min={0}
                      step={1}
                      placeholder={String(product.stockCopje)}
                      value={adjustStock}
                      onChange={e => setAdjustStock(e.target.value)}
                    />
                    {diff !== null && diff !== 0 && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                    {diff === 0 && adjustStock !== '' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">=</span>
                    )}
                  </div>
                  {diff !== null && diff !== 0 && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {diff > 0
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {diff > 0 ? `Shton +${diff} copë` : `Zbret ${diff} copë`}
                    </p>
                  )}
                  {diff === 0 && adjustStock !== '' && (
                    <p className="text-xs mt-1 text-gray-400 flex items-center gap-1">
                      <MinusIcon className="h-3 w-3" />
                      Asnjë ndryshim
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="adj-reason">Arsyeja e Ndryshimit *</Label>
                  <Input
                    id="adj-reason"
                    className="mt-1"
                    placeholder="p.sh. Inventarizim fizik, Gabim hyrjeje..."
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Min. 3 karaktere · obligative</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleStockAdjust}
                  disabled={adjusting || adjustStock === '' || adjustReason.trim().length < 3}
                  loading={adjusting}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Ruaj Stokun
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Stock History */}
      {product.stockMovements.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lëvizjet e Fundit të Stokut</CardTitle>
              <span className="text-xs text-gray-400">Stok aktual: {formatNumber(product.stockCopje)} copë</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {product.stockMovements.slice(0, 10).map(m => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <MovementBadge type={m.type} />
                    <div>
                      {m.reference && <p className="text-xs font-mono text-gray-500">{m.reference}</p>}
                      {m.reason && <p className="text-xs text-gray-400">{m.reason}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      m.type === 'ADJUSTMENT'
                        ? m.quantityCopje >= 0 ? 'text-green-600' : 'text-red-600'
                        : ['IN', 'RETURN', 'RESERVATION_RELEASE'].includes(m.type) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {m.type === 'ADJUSTMENT'
                        ? `${m.quantityCopje >= 0 ? '+' : ''}${formatNumber(m.quantityCopje)}`
                        : `${['IN', 'RETURN', 'RESERVATION_RELEASE'].includes(m.type) ? '+' : '-'}${formatNumber(m.quantityCopje)}`
                      }
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MovementBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string }> = {
    IN: { label: 'Hyrje', className: 'bg-green-100 text-green-700' },
    OUT: { label: 'Dalje', className: 'bg-red-100 text-red-700' },
    RESERVATION: { label: 'Rezervim', className: 'bg-blue-100 text-blue-700' },
    RESERVATION_RELEASE: { label: 'Çliruar', className: 'bg-gray-100 text-gray-600' },
    RETURN: { label: 'Kthim', className: 'bg-yellow-100 text-yellow-700' },
    DAMAGE: { label: 'Dëmtim', className: 'bg-orange-100 text-orange-700' },
    ADJUSTMENT: { label: 'Rregullim', className: 'bg-purple-100 text-purple-700' },
  }
  const { label, className } = map[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>{label}</span>
}
