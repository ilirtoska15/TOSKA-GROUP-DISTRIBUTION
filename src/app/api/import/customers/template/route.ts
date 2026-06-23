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
      'Emri Biznesit *', 'Kodi', 'Lloji Klientit', 'Kodi Biznesit Kryesor', 'Emri Njesise', 'Lloji Njesise',
      'Adresa', 'Telefon', 'Qyteti',
      'Nr Biznesit', 'Nr TVSH', 'Zona', 'Latitude', 'Longitude',
      'Statusi', 'Limiti Borxhit', 'Afati Pages (dite)', 'Email Agjentit', 'Shenime',
    ]
    // Standalone customer
    const ex1 = [
      'Supermarketi Besa', 'MK000001', 'CUSTOMER', '', '', '',
      'Rr. Elbasanit 45', '+355 69 123 4567', 'Tirane',
      'L72309048L', '', 'Zona 1', '41.3275', '19.8187',
      'ACTIVE', '50000', '30', 'agjent@toska.al', '',
    ]
    // Business group (parent)
    const ex2 = [
      'Dyqani Agim', 'MK000010', 'GROUP', '', '', '',
      'Rr. e Durresit', '+355 68 111 2222', 'Tirane',
      'K91820001V', 'M99887766', 'Zona 2', '', '',
      'ACTIVE', '100000', '30', 'agjent@toska.al', 'Grup biznesi',
    ]
    // Unit belonging to the group above (linked via Kodi Biznesit Kryesor = MK000010)
    const ex3 = [
      'Dyqani Agim', '', 'UNIT', 'MK000010', 'Agimi 3', 'DYQAN',
      'Rr. Myslym Shyri 12', '+355 68 987 6543', 'Durres',
      '', '', 'Zona 2', '41.3215', '19.4565',
      'ACTIVE', '0', '30', '', 'Pika 3',
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ex1, ex2, ex3])
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
