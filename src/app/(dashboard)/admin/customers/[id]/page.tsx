'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, MapPin, Phone, Building2, User, Edit, AlertTriangle, CheckCircle, Ban, Package, Layers, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import dynamicImport from 'next/dynamic'

export const dynamic = 'force-dynamic'

const LeafletMap = dynamicImport(() => import('@/components/ui/leaflet-map').then(m => m.LeafletMap), { ssr: false })

interface Customer {
  id: string
  code: string
  businessName: string
  businessAddress: string
  city: string
  phone: string
  phone2?: string
  contactPerson?: string
  businessNumber?: string
  vatNumber?: string
  status: string
  debtLimit: number
  paymentTermDays: number
  notes?: string
  lat?: number
  lng?: number
  currentDebt: number
  isBusinessGroup?: boolean
  parentCustomerId?: string
  unitName?: string
  unitType?: string
  agent?: { name: string } | null
  region?: { name: string } | null
  zone?: { name: string } | null
  parentCustomer?: { id: string; code: string; businessName: string } | null
  units?: Array<{ id: string; code: string; businessName: string; unitName?: string; unitType?: string; status: string }>
  orders: Array<{ id: string; reference: string; status: string; totalAmount: number; createdAt: string }>
  visits: Array<{ id: string; reference: string; status: string; openedAt: string; agent: { name: string } }>
  payments: Array<{ id: string; reference: string; amount: number; method: string; createdAt: string }>
  returns: Array<{ id: string; reference: string; status: string; totalAmount: number; createdAt: string }>
  topProducts: Array<{ productId: string; name: string; code: string; totalQty: number; totalValue: number }>
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then(setCustomer)
      .catch(() => toast.error('Gabim në ngarkimin e klientit'))
      .finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (status: string) => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer((prev) => prev ? { ...prev, status: updated.status } : null)
      toast.success('Statusi u ndryshua')
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!customer) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Klienti nuk u gjet</p>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/customers">
            <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{customer.businessName}</h1>
              <span className={`badge ${getStatusColor(customer.status)}`}>{getStatusLabel(customer.status)}</span>
            </div>
            <p className="text-sm text-gray-500 font-mono">{customer.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/customers/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="h-3.5 w-3.5" />
              Edito
            </Button>
          </Link>
          {customer.status !== 'BLOCKED' && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('BLOCKED')}
              className="text-red-600 border-red-200 hover:bg-red-50">
              <Ban className="h-3.5 w-3.5 mr-1" />
              Blloko
            </Button>
          )}
          {customer.status === 'BLOCKED' && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('ACTIVE')}
              className="text-green-600 border-green-200 hover:bg-green-50">
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Aktivizo
            </Button>
          )}
        </div>
      </div>

      {/* Debt Alert */}
      {customer.currentDebt > 0 && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${
          customer.debtLimit > 0 && customer.currentDebt > customer.debtLimit
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <AlertTriangle className={`h-5 w-5 shrink-0 ${
            customer.debtLimit > 0 && customer.currentDebt > customer.debtLimit ? 'text-red-600' : 'text-yellow-600'
          }`} />
          <div>
            <p className="text-sm font-semibold">Borxh aktual: {formatCurrency(customer.currentDebt)}</p>
            {customer.debtLimit > 0 && (
              <p className="text-xs text-gray-600">Limit: {formatCurrency(customer.debtLimit)}</p>
            )}
          </div>
          <div className="ml-auto">
            <Link href={`/admin/payments?customerId=${id}`}>
              <Button size="sm">Regjistro Pagesë</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{customer.businessAddress}</p>
                  <p className="text-xs text-gray-500">{customer.city}</p>
                </div>
              </div>
              {customer.lat && customer.lng && (
                <LeafletMap
                  center={[customer.lat, customer.lng]}
                  zoom={15}
                  markers={[{ lat: customer.lat, lng: customer.lng, title: customer.businessName, popup: customer.businessAddress }]}
                  height="180px"
                  className="border border-gray-100"
                />
              )}
              <Separator />
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <p className="text-sm">{customer.phone}</p>
              </div>
              {customer.phone2 && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{customer.phone2}</p>
                </div>
              )}
              {customer.contactPerson && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{customer.contactPerson}</p>
                </div>
              )}
              {customer.businessNumber && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <p className="text-xs text-gray-600">Nr. Biznesi: {customer.businessNumber}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Kushtet Tregtare</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Agjent</span>
                <span className="font-medium">{customer.agent?.name ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Limit Borxhi</span>
                <span className="font-medium">{formatCurrency(customer.debtLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Afati Pagesës</span>
                <span className="font-medium">{customer.paymentTermDays} ditë</span>
              </div>
            </CardContent>
          </Card>

          {customer.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Shënime</CardTitle></CardHeader>
              <CardContent className="text-sm text-gray-600">{customer.notes}</CardContent>
            </Card>
          )}

          {/* Business Structure */}
          {(customer.isBusinessGroup || customer.parentCustomer) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  Struktura e Biznesit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {customer.isBusinessGroup && (
                  <div className="px-2 py-1.5 bg-blue-50 rounded-lg text-blue-700 text-xs font-medium">Grup Biznesi</div>
                )}
                {customer.parentCustomer && (
                  <div>
                    <span className="text-gray-500 text-xs">Grupi Prind</span>
                    <Link href={`/admin/customers/${customer.parentCustomer.id}`} className="block mt-0.5 text-primary hover:underline font-medium">
                      {customer.parentCustomer.businessName}
                    </Link>
                  </div>
                )}
                {customer.unitName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Emër Njësie</span>
                    <span className="font-medium">{customer.unitName}</span>
                  </div>
                )}
                {customer.units && customer.units.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs text-gray-500 font-medium">{customer.units.length} Njësi</p>
                    {customer.units.map(u => (
                      <Link key={u.id} href={`/admin/customers/${u.id}`} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                        <div>
                          <p className="text-xs font-medium">{u.businessName}</p>
                          {u.unitName && <p className="text-[10px] text-gray-400">{u.unitName}</p>}
                        </div>
                        <span className={`badge text-[10px] ${getStatusColor(u.status)}`}>{getStatusLabel(u.status)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Porositë e Fundit</CardTitle>
                <Link href={`/admin/orders?customerId=${id}`} className="text-sm text-primary hover:underline">
                  Shih të gjitha
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {customer.orders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nuk ka porosi</p>
              ) : (
                <div className="space-y-2">
                  {customer.orders.slice(0, 5).map((o) => (
                    <Link key={o.id} href={`/admin/orders/${o.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium font-mono">{o.reference}</p>
                        <p className="text-xs text-gray-500">{formatDate(o.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(o.totalAmount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(o.status)}`}>{getStatusLabel(o.status)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Visits */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Vizitat e Fundit</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {customer.visits.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nuk ka vizita</p>
              ) : (
                <div className="space-y-2">
                  {customer.visits.slice(0, 5).map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{v.reference}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(v.openedAt)} • {v.agent.name}</p>
                      </div>
                      <span className={`badge text-[10px] ${getStatusColor(v.status)}`}>{getStatusLabel(v.status)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pagesat e Fundit</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {customer.payments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nuk ka pagesa</p>
              ) : (
                <div className="space-y-2">
                  {customer.payments.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{p.reference}</p>
                        <p className="text-xs text-gray-500">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-700">{formatCurrency(p.amount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(p.method)}`}>{getStatusLabel(p.method)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Returns */}
          {customer.returns && customer.returns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-orange-500" />Kthimet
                  </CardTitle>
                  <Link href={`/admin/returns?customerId=${id}`} className="text-sm text-primary hover:underline">Shih të gjitha</Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.returns.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium font-mono">{r.reference}</p>
                        <p className="text-xs text-gray-500">{formatDate(r.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-orange-600">{formatCurrency(r.totalAmount)}</p>
                        <span className={`badge text-[10px] ${getStatusColor(r.status)}`}>{getStatusLabel(r.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Products */}
          {customer.topProducts && customer.topProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />Produktet Më të Shitura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(p.totalValue)}</p>
                        <p className="text-xs text-gray-400">{p.totalQty} copë</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
