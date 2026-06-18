import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { addStockMovement, getStockLevel } from '@/lib/stock'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const adjustSchema = z.object({
  productId: z.string(),
  countedQty: z.number().int().min(0),
  reason: z.string().optional(),
})

const bulkInventorySchema = z.object({
  type: z.enum(['FULL', 'PARTIAL', 'QUICK']),
  lines: z.array(z.object({
    productId: z.string(),
    countedQty: z.number().int().min(0),
    reason: z.string().optional(),
  })),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const [records, total] = await Promise.all([
    db.inventoryRecord.findMany({
      include: {
        lines: { include: {} },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.inventoryRecord.count(),
  ])

  return NextResponse.json({ records, total })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['ADMIN', 'DEPOIST'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()

    if (body.action === 'quick_adjust') {
      const data = adjustSchema.parse(body)
      const systemQty = await getStockLevel(data.productId)
      const diff = data.countedQty - systemQty

      if (diff !== 0) {
        await addStockMovement({
          productId: data.productId,
          type: 'ADJUSTMENT',
          quantityCopje: Math.abs(diff),
          reason: data.reason ?? 'Rregullim inventari',
          userId: session.user.id,
        })

        if (diff < 0) {
          // Remove stock
          await addStockMovement({
            productId: data.productId,
            type: 'OUT',
            quantityCopje: Math.abs(diff),
            reason: 'Rregullim inventari (minus)',
            userId: session.user.id,
          })
        }
      }

      await createAuditLog({
        userId: session.user.id,
        module: 'inventory',
        action: 'QUICK_ADJUST',
        recordId: data.productId,
        prevValue: { qty: systemQty },
        newValue: { qty: data.countedQty, diff },
      })

      return NextResponse.json({ success: true, systemQty, countedQty: data.countedQty, diff })
    }

    if (body.action === 'bulk_inventory') {
      const data = bulkInventorySchema.parse(body)

      const record = await db.inventoryRecord.create({
        data: {
          type: data.type,
          conductedById: session.user.id,
          notes: data.notes,
          status: 'DRAFT',
        },
      })

      const lines = []
      for (const line of data.lines) {
        const systemQty = await getStockLevel(line.productId)
        const diff = line.countedQty - systemQty

        lines.push({
          inventoryId: record.id,
          productId: line.productId,
          systemQty,
          countedQty: line.countedQty,
          differenceQty: diff,
          reason: line.reason,
        })

        if (diff !== 0) {
          const movType = (diff > 0 ? 'IN' : 'OUT') as 'IN' | 'OUT'
          await addStockMovement({
            productId: line.productId,
            type: movType,
            quantityCopje: Math.abs(diff),
            reason: line.reason ?? 'Inventar',
            referenceId: record.id,
            userId: session.user.id,
          })
        }
      }

      await db.inventoryLine.createMany({ data: lines })
      await db.inventoryRecord.update({
        where: { id: record.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      return NextResponse.json(record, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
