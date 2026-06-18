import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const { status } = body

    const expense = await db.expense.findUnique({ where: { id: params.id } })
    if (!expense) return NextResponse.json({ error: 'Shpenzimi nuk u gjet' }, { status: 404 })

    const updateData: Record<string, unknown> = { status }
    if (status === 'APPROVED') {
      updateData.approvedById = session.user.id
      updateData.approvedAt = new Date()
    }

    const updated = await db.expense.update({ where: { id: params.id }, data: updateData })

    await createAuditLog({
      userId: session.user.id,
      module: 'expenses',
      action: 'UPDATE_STATUS',
      recordId: params.id,
      prevValue: { status: expense.status },
      newValue: { status },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
