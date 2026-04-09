'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { signInAction, magicLinkAction } from '@/app/auth/actions'
import { Spinner } from '@/app/_components/Spinner'
import type { FormState } from '@/types/common'

const INITIAL: FormState = {}

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2.5 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'
const fieldErrorCls = 'mt-1 text-xs text-rose-600'

type Mode = 'password' | 'magic'

export function SignInForm() {
  const [mode, setMode] = useState<Mode>('password')
  const [pwState, pwAction, pwPending] = useActionState(signInAction, INITIAL)
  const [mlState, mlAction, mlPending] = useActionState(magicLinkAction, INITIAL)

  const state = mode === 'password' ? pwState : mlState
  const err = state.errors ?? {}

  // Magic link sent → success state
  if (mode === 'magic' && mlState.success && mlState.message) {
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
        <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{mlState.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div
        className="flex rounded-full p-1"
        style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <button
          type="button"
          onClick={() => setMode('password')}
          className="flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={
            mode === 'password'
              ? { background: 'white', color: '#6c5dd3', boxShadow: '0 1px 3px rgba(109,93,211,0.15)' }
              : { color: '#a99fd8' }
          }
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode('magic')}
          className="flex-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={
            mode === 'magic'
              ? { background: 'white', color: '#6c5dd3', boxShadow: '0 1px 3px rgba(109,93,211,0.15)' }
              : { color: '#a99fd8' }
          }
        >
          Magic Link
        </button>
      </div>

      {state.message && !state.success && (
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

      {mode === 'password' ? (
        <form action={pwAction} className="space-y-4">
          <div>
            <label className={labelCls}>
              Email <span className="text-rose-500">*</span>
            </label>
            <input name="email" type="email" autoFocus placeholder="jane@acme.com" className={inputCls} />
            {err.email && <p className={fieldErrorCls}>{err.email[0]}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls + ' mb-0'}>
                Password <span className="text-rose-500">*</span>
              </label>
              <Link href="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: '#6c5dd3' }}>
                Forgot?
              </Link>
            </div>
            <input name="password" type="password" placeholder="Your password" className={inputCls} />
            {err.password && <p className={fieldErrorCls}>{err.password[0]}</p>}
          </div>

          <button
            type="submit"
            disabled={pwPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90 mt-2"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {pwPending && <Spinner />}
            {pwPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form action={mlAction} className="space-y-4">
          <div>
            <label className={labelCls}>
              Email <span className="text-rose-500">*</span>
            </label>
            <input name="email" type="email" autoFocus placeholder="jane@acme.com" className={inputCls} />
            {err.email && <p className={fieldErrorCls}>{err.email[0]}</p>}
          </div>

          <button
            type="submit"
            disabled={mlPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90 mt-2"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {mlPending && <Spinner />}
            {mlPending ? 'Sending link…' : 'Send magic link'}
          </button>

          <p className="text-xs text-center mt-2" style={{ color: '#a99fd8' }}>
            We&apos;ll email you a one-tap sign-in link.
          </p>
        </form>
      )}
    </div>
  )
}
