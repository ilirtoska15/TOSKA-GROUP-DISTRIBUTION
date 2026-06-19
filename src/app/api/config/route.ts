import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await db.systemConfig.findMany()
    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]))

    return NextResponse.json({ config: configMap, items: configs })
  } catch (err) {
    console.error('[GET /api/config] error:', err)
    return NextResponse.json({ config: {}, items: [], error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as Record<string, string>

    for (const [key, value] of Object.entries(body)) {
      await db.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    await createAuditLog({
      userId: session.user.id,
      module: 'config',
      action: 'UPDATE',
      newValue: body,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[config] POST error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
