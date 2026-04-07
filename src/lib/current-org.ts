/**
 * current-org.ts — Dev-mode org context resolver.
 *
 * Reads the `org_id` cookie set during /setup/organization.
 * TODO: Replace cookie reads with JWT/session claims once auth is implemented.
 */

import { cookies } from 'next/headers'

export async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('org_id')?.value ?? null
}

/**
 * Like getCurrentOrgId but throws if missing.
 * Use in server components and actions that require an org context.
 */
export async function requireOrgId(): Promise<string> {
  const orgId = await getCurrentOrgId()
  if (!orgId) {
    throw new Error('No organisation context. Please complete setup at /setup.')
  }
  return orgId
}
