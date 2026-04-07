'use client'

import { useActionState } from 'react'
import { setupOrgAction } from '@/app/setup/actions'
import type { FormState } from '@/types/common'

const INITIAL: FormState = {}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'
const fieldErrorCls = 'mt-1.5 text-xs text-rose-600'

export function SetupOrgForm() {
  const [state, formAction, isPending] = useActionState(setupOrgAction, INITIAL)
  const err = state.errors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-sm text-rose-700">
          {state.message}
        </div>
      )}

      <div>
        <label className={labelCls}>
          Organisation Name <span className="text-rose-500">*</span>
        </label>
        <input
          name="org_name"
          type="text"
          autoFocus
          placeholder="Acme Corp"
          className={inputCls}
        />
        {err.org_name && <p className={fieldErrorCls}>{err.org_name[0]}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Your Name <span className="text-rose-500">*</span>
        </label>
        <input
          name="admin_name"
          type="text"
          placeholder="Jane Smith"
          className={inputCls}
        />
        {err.admin_name && <p className={fieldErrorCls}>{err.admin_name[0]}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Your Email <span className="text-rose-500">*</span>
        </label>
        <input
          name="admin_email"
          type="email"
          placeholder="jane@acme.com"
          className={inputCls}
        />
        {err.admin_email && <p className={fieldErrorCls}>{err.admin_email[0]}</p>}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
      >
        {isPending ? 'Setting up…' : 'Create Organisation →'}
      </button>
    </form>
  )
}
