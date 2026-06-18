'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, Keyboard, Search, Plus, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

interface Product {
  id: string
  code: string
  name: string
  barcode?: string
  pakoCopje?: number
  stockCopje: number
}

interface InventoryLine {
  productId: string
  productName: string
  productCode: string
  expectedQty: number
  countedQty: number
  unit: string
  diffQty: number
  diffReason: string
}

type ScanMode = 'camera' | 'manual'

export default function DepoistInventoryPage() {
  const [scanMode, setScanMode] = useState<ScanMode>('manual')
  const [manualCode, setManualCode] = useState('')
  const [foundProduct, setFoundProduct] = useState<Product | null>(null)
  const [searching, setSearching] = useState(false)
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState('cope')
  const [diffReason, setDiffReason] = useState('')
  const [lines, setLines] = useState<InventoryLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [_cameraActive, setCameraActive] = useState(false)
  const scannerRef = useRef<{ clear: () => void } | null>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.clear() } catch {}
      }
    }
  }, [])

  const initCamera = useCallback(async () => {
    if (typeof window === 'undefined') return
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode')
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 150 }, rememberLastUsedCamera: true },
        false
      )
      scanner.render(
        (decodedText: string) => {
          setManualCode(decodedText)
          lookupProduct(decodedText)
        },
        () => {}
      )
      scannerRef.current = scanner
      setCameraActive(true)
    } catch {
      toast.error('Kamera nuk u hap. Përdor modalitetin manual.')
      setScanMode('manual')
    }
  }, [])

  useEffect(() => {
    if (scanMode === 'camera') {
      initCamera()
    } else {
      if (scannerRef.current) {
        try { scannerRef.current.clear() } catch {}
        scannerRef.current = null
        setCameraActive(false)
      }
      setTimeout(() => manualInputRef.current?.focus(), 100)
    }
  }, [scanMode, initCamera])

  const lookupProduct = async (query: string) => {
    if (!query.trim()) return
    setSearching(true)
    setFoundProduct(null)
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=1`)
      const data = await res.json()
      if (data.products?.length > 0) {
        setFoundProduct(data.products[0])
        setQty(1)
        setUnit('cope')
        setDiffReason('')
      } else {
        toast.error('Produkti nuk u gjet')
      }
    } finally {
      setSearching(false)
    }
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    lookupProduct(manualCode)
  }

  const addLine = () => {
    if (!foundProduct) return
    const expectedQty = foundProduct.stockCopje
    const copjeQty = unit === 'pako' && foundProduct.pakoCopje ? qty * foundProduct.pakoCopje : qty
    const diff = copjeQty - expectedQty

    const existing = lines.findIndex(l => l.productId === foundProduct.id)
    const newLine: InventoryLine = {
      productId: foundProduct.id,
      productName: foundProduct.name,
      productCode: foundProduct.code,
      expectedQty,
      countedQty: copjeQty,
      unit,
      diffQty: diff,
      diffReason: diff !== 0 ? diffReason : '',
    }

    if (existing >= 0) {
      setLines(prev => prev.map((l, i) => i === existing ? newLine : l))
      toast.success('Linja u përditësua')
    } else {
      setLines(prev => [...prev, newLine])
      toast.success('Produkti u shtua')
    }

    setFoundProduct(null)
    setManualCode('')
    setQty(1)
    setDiffReason('')
    manualInputRef.current?.focus()
  }

  const removeLine = (productId: string) => {
    setLines(prev => prev.filter(l => l.productId !== productId))
  }

  const handleSubmit = async () => {
    if (lines.length === 0) { toast.error('Shto të paktën një produkt'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_inventory',
          type: 'PARTIAL',
          lines: lines.map(l => ({
            productId: l.productId,
            expectedQty: l.expectedQty,
            countedQty: l.countedQty,
            diffReason: l.diffReason || undefined,
          })),
        }),
      })
      if (res.ok) {
        toast.success('Inventarizimi u ruajt. Stoku u korrigjua.')
        setLines([])
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Gabim')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const discrepancies = lines.filter(l => l.diffQty !== 0)

  return (
    <div className="p-4 space-y-4 pb-32">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inventarizim</h1>
        <p className="text-sm text-gray-500">Skanoje ose kërko produktin, numëro sasinë</p>
      </div>

      {/* Mode Selector */}
      <div className="flex rounded-xl border overflow-hidden bg-white">
        <button
          onClick={() => setScanMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${scanMode === 'manual' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Keyboard className="h-4 w-4" />Manual / USB
        </button>
        <button
          onClick={() => setScanMode('camera')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${scanMode === 'camera' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Camera className="h-4 w-4" />Kamera
        </button>
      </div>

      {/* Camera scanner */}
      {scanMode === 'camera' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div id="qr-reader" className="w-full" />
        </div>
      )}

      {/* Manual input */}
      {scanMode === 'manual' && (
        <form onSubmit={handleManualSearch} className="flex gap-2">
          <Input
            ref={manualInputRef}
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Shkruaj barkodin, kodin ose emrin..."
            className="flex-1"
          />
          <Button type="submit" loading={searching}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* Product found card */}
      {foundProduct && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{foundProduct.name}</span>
              <span className="font-mono text-xs text-gray-400">{foundProduct.code}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Stok sistem:</span>
              <span className="font-bold text-gray-900">{foundProduct.stockCopje} copë</span>
              {foundProduct.pakoCopje && (
                <span className="text-gray-400">({Math.floor(foundProduct.stockCopje / foundProduct.pakoCopje)} pako)</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sasia e Numëruar *</Label>
                <Input type="number" min="0" value={qty} onChange={e => setQty(Number(e.target.value))} />
              </div>
              <div>
                <Label>Njësia</Label>
                <select className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                  value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="cope">Copë</option>
                  {foundProduct.pakoCopje && <option value="pako">Pako ({foundProduct.pakoCopje} copë)</option>}
                </select>
              </div>
            </div>
            {(() => {
              const copjeQty = unit === 'pako' && foundProduct.pakoCopje ? qty * foundProduct.pakoCopje : qty
              const diff = copjeQty - foundProduct.stockCopje
              if (diff !== 0) return (
                <div>
                  <div className={`flex items-center gap-2 text-sm mb-2 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Diferenca: {diff > 0 ? '+' : ''}{diff} copë
                  </div>
                  <Label>Arsyeja e Diferencës *</Label>
                  <Input value={diffReason} onChange={e => setDiffReason(e.target.value)}
                    placeholder="Shpjego diferencën..." />
                </div>
              )
              return null
            })()}
            <Button onClick={addLine} className="w-full">
              <Plus className="h-4 w-4 mr-1" />Shto në Listë
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Inventory lines */}
      {lines.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Lista e Inventarizimit</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{lines.length} produkte</span>
              {discrepancies.length > 0 && (
                <Badge variant="warning">{discrepancies.length} diferencë</Badge>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border divide-y">
            {lines.map(l => (
              <div key={l.productId} className={`p-3 ${l.diffQty !== 0 ? 'bg-amber-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{l.productName}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>Sistem: {l.expectedQty}</span>
                      <span>Numëruar: {l.countedQty}</span>
                      {l.diffQty !== 0 && (
                        <span className={`font-semibold ${l.diffQty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {l.diffQty > 0 ? '+' : ''}{l.diffQty}
                        </span>
                      )}
                    </div>
                    {l.diffReason && <p className="text-xs text-amber-700 mt-0.5">{l.diffReason}</p>}
                  </div>
                  <button onClick={() => removeLine(l.productId)} className="text-gray-400 hover:text-red-500 flex-shrink-0 mt-0.5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button onClick={handleSubmit} loading={submitting} className="w-full" size="lg">
              <CheckCircle className="h-4 w-4 mr-2" />Ruaj Inventarizimin ({lines.length} produkte)
            </Button>
            {discrepancies.length > 0 && (
              <p className="text-xs text-center text-amber-600 mt-2">
                {discrepancies.length} diferencë do të korrigjohet automatikisht në stok
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
