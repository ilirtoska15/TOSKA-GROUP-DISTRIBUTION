import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const headers = [
      'Emri Produktit *', 'Kodi', 'Kategoria *', 'Brand', 'Pershkrimi',
      'Cmimi *', 'Rabati %', 'Cope ne Pako', 'Barcode', 'Lot',
      'Afat Skadence (YYYY-MM-DD)', 'Stoku Fillestar', 'Statusi', 'Foto URL',
    ]
    const ex1 = [
      'Uje Mineral 0.5L', 'PR000001', 'Pije', 'Tepelena', 'Uje mineral natyral 0.5 liter',
      '35', '0', '24', '5901234123457', 'LOT-2024-001',
      '2025-12-31', '500', 'ACTIVE', 'https://example.com/foto1.jpg',
    ]
    const ex2 = [
      'Qumesht Gjysem-yndyror 1L', '', 'Bulmetore', 'Tirana Milk', '',
      '120', '5', '12', '', '',
      '2024-06-30', '200', 'ACTIVE', '',
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ex1, ex2])
    ws['!cols'] = headers.map(() => ({ wch: 24 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produktet')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-produktet.xlsx"',
      },
    })
  } catch (err) {
    console.error('[import/products/template]', err)
    return NextResponse.json({ error: 'Gabim gjatë krijimit të template-it' }, { status: 500 })
  }
}
