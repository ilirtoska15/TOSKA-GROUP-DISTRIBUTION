'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Building2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const schema = z.object({
  unitName: z.string().min(1, 'Emri i njësisë kërkohet'),
  unitType: z.string().optional(),
  businessAddress: z.string().min(1, 'Adresa kërkohet'),
  city: z.string().min(1, 'Qyteti kërkohet'),
  phone: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Parent {
  id: string
  code: string
  businessName: string
  phone: string
  businessNumber?: string | null
  vatNumber?: string | null
  debtLimit: number
  paymentTermDays: number
  agent?: { id: string; name: string } | null
  agentId?: string | null
}

export default function NewUnitPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [parent, setParent] = useState<Parent | null>(null)
  const [loadingParent, setLoadingParent] = useState(true)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: (Parent & { parentCustomerId?: string | null }) | null) => {
        if (!data?.id) { toast.error('Biznesi nuk u gjet'); return }
        if (data.parentCustomerId) { toast.error('Një njësi nuk mund të ketë nën-njësi'); router.replace(`/admin/customers/${id}`); return }
        setParent(data)
      })
      .catch(() => toast.error('Gabim në ngarkim'))
      .finally(() => setLoadingParent(false))
  }, [id, router])

  const onSubmit = async (data: FormData) => {
    if (!parent) return
    setLoading(true)
    try {
      const payload = {
        // Unit-specific
        businessAddress: data.businessAddress,
        city: data.city,
        phone: data.phone?.trim() || parent.phone,
        lat: data.lat ? parseFloat(data.lat) : undefined,
        lng: data.lng ? parseFloat(data.lng) : undefined,
        notes: data.notes,
        unitName: data.unitName,
        unitType: data.unitType || null,
        // Inherited legal / commercial data from the parent business
        businessName: parent.businessName,
        businessNumber: parent.businessNumber ?? undefined,
        vatNumber: parent.vatNumber ?? undefined,
        agentId: parent.agent?.id ?? parent.agentId ?? undefined,
        debtLimit: parent.debtLimit,
        paymentTermDays: parent.paymentTermDays,
        // Link
        parentCustomerId: parent.id,
      }
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
        return
      }
      const unit = await res.json()
      toast.success(`Njësia u krijua: ${unit.code}`)
      router.push(`/admin/customers/${unit.id}`)
    } finally {
      setLoading(false)
    }
  }

  if (loadingParent) return (
    <div className="p-6 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!parent) return (
    <div className="p-6 text-center text-gray-500">Biznesi nuk u gjet</div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/admin/customers/${id}`}>
          <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shto Njësi / Pikë</h1>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-blue-500" /> {parent.businessName}
          </p>
        </div>
      </div>

      {/* Inherited data notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
        <p className="text-xs text-blue-700 leading-relaxed">
          Njësia trashëgon të dhënat juridike nga biznesi kryesor. Plotëso vetëm të dhënat e lokacionit.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-blue-800/80">
          <span>Nr. Biznesit: <strong>{parent.businessNumber || '—'}</strong></span>
          <span>TVSH: <strong>{parent.vatNumber || '—'}</strong></span>
          <span>Agjenti: <strong>{parent.agent?.name || '—'}</strong></span>
          <span>Limit Borxhi: <strong>{formatCurrency(parent.debtLimit)}</strong></span>
          <span>Afati Pagesës: <strong>{parent.paymentTermDays} ditë</strong></span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-500" />Të dhënat e Njësisë
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unitName">Emri i Njësisë *</Label>
                <Input id="unitName" placeholder="p.sh. Agimi 3" {...register('unitName')} className="mt-1" />
                {errors.unitName && <p className="form-error">{errors.unitName.message}</p>}
              </div>
              <div>
                <Label htmlFor="unitType">Lloji i Njësisë</Label>
                <select
                  id="unitType"
                  {...register('unitType')}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                >
                  <option value="">— Zgjidh —</option>
                  <option value="DYQAN">Dyqan</option>
                  <option value="MAGAZIN">Magazin</option>
                  <option value="ZYRE">Zyrë</option>
                  <option value="FILIAL">Filial</option>
                  <option value="OTHER">Tjetër</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="businessAddress">Adresa *</Label>
              <Input id="businessAddress" {...register('businessAddress')} className="mt-1" />
              {errors.businessAddress && <p className="form-error">{errors.businessAddress.message}</p>}
            </div>
            <div>
              <Label htmlFor="city">Qyteti / Zona *</Label>
              <Input id="city" {...register('city')} className="mt-1" />
              {errors.city && <p className="form-error">{errors.city.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Telefoni i Njësisë</Label>
              <Input id="phone" placeholder={parent.phone} {...register('phone')} className="mt-1" />
              <p className="text-[11px] text-gray-400 mt-1">Lëre bosh për të përdorur telefonin e biznesit kryesor.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat">GPS Latitude</Label>
                <Input id="lat" inputMode="decimal" placeholder="41.3275" {...register('lat')} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="lng">GPS Longitude</Label>
                <Input id="lng" inputMode="decimal" placeholder="19.8187" {...register('lng')} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Shënime</Label>
              <Textarea id="notes" {...register('notes')} className="mt-1" rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href={`/admin/customers/${id}`}>
            <Button variant="outline" type="button">Anulo</Button>
          </Link>
          <Button type="submit" loading={loading}>Krijo Njësinë</Button>
        </div>
      </form>
    </div>
  )
}
