import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const updateSchema = z.object({
  businessName: z.string().min(1).optional(),
  businessAddress: z.string().optional(),
  city: z.string().optional(),
  regionId: z.string().optional().nullable(),
  zoneId: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  businessNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  phone: z.string().optional(),
  phone2: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
  debtLimit: z.number().min(0).optional(),
  paymentTermDays: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  notes: z.string().optional().nullable(),
  parentCustomerId: z.string().optional().nullable(),
  isBusinessGroup: z.boolean().optional(),
  unitName: z.string().optional().nullable(),
  unitType: z.string().optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const customer = await db.customer.findUnique({
      where: { id: params.id },
      include: {
        agent: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        zone: { select: { id: true, name: true } },
        parentCustomer: { select: { id: true, code: true, businessName: true } },
        units: {
          select: {
            id: true, code: true, businessName: true, unitName: true, unitType: true,
            status: true, city: true, phone: true, businessAddress: true,
            _count: { select: { orders: true } },
          },
          orderBy: { businessName: 'asc' },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { lines: { include: { product: { select: { name: true } } } } },
        },
        visits: { orderBy: { createdAt: 'desc' }, take: 10, include: { agent: { select: { name: true } } } },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        returns: { orderBy: { createdAt: 'desc' }, take: 5 },
        documents: true,
      },
    })

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const now = new Date()
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const prev60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const orderStatusFilter = { in: ['SUBMITTED', 'APROVUAR', 'DORËZUAR'] as string[] }

    const [
      deliveredAmount,
      paidAmount,
      topProductsRaw,
      allOrderDates,
      last30Sales,
      prev30Sales,
    ] = await Promise.all([
      db.order.aggregate({
        where: { customerId: params.id, status: 'DORËZUAR' },
        _sum: { totalAmount: true },
      }),
      db.payment.aggregate({
        where: { customerId: params.id },
        _sum: { amount: true },
      }),
      db.orderLine.groupBy({
        by: ['productId'],
        where: { order: { customerId: params.id, status: orderStatusFilter } },
        _sum: { quantityCopje: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10,
      }),
      db.order.findMany({
        where: { customerId: params.id, status: orderStatusFilter },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.order.aggregate({
        where: { customerId: params.id, status: orderStatusFilter, createdAt: { gte: last30 } },
        _sum: { totalAmount: true },
      }),
      db.order.aggregate({
        where: { customerId: params.id, status: orderStatusFilter, createdAt: { gte: prev60, lt: last30 } },
        _sum: { totalAmount: true },
      }),
    ])

    const productIds = topProductsRaw.map(r => r.productId)
    const productNames = productIds.length > 0
      ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, code: true } })
      : []
    const nameMap = Object.fromEntries(productNames.map(p => [p.id, p]))
    const topProducts = topProductsRaw.map(r => ({
      productId: r.productId,
      name: nameMap[r.productId]?.name ?? r.productId,
      code: nameMap[r.productId]?.code ?? '',
      totalQty: r._sum.quantityCopje ?? 0,
      totalValue: r._sum.lineTotal ?? 0,
    }))

    const currentDebt = Math.max(
      0,
      (deliveredAmount._sum.totalAmount ?? 0) - (paidAmount._sum.amount ?? 0),
    )

    // Purchase Calendar — avg days between orders + days since last
    const dates = allOrderDates.map(o => o.createdAt.getTime())
    let avgDaysBetween: number | null = null
    if (dates.length >= 2) {
      let totalGap = 0
      for (let i = 1; i < dates.length; i++) totalGap += dates[i] - dates[i - 1]
      avgDaysBetween = Math.round(totalGap / (dates.length - 1) / (24 * 60 * 60 * 1000))
    }
    const lastOrderAt = dates.length > 0 ? new Date(dates[dates.length - 1]) : null
    const daysSinceLast = lastOrderAt ? Math.round((now.getTime() - lastOrderAt.getTime()) / (24 * 60 * 60 * 1000)) : null
    let calendarStatus: 'NORMAL' | 'AFËR' | 'VONUAR' = 'NORMAL'
    if (daysSinceLast !== null && avgDaysBetween !== null) {
      if (daysSinceLast > avgDaysBetween * 1.5) calendarStatus = 'VONUAR'
      else if (daysSinceLast > avgDaysBetween * 1.1) calendarStatus = 'AFËR'
    }
    const purchaseCalendar = {
      totalOrders: dates.length,
      avgDaysBetween,
      daysSinceLast,
      lastOrderAt: lastOrderAt?.toISOString() ?? null,
      status: calendarStatus,
    }

    // Growth Tracker — last 30d vs previous 30d
    const currSales = last30Sales._sum.totalAmount ?? 0
    const prevSales = prev30Sales._sum.totalAmount ?? 0
    const growthPct = prevSales > 0 ? Math.round(((currSales - prevSales) / prevSales) * 100) : null
    const growthTracker = {
      currPeriodSales: currSales,
      prevPeriodSales: prevSales,
      growthPct,
      trend: growthPct === null ? 'NO_DATA' : growthPct >= 10 ? 'UP' : growthPct <= -10 ? 'DOWN' : 'STABLE',
    }

    return NextResponse.json({ ...customer, currentDebt, topProducts, purchaseCalendar, growthTracker })
  } catch (err) {
    console.error(`[GET /api/customers/${params.id}] error:`, err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || !['ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const prev = await db.customer.findUnique({ where: { id: params.id } })
    const customer = await db.customer.update({ where: { id: params.id }, data })

    await createAuditLog({
      userId: session.user.id,
      module: 'customers',
      action: 'UPDATE',
      recordId: params.id,
      prevValue: prev,
      newValue: customer,
    })

    return NextResponse.json(customer)
  } catch (err) {
    console.error(`[PATCH /api/customers/${params.id}] error:`, err)
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}
