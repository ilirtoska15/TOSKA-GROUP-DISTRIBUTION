'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Search, X, Building2, Layers, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type CustomerType = 'CUSTOMER' | 'GROUP' | 'UNIT'

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

interface ParentCustomer { id: string; code: string; businessName: string; city?: string }

export default function NewCustomerPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [customerType, setCustomerType] = useState<CustomerType>('CUSTOMER')

  // Parent picker state (for UNIT type)
  const [parentSearch, setParentSearch] = useState('')
  const [parentResults, setParentResults] = useState<ParentCustomer[]>([])
  const [parentLoading, setParentLoading] = useState(false)
  const [parentOpen, setParentOpen] = useState(false)
  const [parentId, setParentId] = useState('')
  const [parentName, setParentName] = useState('')
  const parentRef = useRef<HTMLDivElement>(null)
  const [unitName, setUnitName] = useState('')
  const [unitType, setUnitType] = useState('')

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

  // Load initial parent options for unit type
  useEffect(() => {
    if (customerType !== 'UNIT') return
    fetch('/api/customers?type=GROUP&limit=20')
      .then(r => r.ok ? r.json() : { customers: [] })
      .then(d => setParentResults(d.customers ?? []))
      .catch(() => setParentResults([]))
  }, [customerType])

  // Debounced parent search
  useEffect(() => {
    if (customerType !== 'UNIT') return
    const t = setTimeout(async () => {
      setParentLoading(true)
      try {
        const url = parentSearch.trim()
          ? `/api/customers?search=${encodeURIComponent(parentSearch)}&type=GROUP&limit=20`
          : `/api/customers?type=GROUP&limit=20`
        const r = await fetch(url)
        const d = r.ok ? await r.json() : { customers: [] }
        setParentResults(d.customers ?? [])
      } catch {
        setParentResults([])
      } finally {
        setParentLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [parentSearch, customerType])

  // Close parent picker on click outside
  useEffect(() => {
    if (!parentOpen) return
    const onMousedown = (e: MouseEvent) => {
      if (parentRef.current && !parentRef.current.contains(e.target as Node)) {
        setParentOpen(false)
      }
    }
    document.addEventListener('mousedown', onMousedown)
    return () => document.removeEventListener('mousedown', onMousedown)
  }, [parentOpen])

  const onSubmit = async (data: FormData) => {
    if (customerType === 'UNIT' && !parentId) {
      toast.error('Zgjidh grupin kryesor të biznesit')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...data,
        isBusinessGroup: customerType === 'GROUP',
        parentCustomerId: customerType === 'UNIT' ? parentId : null,
        unitName: customerType === 'UNIT' ? (unitName || null) : null,
        unitType: customerType === 'UNIT' ? (unitType || null) : null,
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

      const customer = await res.json()
      toast.success(`Klienti u krijua: ${customer.code}`)
      router.push(`/admin/customers/${customer.id}`)
    } finally {
      setLoading(false)
    }
  }

  const typeOptions: { value: CustomerType; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'CUSTOMER', label: 'Klient i Vetëm', desc: 'Dyqan ose biznes i pavarur', icon: <Store className="h-4 w-4" /> },
    { value: 'GROUP', label: 'Grup Biznesesh', desc: 'Ka disa njësi/pika', icon: <Layers className="h-4 w-4" /> },
    { value: 'UNIT', label: 'Njësi / Pikë', desc: 'Është pjesë e një grupi', icon: <Building2 className="h-4 w-4" /> },
  ]

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

      {/* Type selector */}
      <Card>
        <CardHeader><CardTitle>Lloji i Klientit</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setCustomerType(opt.value); setParentId(''); setParentName('') }}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-colors ${
                  customerType === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`${customerType === opt.value ? 'text-primary' : 'text-gray-500'}`}>
                  {opt.icon}
                </div>
                <p className={`text-xs font-semibold ${customerType === opt.value ? 'text-primary' : 'text-gray-800'}`}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-gray-400 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unit fields — only for UNIT type */}
      {customerType === 'UNIT' && (
        <Card>
          <CardHeader><CardTitle>Lidhja me Grupin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Grupi Kryesor *</Label>
              <div className="relative mt-1" ref={parentRef}>
                {parentId ? (
                  <div className="flex items-center justify-between h-11 px-3 rounded-xl border border-primary bg-primary/5">
                    <span className="text-sm font-medium text-gray-900">{parentName}</span>
                    <button onClick={() => { setParentId(''); setParentName('') }}>
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        placeholder="Kërko grupin e biznesit..."
                        className="pl-9 h-11 rounded-xl"
                        value={parentSearch}
                        autoComplete="off"
                        onChange={e => { setParentSearch(e.target.value); setParentOpen(true) }}
                        onFocus={() => setParentOpen(true)}
                      />
                    </div>
                    {parentOpen && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {parentLoading ? (
                          <div className="p-3 text-center text-sm text-gray-400 animate-pulse">Duke kërkuar...</div>
                        ) : parentResults.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-400">
                            {parentSearch ? 'Nuk u gjet asnjë grup' : 'Ende nuk ka grupe — krijo një klient tip Grup së pari'}
                          </div>
                        ) : (
                          parentResults.map(c => (
                            <button
                              key={c.id}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 border-b last:border-0 border-gray-100"
                              onClick={() => { setParentId(c.id); setParentName(c.businessName); setParentOpen(false); setParentSearch('') }}
                            >
                              <p className="font-semibold text-gray-900 text-sm">{c.businessName}</p>
                              <p className="text-xs text-gray-400 font-mono">{c.code}{c.city ? ` · ${c.city}` : ''}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="unitName">Emri i Njësisë</Label>
                <Input
                  id="unitName"
                  placeholder="p.sh. Dega Tiranë"
                  value={unitName}
                  onChange={e => setUnitName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="unitType">Lloji i Njësisë</Label>
                <select
                  id="unitType"
                  value={unitType}
                  onChange={e => setUnitType(e.target.value)}
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
          </CardContent>
        </Card>
      )}

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
