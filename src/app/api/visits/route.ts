import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { z } from 'zod'

const openVisitSchema = z.object({
  customerId: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
})

const closeVisitSchema = z.object({
  visitId: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  noOrderReason: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId') ?? ''
  const agentId = searchParams.get('agentId') ?? ''
  const date = searchParams.get('date') ?? ''
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (customerId) where.customerId = customerId
  if (agentId) where.agentId = agentId
  else if (session.user.role === 'AGJENT') where.agentId = session.user.id
  if (status) where.status = status
  if (search) {
    where.OR = [
      { customer: { businessName: { contains: search } } },
      { agent: { name: { contains: search } } },
    ]
  }

  if (date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)
    where.createdAt = { gte: d, lte: end }
  }

  const [visits, total] = await Promise.all([
    db.visit.findMany({
      where,
      include: {
        customer: { select: { id: true, businessName: true, code: true, businessAddress: true } },
        agent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.visit.count({ where }),
  ])

  return NextResponse.json({ visits, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['AGJENT', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const action = body.action

    if (action === 'open') {
      const data = openVisitSchema.parse(body)

      // Check for open visit
      const existingOpen = await db.visit.findFirst({
        where: { agentId: session.user.id, status: 'OPEN' },
      })
      if (existingOpen) {
        return NextResponse.json({ error: 'Keni një vizitë të hapur. Mbylleni para se të hapni një tjetër.' }, { status: 400 })
      }

      const reference = await generateReference(db, 'visit')
      const visit = await db.visit.create({
        data: {
          reference,
          customerId: data.customerId,
          agentId: session.user.id,
          status: 'OPEN',
          openedLat: data.lat,
          openedLng: data.lng,
        },
      })
      return NextResponse.json(visit, { status: 201 })
    }

    if (action === 'close') {
      const data = closeVisitSchema.parse(body)
      const visit = await db.visit.findUnique({ where: { id: data.visitId } })
      if (!visit || visit.agentId !== session.user.id) {
        return NextResponse.json({ error: 'Vizita nuk u gjet' }, { status: 404 })
      }

      const updated = await db.visit.update({
        where: { id: data.visitId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedLat: data.lat,
          closedLng: data.lng,
          noOrderReason: data.noOrderReason,
          notes: data.notes,
        },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
