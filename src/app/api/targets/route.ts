import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  agentId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  targetAmount: z.number().min(0).optional(),
  targetVisits: z.number().int().min(0).optional(),
  targetOrders: z.number().int().min(0).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const where: Record<string, unknown> = { year, month }
  if (session.user.role === 'AGJENT') {
    where.userId = session.user.id
  } else if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ targets: [] })
  }

  const targets = await db.target.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })

  // Calculate achieved amounts
  const enriched = await Promise.all(targets.map(async t => {
    const startOfMonth = new Date(t.year, t.month - 1, 1)
    const endOfMonth = new Date(t.year, t.month, 0, 23, 59, 59)

    const [orders, visits] = await Promise.all([
      db.order.aggregate({
        where: {
          createdById: t.userId,
          status: { in: ['APROVUAR', 'PERGATITJE', 'GATSHME', 'DORËZUAR'] },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.visit.count({
        where: {
          agentId: t.userId,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
    ])

    return {
      id: t.id,
      month: t.month,
      year: t.year,
      targetAmount: t.salesTarget,
      targetVisits: t.visitTarget,
      targetOrders: t.orderTarget,
      achievedAmount: orders._sum.totalAmount ?? 0,
      achievedVisits: visits,
      achievedOrders: orders._count,
      agent: { id: t.userId, name: t.user.name },
    }
  }))

  return NextResponse.json({ targets: enriched })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const target = await db.target.upsert({
      where: { userId_month_year: { userId: data.agentId, month: data.month, year: data.year } },
      create: {
        userId: data.agentId,
        month: data.month,
        year: data.year,
        salesTarget: data.targetAmount ?? 0,
        visitTarget: data.targetVisits ?? 0,
        orderTarget: data.targetOrders ?? 0,
      },
      update: {
        salesTarget: data.targetAmount ?? 0,
        visitTarget: data.targetVisits ?? 0,
        orderTarget: data.targetOrders ?? 0,
      },
    })

    return NextResponse.json(target, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
