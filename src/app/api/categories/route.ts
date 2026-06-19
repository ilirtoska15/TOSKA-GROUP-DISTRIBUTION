import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const categories = await db.category.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(categories)
  } catch (err) {
    console.error('[GET /api/categories] error:', err)
    // Return empty array so UI consumers (/agjent/orders/new, product forms) don't crash
    return NextResponse.json([])
  }
}
