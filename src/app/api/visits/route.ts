import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createNotificationSafe } from '@/lib/notifications'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  reason: z.string().optional(), // alias accepted from frontend
  notes: z.string().optional(),
})

const planVisitSchema = z.object({
  agentId: z.string(),
  customerId: z.string(),
  scheduledDate: z.string(), // ISO date string
  scheduledTime: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId') ?? ''
    const agentId = searchParams.get('agentId') ?? ''
    const date = searchParams.get('date') ?? ''
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const upcoming = searchParams.get('upcoming') === '1'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (customerId) where.customerId = customerId
    if (agentId) where.agentId = agentId
    else if (session.user.role === 'AGJENT') where.agentId = session.user.id
    if (status) where.status = status
    if (search.trim()) {
      where.OR = [
        { customer: { businessName: { contains: search, mode: 'insensitive' } } },
        { agent: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      where.createdAt = { gte: d, lte: end }
    }

    // upcoming=1 → PLANNED visits with scheduledDate >= today
    if (upcoming) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      where.status = 'PLANNED'
      where.scheduledDate = { gte: today }
    }

    const [visits, total] = await Promise.all([
      db.visit.findMany({
        where,
        include: {
          customer: { select: { id: true, businessName: true, code: true, businessAddress: true } },
          agent: { select: { id: true, name: true } },
        },
        orderBy: upcoming
          ? { scheduledDate: 'asc' }
          : { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.visit.count({ where }),
    ])

    return NextResponse.json({ visits, total, page, limit })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[visits] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['AGJENT', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const action = body.action

    // ── Open a real-time visit (agent) ──────────────────────────
    if (action === 'open') {
      const data = openVisitSchema.parse(body)
      const existingOpen = await db.visit.findFirst({
        where: { agentId: session.user.id, status: 'OPEN' },
      })
      if (existingOpen) {
        return NextResponse.json({ error: 'Ke tashmë një vizitë të hapur. Mbylleni para se të hapësh tjetër.' }, { status: 400 })
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

    // ── Close a real-time visit (agent) ─────────────────────────
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
          noOrderReason: data.noOrderReason ?? data.reason, // fix: accept both field names
          notes: data.notes,
        },
      })
      return NextResponse.json(updated)
    }

    // ── Plan a visit (admin only) ────────────────────────────────
    if (action === 'plan') {
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Vetëm admini mund të planifikojë vizita' }, { status: 403 })
      }
      const data = planVisitSchema.parse(body)
      const reference = await generateReference(db, 'visit')
      const visit = await db.visit.create({
        data: {
          reference,
          customerId: data.customerId,
          agentId: data.agentId,
          status: 'PLANNED',
          scheduledDate: new Date(data.scheduledDate),
          scheduledTime: data.scheduledTime,
          priority: data.priority,
          notes: data.notes,
        },
      })
      // Notify the assigned agent
      const customer = await db.customer.findUnique({
        where: { id: data.customerId },
        select: { businessName: true },
      })
      await createNotificationSafe(db, {
        userId: data.agentId,
        type: 'VISIT_PLANNED',
        title: 'Vizitë e Planifikuar',
        message: `U caktua vizitë tek ${customer?.businessName ?? 'klienti'} për ${new Date(data.scheduledDate).toLocaleDateString('sq-AL')}`,
        link: '/agjent/visits',
      })
      return NextResponse.json(visit, { status: 201 })
    }

    // ── Start a planned visit (agent: PLANNED → OPEN) ────────────
    if (action === 'start') {
      const { visitId, lat, lng } = body as { visitId: string; lat?: number; lng?: number }
      if (!visitId) return NextResponse.json({ error: 'visitId kërkohet' }, { status: 400 })
      const visit = await db.visit.findUnique({ where: { id: visitId } })
      if (!visit || visit.agentId !== session.user.id || visit.status !== 'PLANNED') {
        return NextResponse.json({ error: 'Vizita nuk u gjet ose nuk mund të fillohet' }, { status: 404 })
      }
      const existingOpen = await db.visit.findFirst({
        where: { agentId: session.user.id, status: 'OPEN' },
      })
      if (existingOpen) {
        return NextResponse.json({ error: 'Ke tashmë një vizitë të hapur. Mbylleni para se të fillosësh tjetrën.' }, { status: 400 })
      }
      const updated = await db.visit.update({
        where: { id: visitId },
        data: {
          status: 'OPEN',
          openedAt: new Date(),
          openedLat: lat,
          openedLng: lng,
        },
      })
      return NextResponse.json(updated)
    }

    // ── Mark a planned visit as missed (agent or admin) ──────────
    if (action === 'mark_missed') {
      const { visitId } = body as { visitId: string }
      if (!visitId) return NextResponse.json({ error: 'visitId kërkohet' }, { status: 400 })
      const visit = await db.visit.findUnique({ where: { id: visitId } })
      if (!visit) return NextResponse.json({ error: 'Vizita nuk u gjet' }, { status: 404 })
      if (session.user.role === 'AGJENT' && visit.agentId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const updated = await db.visit.update({
        where: { id: visitId },
        data: { status: 'MISSED', closedAt: new Date() },
      })
      return NextResponse.json(updated)
    }

    // ── Cancel a planned visit (admin only) ──────────────────────
    if (action === 'cancel') {
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Vetëm admini mund të anulojë vizita' }, { status: 403 })
      }
      const { visitId } = body as { visitId: string }
      if (!visitId) return NextResponse.json({ error: 'visitId kërkohet' }, { status: 400 })
      const updated = await db.visit.update({
        where: { id: visitId },
        data: { status: 'CANCELLED', closedAt: new Date() },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Action i pavlefshëm' }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    console.error('[visits] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
