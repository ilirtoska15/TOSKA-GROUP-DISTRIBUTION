import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateReference } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLACEHOLDER_PHOTO = '/no-photo.png'

interface Row {
  rowIndex: number
  name: string
  code: string
  category: string
  brand: string
  description: string
  salesPrice: string
  discountPercent: string
  pakoCopje: string
  barcode: string
  lotNumber: string
  expiryDate: string
  initialStock: string
  status: string
  photo: string
  valid: boolean
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { rows: Row[]; onDuplicate: 'update' | 'skip' }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body i pavlefshëm JSON' }, { status: 400 })
  }

  const { rows, onDuplicate = 'skip' } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Nuk ka rreshta për importim' }, { status: 400 })
  }

  const validRows = rows.filter(r => r.valid && !!r.name && !!r.category)
  if (validRows.length === 0) {
    return NextResponse.json({ error: 'Nuk ka rreshta valid' }, { status: 400 })
  }

  // Cache categories and brands to avoid N+1 DB lookups
  const existingCats = await db.category.findMany({ select: { id: true, name: true } })
  const catCache = new Map(existingCats.map(c => [c.name.toLowerCase(), c.id]))

  const existingBrands = await db.brand.findMany({ select: { id: true, name: true } })
  const brandCache = new Map(existingBrands.map(b => [b.name.toLowerCase(), b.id]))

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of validRows) {
    try {
      // Resolve or create category
      let categoryId: string | null = null
      if (row.category) {
        const key = row.category.toLowerCase()
        if (catCache.has(key)) {
          categoryId = catCache.get(key)!
        } else {
          const cat = await db.category.create({ data: { name: row.category } })
          catCache.set(key, cat.id)
          categoryId = cat.id
        }
      }

      // Resolve or create brand
      let brandId: string | null = null
      if (row.brand) {
        const key = row.brand.toLowerCase()
        if (brandCache.has(key)) {
          brandId = brandCache.get(key)!
        } else {
          const br = await db.brand.create({ data: { name: row.brand } })
          brandCache.set(key, br.id)
          brandId = br.id
        }
      }

      const salesPrice = parseFloat(row.salesPrice)
      const discountPercent = parseFloat(row.discountPercent) || 0
      const pakoCopje = row.pakoCopje ? parseInt(row.pakoCopje) : null
      const initialStock = parseInt(row.initialStock) || 0
      const photo = row.photo || PLACEHOLDER_PHOTO
      const status = !row.photo ? 'INACTIVE' : (['ACTIVE', 'INACTIVE'].includes(row.status) ? row.status : 'ACTIVE')

      let expiryDate: Date | null = null
      if (row.expiryDate) {
        const d = new Date(row.expiryDate)
        if (!isNaN(d.getTime())) expiryDate = d
      }

      // Duplicate by code
      if (row.code) {
        const existing = await db.product.findUnique({ where: { code: row.code } })
        if (existing) {
          if (onDuplicate === 'skip') { skipped++; continue }
          await db.product.update({
            where: { code: row.code },
            data: {
              name: row.name,
              categoryId: categoryId ?? existing.categoryId,
              brandId: brandId ?? existing.brandId,
              description: row.description || existing.description || null,
              salesPrice: isNaN(salesPrice) ? existing.salesPrice : salesPrice,
              discountPercent,
              pakoCopje: pakoCopje ?? existing.pakoCopje,
              barcode: row.barcode || existing.barcode || null,
              lotNumber: row.lotNumber || existing.lotNumber || null,
              expiryDate: expiryDate ?? existing.expiryDate,
              photo: row.photo || existing.photo,
              status,
            },
          })
          imported++
          continue
        }
      }

      // Barcode uniqueness check
      if (row.barcode) {
        const dup = await db.product.findUnique({ where: { barcode: row.barcode } })
        if (dup) {
          errors.push(`Rreshti ${row.rowIndex}: barkodi "${row.barcode}" ekziston tashmë — u skippua`)
          skipped++
          continue
        }
      }

      const code = row.code || await generateReference(db, 'product')

      const product = await db.product.create({
        data: {
          code,
          name: row.name,
          categoryId,
          brandId,
          description: row.description || null,
          salesPrice: isNaN(salesPrice) ? 0 : salesPrice,
          discountPercent,
          pakoCopje,
          barcode: row.barcode || null,
          lotNumber: row.lotNumber || null,
          expiryDate,
          photo,
          status,
        },
      })

      if (initialStock > 0) {
        await db.stockMovement.create({
          data: {
            productId: product.id,
            type: 'IN',
            quantityCopje: initialStock,
            reason: 'Hyrje fillestare nga importi Excel',
            reference: `IMPORT-${Date.now()}`,
            userId: session.user.id,
          },
        })
      }

      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gabim i panjohur'
      errors.push(`Rreshti ${row.rowIndex}: ${msg.slice(0, 200)}`)
    }
  }

  await createAuditLog({
    userId: session.user.id,
    module: 'products',
    action: 'PRODUCTS_IMPORT',
    newValue: { total: rows.length, valid: validRows.length, imported, skipped, errors: errors.length, onDuplicate },
  })

  return NextResponse.json({ success: true, imported, skipped, errors })
}
