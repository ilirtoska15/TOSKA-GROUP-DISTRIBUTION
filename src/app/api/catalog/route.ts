import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public endpoint - no auth required
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const categoryId = searchParams.get('categoryId') ?? ''
  const brandId = searchParams.get('brandId') ?? ''

  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { brand: { name: { contains: search } } },
      { category: { name: { contains: search } } },
    ]
  }
  if (categoryId) where.categoryId = categoryId
  if (brandId) where.brandId = brandId

  // Get price visibility config
  const priceConfig = await db.systemConfig.findUnique({ where: { key: 'catalog_show_price' } })
  const showPrice = priceConfig?.value === 'true'

  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      photo: true,
      salesPrice: showPrice,
      promotionActive: true,
      promotionText: true,
      promotionEnds: true,
      showPricePublic: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })

  // Filter price per product
  const publicProducts = products.map((p) => ({
    ...p,
    salesPrice: (showPrice && p.showPricePublic) ? p.salesPrice : null,
  }))

  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: { name: 'asc' } }),
    db.brand.findMany({ orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({ products: publicProducts, categories, brands })
}
