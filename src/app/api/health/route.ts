import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const now = new Date()
    const nearExpiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [
      allProducts,
      allProductsWithStock,
      allCustomers,
      activeOrders,
      pendingApproval,
      pendingReturns,
      openVisits,
      failedDeliveries,
      unpaidPayments,
    ] = await Promise.all([
      db.product.count({ where: { status: 'ACTIVE' } }),
      db.product.findMany({ where: { status: 'ACTIVE' }, select: { id: true, expiryDate: true } }),
      db.customer.count({ where: { status: 'ACTIVE' } }),
      db.order.count({ where: { status: { in: ['SUBMITTED', 'APROVUAR', 'PERGATITJE', 'GATSHME'] } } }),
      db.order.count({ where: { status: 'PRET_APROVIM' } }),
      db.return.count({ where: { status: 'NE_PRITJE' } }),
      db.visit.count({ where: { status: 'OPEN' } }),
      db.delivery.count({ where: { status: 'FAILED' } }),
      db.order.aggregate({
        where: { status: { in: ['SUBMITTED', 'APROVUAR', 'PERGATITJE', 'GATSHME'] } },
        _sum: { totalAmount: true },
      }),
    ])

    // Calculate stock levels
    const { getMultipleStockLevels } = await import('@/lib/stock')
    const productIds = allProductsWithStock.map(p => p.id)
    const stockMap = await getMultipleStockLevels(productIds)

    const outOfStock = productIds.filter(id => (stockMap[id] ?? 0) <= 0).length
    const lowStock = productIds.filter(id => { const s = stockMap[id] ?? 0; return s > 0 && s <= 20 }).length
    const nearExpiry = allProductsWithStock.filter(p => p.expiryDate && new Date(p.expiryDate) <= nearExpiryDate && new Date(p.expiryDate) > now).length

    // Count customers with overdue debt (unpaid for > paymentTermDays)
    const customersWithDebt = await db.customer.count({
      where: {
        status: 'ACTIVE',
        orders: {
          some: {
            status: 'DORËZUAR',
            createdAt: { lt: thirtyDaysAgo },
          },
        },
      },
    })

    const status = outOfStock > 0 || pendingApproval > 5 || pendingReturns > 10
      ? 'critical'
      : lowStock > 5 || nearExpiry > 0 || openVisits > 0 || failedDeliveries > 0
      ? 'warning'
      : 'ok'

    return NextResponse.json({
      status,
      checks: {
        db: true,
        outOfStock,
        lowStock,
        nearExpiry,
        openOrders: activeOrders,
        pendingApproval,
        pendingReturns,
        overdueDebt: customersWithDebt,
        openVisits,
        failedDeliveries,
      },
      summary: {
        totalProducts: allProducts,
        totalCustomers: allCustomers,
        totalActiveOrders: activeOrders,
        totalUnpaidDebt: unpaidPayments._sum.totalAmount ?? 0,
        pendingReturns,
      },
    })
  } catch {
    return NextResponse.json({
      status: 'critical',
      checks: {
        db: false,
        outOfStock: 0, lowStock: 0, nearExpiry: 0, openOrders: 0,
        pendingApproval: 0, pendingReturns: 0, overdueDebt: 0, openVisits: 0, failedDeliveries: 0,
      },
      summary: { totalProducts: 0, totalCustomers: 0, totalActiveOrders: 0, totalUnpaidDebt: 0, pendingReturns: 0 },
    })
  }
}
