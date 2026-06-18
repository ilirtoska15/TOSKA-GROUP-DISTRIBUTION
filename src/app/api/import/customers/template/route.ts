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
      'Emri Biznesit *', 'Kodi', 'Adresa', 'Telefon', 'Qyteti',
      'Nr Biznesit', 'Nr TVSH', 'Zona', 'Latitude', 'Longitude',
      'Statusi', 'Limiti Borxhit', 'Afati Pages (dite)', 'Email Agjentit', 'Shenime',
    ]
    const ex1 = [
      'Supermarketi Besa', 'MK000001', 'Rr. Elbasanit 45', '+355 69 123 4567', 'Tirane',
      'L72309048L', '', 'Zona 1', '41.3275', '19.8187',
      'ACTIVE', '50000', '30', 'agjent@toska.al', '',
    ]
    const ex2 = [
      'Dyqani Fatosi', '', 'Rr. Myslym Shyri 12', '+355 68 987 6543', 'Durres',
      '', 'K91820001V', 'Zona 2', '', '',
      'ACTIVE', '0', '14', '', 'Klient i ri',
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ex1, ex2])
    ws['!cols'] = headers.map(() => ({ wch: 22 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Klientet')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-klientet.xlsx"',
      },
    })
  } catch (err) {
    console.error('[import/customers/template]', err)
    return NextResponse.json({ error: 'Gabim gjatë krijimit të template-it' }, { status: 500 })
  }
}
