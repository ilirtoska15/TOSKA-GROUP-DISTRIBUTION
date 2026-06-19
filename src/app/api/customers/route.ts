import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  businessName: z.string().min(1),
  businessAddress: z.string().min(1),
  city: z.string().min(1),
  regionId: z.string().optional(),
  zoneId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  businessNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  phone: z.string().min(1),
  phone2: z.string().optional(),
  contactPerson: z.string().optional(),
  agentId: z.string().optional(),
  debtLimit: z.number().min(0).default(0),
  paymentTermDays: z.number().min(0).default(30),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search.trim()) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.status = status
    if (agentId) where.agentId = agentId

    // Agents can only see their own customers
    if (session.user.role === 'AGJENT') {
      where.agentId = session.user.id
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          _count: { select: { orders: true, visits: true } },
        },
        orderBy: { businessName: 'asc' },
        skip,
        take: limit,
      }),
      db.customer.count({ where }),
    ])

    return NextResponse.json({ customers, total, page, limit })
  } catch (err) {
    const e = err as { message?: string; code?: string; meta?: unknown; stack?: string }
    console.error('[GET /api/customers]', {
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    })
    return NextResponse.json({ customers: [], total: 0, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const code = await generateReference(db, 'customer')

    const customer = await db.customer.create({
      data: { ...data, code },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'customers',
      action: 'CREATE',
      recordId: customer.id,
      newValue: customer,
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/customers] error:', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: err.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
