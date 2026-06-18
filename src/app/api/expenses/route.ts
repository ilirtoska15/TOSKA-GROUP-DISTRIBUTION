import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  type: z.enum(['FUEL', 'SERVICE', 'PARKING', 'TOLLS', 'WAREHOUSE_SUPPLIES', 'OTHER']).or(z.string()),
  amount: z.number().positive(),
  description: z.string().min(1),
  expenseDate: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '30')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (!['ADMIN'].includes(session.user.role)) where.createdById = session.user.id

  const [expenses, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.expense.count({ where }),
  ])

  return NextResponse.json({
    expenses: expenses.map(e => ({ ...e, requestedBy: e.createdBy, code: `EXP-${e.id.slice(-6).toUpperCase()}` })),
    total, page, limit,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const expense = await db.expense.create({
      data: {
        createdById: session.user.id,
        type: data.type,
        amount: data.amount,
        description: data.description,
        status: 'PENDING',
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
