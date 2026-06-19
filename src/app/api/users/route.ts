import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'AGJENT', 'SHOFER', 'DEPOIST']),
  phone: z.string().optional(),
  regionId: z.string().optional(),
  zoneId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') ?? ''

    const where: Record<string, unknown> = { status: 'ACTIVE' }
    if (role) where.role = role

    const users = await db.user.findMany({
      where,
      include: { permissions: true, region: true, zone: true },
      orderBy: { name: 'asc' },
    })

    const safeUsers = users.map((u) => ({ ...u, password: undefined }))
    return NextResponse.json({ users: safeUsers, total: safeUsers.length })
  } catch (err) {
    console.error('[GET /api/users] error:', err)
    return NextResponse.json({ users: [], total: 0, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const existing = await db.user.findUnique({ where: { email: data.email } })
    if (existing) return NextResponse.json({ error: 'Email ekziston tashmÃ«' }, { status: 400 })

    const hashed = await bcrypt.hash(data.password, 10)

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: data.role,
        phone: data.phone,
        regionId: data.regionId,
        zoneId: data.zoneId,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'users',
      action: 'CREATE',
      recordId: user.id,
      newValue: { name: user.name, email: user.email, role: user.role },
    })

    return NextResponse.json({ ...user, password: undefined }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
