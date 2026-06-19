import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStockLevel } from '@/lib/stock'
import { createAuditLog } from '@/lib/audit'
import { notifyRoles } from '@/lib/notifications'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const adjustSchema = z.object({
  newStock: z.number().int('Stoku duhet të jetë numër i plotë').min(0, 'Stoku nuk mund të jetë negativ'),
  reason: z.string().min(3, 'Arsyeja duhet të ketë të paktën 3 karaktere'),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden — vetëm ADMIN mund të rregullojë stokun' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body i pavlefshëm JSON' }, { status: 400 })
  }

  const parsed = adjustSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Validim i dështuar' }, { status: 400 })
  }

  const { newStock, reason } = parsed.data

  try {
    const product = await db.product.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, code: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Produkti nuk u gjet' }, { status: 404 })
    }

    const currentStock = await getStockLevel(params.id)
    const diff = newStock - currentStock

    if (diff === 0) {
      return NextResponse.json({
        message: 'Stoku është i njëjtë — nuk u krijua asnjë lëvizje',
        currentStock,
        newStock,
        diff: 0,
      })
    }

    // Store as ADJUSTMENT with signed quantityCopje.
    // getStockLevel() does: stock += qty  for ADJUSTMENT type,
    // so negative qty naturally reduces stock.
    const reference = `ADJ-${Date.now()}`
    await db.stockMovement.create({
      data: {
        productId: params.id,
        type: 'ADJUSTMENT',
        quantityCopje: diff,
        reason,
        reference,
        userId: session.user.id,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'stock',
      action: 'ADJUSTMENT',
      recordId: params.id,
      prevValue: {
        productId: params.id,
        productCode: product.code,
        productName: product.name,
        stockBefore: currentStock,
      },
      newValue: {
        stockAfter: newStock,
        diff,
        reason,
        reference,
      },
    })

    // Low stock alert when new level drops below 20 copje
    if (newStock < 20 && newStock < currentStock) {
      notifyRoles(db, ['ADMIN', 'DEPOIST'], {
        type: 'LOW_STOCK',
        title: 'Stok i Ulët',
        message: `${product.name} (${product.code}): stoku ra në ${newStock} copë`,
        link: `/admin/products/${params.id}`,
      }).catch(() => null)
    }

    return NextResponse.json({
      success: true,
      previousStock: currentStock,
      newStock,
      diff,
      reference,
    })
  } catch (err) {
    console.error('[stock/adjust] error:', err)
    return NextResponse.json({ error: 'Gabim i brendshëm gjatë rregullimit të stokut' }, { status: 500 })
  }
}
