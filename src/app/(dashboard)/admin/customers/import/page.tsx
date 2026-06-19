'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Upload, Download, CheckCircle, XCircle, AlertTriangle, Users, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

interface ParsedRow {
  rowIndex: number
  businessName: string
  code: string
  city: string
  phone: string
  status: string
  agentEmail: string
  errors: string[]
  warnings: string[]
  valid: boolean
  [key: string]: unknown
}

interface PreviewResult {
  rows: ParsedRow[]
  stats: { total: number; valid: number; invalid: number; withWarnings: number }
}

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

export default function CustomersImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'update'>('skip')
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Lloji i file-it nuk lejohet. Përdor .xlsx ose .csv')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File është shumë i madh. Maksimumi 100MB.')
      return
    }

    setFileName(file.name)
    setParsing(true)
    setPreview(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import/customers/preview', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gabim gjatë analizës'); return }
      setPreview(data)
      setStep('preview')
    } catch {
      toast.error('Gabim i papritur gjatë leximit të file-it')
    } finally {
      setParsing(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    const validRows = preview.rows.filter(r => r.valid)
    if (validRows.length === 0) { toast.error('Nuk ka rreshta valid për importim'); return }

    setStep('importing')
    try {
      const res = await fetch('/api/import/customers/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview.rows, onDuplicate }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gabim gjatë importit'); setStep('preview'); return }
      setResult(data)
      setStep('done')
    } catch {
      toast.error('Gabim i papritur gjatë importit')
      setStep('preview')
    }
  }

  const DISPLAY_LIMIT = 100

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/customers">
          <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900">Importo Klientë nga Excel</h1>
        </div>
      </div>

      {/* Upload step */}
      {(step === 'upload' || step === 'preview') && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Hapi 1 — Ngarko File Excel</CardTitle>
              <a href="/api/import/customers/template">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Shkarko Template
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {parsing ? (
                <div className="space-y-2">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-500">Duke analizuar file-in...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-10 w-10 text-gray-300 mx-auto" />
                  {fileName ? (
                    <p className="text-sm font-medium text-gray-700">{fileName}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Tërhiq file-in këtu ose <span className="text-primary font-medium">kliko për të zgjedhur</span></p>
                  )}
                  <p className="text-xs text-gray-400">.xlsx · .csv · max 100MB</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Kolona obligative: <strong>Emri Biznesit</strong>. Shkarko template-in sipër për shembullin e saktë.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Preview step */}
      {step === 'preview' && preview && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Gjithsej', val: preview.stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
              { label: 'Valid', val: preview.stats.valid, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Gabime', val: preview.stats.invalid, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Paralajmërime', val: preview.stats.withWarnings, color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Options + Confirm */}
          <Card>
            <CardHeader><CardTitle className="text-base">Hapi 2 — Opsionet e Importit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Nëse kodi i klientit ekziston tashmë:
                </label>
                <div className="flex gap-3">
                  {(['skip', 'update'] as const).map(opt => (
                    <label key={opt} className={`flex-1 flex items-center gap-2 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${onDuplicate === opt ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" className="accent-primary" checked={onDuplicate === opt} onChange={() => setOnDuplicate(opt)} />
                      <div>
                        <p className="text-sm font-medium">{opt === 'skip' ? 'Skip — mos ndrysho' : 'Azhurno të dhënat'}</p>
                        <p className="text-xs text-gray-400">{opt === 'skip' ? 'Klienti ekzistues mbetet i pandryshuar' : 'Mbishkruaj me të dhënat nga Excel'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">
                  Do të importohen <strong className="text-green-700">{preview.stats.valid}</strong> klientë valid
                  {preview.stats.invalid > 0 && <>, <strong className="text-red-600">{preview.stats.invalid}</strong> do të skipp-ohen</>}
                </p>
                <Button onClick={handleConfirm} disabled={preview.stats.valid === 0} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Konfirmo Importin ({preview.stats.valid})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Hapi 3 — Preview
                {preview.rows.length > DISPLAY_LIMIT && (
                  <span className="ml-2 text-xs font-normal text-gray-400">(duke shfaqur {DISPLAY_LIMIT} nga {preview.rows.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-12">#</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-8"></th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Emri Biznesit</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Kodi</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Qyteti</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Telefon</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Mesazhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.rows.slice(0, DISPLAY_LIMIT).map(row => (
                      <tr key={row.rowIndex} className={!row.valid ? 'bg-red-50/40' : row.warnings.length > 0 ? 'bg-amber-50/30' : ''}>
                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{row.rowIndex}</td>
                        <td className="px-2 py-2.5">
                          {!row.valid
                            ? <XCircle className="h-4 w-4 text-red-500" />
                            : row.warnings.length > 0
                              ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                              : <CheckCircle className="h-4 w-4 text-green-500" />}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{row.businessName || <span className="text-red-400 italic">mungon</span>}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{row.code || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.city || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{row.phone || '—'}</td>
                        <td className="px-4 py-2.5 max-w-[260px]">
                          {row.errors.map((e, i) => (
                            <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                              <XCircle className="h-3 w-3 mt-0.5 shrink-0" />{e.replace(/^Rreshti \d+: /, '')}
                            </p>
                          ))}
                          {row.warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600 flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{w.replace(/^Rreshti \d+: /, '')}
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Importing spinner */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Duke importuar klientët...</p>
            <p className="text-xs text-gray-400 mt-1">Ju lutemi mos e mbyllni faqen</p>
          </CardContent>
        </Card>
      )}

      {/* Done step */}
      {step === 'done' && result && (
        <Card>
          <CardContent className="py-8 space-y-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-900">Importi u krye</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="text-center bg-green-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                <p className="text-xs text-gray-500">Importuar</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
                <p className="text-xs text-gray-500">Skippuar</p>
              </div>
              <div className="text-center bg-red-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                <p className="text-xs text-gray-500">Gabime</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                    <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{e}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Link href="/admin/customers">
                <Button>Shko te lista e klientëve</Button>
              </Link>
              <Button variant="outline" onClick={() => { setStep('upload'); setPreview(null); setResult(null); setFileName('') }}>
                Importo sërish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
