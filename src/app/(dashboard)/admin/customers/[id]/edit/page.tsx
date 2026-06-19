'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const parseCoord = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

const schema = z.object({
  businessName: z.string().min(1, 'Emri i biznesit kërkohet'),
  businessAddress: z.string().min(1, 'Adresa kërkohet'),
  city: z.string().min(1, 'Qyteti kërkohet'),
  phone: z.string().min(1, 'Telefoni kërkohet'),
  phone2: z.string().optional(),
  contactPerson: z.string().optional(),
  businessNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  agentId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']),
  debtLimit: z.number().min(0).default(0),
  paymentTermDays: z.number().min(0).default(30),
  lat: z.preprocess(parseCoord, z.number().nullable().optional()),
  lng: z.preprocess(parseCoord, z.number().nullable().optional()),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Agent { id: string; name: string }

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [code, setCode] = useState('')
  const [notFound, setNotFound] = useState(false)

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { debtLimit: 0, paymentTermDays: 30, status: 'ACTIVE' },
  })

  const status = watch('status')
  const agentId = watch('agentId')

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch('/api/users?role=AGJENT').then((r) => r.json()),
    ])
      .then(([cData, aData]) => {
        if (!cData || cData.error === 'Not found' || cData.error === 'Unauthorized') {
          setNotFound(true)
          return
        }
        setCode(cData.code ?? '')
        reset({
          businessName:   cData.businessName    ?? '',
          businessAddress: cData.businessAddress ?? '',
          city:           cData.city             ?? '',
          phone:          cData.phone            ?? '',
          phone2:         cData.phone2           ?? '',
          contactPerson:  cData.contactPerson    ?? '',
          businessNumber: cData.businessNumber   ?? '',
          vatNumber:      cData.vatNumber        ?? '',
          agentId:        cData.agentId          ?? '',
          status:         cData.status           ?? 'ACTIVE',
          debtLimit:      cData.debtLimit        ?? 0,
          paymentTermDays: cData.paymentTermDays ?? 30,
          lat:            cData.lat              ?? null,
          lng:            cData.lng              ?? null,
          notes:          cData.notes            ?? '',
        })
        const list: Agent[] = Array.isArray(aData) ? aData : aData.users ?? []
        setAgents(list)
      })
      .catch(() => toast.error('Gabim në ngarkimin e të dhënave'))
      .finally(() => setDataLoading(false))
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        agentId:       data.agentId || null,
        phone2:        data.phone2 || null,
        contactPerson: data.contactPerson || null,
        businessNumber: data.businessNumber || null,
        vatNumber:     data.vatNumber || null,
        notes:         data.notes || null,
        lat:           data.lat ?? null,
        lng:           data.lng ?? null,
      }
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(Array.isArray(err.error) ? err.error[0]?.message : (err.error ?? 'Gabim në ruajtje'))
        return
      }
      toast.success('Klienti u përditësua')
      router.push(`/admin/customers/${id}`)
    } finally {
      setSaving(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-500">Klienti nuk u gjet.</p>
        <Link href="/admin/customers">
          <Button variant="outline">Kthehu te lista</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 pb-28 lg:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/admin/customers/${id}`}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edito Klientin</h1>
          {code && <p className="text-xs text-gray-400 font-mono">{code}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Business Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informacioni i Biznesit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessName">Emri i Biznesit *</Label>
              <Input id="businessName" {...register('businessName')} className="mt-1 h-11 rounded-xl" />
              {errors.businessName && (
                <p className="text-xs text-red-500 mt-1">{errors.businessName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="businessAddress">Adresa *</Label>
              <Input id="businessAddress" {...register('businessAddress')} className="mt-1 h-11 rounded-xl" />
              {errors.businessAddress && (
                <p className="text-xs text-red-500 mt-1">{errors.businessAddress.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="city">Qyteti *</Label>
              <Input id="city" {...register('city')} className="mt-1 h-11 rounded-xl" />
              {errors.city && (
                <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessNumber">Nr. Biznesit</Label>
                <Input id="businessNumber" {...register('businessNumber')} className="mt-1 h-11 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="vatNumber">TVSH Nr.</Label>
                <Input id="vatNumber" {...register('vatNumber')} className="mt-1 h-11 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kontakti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Telefon *</Label>
                <Input id="phone" {...register('phone')} className="mt-1 h-11 rounded-xl" />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone2">Telefon 2</Label>
                <Input id="phone2" {...register('phone2')} className="mt-1 h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <Label htmlFor="contactPerson">Personi i Kontaktit</Label>
              <Input id="contactPerson" {...register('contactPerson')} className="mt-1 h-11 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Koordinatat GPS (opsionale)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lat">Gjerësia (Lat)</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="41.3275"
                  {...register('lat')}
                  className="mt-1 h-11 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="lng">Gjatësia (Lng)</Label>
                <Input
                  id="lng"
                  type="number"
                  step="any"
                  placeholder="19.8187"
                  {...register('lng')}
                  className="mt-1 h-11 rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commercial Terms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kushtet Tregtare</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Statusi</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setValue('status', v as 'ACTIVE' | 'INACTIVE' | 'BLOCKED')}
                >
                  <SelectTrigger className="mt-1 h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Aktiv</SelectItem>
                    <SelectItem value="INACTIVE">Joaktiv</SelectItem>
                    <SelectItem value="BLOCKED">Bllokuar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Agjenti</Label>
                <Select
                  value={agentId ?? ''}
                  onValueChange={(v) => setValue('agentId', v || undefined)}
                >
                  <SelectTrigger className="mt-1 h-11 rounded-xl">
                    <SelectValue placeholder="Pa agjent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Pa agjent</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="debtLimit">Limit Borxhi (€)</Label>
                <Input
                  id="debtLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('debtLimit', { valueAsNumber: true })}
                  className="mt-1 h-11 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="paymentTermDays">Afati Pagesës (ditë)</Label>
                <Input
                  id="paymentTermDays"
                  type="number"
                  min="0"
                  {...register('paymentTermDays', { valueAsNumber: true })}
                  className="mt-1 h-11 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Shënime</Label>
              <Textarea id="notes" {...register('notes')} rows={3} className="mt-1 rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Fixed above mobile nav on small screens, static on desktop */}
        <div
          className="fixed left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 py-3 flex gap-3 justify-end lg:static lg:bg-transparent lg:border-0 lg:px-0 lg:py-0"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Link href={`/admin/customers/${id}`}>
            <Button variant="outline" type="button" className="h-11">Anulo</Button>
          </Link>
          <Button type="submit" loading={saving} className="h-11 gap-2">
            <Save className="h-4 w-4" />
            Ruaj Ndryshimet
          </Button>
        </div>
      </form>
    </div>
  )
}
