import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { addStockMovement, convertToBase } from '@/lib/stock'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const returnLineSchema = z.object({
  productId: z.string(),
  unit: z.string().transform(v => v.toUpperCase()),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  photo: z.string().optional(),
})

const createSchema = z.object({
  customerId: z.string(),
  orderId: z.string().optional(),
  lines: z.array(returnLineSchema).min(1),
  notes: z.string().optional(),
})

const updateSchema = z.object({
  status: z.enum(['APROVUAR', 'REFUZUAR', 'MARRE_NGA_SHOFERI', 'KTHYER_NE_DEPO', 'PERFUNDUAR']).optional(),
  warehouseAction: z.enum(['RETURN_TO_STOCK', 'MARK_DAMAGED']).optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const customerId = searchParams.get('customerId') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (customerId) where.customerId = customerId
  if (session.user.role === 'AGJENT') where.createdById = session.user.id
  if (session.user.role === 'SHOFER') where.driverId = session.user.id

  const [returns, total] = await Promise.all([
    db.return.findMany({
      where,
      include: {
        customer: { select: { id: true, businessName: true } },
        createdBy: { select: { id: true, name: true } },
        lines: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.return.count({ where }),
  ])

  return NextResponse.json({ returns, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (body.action === 'update') {
      const id = body.id as string
      const data = updateSchema.parse(body)

      const ret = await db.return.findUnique({ where: { id }, include: { lines: true } })
      if (!ret) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const updateData: Record<string, unknown> = {}
      if (data.status) {
        updateData.status = data.status
        if (data.status === 'APROVUAR') {
          updateData.approvedById = session.user.id
          updateData.approvedAt = new Date()
        }
        if (data.status === 'MARRE_NGA_SHOFERI') updateData.pickedUpAt = new Date()
        if (data.status === 'KTHYER_NE_DEPO') updateData.receivedAt = new Date()
        if (data.status === 'PERFUNDUAR' && data.warehouseAction) {
          updateData.warehouseAction = data.warehouseAction
          if (data.warehouseAction === 'RETURN_TO_STOCK') {
            for (const line of ret.lines) {
              await addStockMovement({
                productId: line.productId,
                type: 'RETURN',
                quantityCopje: line.quantityCopje,
                reference: ret.reference,
                referenceId: ret.id,
                userId: session.user.id,
                reason: 'Kthim i pranuar nÃ« stok',
              })
            }
          }
        }
      }
      if (data.notes) updateData.notes = data.notes

      const updated = await db.return.update({ where: { id }, data: updateData })

      await createAuditLog({
        userId: session.user.id,
        module: 'returns',
        action: 'UPDATE_STATUS',
        recordId: id,
        prevValue: { status: ret.status },
        newValue: { status: data.status },
      })

      return NextResponse.json(updated)
    }

    // Create return
    const data = createSchema.parse(body)
    const reference = await generateReference(db, 'return')

    const product = await db.product.findMany({
      where: { id: { in: data.lines.map((l) => l.productId) } },
    })
    const productMap = Object.fromEntries(product.map((p) => [p.id, p]))

    const ret = await db.return.create({
      data: {
        reference,
        customerId: data.customerId,
        orderId: data.orderId,
        createdById: session.user.id,
        status: 'NE_PRITJE',
        notes: data.notes,
        lines: {
          create: data.lines.map((line) => {
            const prod = productMap[line.productId]
            const quantityCopje = convertToBase(line.quantity, line.unit, prod?.pakoCopje)
            return {
              productId: line.productId,
              unit: line.unit,
              quantity: line.quantity,
              quantityCopje,
              reason: line.reason,
              photo: line.photo,
            }
          }),
        },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'returns',
      action: 'CREATE',
      recordId: ret.id,
      newValue: { reference },
    })

    return NextResponse.json(ret, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
