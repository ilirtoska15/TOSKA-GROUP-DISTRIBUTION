'use client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'

interface Customer {
  id: string
  code: string
  businessName: string
  status: string
}

const schema = z.object({
  customerId: z.string().min(1, 'Zgjidh klientin'),
  amount: z.coerce.number().positive('Shuma duhet të jetë pozitive'),
  method: z.enum(['CASH', 'BANK']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewPaymentPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'CASH' },
  })

  useEffect(() => {
    fetch('/api/customers?limit=500&status=ACTIVE')
      .then(r => r.json())
      .then(d => {
        setCustomers(d.customers ?? [])
        setLoadingCustomers(false)
      })
      .catch(() => setLoadingCustomers(false))
  }, [])

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return true
    const q = customerSearch.toLowerCase()
    return c.businessName.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json().catch(() => ({ error: 'Server error' }))

      if (!res.ok) {
        const msg = Array.isArray(result.error)
          ? result.error.map((e: { message: string }) => e.message).join(', ')
          : result.error ?? 'Gabim gjatë ruajtjes'
        toast.error(msg)
        return
      }

      toast.success('Pagesa u regjistrua me sukses')
      router.push('/admin/payments')
    } catch {
      toast.error('Gabim i papritur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/payments">
          <button className="p-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pagesë e Re</h1>
          <p className="text-sm text-gray-500">Regjistro pagesë manuale</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Customer */}
          <div className="space-y-1.5">
            <Label>Klienti *</Label>
            <Input
              placeholder="Kërko klientin..."
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              className="mb-1.5"
            />
            <select
              {...register('customerId')}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              size={Math.min(6, filteredCustomers.length + 1)}
            >
              <option value="">— Zgjidh klientin —</option>
              {loadingCustomers ? (
                <option disabled>Duke ngarkuar...</option>
              ) : (
                filteredCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.code})
                  </option>
                ))
              )}
            </select>
            {errors.customerId && (
              <p className="text-xs text-destructive">{errors.customerId.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Shuma (ALL) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              {...register('amount')}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label>Metoda e Pagesës *</Label>
            <div className="flex gap-3">
              {(['CASH', 'BANK'] as const).map(m => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={m}
                    {...register('method')}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {m === 'CASH' ? 'Cash' : 'Bankë'}
                  </span>
                </label>
              ))}
            </div>
            {errors.method && (
              <p className="text-xs text-destructive">{errors.method.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Shënime</Label>
            <textarea
              id="notes"
              {...register('notes')}
              placeholder="Shënime opsionale..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/admin/payments" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                Anulo
              </Button>
            </Link>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Duke ruajtur...
                </>
              ) : (
                'Regjistro Pagesën'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
