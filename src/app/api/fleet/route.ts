import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const createSchema = z.object({
  plate: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  insuranceExpiry: z.string().optional(),
  registrationExpiry: z.string().optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const vehicles = await db.vehicle.findMany({
      orderBy: { plate: 'asc' },
    })

    // Vehicle schema has no make/model/year — stored in notes as JSON
    const normalized = vehicles.map(v => {
      let extra: Record<string, unknown> = {}
      try { extra = JSON.parse(v.notes ?? '{}') } catch { /* ignore malformed notes */ }
      return {
        ...v,
        make: (extra.make as string) ?? '',
        model: (extra.model as string) ?? '',
        year: (extra.year as number) ?? new Date().getFullYear(),
      }
    })

    return NextResponse.json({ vehicles: normalized })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[fleet] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const existing = await db.vehicle.findUnique({ where: { plate: data.plate } })
    if (existing) return NextResponse.json({ error: 'Targa ekziston tashmÃ«' }, { status: 400 })

    const notes = JSON.stringify({ make: data.make, model: data.model, year: data.year })

    const vehicle = await db.vehicle.create({
      data: {
        plate: data.plate,
        notes,
        insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined,
        registrationExpiry: data.registrationExpiry ? new Date(data.registrationExpiry) : undefined,
      },
    })

    return NextResponse.json({ ...vehicle, make: data.make, model: data.model, year: data.year }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
