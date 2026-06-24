import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMultipleStockLevels } from '@/lib/stock'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public endpoint — no auth. Never exposes real stock numbers or unpublished prices.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() ?? ''
    const categoryId = searchParams.get('categoryId') ?? ''

    const where: Record<string, unknown> = { status: 'ACTIVE' }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (categoryId) where.categoryId = categoryId

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
        salesPrice: true,
        discountPercent: true,
        pakoCopje: true,
        showPricePublic: true,
        promotionActive: true,
        promotionText: true,
        brand: { select: { name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    })

    const stockMap = await getMultipleStockLevels(products.map((p) => p.id))

    const publicProducts = products.map((p) => {
      const priceVisible = showPrice && p.showPricePublic
      const finalUnitPrice = priceVisible
        ? p.salesPrice * (1 - (p.discountPercent ?? 0) / 100)
        : null
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        photo: p.photo,
        pakoCopje: p.pakoCopje,
        promotionActive: p.promotionActive,
        promotionText: p.promotionText,
        brand: p.brand,
        category: p.category,
        // Price only if globally enabled AND flagged per product
        price: priceVisible ? finalUnitPrice : null,
        discountPercent: priceVisible ? (p.discountPercent ?? 0) : 0,
        // Availability only — never the real stock number
        available: (stockMap[p.id] ?? 0) > 0,
      }
    })

    const categories = await db.category.findMany({ orderBy: { name: 'asc' } })

    // Public, non-sensitive data — let the CDN serve a short-lived cached copy.
    return NextResponse.json(
      { products: publicProducts, categories, showPrice },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    )
  } catch (err) {
    console.error('[GET /api/public/catalog]', err)
    return NextResponse.json({ products: [], categories: [], showPrice: false, error: 'Internal server error' }, { status: 500 })
  }
}
