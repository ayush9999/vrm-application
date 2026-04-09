/**
 * current-user.ts — Resolves the current user context from the Supabase Auth session.
 *
 * Reads auth.uid() via the cookie-aware server client, then looks up:
 *   - public.users (id = auth.uid()) → home org_id
 *   - org_memberships → role within that org
 */

import { createServerClient } from '@/lib/supabase/server'
import type { CurrentUser, OrgRole } from '@/types/org'

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: userRow } = await supabase
    .from('users')
    .select('id, org_id')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!userRow) {
    // Auth session exists but no public.users row — user is mid-signup
    // (just confirmed email but org-creation hasn't completed). Caller
    // should redirect to /auth/callback or /sign-up to finish provisioning.
    return null
  }

  const { data: membership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('user_id', userRow.id)
    .eq('org_id', userRow.org_id)
    .maybeSingle()

  const role: OrgRole = (membership?.role as OrgRole) ?? 'vendor_admin'
  return { userId: userRow.id, orgId: userRow.org_id, role }
}

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
