import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'sales'
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date()
  to.setHours(23, 59, 59, 999)

  if (type === 'sales') {
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { notIn: ['DRAFT', 'ANULUAR'] },
      },
      include: {
        customer: { select: { businessName: true, code: true } },
        createdBy: { select: { name: true } },
        lines: { include: { product: { select: { name: true, code: true, brand: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ orders })
  }

  if (type === 'payments') {
    const payments = await db.payment.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        customer: { select: { businessName: true, code: true } },
        collectedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ payments })
  }

  if (type === 'visits') {
    const visits = await db.visit.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        customer: { select: { businessName: true, code: true } },
        agent: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ visits })
  }

  if (type === 'debt') {
    const customers = await db.customer.findMany({
      where: { status: 'ACTIVE' },
      include: {
        orders: { where: { status: 'DORÃ‹ZUAR' }, select: { totalAmount: true } },
        payments: { select: { amount: true } },
      },
    })

    const debtReport = customers
      .map((c) => {
        const totalOrders = c.orders.reduce((s, o) => s + o.totalAmount, 0)
        const totalPaid = c.payments.reduce((s, p) => s + p.amount, 0)
        const debt = totalOrders - totalPaid
        return { customerId: c.id, businessName: c.businessName, code: c.code, totalOrders, totalPaid, debt }
      })
      .filter((c) => c.debt > 0)
      .sort((a, b) => b.debt - a.debt)

    return NextResponse.json({ debtReport })
  }

  if (type === 'brands') {
    const lines = await db.orderLine.findMany({
      where: { order: { createdAt: { gte: from, lte: to }, status: { notIn: ['DRAFT', 'ANULUAR'] } } },
      include: { product: { include: { brand: { select: { name: true } } } } },
    })

    const brandMap: Record<string, { name: string; quantity: number; total: number }> = {}
    for (const line of lines) {
      const brand = line.product.brand?.name ?? 'Pa Brand'
      if (!brandMap[brand]) brandMap[brand] = { name: brand, quantity: 0, total: 0 }
      brandMap[brand].quantity += line.quantityCopje
      brandMap[brand].total += line.lineTotal
    }

    return NextResponse.json({ brands: Object.values(brandMap).sort((a, b) => b.total - a.total) })
  }

  if (type === 'inactive_customers') {
    const days = parseInt(searchParams.get('days') ?? '30')
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const customers = await db.customer.findMany({
      where: {
        status: 'ACTIVE',
        orders: { none: { createdAt: { gte: cutoff } } },
      },
      include: {
        agent: { select: { name: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    })

    return NextResponse.json({ customers })
  }

  return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
}
