import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'AGJENT', 'SHOFER', 'DEPOIST']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  phone: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  zoneId: z.string().optional().nullable(),
  permissions: z.array(z.object({
    permission: z.string(),
    enabled: z.boolean(),
  })).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (data.name) updateData.name = data.name
    if (data.email) updateData.email = data.email
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10)
    if (data.role) updateData.role = data.role
    if (data.status) updateData.status = data.status
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.regionId !== undefined) updateData.regionId = data.regionId
    if (data.zoneId !== undefined) updateData.zoneId = data.zoneId

    const user = await db.user.update({ where: { id: params.id }, data: updateData })

    // Update permissions
    if (data.permissions) {
      for (const perm of data.permissions) {
        await db.userPermission.upsert({
          where: { userId_permission: { userId: params.id, permission: perm.permission } },
          update: { enabled: perm.enabled },
          create: { userId: params.id, permission: perm.permission, enabled: perm.enabled },
        })
      }

      await createAuditLog({
        userId: session.user.id,
        module: 'permissions',
        action: 'UPDATE',
        recordId: params.id,
        newValue: data.permissions,
      })
    }

    await createAuditLog({
      userId: session.user.id,
      module: 'users',
      action: 'UPDATE',
      recordId: params.id,
      newValue: { name: user.name, role: user.role, status: user.status },
    })

    return NextResponse.json({ ...user, password: undefined })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
