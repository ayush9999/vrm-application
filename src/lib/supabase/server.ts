/**
 * server.ts — Cookie-aware server-side Supabase client.
 *
 * Returns a Supabase client bound to the current request's auth cookies.
 * Queries made through this client run as the logged-in user and respect
 * Row Level Security policies — i.e. they automatically see only rows
 * the user is allowed to see.
 *
 * Use this client from:
 *   - Server components (page.tsx, layout.tsx)
 *   - Server actions ('use server')
 *   - Route handlers (app/api/*)
 *
 * For operations that need to bypass RLS (signup bootstrap, invite acceptance,
 * cross-org admin tasks), use createServiceClient() from ./service.ts instead.
 */

import { cache } from 'react'
import { createServerClient as createSsrServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be set.',
  )
}

/**
 * Returns a server-side Supabase client bound to the current request's
 * auth cookies. Wrapped in React cache() so layout.tsx and page.tsx
 * share one client instance (and one auth.getUser() round-trip) instead
 * of creating separate ones within the same server render.
 */
export const createServerClient = cache(async () => {
  const cookieStore = await cookies()

  return createSsrServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // setAll may be called from a server component where cookies are
          // read-only. That's fine — token refresh will retry on the next
          // request that goes through the proxy / a route handler.
        }
      },
    },
  })
})
