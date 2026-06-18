import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024

const FIELD_ALIASES: Record<string, string[]> = {
  businessName: ['emribiznesit', 'businessname', 'emri', 'name', 'biznesi'],
  code: ['kodi', 'code', 'kodiklientit'],
  businessAddress: ['adresa', 'businessaddress', 'address', 'adresabiznesit'],
  phone: ['telefon', 'phone', 'tel', 'numeritelfonit', 'nrtelfonit'],
  city: ['qyteti', 'city'],
  businessNumber: ['nrbiznesit', 'businessnumber', 'nipt'],
  vatNumber: ['nrtvsh', 'vatnumber', 'tvsh', 'vat'],
  zone: ['zona', 'zone'],
  lat: ['latitude', 'lat', 'gjeresia'],
  lng: ['longitude', 'lng', 'long', 'gjatesia'],
  status: ['statusi', 'status'],
  debtLimit: ['limitiborxhit', 'debtlimit', 'limiti'],
  paymentTermDays: ['afatipagesdite', 'paymenttermdays', 'paymentduedays', 'afatipages', 'afati'],
  agentEmail: ['emailagjentit', 'agentemail', 'agjenti', 'agent'],
  notes: ['shenime', 'notes'],
}

export interface ParsedCustomerRow {
  rowIndex: number
  businessName: string
  code: string
  businessAddress: string
  phone: string
  city: string
  businessNumber: string
  vatNumber: string
  zone: string
  lat: string
  lng: string
  status: string
  debtLimit: string
  paymentTermDays: string
  agentEmail: string
  notes: string
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

function validateRow(rowIndex: number, row: unknown[], idx: Record<string, number>): ParsedCustomerRow {
  const errors: string[] = []
  const warnings: string[] = []
  const g = (f: string) => cell(row, idx, f)

  const businessName = g('businessName')
  const code = g('code')
  const businessAddress = g('businessAddress')
  const phone = g('phone')
  const city = g('city')
  const businessNumber = g('businessNumber')
  const vatNumber = g('vatNumber')
  const zone = g('zone')
  const latRaw = g('lat')
  const lngRaw = g('lng')
  const rawStatus = g('status').toUpperCase() || 'ACTIVE'
  const debtRaw = g('debtLimit') || '0'
  const ptRaw = g('paymentTermDays') || '30'
  const agentEmail = g('agentEmail')
  const notes = g('notes')

  if (!businessName) errors.push(`Rreshti ${rowIndex}: mungon emri i biznesit`)
  if (!businessAddress) warnings.push(`Rreshti ${rowIndex}: adresa mungon`)
  if (!phone) warnings.push(`Rreshti ${rowIndex}: telefoni mungon`)
  if (!city) warnings.push(`Rreshti ${rowIndex}: qyteti mungon`)

  const status = ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(rawStatus) ? rawStatus : 'ACTIVE'
  if (rawStatus && !['ACTIVE', 'INACTIVE', 'BLOCKED', ''].includes(rawStatus)) {
    warnings.push(`Rreshti ${rowIndex}: statusi "${rawStatus}" i panjohur — u vendos ACTIVE`)
  }

  const debtNum = parseFloat(debtRaw.replace(',', '.'))
  const debtLimit = isNaN(debtNum) || debtNum < 0 ? '0' : String(debtNum)
  if (debtRaw && debtRaw !== '0' && (isNaN(debtNum) || debtNum < 0)) {
    warnings.push(`Rreshti ${rowIndex}: limiti i borxhit i pavlefshëm — u vendos 0`)
  }

  const ptNum = parseInt(ptRaw, 10)
  const paymentTermDays = isNaN(ptNum) || ptNum < 0 ? '30' : String(ptNum)
  if (ptRaw && ptRaw !== '30' && (isNaN(ptNum) || ptNum < 0)) {
    warnings.push(`Rreshti ${rowIndex}: afati i pagesës i pavlefshëm — u vendos 30`)
  }

  const latOk = !latRaw || !isNaN(parseFloat(latRaw))
  const lngOk = !lngRaw || !isNaN(parseFloat(lngRaw))
  if (latRaw && !latOk) warnings.push(`Rreshti ${rowIndex}: latitude i pavlefshëm — u injorua`)
  if (lngRaw && !lngOk) warnings.push(`Rreshti ${rowIndex}: longitude i pavlefshëm — u injorua`)

  return {
    rowIndex, businessName, code, businessAddress, phone, city,
    businessNumber, vatNumber, zone,
    lat: latOk ? latRaw : '',
    lng: lngOk ? lngRaw : '',
    status, debtLimit, paymentTermDays, agentEmail, notes,
    errors, warnings,
    valid: errors.length === 0 && !!businessName,
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
    console.error('[import/customers/preview]', err)
    return NextResponse.json({ error: 'Gabim gjatë leximit të file-it Excel' }, { status: 500 })
  }
}
