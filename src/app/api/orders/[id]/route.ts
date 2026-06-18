import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { addStockMovement } from '@/lib/stock'

export const dynamic = 'force-dynamic'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['PRET_APROVIM', 'APROVUAR', 'NE_PERGATITJE', 'GATI_PER_NGARKIM', 'NE_DERGESE', 'DORËZUAR', 'DESHTUAR', 'ANULUAR', 'SUBMITTED']).optional(),
  notes: z.string().optional(),
  rejectionNote: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      lines: {
        include: { product: { select: { id: true, name: true, photo: true, code: true } } },
      },
      delivery: { include: { driver: { select: { id: true, name: true } } } },
      payments: { include: { collectedBy: { select: { name: true } } } },
      returns: { include: { lines: { include: { product: { select: { name: true } } } } } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const order = await db.order.findUnique({
      where: { id: params.id },
      include: { lines: true },
    })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (order.isLocked && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Porosi e bllokuar' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}

    if (data.status) {
      updateData.status = data.status

      if (data.status === 'APROVUAR' && session.user.role === 'ADMIN') {
        updateData.approvedById = session.user.id
        updateData.approvedAt = new Date()

        // Reserve stock if not already reserved
        if (!['SUBMITTED', 'APROVUAR'].includes(order.status)) {
          for (const line of order.lines) {
            await addStockMovement({
              productId: line.productId,
              type: 'RESERVATION',
              quantityCopje: line.quantityCopje,
              reference: order.reference,
              referenceId: order.id,
              userId: session.user.id,
              reason: 'Aprovim porosie',
            })
          }
        }
      }

      if (data.status === 'ANULUAR') {
        updateData.rejectedById = session.user.id
        updateData.rejectedAt = new Date()
        if (data.rejectionNote) updateData.rejectionNote = data.rejectionNote

        // Release reservations
        if (['SUBMITTED', 'APROVUAR', 'NE_PERGATITJE', 'GATI_PER_NGARKIM'].includes(order.status)) {
          for (const line of order.lines) {
            await addStockMovement({
              productId: line.productId,
              type: 'RESERVATION_RELEASE',
              quantityCopje: line.quantityCopje,
              reference: order.reference,
              referenceId: order.id,
              userId: session.user.id,
              reason: 'Anulim porosie',
            })
          }
        }
      }

      if (data.status === 'DORËZUAR') {
        updateData.isLocked = true
        // Convert reservation to actual OUT
        for (const line of order.lines) {
          await addStockMovement({
            productId: line.productId,
            type: 'RESERVATION_RELEASE',
            quantityCopje: line.quantityCopje,
            reference: order.reference,
            referenceId: order.id,
            userId: session.user.id,
            reason: 'Konfirmim dërgese',
          })
          await addStockMovement({
            productId: line.productId,
            type: 'OUT',
            quantityCopje: line.quantityCopje,
            reference: order.reference,
            referenceId: order.id,
            userId: session.user.id,
            reason: 'Dorëzim porosie',
          })
        }
      }
    }

    if (data.notes !== undefined) updateData.notes = data.notes

    const updated = await db.order.update({
      where: { id: params.id },
      data: updateData,
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'orders',
      action: 'UPDATE_STATUS',
      recordId: params.id,
      prevValue: { status: order.status },
      newValue: { status: data.status },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
