import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'
import { getStockLevel } from '@/lib/stock'

export const dynamic = 'force-dynamic'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  brandId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  photo: z.string().optional(),
  salesPrice: z.number().min(0).optional(),
  barcode: z.string().optional().nullable(),
  pakoCopje: z.number().int().positive().optional().nullable(),
  promotionActive: z.boolean().optional(),
  promotionText: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  showPricePublic: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await db.product.findUnique({
    where: { id: params.id },
    include: {
      brand: true,
      category: true,
      stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stockCopje = await getStockLevel(params.id)

  return NextResponse.json({ ...product, stockCopje })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || !['ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const prev = await db.product.findUnique({ where: { id: params.id } })
    const product = await db.product.update({
      where: { id: params.id },
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : data.expiryDate === null ? null : undefined,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'products',
      action: 'UPDATE',
      recordId: params.id,
      prevValue: prev,
      newValue: product,
    })

    return NextResponse.json(product)
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
