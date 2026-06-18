import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { addStockMovement } from '@/lib/stock'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  lines: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    reason: z.enum(['DAMAGED_WAREHOUSE', 'DAMAGED_TRANSPORT', 'RETURNED_DAMAGED', 'EXPIRED']),
    photo: z.string().optional(),
    returnId: z.string().optional(),
    orderId: z.string().optional(),
  })).min(1),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const [damages, total] = await Promise.all([
      db.damage.findMany({
        include: {
          reportedBy: { select: { name: true } },
          lines: { include: { product: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.damage.count(),
    ])

    return NextResponse.json({ damages, total })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[damage] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const reference = await generateReference(db, 'damage')

    const damage = await db.damage.create({
      data: {
        reference,
        reportedById: session.user.id,
        notes: data.notes,
        lines: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            reason: line.reason,
            photo: line.photo,
            returnId: line.returnId,
            orderId: line.orderId,
          })),
        },
      },
    })

    // Remove stock for damaged items
    for (const line of data.lines) {
      await addStockMovement({
        productId: line.productId,
        type: 'DAMAGE',
        quantityCopje: line.quantity,
        reason: line.reason,
        reference: damage.reference,
        referenceId: damage.id,
        userId: session.user.id,
      })
    }

    await createAuditLog({
      userId: session.user.id,
      module: 'damage',
      action: 'CREATE',
      recordId: damage.id,
      newValue: { reference },
    })

    return NextResponse.json(damage, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
