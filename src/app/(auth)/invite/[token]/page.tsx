import Link from 'next/link'
import { getInviteWithOrgByToken } from '@/lib/db/invites'
import { createServerClient } from '@/lib/supabase/server'
import { InviteSignUpForm } from './_components/InviteSignUpForm'
import { AcceptInviteButton } from './_components/AcceptInviteButton'
import { signOutAction } from '@/app/auth/actions'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  const result = await getInviteWithOrgByToken(token)

  // Invalid / expired / revoked / accepted
  if (!result) {
    return (
      <>
        <div className="text-center mb-5">
          <div
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(225,29,72,0.1)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
            Invite not valid
          </h2>
          <p className="text-sm mt-2" style={{ color: '#a99fd8' }}>
            This invite link has expired, been revoked, or already been accepted.
          </p>
        </div>

        <Link
          href="/sign-in"
          className="block w-full text-center rounded-full px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          Go to sign in
        </Link>
      </>
    )
  }

  const { invite, orgName } = result

  // Check current session
  const supabase = await createServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // Case 1: Already signed in with a matching email — show "Accept" button
  if (authUser && authUser.email?.toLowerCase() === invite.email.toLowerCase()) {
    return (
      <>
        <div className="text-center mb-5">
          <div
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(108,93,211,0.12)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6c5dd3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
            Join {orgName}
          </h2>
          <p className="text-sm mt-2" style={{ color: '#4a4270' }}>
            You&apos;ve been invited as <span className="font-semibold">{invite.role.replace('_', ' ')}</span>
          </p>
        </div>

        <AcceptInviteButton token={token} />
      </>
    )
  }

  // Case 2: Signed in with a DIFFERENT email — must sign out first
  if (authUser && authUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <>
        <div className="text-center mb-5">
          <div
            className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(245,158,11,0.12)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
            Wrong account
          </h2>
          <p className="text-sm mt-2" style={{ color: '#4a4270' }}>
            This invite is for <span className="font-mono font-semibold">{invite.email}</span>
            <br />but you&apos;re signed in as <span className="font-mono">{authUser.email}</span>.
          </p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Sign out and accept invite
          </button>
        </form>
      </>
    )
  }

  // Case 3: Not signed in — show signup form pre-filled with invite email
  return (
    <>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
          Join {orgName}
        </h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          You&apos;ve been invited. Create your account to join.
        </p>
      </div>

      <InviteSignUpForm token={token} email={invite.email} />

      <p className="mt-6 text-center text-sm" style={{ color: '#4a4270' }}>
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold hover:underline" style={{ color: '#6c5dd3' }}>
          Sign in instead
        </Link>
      </p>
    </>
  )
}
