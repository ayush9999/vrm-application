/**
 * service.ts — Service-role Supabase client (BYPASSES Row Level Security).
 *
 * ⚠️  USE SPARINGLY. This client has admin access to the entire database
 *    and ignores all RLS policies. Only call it from places where you
 *    genuinely need to act before a user session exists or across orgs:
 *
 *      - Signup flow (creates auth.user → public.users → org → membership)
 *      - Invite acceptance (validates token, adds user to a different org)
 *      - One-off seed/migration scripts
 *      - Webhook handlers from external systems
 *
 * Never import this from a normal page.tsx, route handler, or db helper.
 * For ordinary queries, use createServerClient() from ./server.ts which
 * is cookie-aware and respects RLS.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.',
  )
}

export function createServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
