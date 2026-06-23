'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Search, X, Store, Building2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Mode = 'BUSINESS' | 'UNIT'

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

interface ParentResult {
  id: string
  code: string
  businessName: string
  city?: string | null
  parentCustomerId?: string | null
}

interface ParentDetail {
  id: string
  code: string
  businessName: string
  phone: string
  businessNumber?: string | null
  vatNumber?: string | null
  debtLimit: number
  paymentTermDays: number
  status: string
  agent?: { id: string; name: string } | null
  agentId?: string | null
}

// ─── Unit form state ───────────────────────────────────────────
interface UnitForm {
  unitName: string
  unitType: string
  businessAddress: string
  city: string
  phone: string
  lat: string
  lng: string
  notes: string
}
const EMPTY_UNIT: UnitForm = {
  unitName: '', unitType: '', businessAddress: '', city: '', phone: '', lat: '', lng: '', notes: '',
}

export default function NewCustomerPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('BUSINESS')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('')

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { debtLimit: 0, paymentTermDays: 30 },
  })

  // ── Parent picker (UNIT mode) ──
  const [parentSearch, setParentSearch] = useState('')
  const [parentResults, setParentResults] = useState<ParentResult[]>([])
  const [parentLoading, setParentLoading] = useState(false)
  const [parentOpen, setParentOpen] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const [parent, setParent] = useState<ParentDetail | null>(null)
  const [loadingParent, setLoadingParent] = useState(false)

  // ── Unit fields ──
  const [unit, setUnit] = useState<UnitForm>(EMPTY_UNIT)
  const [unitErrors, setUnitErrors] = useState<Partial<Record<keyof UnitForm, string>>>({})

  useEffect(() => {
    fetch('/api/users?role=AGJENT')
      .then((r) => r.json())
      .then((data) => {
        const agentList = Array.isArray(data) ? data : data.users ?? []
        setAgents(agentList.filter((u: { role: string }) => u.role === 'AGJENT'))
      })
      .catch(() => {})
  }, [])

  // Load + debounce parent search (only top-level businesses, never units)
  useEffect(() => {
    if (mode !== 'UNIT') return
    const t = setTimeout(async () => {
      setParentLoading(true)
      try {
        const url = parentSearch.trim()
          ? `/api/customers?search=${encodeURIComponent(parentSearch)}&topLevel=1&limit=20`
          : `/api/customers?topLevel=1&limit=20`
        const r = await fetch(url)
        const d = r.ok ? await r.json() : { customers: [] }
        setParentResults((d.customers ?? []).filter((c: ParentResult) => !c.parentCustomerId))
      } catch {
        setParentResults([])
      } finally {
        setParentLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [parentSearch, mode])

  useEffect(() => {
    if (!parentOpen) return
    const onMousedown = (e: MouseEvent) => {
      if (parentRef.current && !parentRef.current.contains(e.target as Node)) setParentOpen(false)
    }
    document.addEventListener('mousedown', onMousedown)
    return () => document.removeEventListener('mousedown', onMousedown)
  }, [parentOpen])

  const selectParent = (p: ParentResult) => {
    setParentOpen(false)
    setParentSearch('')
    setLoadingParent(true)
    fetch(`/api/customers/${p.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ParentDetail | null) => {
        if (!data?.id) { toast.error('Gabim në ngarkimin e biznesit'); return }
        setParent(data)
      })
      .catch(() => toast.error('Gabim në ngarkim'))
      .finally(() => setLoadingParent(false))
  }

  // ── Submit: BUSINESS ──
  const onSubmitBusiness = async (data: FormData) => {
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
      toast.success(`Biznesi u krijua: ${customer.code}`)
      router.push(`/admin/customers/${customer.id}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Submit: UNIT ──
  const onSubmitUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parent) { toast.error('Zgjidh biznesin kryesor'); return }
    const errs: Partial<Record<keyof UnitForm, string>> = {}
    if (!unit.unitName.trim()) errs.unitName = 'Emri i njësisë kërkohet'
    if (!unit.businessAddress.trim()) errs.businessAddress = 'Adresa kërkohet'
    if (!unit.city.trim()) errs.city = 'Qyteti kërkohet'
    setUnitErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      const payload = {
        // Unit-specific
        unitName: unit.unitName.trim(),
        unitType: unit.unitType || null,
        businessAddress: unit.businessAddress.trim(),
        city: unit.city.trim(),
        phone: unit.phone.trim() || parent.phone,
        lat: unit.lat ? parseFloat(unit.lat) : undefined,
        lng: unit.lng ? parseFloat(unit.lng) : undefined,
        notes: unit.notes.trim() || undefined,
        // Inherited (backend re-applies these from the parent as well)
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
      const created = await res.json()
      toast.success(`Njësia u krijua: ${created.code}`)
      router.push(`/admin/customers/${created.id}`)
    } finally {
      setLoading(false)
    }
  }

  const setU = (k: keyof UnitForm, v: string) => setUnit((p) => ({ ...p, [k]: v }))

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/customers">
          <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Klient i Ri</h1>
      </div>

      {/* Registration type — 2 cards */}
      <Card>
        <CardHeader><CardTitle>Lloji i regjistrimit</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('BUSINESS')}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-colors ${
                mode === 'BUSINESS' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Store className={`h-5 w-5 ${mode === 'BUSINESS' ? 'text-primary' : 'text-gray-400'}`} />
              <p className={`text-sm font-semibold ${mode === 'BUSINESS' ? 'text-primary' : 'text-gray-800'}`}>Biznes i Ri</p>
              <p className="text-[11px] text-gray-400 leading-tight">Për biznes të ri ose klient të pavarur.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('UNIT')}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border-2 text-left transition-colors ${
                mode === 'UNIT' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Building2 className={`h-5 w-5 ${mode === 'UNIT' ? 'text-primary' : 'text-gray-400'}`} />
              <p className={`text-sm font-semibold ${mode === 'UNIT' ? 'text-primary' : 'text-gray-800'}`}>Njësi / Pikë</p>
              <p className="text-[11px] text-gray-400 leading-tight">Lokacion i ri i një biznesi ekzistues.</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ───────────── BUSINESS MODE ───────────── */}
      {mode === 'BUSINESS' && (
        <form onSubmit={handleSubmit(onSubmitBusiness)} className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Informacioni i Biznesit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="businessName">Emri i Biznesit *</Label>
                <Input id="businessName" {...register('businessName')} className="mt-1" />
                {errors.businessName && <p className="form-error">{errors.businessName.message}</p>}
              </div>
              <div>
                <Label htmlFor="businessAddress">Adresa Kryesore *</Label>
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
                <Select value={selectedAgentId} onValueChange={(v) => { setSelectedAgentId(v); setValue('agentId', v) }}>
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
                  <Input id="debtLimit" type="number" step="0.01" {...register('debtLimit', { valueAsNumber: true })} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="paymentTermDays">Afati Pagesës (ditë)</Label>
                  <Input id="paymentTermDays" type="number" {...register('paymentTermDays', { valueAsNumber: true })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Shënime</Label>
                <Textarea id="notes" {...register('notes')} className="mt-1" rows={3} />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Link href="/admin/customers"><Button variant="outline" type="button">Anulo</Button></Link>
            <Button type="submit" loading={loading}>Krijo Biznesin</Button>
          </div>
        </form>
      )}

      {/* ───────────── UNIT MODE ───────────── */}
      {mode === 'UNIT' && (
        <form onSubmit={onSubmitUnit} className="space-y-4">
          {/* Parent picker */}
          <Card>
            <CardHeader><CardTitle>Biznesi Kryesor</CardTitle></CardHeader>
            <CardContent>
              <div className="relative" ref={parentRef}>
                {parent ? (
                  <div className="flex items-center justify-between h-11 px-3 rounded-xl border border-primary bg-primary/5">
                    <span className="text-sm font-medium text-gray-900 truncate">{parent.businessName} <span className="text-gray-400 font-mono text-xs">· {parent.code}</span></span>
                    <button type="button" onClick={() => { setParent(null); setUnit(EMPTY_UNIT); setUnitErrors({}) }}>
                      <X className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        placeholder="Kërko sipas emrit, kodit, telefonit, nr. biznesit, qytetit..."
                        className="pl-9 h-11 rounded-xl"
                        value={parentSearch}
                        autoComplete="off"
                        onChange={(e) => { setParentSearch(e.target.value); setParentOpen(true) }}
                        onFocus={() => setParentOpen(true)}
                      />
                    </div>
                    {parentOpen && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {parentLoading ? (
                          <div className="p-3 text-center text-sm text-gray-400 animate-pulse">Duke kërkuar...</div>
                        ) : parentResults.length === 0 ? (
                          <div className="p-4 text-center text-sm text-gray-400">
                            {parentSearch ? 'Nuk u gjet asnjë biznes' : 'Shkruaj për të kërkuar...'}
                          </div>
                        ) : (
                          parentResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 border-b last:border-0 border-gray-100"
                              onClick={() => selectParent(c)}
                            >
                              <p className="font-semibold text-gray-900 text-sm truncate">{c.businessName}</p>
                              <p className="text-xs text-gray-400 font-mono">{c.code}{c.city ? ` · ${c.city}` : ''}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {loadingParent && <p className="text-xs text-gray-400 mt-2 animate-pulse">Duke ngarkuar të dhënat e biznesit...</p>}
            </CardContent>
          </Card>

          {/* Inherited data + unit fields — shown after parent is chosen */}
          {parent && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> Të dhënat e trashëguara nga biznesi kryesor
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-blue-800/80">
                  <span>Emri: <strong>{parent.businessName}</strong></span>
                  <span>Nr. Biznesit: <strong>{parent.businessNumber || '—'}</strong></span>
                  <span>TVSH: <strong>{parent.vatNumber || '—'}</strong></span>
                  <span>Telefoni: <strong>{parent.phone || '—'}</strong></span>
                  <span>Agjenti: <strong>{parent.agent?.name || '—'}</strong></span>
                  <span>Limit Borxhi: <strong>{formatCurrency(parent.debtLimit)}</strong></span>
                  <span>Afati Pagesës: <strong>{parent.paymentTermDays} ditë</strong></span>
                </div>
              </div>

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
                      <Input id="unitName" placeholder="p.sh. Agimi 3" value={unit.unitName} onChange={(e) => setU('unitName', e.target.value)} className="mt-1" />
                      {unitErrors.unitName && <p className="form-error">{unitErrors.unitName}</p>}
                    </div>
                    <div>
                      <Label htmlFor="unitType">Lloji i Njësisë</Label>
                      <select
                        id="unitType"
                        value={unit.unitType}
                        onChange={(e) => setU('unitType', e.target.value)}
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
                    <Label htmlFor="unitAddress">Adresa e Njësisë *</Label>
                    <Input id="unitAddress" value={unit.businessAddress} onChange={(e) => setU('businessAddress', e.target.value)} className="mt-1" />
                    {unitErrors.businessAddress && <p className="form-error">{unitErrors.businessAddress}</p>}
                  </div>
                  <div>
                    <Label htmlFor="unitCity">Qyteti / Zona *</Label>
                    <Input id="unitCity" value={unit.city} onChange={(e) => setU('city', e.target.value)} className="mt-1" />
                    {unitErrors.city && <p className="form-error">{unitErrors.city}</p>}
                  </div>
                  <div>
                    <Label htmlFor="unitPhone">Telefoni i Njësisë</Label>
                    <Input id="unitPhone" placeholder={parent.phone} value={unit.phone} onChange={(e) => setU('phone', e.target.value)} className="mt-1" />
                    <p className="text-[11px] text-gray-400 mt-1">Lëre bosh për të përdorur telefonin e biznesit kryesor.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="unitLat">GPS Latitude</Label>
                      <Input id="unitLat" inputMode="decimal" placeholder="41.3275" value={unit.lat} onChange={(e) => setU('lat', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="unitLng">GPS Longitude</Label>
                      <Input id="unitLng" inputMode="decimal" placeholder="19.8187" value={unit.lng} onChange={(e) => setU('lng', e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="unitNotes">Shënime</Label>
                    <Textarea id="unitNotes" value={unit.notes} onChange={(e) => setU('notes', e.target.value)} className="mt-1" rows={3} />
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 justify-end">
                <Link href="/admin/customers"><Button variant="outline" type="button">Anulo</Button></Link>
                <Button type="submit" loading={loading}>Krijo Njësinë</Button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  )
}
