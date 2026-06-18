import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'product-images'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nuk u gjet asnjë file' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Lloji i file-it nuk lejohet. Përdor JPG, PNG ose WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File shumë i madh. Maksimumi 5MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const filename = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // ── Production: Supabase Storage ──
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false },
      })

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filename, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (error) {
        console.error('[upload] Supabase Storage error:', error)
        return NextResponse.json({ error: 'Gabim në upload: ' + error.message }, { status: 500 })
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)
      return NextResponse.json({ url: urlData.publicUrl })
    }

    // ── Development fallback: local filesystem ──
    const { writeFile, mkdir } = await import('fs/promises')
    const { join } = await import('path')
    const { existsSync } = await import('fs')

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'products')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const localFilename = filename.replace('products/', '')
    const filepath = join(uploadDir, localFilename)
    await writeFile(filepath, buffer)

    return NextResponse.json({ url: `/uploads/products/${localFilename}` })
  } catch (err) {
    console.error('[upload] Unexpected error:', err)
    return NextResponse.json({ error: 'Gabim i papritur në upload' }, { status: 500 })
  }
}
