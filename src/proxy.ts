/**
 * proxy.ts — Edge route gating + Supabase session refresh.
 *
 * Runs on every request that matches `config.matcher` below. Two jobs:
 *   1. Refresh the Supabase auth session (so cookies stay valid as the
 *      access token nears expiry).
 *   2. Redirect unauthenticated requests to /sign-in, except for an
 *      explicit allowlist of public routes (auth pages, callback, etc.)
 *
 * Next.js 16 uses `proxy.ts` with a `proxy` export (replaces the old `middleware.ts`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createSsrServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/invite', // /invite/[token] for accepting invites
  '/portal', // /portal/[token] for vendor portal access (no auth, token-validated)
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Mutable response we may modify with refreshed session cookies.
  let response = NextResponse.next({ request })

  const supabase = createSsrServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // IMPORTANT: getUser() (not getSession()) revalidates the JWT against
  // Supabase Auth so we don't trust a stale cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthenticated = !!user

  // Already-signed-in users on auth pages should bounce to home.
  if (isAuthenticated && (pathname === '/sign-in' || pathname === '/sign-up')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Unauthenticated users on protected routes go to sign-in.
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Match everything except Next.js internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
