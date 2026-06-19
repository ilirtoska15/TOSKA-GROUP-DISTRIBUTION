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

  // ── Territory Performance ─────────────────────────────────────────────────
  if (type === 'territory') {
    const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()))

    // Zones with all customers (not just active) + unzoned customers for city fallback
    const [zones, unzonedCustomers] = await Promise.all([
      db.zone.findMany({
        include: {
          region: { select: { name: true } },
          customers: { select: { id: true, status: true } },
        },
        orderBy: { name: 'asc' },
      }),
      db.customer.findMany({
        where: { zoneId: null },
        select: { id: true, city: true, status: true },
      }),
    ])

    // Group unzoned customers by city (fallback: 'Pa zonë')
    const cityGroups: Record<string, Array<{ id: string; status: string }>> = {}
    for (const c of unzonedCustomers) {
      const key = c.city?.trim() || 'Pa zonë'
      if (!cityGroups[key]) cityGroups[key] = []
      cityGroups[key].push({ id: c.id, status: c.status })
    }

    const zonedIds = zones.flatMap(z => z.customers.map(c => c.id))
    const unzonedIds = unzonedCustomers.map(c => c.id)
    const allCustomerIds = [...zonedIds, ...unzonedIds]

    if (allCustomerIds.length === 0) return NextResponse.json({ territory: [] })

    const orderStatusFilter = { notIn: ['DRAFT', 'ANULUAR'] as string[] }
    const [currOrders, prevOrders, payments] = await Promise.all([
      db.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: allCustomerIds }, createdAt: { gte: from, lte: to }, status: orderStatusFilter },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      db.order.groupBy({
        by: ['customerId'],
        where: { customerId: { in: allCustomerIds }, createdAt: { gte: prevFrom, lt: from }, status: orderStatusFilter },
        _sum: { totalAmount: true },
      }),
      db.payment.groupBy({
        by: ['customerId'],
        where: { customerId: { in: allCustomerIds }, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ])

    const currMap: Record<string, { total: number; orders: number }> = {}
    for (const r of currOrders) currMap[r.customerId] = { total: r._sum.totalAmount ?? 0, orders: r._count.id }
    const prevMap: Record<string, number> = {}
    for (const r of prevOrders) prevMap[r.customerId] = r._sum.totalAmount ?? 0
    const payMap: Record<string, number> = {}
    for (const r of payments) payMap[r.customerId] = r._sum.amount ?? 0

    const buildTerritoryRow = (
      customers: Array<{ id: string; status: string }>,
      zoneName: string, regionName: string, zoneId: string
    ) => {
      const totalCustomers = customers.length
      const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length
      const customerIds = customers.map(c => c.id)
      const currTotal = customerIds.reduce((s, cid) => s + (currMap[cid]?.total ?? 0), 0)
      const prevTotal = customerIds.reduce((s, cid) => s + (prevMap[cid] ?? 0), 0)
      const orderCount = customerIds.reduce((s, cid) => s + (currMap[cid]?.orders ?? 0), 0)
      const totalPayments = customerIds.reduce((s, cid) => s + (payMap[cid] ?? 0), 0)
      const growthPct = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : null
      return {
        zoneId,
        zoneName,
        regionName,
        totalCustomers,
        activeCustomers,
        totalSales: currTotal,
        orderCount,
        averageOrderValue: orderCount > 0 ? Math.round(currTotal / orderCount) : 0,
        avgPerCustomer: activeCustomers > 0 ? Math.round(currTotal / activeCustomers) : 0,
        totalPayments,
        growthPct,
      }
    }

    const zoneRows = zones
      .filter(z => z.customers.length > 0)
      .map(z => buildTerritoryRow(z.customers, z.name, z.region?.name ?? '—', z.id))

    const cityRows = Object.entries(cityGroups)
      .map(([city, customers]) => buildTerritoryRow(customers, city, 'Pa zonë', `city:${city}`))

    const territory = [...zoneRows, ...cityRows].sort((a, b) => b.totalSales - a.totalSales)

    return NextResponse.json({ territory, from: from.toISOString(), to: to.toISOString() })
  }

  // ── Product Penetration ───────────────────────────────────────────────────
  if (type === 'product_penetration') {
    const [totalActive, orderLines] = await Promise.all([
      db.customer.count({ where: { status: 'ACTIVE' } }),
      db.orderLine.findMany({
        where: { order: { createdAt: { gte: from, lte: to }, status: { notIn: ['DRAFT', 'ANULUAR'] } } },
        select: { productId: true, lineTotal: true, order: { select: { customerId: true } } },
        take: 50000,
      }),
    ])

    // Aggregate per product
    const productData: Record<string, { customers: Set<string>; orderCount: number; totalValue: number }> = {}
    for (const line of orderLines) {
      if (!productData[line.productId]) productData[line.productId] = { customers: new Set(), orderCount: 0, totalValue: 0 }
      productData[line.productId].customers.add(line.order.customerId)
      productData[line.productId].orderCount++
      productData[line.productId].totalValue += line.lineTotal
    }

    const productIds = Object.keys(productData)
    const products = productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, code: true, category: { select: { name: true } }, brand: { select: { name: true } } },
        })
      : []
    const infoMap = Object.fromEntries(products.map(p => [p.id, p]))

    const penetration = productIds
      .map(pid => ({
        productId: pid,
        name: infoMap[pid]?.name ?? pid,
        code: infoMap[pid]?.code ?? '',
        category: infoMap[pid]?.category?.name ?? '—',
        brand: infoMap[pid]?.brand?.name ?? '—',
        uniqueCustomers: productData[pid].customers.size,
        penetrationPct: totalActive > 0 ? Math.round((productData[pid].customers.size / totalActive) * 100) : 0,
        orderCount: productData[pid].orderCount,
        totalValue: productData[pid].totalValue,
      }))
      .sort((a, b) => b.penetrationPct - a.penetrationPct)
      .slice(0, 30)

    return NextResponse.json({ penetration, totalActiveCustomers: totalActive })
  }

  // ── Visit Effectiveness ───────────────────────────────────────────────────
  if (type === 'visit_effectiveness') {
    const [allVisits, visitsWithOrder] = await Promise.all([
      db.visit.groupBy({
        by: ['agentId'],
        where: { createdAt: { gte: from, lte: to }, status: { in: ['CLOSED', 'MISSED'] } },
        _count: { id: true },
      }),
      db.visit.groupBy({
        by: ['agentId'],
        where: { createdAt: { gte: from, lte: to }, status: 'CLOSED', hasOrder: true },
        _count: { id: true },
      }),
    ])

    const withOrderMap: Record<string, number> = {}
    for (const r of visitsWithOrder) withOrderMap[r.agentId] = r._count.id

    const agentIds = allVisits.map(r => r.agentId)
    const agents = agentIds.length > 0
      ? await db.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
      : []
    const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]))

    const effectiveness = allVisits
      .map(r => {
        const total = r._count.id
        const withOrder = withOrderMap[r.agentId] ?? 0
        return {
          agentId: r.agentId,
          agentName: agentMap[r.agentId] ?? r.agentId,
          totalVisits: total,
          visitsWithOrder: withOrder,
          conversionRate: total > 0 ? Math.round((withOrder / total) * 100) : 0,
        }
      })
      .sort((a, b) => b.conversionRate - a.conversionRate)

    return NextResponse.json({ effectiveness })
  }

  // ── Recovery Opportunities ────────────────────────────────────────────────
  if (type === 'recovery_opportunities') {
    const now = new Date()
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const prev60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const orderStatusFilter = { notIn: ['DRAFT', 'ANULUAR'] as string[] }

    const [currOrders, prevOrders] = await Promise.all([
      db.order.groupBy({
        by: ['customerId'],
        where: { createdAt: { gte: last30 }, status: orderStatusFilter },
        _sum: { totalAmount: true },
      }),
      db.order.groupBy({
        by: ['customerId'],
        where: { createdAt: { gte: prev60, lt: last30 }, status: orderStatusFilter },
        _sum: { totalAmount: true },
      }),
    ])

    const currMap: Record<string, number> = {}
    for (const r of currOrders) currMap[r.customerId] = r._sum.totalAmount ?? 0
    const prevMap: Record<string, number> = {}
    for (const r of prevOrders) prevMap[r.customerId] = r._sum.totalAmount ?? 0

    // Customers that had sales in prev period but declined
    const recovering = Object.keys(prevMap)
      .map(cid => {
        const prev = prevMap[cid] ?? 0
        const curr = currMap[cid] ?? 0
        if (prev === 0) return null
        const growthPct = Math.round(((curr - prev) / prev) * 100)
        if (growthPct >= -20) return null
        const status = growthPct <= -40 ? 'CRITICAL' : 'WARNING'
        const lostValue = prev - curr
        return { customerId: cid, growthPct, lostValue, status, prevValue: prev, currValue: curr }
      })
      .filter(Boolean)
      .sort((a, b) => a!.growthPct - b!.growthPct)
      .slice(0, 30) as Array<{ customerId: string; growthPct: number; lostValue: number; status: string; prevValue: number; currValue: number }>

    if (recovering.length === 0) return NextResponse.json({ recovery: [] })

    const customers = await db.customer.findMany({
      where: { id: { in: recovering.map(r => r.customerId) } },
      select: { id: true, businessName: true, code: true, agent: { select: { name: true } } },
    })
    const custMap = Object.fromEntries(customers.map(c => [c.id, c]))

    const recovery = recovering.map(r => ({
      ...r,
      businessName: custMap[r.customerId]?.businessName ?? r.customerId,
      code: custMap[r.customerId]?.code ?? '',
      agentName: custMap[r.customerId]?.agent?.name ?? '—',
    }))

    return NextResponse.json({ recovery })
  }

  // ── Product Pair Analysis ────────────────────────────────────────────────
  if (type === 'product_pairs') {
    // Find most frequently co-purchased product pairs
    const cutoff = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000)
    const effectiveFrom = cutoff > from ? cutoff : from

    const orders = await db.order.findMany({
      where: { createdAt: { gte: effectiveFrom, lte: to }, status: { notIn: ['DRAFT', 'ANULUAR'] } },
      select: { id: true, lines: { select: { productId: true } } },
      take: 5000,
    })

    const pairCounts: Record<string, number> = {}
    for (const order of orders) {
      const pids = order.lines.map(l => l.productId)
      if (pids.length < 2) continue
      for (let i = 0; i < pids.length; i++) {
        for (let j = i + 1; j < pids.length; j++) {
          const key = [pids[i], pids[j]].sort().join('||')
          pairCounts[key] = (pairCounts[key] ?? 0) + 1
        }
      }
    }

    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([key, count]) => ({ pair: key.split('||'), count }))

    const allPairProductIds = Array.from(new Set(topPairs.flatMap(p => p.pair)))
    const pairProducts = allPairProductIds.length > 0
      ? await db.product.findMany({ where: { id: { in: allPairProductIds } }, select: { id: true, name: true, code: true } })
      : []
    const pMap = Object.fromEntries(pairProducts.map(p => [p.id, p]))

    const pairs = topPairs.map(p => ({
      productA: { id: p.pair[0], name: pMap[p.pair[0]]?.name ?? p.pair[0], code: pMap[p.pair[0]]?.code ?? '' },
      productB: { id: p.pair[1], name: pMap[p.pair[1]]?.name ?? p.pair[1], code: pMap[p.pair[1]]?.code ?? '' },
      count: p.count,
    }))

    return NextResponse.json({ pairs, orderCount: orders.length })
  }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[reports] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
