'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUpload } from '@/components/ui/image-upload'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().min(2, 'Emri duhet të jetë të paktën 2 karaktere'),
  photo: z.string().min(1, 'Foto e produktit është e detyrueshme'),
  salesPrice: z.coerce.number().min(0.01, 'Çmimi duhet të jetë pozitiv'),
  discountPercent: z.coerce.number().min(0, 'Rabati nuk mund të jetë negativ').max(100, 'Rabati nuk mund të jetë mbi 100%').default(0),
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
})

type FormData = z.infer<typeof schema>

interface Category { id: string; name: string }
interface Brand { id: string; name: string }

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { promotionActive: false, showPricePublic: false },
  })

  const promotionActive = watch('promotionActive')

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/brands').then(r => r.json()),
    ]).then(([cats, brs]) => {
      setCategories(cats)
      setBrands(brs)
    })
  }, [])

  const handlePhotoChange = (url: string) => {
    setPhotoUrl(url)
    setValue('photo', url, { shouldValidate: true })
  }

  const onSubmit = async (data: FormData) => {
    if (!photoUrl) {
      toast.error('Ngarko foton e produktit para se të vazhdosh')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...data,
        photo: photoUrl,
        pakoCopje: data.pakoCopje ? Number(data.pakoCopje) : undefined,
        salesPrice: Number(data.salesPrice),
        discountPercent: Number(data.discountPercent ?? 0),
        expiryDate: data.expiryDate || undefined,
        barcode: data.barcode || undefined,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        brandId: data.brandId || undefined,
        lotNumber: data.lotNumber || undefined,
        promotionText: data.promotionText || undefined,
      }
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(Array.isArray(err.error) ? err.error[0]?.message : (err.error ?? 'Gabim'))
        return
      }
      const product = await res.json()
      toast.success(`Produkti u krijua: ${product.code}`)
      router.push('/admin/products')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/products">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900">Produkt i Ri</h1>
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
            {errors.photo && (
              <p className="text-xs text-red-500 mt-1">{errors.photo.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informacioni Bazë</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Emri i Produktit *</Label>
              <Input id="name" {...register('name')} placeholder="p.sh. Ujë Mineral 1.5L" />
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
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
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
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
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
          <CardHeader>
            <CardTitle className="text-base">Çmimi dhe Njësia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salesPrice">Çmimi i Shitjes (ALL) *</Label>
                <Input
                  id="salesPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('salesPrice')}
                  placeholder="0.00"
                />
                {errors.salesPrice && <p className="text-xs text-red-500 mt-1">{errors.salesPrice.message}</p>}
              </div>
              <div>
                <Label htmlFor="discountPercent">Rabat % (Zbritje)</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  {...register('discountPercent')}
                  placeholder="0"
                />
                {errors.discountPercent && <p className="text-xs text-red-500 mt-1">{errors.discountPercent.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pakoCopje">Copë për Pako</Label>
                <Input
                  id="pakoCopje"
                  type="number"
                  min="1"
                  {...register('pakoCopje')}
                  placeholder="p.sh. 12 (nëse ka pako)"
                />
                <p className="text-xs text-gray-400 mt-0.5">Lër bosh nëse produkti shitet vetëm copë</p>
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
          <CardHeader>
            <CardTitle className="text-base">Promovimi dhe Dukshmëria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('promotionActive')}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm font-medium text-gray-700">Produkti është në promovim</span>
            </label>
            {promotionActive && (
              <div>
                <Label htmlFor="promotionText">Teksti i Promovimit</Label>
                <Input id="promotionText" {...register('promotionText')} placeholder="p.sh. -20% këtë javë" />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('showPricePublic')}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm font-medium text-gray-700">Shfaq çmimin në katalogun publik</span>
            </label>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end pb-8">
          <Link href="/admin/products">
            <Button type="button" variant="outline">Anulo</Button>
          </Link>
          <Button type="submit" loading={loading} disabled={loading || !photoUrl}>
            Krijo Produktin
          </Button>
        </div>
      </form>
    </div>
  )
}
