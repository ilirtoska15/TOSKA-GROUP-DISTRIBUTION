import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { getStockLevel, addStockMovement, convertToBase } from '@/lib/stock'
import { sendPushToRole } from '@/lib/push'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// quantity is the DISPLAY quantity (in selected unit).
// salesPrice is intentionally absent — fetched from DB.
const orderLineSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(['COPE', 'PAKO']),
  quantity: z.number().int().positive(),
})

const createSchema = z.object({
  customerId: z.string().min(1, 'Klienti kërkohet'),
  lines: z.array(orderLineSchema).min(1, 'Porosia duhet të ketë të paktën një artikull'),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const customerId = searchParams.get('customerId') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search.trim()) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { customer: { businessName: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (status) where.status = status
    if (customerId) where.customerId = customerId

    if (session.user.role === 'AGJENT') {
      where.createdById = session.user.id
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          customer: { select: { id: true, businessName: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ])

    return NextResponse.json({ orders, total, page, limit })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[orders] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    let data: z.infer<typeof createSchema>
    try {
      data = createSchema.parse(body)
    } catch (zodErr) {
      if (zodErr instanceof z.ZodError) {
        const msg = zodErr.errors[0]?.message ?? 'Të dhënat janë të pavlefshme'
        return NextResponse.json({ error: msg, details: zodErr.errors }, { status: 400 })
      }
      throw zodErr
    }

    // Validate customer
    const customer = await db.customer.findUnique({ where: { id: data.customerId } })
    if (!customer) return NextResponse.json({ error: 'Klienti nuk u gjet' }, { status: 404 })
    if (customer.status === 'BLOCKED') {
      return NextResponse.json({ error: 'Klienti është bllokuar. Nuk mund të krijohen porosi.' }, { status: 400 })
    }

    // Build order lines — fetch prices from DB, do conversion server-side
    const orderLines = []
    let totalAmount = 0

    for (const line of data.lines) {
      const product = await db.product.findUnique({ where: { id: line.productId } })
      if (!product) {
        return NextResponse.json({ error: `Produkti nuk u gjet (${line.productId})` }, { status: 404 })
      }
      if (product.status !== 'ACTIVE') {
        return NextResponse.json({ error: `Produkti "${product.name}" nuk është aktiv` }, { status: 400 })
      }
      if (line.unit === 'PAKO' && !product.pakoCopje) {
        return NextResponse.json({ error: `Produkti "${product.name}" nuk ka konfigurim Pako` }, { status: 400 })
      }

      // Convert display quantity to base copje — done server-side only
      const quantityCopje = convertToBase(line.quantity, line.unit, product.pakoCopje)

      // Stock check only for SUBMITTED orders
      if (data.status === 'SUBMITTED') {
        const stock = await getStockLevel(product.id)
        if (quantityCopje > stock) {
          return NextResponse.json({
            error: `Stok i pamjaftueshëm për "${product.name}". Disponibël: ${stock} copë, Kërkuar: ${quantityCopje} copë`,
          }, { status: 400 })
        }
      }

      // Use server-side price with discount — never trust client
      const discountPercent = product.discountPercent ?? 0
      const finalUnitPrice = product.salesPrice * (1 - discountPercent / 100)
      const lineTotal = finalUnitPrice * quantityCopje
      totalAmount += lineTotal

      orderLines.push({
        productId: line.productId,
        unit: line.unit,
        quantity: line.quantity,      // display quantity
        quantityCopje,                // converted
        salesPrice: product.salesPrice,
        discountPercent,
        finalUnitPrice,
        lineTotal,
        productSnapshot: JSON.stringify({
          name: product.name,
          code: product.code,
          photo: product.photo,
          salesPrice: product.salesPrice,
          discountPercent,
          finalUnitPrice,
        }),
      })
    }

    // Debt limit check for submitted orders
    let orderStatus: string = data.status
    if (data.status === 'SUBMITTED') {
      try {
        const [deliveredAgg, paidAgg] = await Promise.all([
          db.order.aggregate({
            where: { customerId: data.customerId, status: 'DORËZUAR' },
            _sum: { totalAmount: true },
          }),
          db.payment.aggregate({
            where: { customerId: data.customerId },
            _sum: { amount: true },
          }),
        ])
        const currentDebt = (deliveredAgg._sum.totalAmount ?? 0) - (paidAgg._sum.amount ?? 0)
        if (customer.debtLimit > 0 && currentDebt + totalAmount > customer.debtLimit) {
          orderStatus = 'PRET_APROVIM'
        }
      } catch {
        // Non-fatal — proceed without debt check
      }
    }

    const reference = await generateReference(db, 'order')

    const order = await db.order.create({
      data: {
        reference,
        customerId: data.customerId,
        createdById: session.user.id,
        agentId: session.user.role === 'AGJENT' ? session.user.id : undefined,
        status: orderStatus,
        totalAmount,
        notes: data.notes,
        lines: { create: orderLines },
      },
      include: { lines: true },
    })

    // Reserve stock for submitted/approved orders
    if (orderStatus === 'SUBMITTED' || orderStatus === 'APROVUAR' || orderStatus === 'PRET_APROVIM') {
      for (const line of order.lines) {
        await addStockMovement({
          productId: line.productId,
          type: 'RESERVATION',
          quantityCopje: line.quantityCopje,
          reference: order.reference,
          referenceId: order.id,
          userId: session.user.id,
          reason: 'Porosi e dërguar',
        }).catch(() => null)
      }
    }

    await createAuditLog({
      userId: session.user.id,
      module: 'orders',
      action: 'CREATE',
      recordId: order.id,
      newValue: { reference: order.reference, status: order.status, totalAmount },
    })

    if (order.status === 'SUBMITTED' || order.status === 'PRET_APROVIM') {
      sendPushToRole('ADMIN', 'Porosi e Re', `${order.reference} — Klient #${data.customerId.slice(-6)}`, '/admin/orders').catch(() => null)
    }

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[orders] POST error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
