import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024

const FIELD_ALIASES: Record<string, string[]> = {
  name: ['emriproduktit', 'name', 'emri', 'produkti'],
  code: ['kodi', 'code', 'kodiproduktit'],
  category: ['kategoria', 'category', 'cat'],
  brand: ['brand', 'brandi', 'marka'],
  description: ['pershkrimi', 'description', 'pershkrim'],
  salesPrice: ['cmimi', 'salesprice', 'price', 'cmimiishitjes'],
  discountPercent: ['rabati', 'discountpercent', 'rabat', 'discount', 'zbritja'],
  pakoCopje: ['copjenpako', 'piecesperpackage', 'pakocope', 'copenepako', 'pakocop'],
  barcode: ['barcode', 'barkodi'],
  lotNumber: ['lot', 'lotnumber', 'numrilotit', 'batchnumber'],
  expiryDate: ['afatskadence', 'expirydate', 'expiry', 'skadenca'],
  initialStock: ['stokufillestar', 'initialstock', 'stoku', 'stock'],
  status: ['statusi', 'status'],
  photo: ['fotourl', 'imageurl', 'photo', 'foto', 'image'],
}

export interface ParsedProductRow {
  rowIndex: number
  name: string
  code: string
  category: string
  brand: string
  description: string
  salesPrice: string
  discountPercent: string
  pakoCopje: string
  barcode: string
  lotNumber: string
  expiryDate: string
  initialStock: string
  status: string
  photo: string
  errors: string[]
  warnings: string[]
  valid: boolean
}

function norm(h: unknown): string {
  return String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildIdx(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {}
  headers.forEach((h, i) => {
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(h) && !(field in idx)) idx[field] = i
    }
  })
  return idx
}

function cell(row: unknown[], idx: Record<string, number>, field: string): string {
  const i = idx[field]
  return i === undefined ? '' : String(row[i] ?? '').trim()
}

function validateRow(rowIndex: number, row: unknown[], idx: Record<string, number>): ParsedProductRow {
  const errors: string[] = []
  const warnings: string[] = []
  const g = (f: string) => cell(row, idx, f)

  const name = g('name')
  const code = g('code')
  const category = g('category')
  const brand = g('brand')
  const description = g('description')
  const salesPriceRaw = g('salesPrice')
  const discountRaw = g('discountPercent') || '0'
  const pakoCopjeRaw = g('pakoCopje')
  const barcode = g('barcode')
  const lotNumber = g('lotNumber')
  const expiryDate = g('expiryDate')
  const initialStockRaw = g('initialStock') || '0'
  const rawStatus = g('status').toUpperCase() || 'ACTIVE'
  const photo = g('photo')

  if (!name) errors.push(`Rreshti ${rowIndex}: mungon emri i produktit`)
  if (!category) errors.push(`Rreshti ${rowIndex}: mungon kategoria`)

  const priceNum = parseFloat(salesPriceRaw.replace(',', '.'))
  if (!salesPriceRaw || isNaN(priceNum) || priceNum <= 0) {
    errors.push(`Rreshti ${rowIndex}: çmimi duhet të jetë numër pozitiv (mora: "${salesPriceRaw}")`)
  }
  const salesPrice = isNaN(priceNum) ? salesPriceRaw : String(priceNum)

  const discountNum = parseFloat(discountRaw.replace(',', '.'))
  let discountPercent = '0'
  if (!isNaN(discountNum) && discountNum >= 0 && discountNum <= 100) {
    discountPercent = String(discountNum)
  } else if (discountRaw && discountRaw !== '0') {
    warnings.push(`Rreshti ${rowIndex}: rabati "${discountRaw}" i pavlefshëm (duhet 0-100) — u vendos 0`)
  }

  let pakoCopje = ''
  if (pakoCopjeRaw) {
    const n = parseInt(pakoCopjeRaw, 10)
    if (!isNaN(n) && n >= 1) pakoCopje = String(n)
    else warnings.push(`Rreshti ${rowIndex}: copë në pako "${pakoCopjeRaw}" i pavlefshëm — u injorua`)
  }

  const stockNum = parseInt(initialStockRaw, 10)
  const initialStock = !isNaN(stockNum) && stockNum >= 0 ? String(stockNum) : '0'
  if (initialStockRaw && initialStockRaw !== '0' && (isNaN(stockNum) || stockNum < 0)) {
    warnings.push(`Rreshti ${rowIndex}: stoku fillestar i pavlefshëm — u vendos 0`)
  }

  const validStatuses = ['ACTIVE', 'INACTIVE']
  const statusBase = validStatuses.includes(rawStatus) ? rawStatus : 'ACTIVE'
  const status = !photo && statusBase === 'ACTIVE' ? 'INACTIVE' : statusBase

  if (!photo) warnings.push(`Rreshti ${rowIndex}: foto URL mungon — produkti importohet si JOAKTIV`)

  return {
    rowIndex, name, code, category, brand, description,
    salesPrice, discountPercent, pakoCopje, barcode, lotNumber,
    expiryDate, initialStock, status, photo,
    errors, warnings,
    valid: errors.length === 0 && !!name && !!category,
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nuk u gjet asnjë file' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File shumë i madh. Maksimumi 10MB.' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json({ error: 'Lloji i file-it nuk lejohet. Përdor .xlsx ose .csv' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    if (raw.length < 2) return NextResponse.json({ error: 'File-i është bosh ose nuk ka rreshta' }, { status: 400 })

    const headers = (raw[0] as unknown[]).map(norm)
    const idx = buildIdx(headers)
    const dataRows = (raw.slice(1) as unknown[][]).filter(r => r.some(c => String(c ?? '').trim() !== ''))

    if (dataRows.length === 0) return NextResponse.json({ error: 'Nuk ka rreshta me të dhëna' }, { status: 400 })

    const rows = dataRows.map((r, i) => validateRow(i + 2, r, idx))

    return NextResponse.json({
      rows,
      stats: {
        total: rows.length,
        valid: rows.filter(r => r.valid).length,
        invalid: rows.filter(r => !r.valid).length,
        withWarnings: rows.filter(r => r.warnings.length > 0).length,
      },
    })
  } catch (err) {
    console.error('[import/products/preview]', err)
    return NextResponse.json({ error: 'Gabim gjatë leximit të file-it Excel' }, { status: 500 })
  }
}
