import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { convertToBase } from '@/lib/stock'
import { sendPushToRole } from '@/lib/push'
import { notifyRoles } from '@/lib/notifications'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_ITEMS = 50
const MAX_QTY_PER_ITEM = 9999

// Simple in-memory rate limiter (per server instance): max 5 requests / 10 min per IP.
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  arr.push(now)
  hits.set(ip, arr)
  if (hits.size > 5000) hits.clear() // crude memory cap
  return arr.length > RATE_LIMIT
}

const itemSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(['COPE', 'PAKO']),
  quantity: z.number().int().positive().max(MAX_QTY_PER_ITEM),
})

const schema = z.object({
  businessName: z.string().trim().min(1, 'Emri i biznesit kërkohet').max(200),
  contactName: z.string().trim().min(1, 'Personi kontaktues kërkohet').max(200),
  phone: z.string().trim().min(3, 'Telefoni kërkohet').max(40),
  address: z.string().trim().min(1, 'Adresa kërkohet').max(300),
  city: z.string().trim().min(1, 'Qyteti kërkohet').max(120),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(itemSchema).min(1, 'Shporta është bosh').max(MAX_ITEMS),
  // honeypot — must be empty for a real human
  website: z.string().optional(),
})

async function publicOrderReference(): Promise<string> {
  const year = new Date().getFullYear()
  const counter = await db.sequenceCounter.upsert({
    where: { name_year: { name: 'publicorder', year } },
    update: { value: { increment: 1 } },
    create: { name: 'publicorder', year, value: 1 },
  })
  return `PUB-${year}-${String(counter.value).padStart(6, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()) || req.headers.get('x-real-ip') || 'unknown'

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body i pavlefshëm' }, { status: 400 })

    let data: z.infer<typeof schema>
    try {
      data = schema.parse(body)
    } catch (zerr) {
      if (zerr instanceof z.ZodError) {
        return NextResponse.json({ error: zerr.errors[0]?.message ?? 'Të dhëna të pavlefshme' }, { status: 400 })
      }
      throw zerr
    }

    // Honeypot: pretend success but do nothing (don't reveal the trap to bots)
    if (data.website && data.website.trim() !== '') {
      return NextResponse.json({ success: true, reference: null }, { status: 201 })
    }

    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Shumë kërkesa. Provoni sërish më vonë.' }, { status: 429 })
    }

    // Validate products against DB and compute prices server-side (never trust client prices)
    const ids = Array.from(new Set(data.items.map((i) => i.productId)))
    const products = await db.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true, name: true, code: true, salesPrice: true, discountPercent: true, pakoCopje: true, photo: true },
    })
    const byId = new Map(products.map((p) => [p.id, p]))

    const items: Prisma.InputJsonValue[] = []
    let totalAmount = 0
    for (const line of data.items) {
      const p = byId.get(line.productId)
      if (!p) {
        return NextResponse.json({ error: 'Një ose më shumë produkte nuk janë të disponueshme.' }, { status: 400 })
      }
      if (line.unit === 'PAKO' && !p.pakoCopje) {
        return NextResponse.json({ error: `Produkti "${p.name}" nuk ka konfigurim Pako.` }, { status: 400 })
      }
      const quantityCopje = convertToBase(line.quantity, line.unit, p.pakoCopje)
      const finalUnitPrice = p.salesPrice * (1 - (p.discountPercent ?? 0) / 100)
      const lineTotal = finalUnitPrice * quantityCopje
      totalAmount += lineTotal
      items.push({
        productId: p.id,
        name: p.name,
        code: p.code,
        unit: line.unit,
        quantity: line.quantity,
        quantityCopje,
        finalUnitPrice,
        lineTotal,
      })
    }

    const reference = await publicOrderReference()

    const request = await db.publicOrderRequest.create({
      data: {
        reference,
        businessName: data.businessName,
        contactName: data.contactName,
        phone: data.phone,
        address: data.address,
        city: data.city,
        notes: data.notes || null,
        items,
        totalAmount,
        status: 'PENDING',
      },
      select: { id: true, reference: true },
    })

    // Notify admins (best-effort)
    sendPushToRole('ADMIN', 'Kërkesë e Re Publike', `${request.reference} — ${data.businessName}`, '/admin/public-orders').catch(() => null)
    notifyRoles(db, ['ADMIN'], {
      type: 'PUBLIC_ORDER',
      title: 'Kërkesë e Re nga Katalogu',
      message: `${request.reference} — ${data.businessName} (${data.phone})`,
      link: '/admin/public-orders',
    }).catch(() => null)

    return NextResponse.json({ success: true, reference: request.reference }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/public/orders]', err)
    return NextResponse.json({ error: 'Gabim gjatë dërgimit të kërkesës' }, { status: 500 })
  }
}
