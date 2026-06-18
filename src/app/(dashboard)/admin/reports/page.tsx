'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { value: 'sales', label: 'Shitjet' },
  { value: 'payments', label: 'Pagesat' },
  { value: 'visits', label: 'Vizitat' },
  { value: 'debt', label: 'Borxhet' },
  { value: 'brands', label: 'Shitjet sipas Brendit' },
  { value: 'inactive_customers', label: 'Klientë pa Porosi' },
]

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales')
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [days, setDays] = useState('30')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType, from, to, days })
      const res = await fetch(`/api/reports?${params}`)
      const result = await res.json()
      setData(result)
    } catch {
      toast.error('Gabim në ngarkimin e raportit')
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams({ type: reportType, from, to })
      const res = await fetch(`/api/export?${params}`)
      if (!res.ok) { toast.error('Gabim në eksportim'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `toska_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Eksportimi u krye')
    } catch {
      toast.error('Gabim në eksportim')
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raporte</h1>
        </div>
        <Button variant="outline" onClick={exportExcel} className="gap-2">
          <Download className="h-4 w-4" />
          Eksporto Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-48">
              <Label>Lloji i Raportit</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {reportType !== 'inactive_customers' ? (
              <>
                <div>
                  <Label>Nga</Label>
                  <Input type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label>Deri</Label>
                  <Input type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            ) : (
              <div>
                <Label>Ditët</Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger className="mt-1 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 ditë</SelectItem>
                    <SelectItem value="60">60 ditë</SelectItem>
                    <SelectItem value="90">90 ditë</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={runReport} loading={loading}>Gjenero</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {reportType === 'sales' && data.orders && (
            <Card>
              <CardHeader><CardTitle>Shitjet — {data.orders.length} Porosi</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2">Referenca</th>
                        <th className="pb-2">Klienti</th>
                        <th className="pb-2">Data</th>
                        <th className="pb-2 text-right">Shuma</th>
                        <th className="pb-2">Statusi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.map((o: any) => (
                        <tr key={o.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 font-mono">{o.reference}</td>
                          <td className="py-2">{o.customer?.businessName}</td>
                          <td className="py-2 text-gray-500">{formatDate(o.createdAt)}</td>
                          <td className="py-2 text-right font-semibold">{formatCurrency(o.totalAmount)}</td>
                          <td className="py-2">{o.status}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-3 font-bold">Totali</td>
                        <td className="pt-3 text-right font-bold text-primary">
                          {formatCurrency(data.orders.reduce((s: number, o: any) => s + o.totalAmount, 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {reportType === 'brands' && data.brands && (
            <Card>
              <CardHeader><CardTitle>Shitjet sipas Brendit</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.brands.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}€`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {data.brands.map((b: any) => (
                    <div key={b.name} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm font-medium">{b.name}</span>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(b.total)}</p>
                        <p className="text-xs text-gray-400">{b.quantity} copë</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {reportType === 'debt' && data.debtReport && (
            <Card>
              <CardHeader><CardTitle>Klientët me Borxh</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.debtReport.map((c: any) => (
                    <div key={c.customerId} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium">{c.businessName}</p>
                        <p className="text-xs text-gray-400">{c.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{formatCurrency(c.debt)}</p>
                        <p className="text-xs text-gray-400">Total Porosi: {formatCurrency(c.totalOrders)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {reportType === 'inactive_customers' && data.customers && (
            <Card>
              <CardHeader><CardTitle>Klientë pa Porosi — {days} ditë</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.customers.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium">{c.businessName}</p>
                        <p className="text-xs text-gray-400">{c.agent?.name ?? 'Pa agjent'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {c.orders[0] ? `Porosi e fundit: ${formatDate(c.orders[0].createdAt)}` : 'Kurrë nuk ka porosi'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
