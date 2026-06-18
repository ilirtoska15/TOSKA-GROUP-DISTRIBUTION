import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  businessName: z.string().min(1).optional(),
  businessAddress: z.string().optional(),
  city: z.string().optional(),
  regionId: z.string().optional().nullable(),
  zoneId: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  businessNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  phone: z.string().optional(),
  phone2: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
  debtLimit: z.number().min(0).optional(),
  paymentTermDays: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  notes: z.string().optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await db.customer.findUnique({
    where: { id: params.id },
    include: {
      agent: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { lines: { include: { product: { select: { name: true } } } } },
      },
      visits: { orderBy: { createdAt: 'desc' }, take: 10, include: { agent: { select: { name: true } } } },
      payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      returns: { orderBy: { createdAt: 'desc' }, take: 5 },
      documents: true,
    },
  })

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Calculate current debt
  const deliveredAmount = await db.order.aggregate({
    where: { customerId: params.id, status: 'DORËZUAR' },
    _sum: { totalAmount: true },
  })
  const paidAmount = await db.payment.aggregate({
    where: { customerId: params.id },
    _sum: { amount: true },
  })
  const currentDebt = Math.max(0, (deliveredAmount._sum.totalAmount ?? 0) - (paidAmount._sum.amount ?? 0))

  return NextResponse.json({ ...customer, currentDebt })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || !['ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const prev = await db.customer.findUnique({ where: { id: params.id } })
    const customer = await db.customer.update({ where: { id: params.id }, data })

    await createAuditLog({
      userId: session.user.id,
      module: 'customers',
      action: 'UPDATE',
      recordId: params.id,
      prevValue: prev,
      newValue: customer,
    })

    return NextResponse.json(customer)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
