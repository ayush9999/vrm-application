/**
 * current-user.ts — Dev-mode user/role context resolver.
 *
 * Reads the `user_id` cookie set during /setup/organization and resolves
 * the user's role from org_memberships.
 * TODO: Replace with real session/JWT resolution once auth is implemented.
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import type { CurrentUser, OrgRole } from '@/types/org'

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('user_id')?.value ?? null
}

/**
 * Returns { userId, orgId, role } from cookies + a single DB lookup.
 * Returns null if cookies are absent (no setup yet).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  const orgId = cookieStore.get('org_id')?.value
  if (!userId || !orgId) return null

  const supabase = createServerClient()
  const { data } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  const role: OrgRole = (data?.role as OrgRole) ?? 'vendor_admin'
  return { userId, orgId, role }
}

/**
 * Like getCurrentUser but throws if no context exists.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('No user context. Please complete setup at /setup.')
  }
  return user
}
