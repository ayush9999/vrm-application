'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createIssueAction } from '../../actions'
import { Spinner } from '@/app/_components/Spinner'
import type { Vendor } from '@/types/vendor'
import type { OrgUser } from '@/lib/db/organizations'

interface Prefill {
  vendor_id?: string
  title?: string
  severity?: string
  source?: string
  description?: string
  type?: string
}

export function NewIssueForm({
  vendors,
  orgUsers,
  prefill = {},
}: {
  vendors: Vendor[]
  orgUsers: OrgUser[]
  prefill?: Prefill
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createIssueAction, {})

  useEffect(() => {
    if (state.success && state.issueId) {
      router.push(`/issues/${state.issueId}`)
    }
  }, [state.success, state.issueId, router])

  return (
    <form action={formAction} className="space-y-4">
      {state.message && (
        <p className={`text-xs ${state.success ? 'text-emerald-600' : 'text-rose-500'}`}>
          {state.message}
        </p>
      )}

      {/* Vendor */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Vendor *</label>
        <select
          name="vendor_id"
          required
          defaultValue={prefill.vendor_id ?? ''}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        >
          <option value="">Select vendor…</option>
          {vendors.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Title *</label>
        <input
          name="title"
          required
          defaultValue={prefill.title ?? ''}
          placeholder="e.g. Missing SOC 2 report, Expired certificate…"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={prefill.description ?? ''}
          placeholder="Describe the issue, context, and expected resolution…"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        />
      </div>

      {/* Severity + Due Date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Severity</label>
          <select
            name="severity"
            defaultValue={prefill.severity ?? 'medium'}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Due Date</label>
          <input
            name="due_date"
            type="date"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          />
        </div>
      </div>

      {/* Owner */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Owner</label>
        <select
          name="owner_user_id"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        >
          <option value="">Unassigned</option>
          {orgUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id}</option>
          ))}
        </select>
      </div>

      {/* Remediation Plan */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Remediation Plan</label>
        <textarea
          name="remediation_plan"
          rows={2}
          placeholder="How should this be resolved?"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        />
      </div>

      <input type="hidden" name="source" value={prefill.source ?? 'manual'} />
      <input type="hidden" name="type" value={prefill.type ?? 'general'} />

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
      >
        {isPending && <Spinner />}
        {isPending ? 'Creating…' : 'Create Issue'}
      </button>
    </form>
  )
}
