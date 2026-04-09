/**
 * /auth/callback — Handles email confirmation, magic link sign-in, and OAuth callbacks.
 *
 * Supabase Auth redirects users here after they click a confirmation/magic link.
 * The URL contains a `code` query param that we exchange for a session.
 * Once the session is established, we provision the user's org if it doesn't
 * exist yet (first-time email confirmation creates the org from user_metadata).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { provisionUserOrg } from '@/app/auth/actions'
import { acceptInvite } from '@/lib/db/invites'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const error = searchParams.get('error_description') ?? searchParams.get('error')

  if (error) {
    // Surface auth errors back on the sign-in page
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error)}`,
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  const supabase = await createServerClient()
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data.user) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(exchangeError?.message ?? 'auth_failed')}`,
    )
  }

  const authUser = data.user

  // Provision org/users/membership if this is the first time the user is confirming.
  // For invite-accept flows, the public.users row already exists and provisionUserOrg
  // is a no-op (idempotent).
  const service = createServiceClient()
  const { data: existing } = await service
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!existing) {
    // First-time confirmation — read metadata to determine flow.
    const fullName = (authUser.user_metadata?.full_name as string | undefined)?.trim()
    const email = authUser.email ?? ''
    const inviteToken = (authUser.user_metadata?.invite_token as string | undefined)?.trim()
    const orgName = (authUser.user_metadata?.org_name as string | undefined)?.trim()

    if (!fullName) {
      return NextResponse.redirect(
        `${origin}/sign-in?error=incomplete_signup`,
      )
    }

    if (inviteToken) {
      // Invited user — accept the invite (joins existing org, creates public.users)
      try {
        await acceptInvite({
          token: inviteToken,
          authUserId: authUser.id,
          email,
          fullName,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'invite_accept_failed'
        return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(msg)}`)
      }
    } else if (orgName) {
      // Standalone signup — create a new org
      try {
        await provisionUserOrg({
          authUserId: authUser.id,
          email,
          orgName,
          fullName,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'provisioning_failed'
        return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(msg)}`)
      }
    } else {
      // Neither org_name nor invite_token — shouldn't happen
      return NextResponse.redirect(`${origin}/sign-in?error=incomplete_signup`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
