import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// Inline haversine — avoids circular imports with lib/route-optimization
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
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

  if (type === 'product_leaderboard') {
    const linesRaw = await db.orderLine.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: from, lte: to }, status: { notIn: ['DRAFT', 'ANULUAR'] } } },
      _sum: { quantityCopje: true, lineTotal: true },
      _count: { orderId: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 20,
    })
    const products = linesRaw.length > 0
      ? await db.product.findMany({
          where: { id: { in: linesRaw.map(r => r.productId) } },
          select: { id: true, name: true, code: true, category: { select: { name: true } } },
        })
      : []
    const nameMap = Object.fromEntries(products.map(p => [p.id, p]))
    const leaderboard = linesRaw.map((r, i) => ({
      rank: i + 1,
      productId: r.productId,
      name: nameMap[r.productId]?.name ?? r.productId,
      code: nameMap[r.productId]?.code ?? '',
      category: nameMap[r.productId]?.category?.name ?? '—',
      totalQty: r._sum.quantityCopje ?? 0,
      totalValue: r._sum.lineTotal ?? 0,
      orderCount: r._count.orderId,
    }))
    return NextResponse.json({ leaderboard })
  }

  if (type === 'declining_products') {
    const period = parseInt(searchParams.get('period') ?? '7')
    const now = new Date()
    const startCurrent = new Date(now.getTime() - period * 24 * 60 * 60 * 1000)
    const startPrev = new Date(now.getTime() - period * 2 * 24 * 60 * 60 * 1000)

    const orderFilter = { status: { notIn: ['DRAFT', 'ANULUAR'] as string[] } }
    const [currentLines, prevLines] = await Promise.all([
      db.orderLine.groupBy({
        by: ['productId'],
        where: { order: { ...orderFilter, createdAt: { gte: startCurrent, lte: now } } },
        _sum: { quantityCopje: true },
      }),
      db.orderLine.groupBy({
        by: ['productId'],
        where: { order: { ...orderFilter, createdAt: { gte: startPrev, lt: startCurrent } } },
        _sum: { quantityCopje: true },
      }),
    ])

    const prevMap: Record<string, number> = {}
    for (const r of prevLines) prevMap[r.productId] = r._sum.quantityCopje ?? 0

    const currentMap: Record<string, number> = {}
    for (const r of currentLines) currentMap[r.productId] = r._sum.quantityCopje ?? 0

    // Products that had sales in previous period — compare
    const allProductIds = Array.from(new Set([...prevLines.map(r => r.productId), ...currentLines.map(r => r.productId)]))
    const declining = allProductIds
      .map(pid => {
        const prev = prevMap[pid] ?? 0
        const curr = currentMap[pid] ?? 0
        if (prev === 0) return null // no prior sales — skip (can't calculate decline)
        const growth = ((curr - prev) / prev) * 100
        if (growth >= 0) return null // not declining
        const severity = growth < -25 ? 'SEVERE' : growth < -10 ? 'WARNING' : 'NORMAL'
        return { productId: pid, currentQty: curr, prevQty: prev, growthPct: Math.round(growth), severity }
      })
      .filter(Boolean)
      .sort((a, b) => (a!.growthPct) - (b!.growthPct)) // most declining first
      .slice(0, 30) as Array<{ productId: string; currentQty: number; prevQty: number; growthPct: number; severity: string }>

    const products = declining.length > 0
      ? await db.product.findMany({
          where: { id: { in: declining.map(d => d.productId) } },
          select: { id: true, name: true, code: true, category: { select: { name: true } } },
        })
      : []
    const nameMap = Object.fromEntries(products.map(p => [p.id, p]))
    const result = declining.map(d => ({
      ...d,
      name: nameMap[d.productId]?.name ?? d.productId,
      code: nameMap[d.productId]?.code ?? '',
      category: nameMap[d.productId]?.category?.name ?? '—',
    }))
    return NextResponse.json({ declining: result, period, startCurrent, startPrev })
  }

  if (type === 'visits_gps') {
    const visits = await db.visit.findMany({
      where: { createdAt: { gte: from, lte: to }, status: { notIn: ['PLANNED', 'CANCELLED'] } },
      include: {
        customer: { select: { businessName: true, code: true, lat: true, lng: true } },
        agent: { select: { name: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 200,
    })
    const result = visits.map(v => {
      let gpsStatus = 'NO_GPS'
      let gpsDistanceM: number | null = null
      if (v.openedLat != null && v.openedLng != null) {
        if (v.customer.lat != null && v.customer.lng != null) {
          gpsDistanceM = Math.round(haversineKm(v.openedLat, v.openedLng, v.customer.lat, v.customer.lng) * 1000)
          gpsStatus = gpsDistanceM <= 100 ? 'GPS_VERIFIED' : gpsDistanceM <= 300 ? 'NEAR_LOCATION' : 'OUTSIDE_LOCATION'
        } else {
          gpsStatus = 'HAS_GPS'
        }
      }
      return { ...v, gpsStatus, gpsDistanceM }
    })
    return NextResponse.json({ visits: result })
  }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[reports] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
