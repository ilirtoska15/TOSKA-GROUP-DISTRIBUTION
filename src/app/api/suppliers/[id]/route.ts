import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const updated = await db.supplier.update({
      where: { id: params.id },
      data: {
        name: body.name,
        contactPerson: body.contact,
        phone: body.phone,
        email: body.email || undefined,
        address: body.address,
        ...(body.status && { status: body.status }),
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
