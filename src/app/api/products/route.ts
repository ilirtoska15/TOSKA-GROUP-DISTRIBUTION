import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { getMultipleStockLevels } from '@/lib/stock'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  name: z.string().min(1),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  photo: z.string().min(1, 'Foto e produktit kërkohet').refine(
    (v) => v.startsWith('/uploads/'),
    'Fotoja duhet të ngarkohet nga sistemi'
  ),
  salesPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  barcode: z.string().optional(),
  pakoCopje: z.number().int().positive().optional(),
  promotionActive: z.boolean().default(false),
  promotionText: z.string().optional(),
  expiryDate: z.string().optional(),
  lotNumber: z.string().optional(),
  showPricePublic: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const categoryId = searchParams.get('categoryId') ?? ''
    const brandId = searchParams.get('brandId') ?? ''

    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '30')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.status = status
    else where.status = 'ACTIVE'
    if (categoryId) where.categoryId = categoryId
    if (brandId) where.brandId = brandId

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ])

    // Stock calculation is non-fatal: if it fails, products get stockCopje: 0
    let stockMap: Record<string, number> = {}
    if (products.length > 0) {
      try {
        stockMap = await getMultipleStockLevels(products.map((p) => p.id))
      } catch (err) {
        console.warn('[products] stock calculation failed, returning 0 for all:', err)
      }
    }

    const productsWithStock = products.map((p) => ({
      ...p,
      stockCopje: stockMap[p.id] ?? 0,
    }))

    return NextResponse.json({ products: productsWithStock, total, page, limit })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[products] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !['ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = createSchema.parse(body)

    const code = await generateReference(db, 'product')

    const product = await db.product.create({
      data: {
        ...data,
        code,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      module: 'products',
      action: 'CREATE',
      recordId: product.id,
      newValue: product,
    })

    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[products] POST error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
