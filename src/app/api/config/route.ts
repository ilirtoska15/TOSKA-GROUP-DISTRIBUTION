import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const configs = await db.systemConfig.findMany()
  const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]))

  return NextResponse.json(configMap)
}

export async function POST(req: NextRequest) {
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
}
