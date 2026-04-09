'use client'

import { useActionState } from 'react'
import { resetPasswordAction } from '@/app/auth/actions'
import { Spinner } from '@/app/_components/Spinner'
import type { FormState } from '@/types/common'

const INITIAL: FormState = {}

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2.5 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'
const fieldErrorCls = 'mt-1 text-xs text-rose-600'

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, INITIAL)
  const err = state.errors ?? {}

  return (
    <form action={formAction} className="space-y-4">
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
        <label className={labelCls}>
          New Password <span className="text-rose-500">*</span>
        </label>
        <input name="password" type="password" autoFocus placeholder="At least 8 characters" className={inputCls} />
        {err.password && <p className={fieldErrorCls}>{err.password[0]}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
      >
        {isPending && <Spinner />}
        {isPending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
