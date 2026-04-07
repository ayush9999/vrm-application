import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/setup', '/_next', '/favicon.ico', '/api']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through without checking
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Require org_id cookie — set during /setup/organization
  const orgId = request.cookies.get('org_id')?.value
  if (!orgId) {
    const setupUrl = new URL('/setup', request.url)
    return NextResponse.redirect(setupUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
