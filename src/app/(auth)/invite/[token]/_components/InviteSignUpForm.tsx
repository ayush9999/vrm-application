'use client'

import { useActionState } from 'react'
import { signUpWithInviteAction } from '@/app/auth/actions'
import { Spinner } from '@/app/_components/Spinner'
import type { FormState } from '@/types/common'

const INITIAL: FormState = {}

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2.5 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const lockedInputCls = inputCls + ' bg-[rgba(109,93,211,0.04)] cursor-not-allowed'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'
const fieldErrorCls = 'mt-1 text-xs text-rose-600'

export function InviteSignUpForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState(signUpWithInviteAction, INITIAL)
  const err = state.errors ?? {}

  if (state.success && state.message) {
    return (
      <div
        className="rounded-xl px-4 py-5 text-center"
        style={{
          background: 'rgba(5,150,105,0.06)',
          border: '1px solid rgba(5,150,105,0.2)',
        }}
      >
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(5,150,105,0.12)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <p className="text-sm font-semibold" style={{ color: '#059669' }}>Check your email</p>
        <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{state.message}</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="invite_token" value={token} />
      <input type="hidden" name="email" value={email} />

      {state.message && (
        <div
          className="rounded-lg px-3 py-2.5 text-sm"
          style={{
            background: 'rgba(225,29,72,0.06)',
            border: '1px solid rgba(225,29,72,0.2)',
            color: '#e11d48',
          }}
        >
          {state.message}
        </div>
      )}

      <div>
        <label className={labelCls}>Email</label>
        <input
          type="email"
          value={email}
          readOnly
          disabled
          className={lockedInputCls}
        />
        <p className="text-[10px] mt-1" style={{ color: '#a99fd8' }}>
          Email is locked to match the invite
        </p>
      </div>

      <div>
        <label className={labelCls}>
          Your Name <span className="text-rose-500">*</span>
        </label>
        <input name="full_name" type="text" autoFocus placeholder="Jane Smith" className={inputCls} />
        {err.full_name && <p className={fieldErrorCls}>{err.full_name[0]}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Password <span className="text-rose-500">*</span>
        </label>
        <input name="password" type="password" placeholder="At least 8 characters" className={inputCls} />
        {err.password && <p className={fieldErrorCls}>{err.password[0]}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
      >
        {isPending && <Spinner />}
        {isPending ? 'Creating account…' : 'Create account & join'}
      </button>
    </form>
  )
}
