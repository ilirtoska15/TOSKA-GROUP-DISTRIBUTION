import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { getStockLevel, addStockMovement, convertToBase } from '@/lib/stock'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const newCustomerSchema = z.object({
  businessName: z.string().trim().min(1),
  businessAddress: z.string().trim().min(1),
  city: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  contactPerson: z.string().trim().optional(),
  agentId: z.string().optional(),
})

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reviewNote: z.string().trim().max(1000).optional(),
  customerId: z.string().optional(),          // link to existing customer (APPROVE)
  newCustomer: newCustomerSchema.optional(),  // create a new customer (APPROVE)
})

interface StoredItem { productId: string; unit: 'COPE' | 'PAKO'; quantity: number }

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body i pavlefshëm' }, { status: 400 })

    let data: z.infer<typeof patchSchema>
    try {
      data = patchSchema.parse(body)
    } catch (zerr) {
      if (zerr instanceof z.ZodError) {
        return NextResponse.json({ error: zerr.errors[0]?.message ?? 'Të dhëna të pavlefshme' }, { status: 400 })
      }
      throw zerr
    }

    const request = await db.publicOrderRequest.findUnique({ where: { id: params.id } })
    if (!request) return NextResponse.json({ error: 'Kërkesa nuk u gjet' }, { status: 404 })
    if (request.status !== 'PENDING') {
      return NextResponse.json({ error: 'Kjo kërkesë është procesuar tashmë' }, { status: 400 })
    }

    // ── REJECT ──
    if (data.action === 'REJECT') {
      const updated = await db.publicOrderRequest.update({
        where: { id: params.id },
        data: { status: 'REJECTED', reviewNote: data.reviewNote || null, reviewedById: session.user.id },
      })
      await createAuditLog({
        userId: session.user.id, module: 'public-orders', action: 'REJECT', recordId: params.id,
        newValue: { reference: request.reference },
      }).catch(() => null)
      return NextResponse.json({ success: true, request: updated })
    }

    // ── APPROVE ──
    // 1) Resolve customer: link existing, create new, or create from the request data.
    let customerId = data.customerId?.trim() || ''
    if (customerId) {
      const exists = await db.customer.findUnique({ where: { id: customerId } })
      if (!exists) return NextResponse.json({ error: 'Klienti i zgjedhur nuk u gjet' }, { status: 400 })
    } else {
      const nc = data.newCustomer ?? {
        businessName: request.businessName,
        businessAddress: request.address,
        city: request.city,
        phone: request.phone,
        contactPerson: request.contactName,
      }
      const code = await generateReference(db, 'customer')
      const created = await db.customer.create({
        data: {
          code,
          businessName: nc.businessName,
          businessAddress: nc.businessAddress,
          city: nc.city,
          phone: nc.phone,
          contactPerson: nc.contactPerson || request.contactName || undefined,
          agentId: (data.newCustomer?.agentId?.trim()) || undefined,
          notes: `Krijuar nga kërkesa publike ${request.reference}`,
        },
      })
      customerId = created.id
    }

    // 2) Rebuild order lines from DB (never trust stored prices) + stock validation.
    const items = (Array.isArray(request.items) ? request.items : []) as unknown as StoredItem[]
    if (items.length === 0) return NextResponse.json({ error: 'Kërkesa nuk ka artikuj' }, { status: 400 })

    const orderLines = []
    let totalAmount = 0
    for (const line of items) {
      const product = await db.product.findUnique({ where: { id: line.productId } })
      if (!product) return NextResponse.json({ error: `Produkti nuk u gjet (${line.productId})` }, { status: 400 })
      if (product.status !== 'ACTIVE') return NextResponse.json({ error: `Produkti "${product.name}" nuk është aktiv` }, { status: 400 })
      if (line.unit === 'PAKO' && !product.pakoCopje) {
        return NextResponse.json({ error: `Produkti "${product.name}" nuk ka konfigurim Pako` }, { status: 400 })
      }
      const quantityCopje = convertToBase(line.quantity, line.unit, product.pakoCopje)

      const stock = await getStockLevel(product.id)
      if (quantityCopje > stock) {
        return NextResponse.json({
          error: `Stok i pamjaftueshëm për "${product.name}". Disponibël: ${stock} copë, Kërkuar: ${quantityCopje} copë`,
        }, { status: 400 })
      }

      const discountPercent = product.discountPercent ?? 0
      const finalUnitPrice = product.salesPrice * (1 - discountPercent / 100)
      const lineTotal = finalUnitPrice * quantityCopje
      totalAmount += lineTotal

      orderLines.push({
        productId: product.id,
        unit: line.unit,
        quantity: line.quantity,
        quantityCopje,
        salesPrice: product.salesPrice,
        discountPercent,
        finalUnitPrice,
        lineTotal,
        productSnapshot: JSON.stringify({
          name: product.name, code: product.code, photo: product.photo,
          salesPrice: product.salesPrice, discountPercent, finalUnitPrice,
        }),
      })
    }

    // 3) Create the real order (enters the normal workflow at SUBMITTED) and reserve stock.
    const reference = await generateReference(db, 'order')
    const order = await db.order.create({
      data: {
        reference,
        customerId,
        createdById: session.user.id,
        status: 'SUBMITTED',
        totalAmount,
        notes: `Nga kërkesa publike ${request.reference}${request.notes ? ` — ${request.notes}` : ''}`,
        lines: { create: orderLines },
      },
      include: { lines: true },
    })

    for (const line of order.lines) {
      await addStockMovement({
        productId: line.productId,
        type: 'RESERVATION',
        quantityCopje: line.quantityCopje,
        reference: order.reference,
        referenceId: order.id,
        userId: session.user.id,
        reason: 'Porosi nga kërkesë publike',
      }).catch(() => null)
    }

    const updated = await db.publicOrderRequest.update({
      where: { id: params.id },
      data: { status: 'APPROVED', reviewNote: data.reviewNote || null, reviewedById: session.user.id, customerId, orderId: order.id },
    })

    await createAuditLog({
      userId: session.user.id, module: 'public-orders', action: 'APPROVE', recordId: params.id,
      newValue: { reference: request.reference, orderReference: order.reference, customerId, totalAmount },
    }).catch(() => null)

    return NextResponse.json({ success: true, request: updated, orderId: order.id, orderReference: order.reference })
  } catch (err) {
    console.error(`[PATCH /api/admin/public-orders/${params.id}]`, err)
    return NextResponse.json({ error: 'Gabim gjatë procesimit të kërkesës' }, { status: 500 })
  }
}
