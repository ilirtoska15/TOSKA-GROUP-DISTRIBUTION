import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''

    if (q.length < 2) return NextResponse.json({ results: [] })

  const [customers, products, orders, payments, returns] = await Promise.all([
    db.customer.findMany({
      where: {
        OR: [
          { businessName: { contains: q } },
          { code: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      take: 5,
      select: { id: true, businessName: true, code: true, phone: true, status: true },
    }),
    db.product.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { barcode: { contains: q } },
        ],
      },
      take: 5,
      select: { id: true, name: true, code: true, barcode: true, status: true },
    }),
    db.order.findMany({
      where: { reference: { contains: q } },
      take: 5,
      select: {
        id: true, reference: true, status: true, totalAmount: true,
        customer: { select: { businessName: true } },
      },
    }),
    db.payment.findMany({
      where: { reference: { contains: q } },
      take: 5,
      select: { id: true, reference: true, amount: true, method: true },
    }),
    db.return.findMany({
      where: { reference: { contains: q } },
      take: 5,
      select: { id: true, reference: true, status: true },
    }),
  ])

  const results = [
    ...customers.map((c) => ({ type: 'customer', id: c.id, label: c.businessName, sub: c.code, href: `/admin/customers/${c.id}`, status: c.status })),
    ...products.map((p) => ({ type: 'product', id: p.id, label: p.name, sub: p.code, href: `/admin/products/${p.id}`, status: p.status })),
    ...orders.map((o) => ({ type: 'order', id: o.id, label: o.reference, sub: o.customer.businessName, href: `/admin/orders/${o.id}`, status: o.status })),
    ...payments.map((p) => ({ type: 'payment', id: p.id, label: p.reference, sub: `${p.amount} â‚¬`, href: `/admin/payments`, status: p.method })),
    ...returns.map((r) => ({ type: 'return', id: r.id, label: r.reference, sub: '', href: `/admin/returns/${r.id}`, status: r.status })),
  ]

    return NextResponse.json({ results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[search] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
