import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { action } = body

    const delivery = await db.delivery.findUnique({ where: { id: params.id } })
    if (!delivery) return NextResponse.json({ error: 'Dërgesa nuk u gjet' }, { status: 404 })

    if (action === 'assign') {
      if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { driverId } = body
      if (!driverId) return NextResponse.json({ error: 'driverId kërkohet' }, { status: 400 })

      const updated = await db.delivery.update({
        where: { id: params.id },
        data: { driverId, status: 'ASSIGNED' },
      })

      await createAuditLog({
        userId: session.user.id,
        module: 'deliveries',
        action: 'ASSIGN_DRIVER',
        recordId: params.id,
        newValue: { driverId },
      })

      return NextResponse.json(updated)
    }

    if (action === 'update') {
      if (session.user.role === 'SHOFER' && delivery.driverId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { status } = body
      const updateData: Record<string, unknown> = {}

      if (status) {
        updateData.status = status
        if (status === 'LOADED') updateData.loadedAt = new Date()
        if (status === 'IN_DELIVERY') updateData.startedAt = new Date()
        if (status === 'PICKED_UP') {
          updateData.status = 'IN_DELIVERY'
          updateData.startedAt = new Date()
        }
        if (status === 'DELIVERED') {
          updateData.deliveredAt = new Date()
          await db.order.update({ where: { id: delivery.orderId }, data: { status: 'DORËZUAR', isLocked: true } })
        }
        if (status === 'FAILED') {
          updateData.failedAt = new Date()
          updateData.failureReason = body.failureReason
          await db.order.update({ where: { id: delivery.orderId }, data: { status: 'DESHTUAR' } })
        }
      }

      const updated = await db.delivery.update({ where: { id: params.id }, data: updateData })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
