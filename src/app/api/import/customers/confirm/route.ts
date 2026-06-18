import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Row {
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
  valid: boolean
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { rows: Row[]; onDuplicate: 'update' | 'skip' }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body i pavlefshëm JSON' }, { status: 400 })
  }

  const { rows, onDuplicate = 'skip' } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Nuk ka rreshta për importim' }, { status: 400 })
  }

  const validRows = rows.filter(r => r.valid && !!r.businessName)
  if (validRows.length === 0) {
    return NextResponse.json({ error: 'Nuk ka rreshta valid' }, { status: 400 })
  }

  const agents = await db.user.findMany({
    where: { role: 'AGJENT', status: 'ACTIVE' },
    select: { id: true, email: true },
  })
  const agentByEmail = new Map(agents.map(a => [a.email.toLowerCase(), a.id]))

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of validRows) {
    try {
      const agentId = row.agentEmail
        ? (agentByEmail.get(row.agentEmail.toLowerCase()) ?? null)
        : null

      if (row.agentEmail && !agentId) {
        errors.push(`Rreshti ${row.rowIndex}: agjenti "${row.agentEmail}" nuk u gjet — importuar pa agjent`)
      }

      if (row.code) {
        const existing = await db.customer.findUnique({ where: { code: row.code } })
        if (existing) {
          if (onDuplicate === 'skip') { skipped++; continue }
          await db.customer.update({
            where: { code: row.code },
            data: {
              businessName: row.businessName,
              businessAddress: row.businessAddress || existing.businessAddress,
              phone: row.phone || existing.phone,
              city: row.city || existing.city,
              businessNumber: row.businessNumber || existing.businessNumber || null,
              vatNumber: row.vatNumber || existing.vatNumber || null,
              agentId: agentId ?? existing.agentId,
              debtLimit: parseFloat(row.debtLimit) || 0,
              paymentTermDays: parseInt(row.paymentTermDays) || 30,
              status: ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(row.status) ? row.status : existing.status,
              lat: row.lat ? parseFloat(row.lat) : existing.lat,
              lng: row.lng ? parseFloat(row.lng) : existing.lng,
              notes: row.notes || existing.notes || null,
            },
          })
          imported++
          continue
        }
      }

      const code = row.code || await generateReference(db, 'customer')
      await db.customer.create({
        data: {
          code,
          businessName: row.businessName,
          businessAddress: row.businessAddress || '',
          phone: row.phone || '',
          city: row.city || '',
          businessNumber: row.businessNumber || null,
          vatNumber: row.vatNumber || null,
          agentId: agentId ?? null,
          debtLimit: parseFloat(row.debtLimit) || 0,
          paymentTermDays: parseInt(row.paymentTermDays) || 30,
          status: ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(row.status) ? row.status : 'ACTIVE',
          lat: row.lat ? parseFloat(row.lat) : null,
          lng: row.lng ? parseFloat(row.lng) : null,
          notes: row.notes || null,
        },
      })
      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gabim i panjohur'
      errors.push(`Rreshti ${row.rowIndex}: ${msg.slice(0, 200)}`)
    }
  }

  await createAuditLog({
    userId: session.user.id,
    module: 'customers',
    action: 'CUSTOMERS_IMPORT',
    newValue: { total: rows.length, valid: validRows.length, imported, skipped, errors: errors.length, onDuplicate },
  })

  return NextResponse.json({ success: true, imported, skipped, errors })
}
