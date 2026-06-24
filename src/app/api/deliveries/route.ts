import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const assignSchema = z.object({
  orderId: z.string(),
  driverId: z.string(),
})

const updateSchema = z.object({
  deliveryId: z.string(),
  status: z.enum(['LOADED', 'IN_DELIVERY', 'DELIVERED', 'FAILED']),
  failureReason: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? ''
    const driverId = searchParams.get('driverId') ?? ''
    const date = searchParams.get('date') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (driverId) where.driverId = driverId
    else if (session.user.role === 'SHOFER') where.driverId = session.user.id

    if (date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      where.assignedAt = { gte: d, lte: end }
    }

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          order: {
            include: {
              customer: { select: { id: true, businessName: true, businessAddress: true, phone: true, lat: true, lng: true } },
              lines: { include: { product: { select: { id: true, name: true } } } },
            },
          },
          driver: { select: { id: true, name: true } },
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.delivery.count({ where }),
    ])

    return NextResponse.json({ deliveries, total, page, limit })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[deliveries] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    if (body.action === 'assign') {
      if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const data = assignSchema.parse(body)

      const delivery = await db.delivery.create({
        data: {
          orderId: data.orderId,
          driverId: data.driverId,
          status: 'ASSIGNED',
        },
      })

      await db.order.update({ where: { id: data.orderId }, data: { status: 'NE_DERGESE' } })

      return NextResponse.json(delivery, { status: 201 })
    }

    if (body.action === 'update') {
      const data = updateSchema.parse(body)
      const delivery = await db.delivery.findUnique({ where: { id: data.deliveryId } })
      if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      if (session.user.role === 'SHOFER' && delivery.driverId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const updateData: Record<string, unknown> = { status: data.status }
      if (data.status === 'LOADED') updateData.loadedAt = new Date()
      if (data.status === 'IN_DELIVERY') updateData.startedAt = new Date()
      if (data.status === 'DELIVERED') {
        updateData.deliveredAt = new Date()
        // Update order status
        await db.order.update({ where: { id: delivery.orderId }, data: { status: 'DORËZUAR', isLocked: true } })
      }
      if (data.status === 'FAILED') {
        updateData.failedAt = new Date()
        updateData.failureReason = data.failureReason
        await db.order.update({ where: { id: delivery.orderId }, data: { status: 'DESHTUAR' } })
      }
      if (data.notes) updateData.notes = data.notes

      const updated = await db.delivery.update({ where: { id: data.deliveryId }, data: updateData })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
