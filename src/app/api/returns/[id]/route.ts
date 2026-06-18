import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { addStockMovement } from '@/lib/stock'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { status } = body

    const ret = await db.return.findUnique({ where: { id: params.id }, include: { lines: true } })
    if (!ret) return NextResponse.json({ error: 'Kthimi nuk u gjet' }, { status: 404 })

    const updateData: Record<string, unknown> = { status }

    if (status === 'APROVUAR') {
      if (!['ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updateData.approvedById = session.user.id
      updateData.approvedAt = new Date()
    }

    if (status === 'REFUZUAR') {
      if (!['ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (status === 'KTHYER_NE_DEPO') {
      updateData.receivedAt = new Date()
    }

    if (status === 'PERFUNDUAR') {
      updateData.warehouseAction = 'RETURN_TO_STOCK'
      for (const line of ret.lines) {
        await addStockMovement({
          productId: line.productId,
          type: 'RETURN',
          quantityCopje: line.quantityCopje,
          reference: ret.reference,
          referenceId: ret.id,
          userId: session.user.id,
          reason: 'Kthim i pranuar në stok',
        })
      }
    }

    const updated = await db.return.update({ where: { id: params.id }, data: updateData })

    await createAuditLog({
      userId: session.user.id,
      module: 'returns',
      action: 'UPDATE_STATUS',
      recordId: params.id,
      prevValue: { status: ret.status },
      newValue: { status },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
