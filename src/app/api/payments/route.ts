import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  customerId: z.string(),
  orderId: z.string().optional(),
  amount: z.number().positive('Shuma duhet tÃ« jetÃ« pozitive'),
  method: z.enum(['CASH', 'BANK']),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const customerId = searchParams.get('customerId') ?? ''
  const method = searchParams.get('method') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { reference: { contains: search } },
      { customer: { businessName: { contains: search } } },
    ]
  }
  if (customerId) where.customerId = customerId
  if (method) where.method = method

  if (session.user.role === 'SHOFER' || session.user.role === 'AGJENT') {
    where.collectedById = session.user.id
  }

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where,
      include: {
        customer: { select: { id: true, businessName: true, code: true } },
        collectedBy: { select: { id: true, name: true } },
        order: { select: { id: true, reference: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.payment.count({ where }),
  ])

  return NextResponse.json({ payments, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check permission
  const userPermissions = await db.userPermission.findMany({ where: { userId: session.user.id } })
  if (!hasPermission(session.user.role, userPermissions, 'collect_payments')) {
    return NextResponse.json({ error: 'Nuk keni leje pÃ«r tÃ« mbledhur pagesa' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    if (data.amount <= 0) {
      return NextResponse.json({ error: 'Shuma duhet tÃ« jetÃ« pozitive' }, { status: 400 })
    }

    const reference = await generateReference(db, 'payment')

    const payment = await db.payment.create({
      data: {
        reference,
        customerId: data.customerId,
        orderId: data.orderId,
        amount: data.amount,
        method: data.method,
        collectedById: session.user.id,
        notes: data.notes,
      },
      include: {
        customer: { select: { businessName: true } },
        collectedBy: { select: { name: true } },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'payments',
      action: 'CREATE',
      recordId: payment.id,
      newValue: { reference, amount: data.amount, method: data.method },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
