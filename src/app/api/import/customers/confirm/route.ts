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
  customerType: string
  parentBusinessCode: string
  unitName: string
  unitType: string
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

const normStatus = (s: string, fallback: string) =>
  ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(s) ? s : fallback

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

  // Maps a customer code → its id (existing or just-created), so units can resolve their parent.
  const codeToId = new Map<string, string>()
  const allCodes = validRows.flatMap(r => [r.code, r.parentBusinessCode].filter(Boolean))
  if (allCodes.length > 0) {
    const existingByCode = await db.customer.findMany({
      where: { code: { in: Array.from(new Set(allCodes)) } },
      select: { id: true, code: true },
    })
    existingByCode.forEach(c => codeToId.set(c.code, c.id))
  }

  const resolveAgent = (row: Row): string | null | undefined => {
    if (!row.agentEmail) return undefined // undefined = "not specified", leave to fallback
    const id = agentByEmail.get(row.agentEmail.toLowerCase())
    if (!id) errors.push(`Rreshti ${row.rowIndex}: agjenti "${row.agentEmail}" nuk u gjet — importuar pa agjent`)
    return id ?? null
  }

  // Process parents/standalone first so units can link to a freshly-created group.
  const nonUnits = validRows.filter(r => r.customerType !== 'UNIT')
  const unitRows = validRows.filter(r => r.customerType === 'UNIT')

  for (const row of nonUnits) {
    try {
      const agentId = resolveAgent(row)
      const isBusinessGroup = row.customerType === 'GROUP'

      if (row.code && codeToId.has(row.code)) {
        if (onDuplicate === 'skip') { skipped++; continue }
        const existing = await db.customer.findUnique({ where: { code: row.code } })
        if (!existing) { skipped++; continue }
        const updated = await db.customer.update({
          where: { code: row.code },
          data: {
            businessName: row.businessName,
            businessAddress: row.businessAddress || existing.businessAddress,
            phone: row.phone || existing.phone,
            city: row.city || existing.city,
            businessNumber: row.businessNumber || existing.businessNumber || null,
            vatNumber: row.vatNumber || existing.vatNumber || null,
            agentId: agentId === undefined ? existing.agentId : (agentId ?? existing.agentId),
            debtLimit: parseFloat(row.debtLimit) || 0,
            paymentTermDays: parseInt(row.paymentTermDays) || 30,
            status: normStatus(row.status, existing.status),
            lat: row.lat ? parseFloat(row.lat) : existing.lat,
            lng: row.lng ? parseFloat(row.lng) : existing.lng,
            notes: row.notes || existing.notes || null,
            isBusinessGroup,
          },
        })
        codeToId.set(updated.code, updated.id)
        imported++
        continue
      }

      const code = row.code || await generateReference(db, 'customer')
      const created = await db.customer.create({
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
          status: normStatus(row.status, 'ACTIVE'),
          lat: row.lat ? parseFloat(row.lat) : null,
          lng: row.lng ? parseFloat(row.lng) : null,
          notes: row.notes || null,
          isBusinessGroup,
        },
      })
      codeToId.set(created.code, created.id)
      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gabim i panjohur'
      errors.push(`Rreshti ${row.rowIndex}: ${msg.slice(0, 200)}`)
    }
  }

  // Cache parent records for legal/commercial-field inheritance.
  const parentCache = new Map<string, Awaited<ReturnType<typeof db.customer.findUnique>>>()
  const getParent = async (id: string) => {
    if (!parentCache.has(id)) parentCache.set(id, await db.customer.findUnique({ where: { id } }))
    return parentCache.get(id) ?? null
  }

  for (const row of unitRows) {
    try {
      const parentId = codeToId.get(row.parentBusinessCode)
      if (!parentId) {
        errors.push(`Rreshti ${row.rowIndex}: biznesi kryesor "${row.parentBusinessCode}" nuk u gjet — njësia u anashkalua`)
        skipped++
        continue
      }
      const parent = await getParent(parentId)
      if (!parent) {
        errors.push(`Rreshti ${row.rowIndex}: biznesi kryesor "${row.parentBusinessCode}" nuk u gjet`)
        skipped++
        continue
      }

      // Unit inherits legal & commercial terms from the parent group; address/contact are unit-specific.
      const agentId = resolveAgent(row)
      const data = {
        businessName: row.businessName || parent.businessName,
        businessAddress: row.businessAddress || '',
        phone: row.phone || parent.phone,
        city: row.city || parent.city,
        businessNumber: row.businessNumber || parent.businessNumber || null,
        vatNumber: row.vatNumber || parent.vatNumber || null,
        agentId: agentId === undefined ? parent.agentId : (agentId ?? parent.agentId),
        debtLimit: parent.debtLimit,
        paymentTermDays: parent.paymentTermDays,
        status: normStatus(row.status, 'ACTIVE'),
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
        notes: row.notes || null,
        parentCustomerId: parentId,
        isBusinessGroup: false,
        unitName: row.unitName || null,
        unitType: row.unitType || null,
      }

      if (row.code && codeToId.has(row.code)) {
        if (onDuplicate === 'skip') { skipped++; continue }
        const updated = await db.customer.update({ where: { code: row.code }, data })
        codeToId.set(updated.code, updated.id)
        imported++
        continue
      }

      const code = row.code || await generateReference(db, 'customer')
      const created = await db.customer.create({ data: { ...data, code } })
      codeToId.set(created.code, created.id)
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
