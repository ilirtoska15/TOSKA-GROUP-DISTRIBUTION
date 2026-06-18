import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const notes = JSON.stringify({ make: body.make, model: body.model, year: body.year })

    const updated = await db.vehicle.update({
      where: { id: params.id },
      data: {
        plate: body.plate,
        notes,
        insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : undefined,
        registrationExpiry: body.registrationExpiry ? new Date(body.registrationExpiry) : undefined,
        ...(body.status && { status: body.status }),
      },
    })
    return NextResponse.json({ ...updated, make: body.make, model: body.model, year: body.year })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
