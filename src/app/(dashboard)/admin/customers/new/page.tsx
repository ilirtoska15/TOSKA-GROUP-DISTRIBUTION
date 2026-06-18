'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const schema = z.object({
  businessName: z.string().min(1, 'Emri i biznesit kërkohet'),
  businessAddress: z.string().min(1, 'Adresa kërkohet'),
  city: z.string().min(1, 'Qyteti kërkohet'),
  phone: z.string().min(1, 'Telefon kërkohet'),
  phone2: z.string().optional(),
  contactPerson: z.string().optional(),
  businessNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  agentId: z.string().optional(),
  debtLimit: z.number().min(0).default(0),
  paymentTermDays: z.number().min(0).default(30),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewCustomerPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { debtLimit: 0, paymentTermDays: 30 },
  })

  useEffect(() => {
    fetch('/api/users?role=AGJENT')
      .then((r) => r.json())
      .then((data) => {
        const agentList = Array.isArray(data) ? data : data.users ?? []
        setAgents(agentList.filter((u: { role: string }) => u.role === 'AGJENT'))
      })
      .catch(() => {})
  }, [])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
        return
      }

      const customer = await res.json()
      toast.success(`Klienti u krijua: ${customer.code}`)
      router.push(`/admin/customers/${customer.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Klient i Ri</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Informacioni i Biznesit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessName">Emri i Biznesit *</Label>
              <Input id="businessName" {...register('businessName')} className="mt-1" />
              {errors.businessName && <p className="form-error">{errors.businessName.message}</p>}
            </div>
            <div>
              <Label htmlFor="businessAddress">Adresa *</Label>
              <Input id="businessAddress" {...register('businessAddress')} className="mt-1" />
              {errors.businessAddress && <p className="form-error">{errors.businessAddress.message}</p>}
            </div>
            <div>
              <Label htmlFor="city">Qyteti *</Label>
              <Input id="city" {...register('city')} className="mt-1" />
              {errors.city && <p className="form-error">{errors.city.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessNumber">Nr. Biznesit</Label>
                <Input id="businessNumber" {...register('businessNumber')} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="vatNumber">TVSH Nr.</Label>
                <Input id="vatNumber" {...register('vatNumber')} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kontakti</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="phone">Telefon *</Label>
              <Input id="phone" {...register('phone')} className="mt-1" />
              {errors.phone && <p className="form-error">{errors.phone.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone2">Telefon 2</Label>
              <Input id="phone2" {...register('phone2')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="contactPerson">Personi i Kontaktit</Label>
              <Input id="contactPerson" {...register('contactPerson')} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kushtet Tregtare</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="agentId">Agjenti</Label>
              <Select onValueChange={(v) => setValue('agentId', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Zgjedh agjentin..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="debtLimit">Limit Borxhi (€)</Label>
                <Input
                  id="debtLimit"
                  type="number"
                  step="0.01"
                  {...register('debtLimit', { valueAsNumber: true })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="paymentTermDays">Afati Pagesës (ditë)</Label>
                <Input
                  id="paymentTermDays"
                  type="number"
                  {...register('paymentTermDays', { valueAsNumber: true })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Shënime</Label>
              <Textarea id="notes" {...register('notes')} className="mt-1" rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href="/admin/customers">
            <Button variant="outline" type="button">Anulo</Button>
          </Link>
          <Button type="submit" loading={loading}>Krijo Klientin</Button>
        </div>
      </form>
    </div>
  )
}
