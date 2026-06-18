import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Public routes
  if (pathname.startsWith('/catalog') || pathname.startsWith('/api/catalog')) {
    return NextResponse.next()
  }

  // Auth routes
  if (pathname === '/login') {
    if (session?.user) {
      const roleMap: Record<string, string> = {
        ADMIN: '/admin',
        AGJENT: '/agjent',
        SHOFER: '/shofer',
        DEPOIST: '/depoist',
      }
      return NextResponse.redirect(new URL(roleMap[session.user.role] ?? '/', req.url))
    }
    return NextResponse.next()
  }

  // Protected routes
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Role-based route protection
  const role = session.user.role
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    const roleMap: Record<string, string> = { AGJENT: '/agjent', SHOFER: '/shofer', DEPOIST: '/depoist' }
    return NextResponse.redirect(new URL(roleMap[role] ?? '/login', req.url))
  }
  if (pathname.startsWith('/agjent') && !['ADMIN', 'AGJENT'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (pathname.startsWith('/shofer') && !['ADMIN', 'SHOFER'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (pathname.startsWith('/depoist') && !['ADMIN', 'DEPOIST'].includes(role)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest|api/auth).*)'],
}
