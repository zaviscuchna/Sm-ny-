import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/session'

const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/init-db',
  '/api/admin/diag',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (PUBLIC_API_ROUTES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json({ error: 'Nepřihlášený uživatel' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
