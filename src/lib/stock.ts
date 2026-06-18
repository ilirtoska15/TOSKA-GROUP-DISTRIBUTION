import { db } from '@/lib/db'

export async function getStockLevel(productId: string): Promise<number> {
  const result = await db.stockMovement.groupBy({
    by: ['type'],
    where: { productId },
    _sum: { quantityCopje: true },
  })

  let stock = 0
  for (const row of result) {
    const qty = row._sum.quantityCopje ?? 0
    if (['IN', 'RETURN', 'ADJUSTMENT'].includes(row.type)) {
      stock += qty
    } else if (['OUT', 'RESERVATION', 'DAMAGE'].includes(row.type)) {
      stock -= qty
    } else if (row.type === 'RESERVATION_RELEASE') {
      stock += qty
    }
  }
  return Math.max(0, stock)
}

export async function getMultipleStockLevels(productIds: string[]): Promise<Record<string, number>> {
  const result = await db.stockMovement.groupBy({
    by: ['productId', 'type'],
    where: { productId: { in: productIds } },
    _sum: { quantityCopje: true },
  })

  const stockMap: Record<string, number> = {}
  for (const id of productIds) stockMap[id] = 0

  for (const row of result) {
    const qty = row._sum.quantityCopje ?? 0
    if (['IN', 'RETURN', 'ADJUSTMENT'].includes(row.type)) {
      stockMap[row.productId] = (stockMap[row.productId] ?? 0) + qty
    } else if (['OUT', 'RESERVATION', 'DAMAGE'].includes(row.type)) {
      stockMap[row.productId] = (stockMap[row.productId] ?? 0) - qty
    } else if (row.type === 'RESERVATION_RELEASE') {
      stockMap[row.productId] = (stockMap[row.productId] ?? 0) + qty
    }
  }

  for (const id of productIds) {
    stockMap[id] = Math.max(0, stockMap[id] ?? 0)
  }

  return stockMap
}

export function convertToBase(quantity: number, unit: string, pakoCopje?: number | null): number {
  if (unit === 'COPE' || !pakoCopje) return quantity
  return quantity * pakoCopje
}

export function convertFromBase(quantityCopje: number, unit: string, pakoCopje?: number | null): number {
  if (unit === 'COPE' || !pakoCopje) return quantityCopje
  return Math.floor(quantityCopje / pakoCopje)
}

export async function addStockMovement(opts: {
  productId: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVATION' | 'RESERVATION_RELEASE' | 'RETURN' | 'DAMAGE'
  quantityCopje: number
  reason?: string
  reference?: string
  referenceId?: string
  userId?: string
  notes?: string
}) {
  return db.stockMovement.create({
    data: {
      productId: opts.productId,
      type: opts.type,
      quantityCopje: opts.quantityCopje,
      reason: opts.reason,
      reference: opts.reference,
      referenceId: opts.referenceId,
      userId: opts.userId,
      notes: opts.notes,
    },
  })
}
