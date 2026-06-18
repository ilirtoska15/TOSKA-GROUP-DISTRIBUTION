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

const orderLineSchema = z.object({
  productId: z.string(),
  unit: z.enum(['COPE', 'PAKO']),
  quantity: z.number().int().positive(),
  salesPrice: z.number().min(0),
})

const createSchema = z.object({
  customerId: z.string(),
  lines: z.array(orderLineSchema).min(1),
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

    // Agents see only their own orders
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
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Validate customer
    const customer = await db.customer.findUnique({ where: { id: data.customerId } })
    if (!customer) return NextResponse.json({ error: 'Klienti nuk u gjet' }, { status: 404 })
    if (customer.status === 'BLOCKED') {
      return NextResponse.json({ error: 'Klienti Ã«shtÃ« bllokuar. Nuk mund tÃ« krijohen porosi.' }, { status: 400 })
    }

    // Validate and build order lines
    const orderLines = []
    let totalAmount = 0

    for (const line of data.lines) {
      const product = await db.product.findUnique({ where: { id: line.productId } })
      if (!product) return NextResponse.json({ error: `Produkti ${line.productId} nuk u gjet` }, { status: 404 })
      if (product.status !== 'ACTIVE') return NextResponse.json({ error: `Produkti ${product.name} nuk Ã«shtÃ« aktiv` }, { status: 400 })

      if (line.unit === 'PAKO' && !product.pakoCopje) {
        return NextResponse.json({ error: `Produkti ${product.name} nuk ka rregull konvertimi pÃ«r Pako` }, { status: 400 })
      }

      const quantityCopje = convertToBase(line.quantity, line.unit, product.pakoCopje)

      // Only validate stock if submitting (not draft)
      if (data.status === 'SUBMITTED') {
        const stock = await getStockLevel(product.id)
        if (quantityCopje > stock) {
          return NextResponse.json({
            error: `Stok i pamjaftueshÃ«m pÃ«r ${product.name}. DisponibÃ«l: ${stock} copÃ«, KÃ«rkuar: ${quantityCopje} copÃ«`,
          }, { status: 400 })
        }
      }

      const lineTotal = line.salesPrice * quantityCopje
      totalAmount += lineTotal

      orderLines.push({
        productId: line.productId,
        unit: line.unit,
        quantity: line.quantity,
        quantityCopje,
        salesPrice: line.salesPrice,
        lineTotal,
        productSnapshot: JSON.stringify({
          name: product.name,
          code: product.code,
          photo: product.photo,
          salesPrice: product.salesPrice,
        }),
      })
    }

    // Check debt limit for submissions
    let orderStatus: string = data.status
    if (data.status === 'SUBMITTED') {
      const deliveredAmount = await db.order.aggregate({
        where: { customerId: data.customerId, status: 'DORÃ‹ZUAR' },
        _sum: { totalAmount: true },
      })
      const paidAmount = await db.payment.aggregate({
        where: { customerId: data.customerId },
        _sum: { amount: true },
      })
      const currentDebt = (deliveredAmount._sum.totalAmount ?? 0) - (paidAmount._sum.amount ?? 0)
      if (customer.debtLimit > 0 && currentDebt + totalAmount > customer.debtLimit) {
        orderStatus = 'PRET_APROVIM'
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

    // Reserve stock for submitted orders
    if (orderStatus === 'SUBMITTED' || orderStatus === 'APROVUAR') {
      for (const line of order.lines) {
        await addStockMovement({
          productId: line.productId,
          type: 'RESERVATION',
          quantityCopje: line.quantityCopje,
          reference: order.reference,
          referenceId: order.id,
          userId: session.user.id,
          reason: 'Porosi e aprovuar',
        })
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
      sendPushToRole('ADMIN', 'Porosi e Re', `${order.reference} â€” Klient #${data.customerId.slice(-6)}`, '/admin/orders').catch(() => null)
    }

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
