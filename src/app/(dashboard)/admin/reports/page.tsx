'use client'

import { useState } from 'react'
import { Download, TrendingDown, Trophy, MapPin, Globe, Target, Activity, AlertOctagon, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

const REPORT_TYPES = [
  { value: 'sales', label: 'Shitjet' },
  { value: 'payments', label: 'Pagesat' },
  { value: 'visits', label: 'Vizitat' },
  { value: 'debt', label: 'Borxhet' },
  { value: 'brands', label: 'Shitjet sipas Brendit' },
  { value: 'inactive_customers', label: 'Klientë pa Porosi' },
  { value: 'product_leaderboard', label: 'Top Produktet' },
  { value: 'declining_products', label: 'Produktet në Rënie' },
  { value: 'visits_gps', label: 'Vizitat me GPS' },
  { value: 'territory', label: 'Performanca e Territorit' },
  { value: 'product_penetration', label: 'Penetrimi i Produkteve' },
  { value: 'visit_effectiveness', label: 'Efektiviteti i Vizitave' },
  { value: 'recovery_opportunities', label: 'Mundësi Rikuperimi' },
  { value: 'product_pairs', label: 'Çift Produktesh' },
]

const SEVERITY_STYLE: Record<string, string> = {
  SEVERE: 'bg-red-100 text-red-700',
  WARNING: 'bg-yellow-100 text-yellow-700',
  NORMAL: 'bg-gray-100 text-gray-600',
}

const GPS_STYLE: Record<string, string> = {
  GPS_VERIFIED: 'bg-green-100 text-green-700',
  NEAR_LOCATION: 'bg-yellow-100 text-yellow-700',
  OUTSIDE_LOCATION: 'bg-red-100 text-red-700',
  HAS_GPS: 'bg-blue-100 text-blue-700',
  NO_GPS: 'bg-gray-100 text-gray-400',
}
const GPS_LABEL: Record<string, string> = {
  GPS_VERIFIED: 'GPS Verifikuar',
  NEAR_LOCATION: 'Afër Klientit',
  OUTSIDE_LOCATION: 'Jashtë Lokacionit',
  HAS_GPS: 'Ka GPS',
  NO_GPS: 'Pa GPS',
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sales')
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [days, setDays] = useState('30')
  const [period, setPeriod] = useState('7')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType, from, to, days, period })
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
            {reportType === 'inactive_customers' ? (
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
            ) : reportType === 'declining_products' ? (
              <div>
                <Label>Periudha</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="mt-1 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 ditë</SelectItem>
                    <SelectItem value="30">30 ditë</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
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

          {reportType === 'product_leaderboard' && data.leaderboard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" />Top 20 Produktet — {data.leaderboard.length} rezultate</CardTitle>
              </CardHeader>
              <CardContent>
                {data.leaderboard.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Nuk ka shitje në këtë periudhë</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.leaderboard.slice(0, 10).map((p: any) => ({ name: p.name.slice(0, 16) + (p.name.length > 16 ? '…' : ''), total: p.totalValue }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(v: number) => `${v.toLocaleString()}L`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-1.5">
                      {data.leaderboard.map((p: any) => (
                        <div key={p.productId} className="flex items-center gap-3 py-2 border-b last:border-0">
                          <span className="w-7 text-center text-sm font-bold text-gray-400">#{p.rank}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.code} · {p.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{formatCurrency(p.totalValue)}</p>
                            <p className="text-xs text-gray-400">{p.totalQty.toLocaleString()} copë · {p.orderCount} porosi</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === 'declining_products' && data.declining && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  Produktet në Rënie — {period} ditë vs {period} ditët paraprake
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.declining.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Nuk ka produkte në rënie</p>
                ) : (
                  <div className="space-y-2">
                    {data.declining.map((p: any) => (
                      <div key={p.productId} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEVERITY_STYLE[p.severity]}`}>
                          {p.severity === 'SEVERE' ? 'KRITIK' : p.severity === 'WARNING' ? 'KUJDES' : 'NORMAL'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.code} · {p.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-600">{p.growthPct}%</p>
                          <p className="text-xs text-gray-400">{p.currentQty} copë (ishte {p.prevQty})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === 'visits_gps' && data.visits && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-500" />Vizitat me GPS — {data.visits.length} rezultate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4 text-xs">
                  {['GPS_VERIFIED', 'NEAR_LOCATION', 'OUTSIDE_LOCATION', 'HAS_GPS', 'NO_GPS'].map(s => {
                    const count = data.visits.filter((v: any) => v.gpsStatus === s).length
                    return count > 0 ? (
                      <span key={s} className={`px-2 py-1 rounded-full font-medium ${GPS_STYLE[s]}`}>
                        {GPS_LABEL[s]}: {count}
                      </span>
                    ) : null
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Agjenti</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Klienti</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Data</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">GPS</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Distanca</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.visits.map((v: any) => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">{v.agent?.name ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{v.customer?.businessName}</p>
                            <p className="text-xs text-gray-400">{v.customer?.code}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{v.openedAt ? formatDateTime(v.openedAt) : '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${GPS_STYLE[v.gpsStatus] ?? ''}`}>
                              {GPS_LABEL[v.gpsStatus] ?? v.gpsStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">
                            {v.gpsDistanceM != null ? `${v.gpsDistanceM} m` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          {reportType === 'territory' && data.territory && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-500" />Performanca e Territorit — {data.territory.length} zona</CardTitle>
              </CardHeader>
              <CardContent>
                {data.territory.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Nuk ka të dhëna</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Zona / Rajoni</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Klientë</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Shitje</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Porosi</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Inkaso</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Rritja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.territory.map((z: any) => (
                          <tr key={z.zoneId} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <p className="font-medium">{z.zoneName}</p>
                              <p className="text-xs text-gray-400">{z.regionName}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right">{z.activeCustomers}</td>
                            <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(z.totalSales)}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{z.orderCount}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{formatCurrency(z.totalPayments)}</td>
                            <td className="px-3 py-2.5 text-right">
                              {z.growthPct === null ? (
                                <span className="text-xs text-gray-400">—</span>
                              ) : (
                                <span className={`text-xs font-bold ${z.growthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {z.growthPct >= 0 ? '+' : ''}{z.growthPct}%
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === 'product_penetration' && data.penetration && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-purple-500" />Penetrimi i Produkteve — {data.totalActiveCustomers} klientë aktiv</CardTitle>
              </CardHeader>
              <CardContent>
                {data.penetration.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Nuk ka të dhëna</p>
                ) : (
                  <div className="space-y-2">
                    {data.penetration.map((p: any, i: number) => (
                      <div key={p.productId} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                        <span className="w-6 text-center text-xs font-bold text-gray-400 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.code} · {p.category} · {p.brand}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-purple-600">{p.penetrationPct}%</p>
                          <p className="text-xs text-gray-400">{p.uniqueCustomers} klientë · {formatCurrency(p.totalValue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === 'visit_effectiveness' && data.effectiveness && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-500" />Efektiviteti i Vizitave sipas Agjentit</CardTitle>
              </CardHeader>
              <CardContent>
                {data.effectiveness.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Nuk ka vizita në këtë periudhë</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Agjenti</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Vizita Gjithsej</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Me Porosi</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Norma Konv.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.effectiveness.map((a: any) => (
                          <tr key={a.agentId} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-medium">{a.agentName}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{a.totalVisits}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{a.visitsWithOrder}</td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={`text-sm font-bold ${a.conversionRate >= 50 ? 'text-green-600' : a.conversionRate >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {a.conversionRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === 'recovery_opportunities' && data.recovery && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertOctagon className="h-5 w-5 text-orange-500" />Mundësi Rikuperimi — {data.recovery.length} klientë</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recovery.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Asnjë klient nuk ka rënie të madhe</p>
                ) : (
                  <div className="space-y-2">
                    {data.recovery.map((c: any) => (
                      <div key={c.customerId} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {c.status === 'CRITICAL' ? 'KRITIK' : 'KUJDES'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.businessName}</p>
                          <p className="text-xs text-gray-400">{c.code} · {c.agentName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-600">{c.growthPct}%</p>
                          <p className="text-xs text-gray-400">Humbur: {formatCurrency(c.lostValue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reportType === 'product_pairs' && data.pairs && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shuffle className="h-5 w-5 text-teal-500" />Çift Produktesh — nga {data.orderCount} porosi</CardTitle>
              </CardHeader>
              <CardContent>
                {data.pairs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Nuk ka të dhëna të mjaftueshme</p>
                ) : (
                  <div className="space-y-2">
                    {data.pairs.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100">
                        <span className="w-6 text-center text-xs font-bold text-gray-400 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.productA.name}</p>
                            <p className="text-[10px] font-mono text-gray-400">{p.productA.code}</p>
                          </div>
                          <span className="text-gray-300 shrink-0">+</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.productB.name}</p>
                            <p className="text-[10px] font-mono text-gray-400">{p.productB.code}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-teal-600">{p.count}</p>
                          <p className="text-xs text-gray-400">herë bashkë</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
