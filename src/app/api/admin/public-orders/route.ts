import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [requests, total, pendingCount] = await Promise.all([
      db.publicOrderRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.publicOrderRequest.count({ where }),
      db.publicOrderRequest.count({ where: { status: 'PENDING' } }),
    ])

    return NextResponse.json({ requests, total, page, limit, pendingCount })
  } catch (err) {
    console.error('[GET /api/admin/public-orders]', err)
    return NextResponse.json({ requests: [], total: 0, error: 'Internal server error' }, { status: 500 })
  }
}
