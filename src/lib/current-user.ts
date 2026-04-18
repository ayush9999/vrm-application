/**
 * current-user.ts — Resolves the current user context from the Supabase Auth session.
 *
 * Reads auth.uid() via the cookie-aware server client, then looks up:
 *   - public.users (id = auth.uid()) → home org_id
 *   - org_memberships → role within that org
 *
 * Wrapped in React cache() so multiple calls within the same server
 * render (layout.tsx + page.tsx + server actions) share one result
 * instead of making redundant auth + DB round-trips.
 */

import { cache } from 'react'
import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import type { CurrentUser, OrgRole } from '@/types/org'

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Auth check must go through Supabase client (validates JWT via HTTP)
  const supabase = await createServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  // DB lookups use direct Postgres (fast, pipelined on one connection)
  const [userRows, membershipRows] = await Promise.all([
    sql<{ id: string; org_id: string }[]>`
      SELECT id, org_id FROM users WHERE id = ${authUser.id} LIMIT 1
    `,
    sql<{ role: string }[]>`
      SELECT om.role
      FROM org_memberships om
      JOIN users u ON u.id = om.user_id AND u.org_id = om.org_id
      WHERE om.user_id = ${authUser.id}
      LIMIT 1
    `,
  ])

  const userRow = userRows[0]
  if (!userRow) return null

  const role: OrgRole = (membershipRows[0]?.role as OrgRole) ?? 'vendor_admin'
  return { userId: userRow.id, orgId: userRow.org_id, role }
})

/**
 * Like getCurrentUser but throws if no context is available.
 * Callers should typically be on a route protected by proxy.ts so this
 * shouldn't fire in normal operation.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('No user context. Please sign in.')
  }
  return user
}

/**
 * Convenience for when you only need the user id.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.userId ?? null
}
