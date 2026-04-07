'use client'

import { useActionState, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createIssueAction, checkDuplicateIssuesAction } from '../../actions'
import { Spinner } from '@/app/_components/Spinner'
import type { Vendor } from '@/types/vendor'
import type { OrgUser } from '@/lib/db/organizations'

interface Prefill {
  vendor_id?: string
  title?: string
  severity?: string
  source?: string
  assessment_id?: string
  finding_id?: string
  finding_ids?: string[]
  description?: string
  type?: string
}

interface DuplicateIssue {
  id: string
  title: string
  status: string
  severity: string
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
  const fromAssessment = prefill.source === 'assessment'
  const [duplicates, setDuplicates] = useState<DuplicateIssue[]>([])
  const [checkedDupes, setCheckedDupes] = useState(false)

  useEffect(() => {
    if (state.success && state.issueId) {
      router.push(`/issues/${state.issueId}`)
    }
  }, [state.success, state.issueId, router])

  // Check for duplicates when we have vendor + finding context
  useEffect(() => {
    if (prefill.vendor_id && prefill.finding_id && !checkedDupes) {
      setCheckedDupes(true)
      checkDuplicateIssuesAction(prefill.vendor_id, prefill.finding_id)
        .then(setDuplicates)
        .catch(() => {}) // silently fail
    }
  }, [prefill.vendor_id, prefill.finding_id, checkedDupes])

  return (
    <form action={formAction} className="space-y-4">
      {state.message && (
        <p className={`text-xs ${state.success ? 'text-emerald-600' : 'text-rose-500'}`}>
          {state.message}
        </p>
      )}

      {fromAssessment && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'rgba(225,29,72,0.05)', color: '#be123c', border: '1px solid rgba(225,29,72,0.15)' }}
        >
          {(prefill.finding_ids?.length ?? 0) > 1
            ? `Creating grouped issue from ${prefill.finding_ids!.length} assessment findings`
            : 'Creating issue from assessment finding'
          }
        </div>
      )}

      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="7" />
              <path d="M8 4.5V8.5" />
              <circle cx="8" cy="11" r="0.5" fill="#d97706" />
            </svg>
            <span className="text-xs font-bold" style={{ color: '#92400e' }}>
              Possible duplicate — {duplicates.length} existing issue{duplicates.length > 1 ? 's' : ''} found
            </span>
          </div>
          <div className="space-y-1">
            {duplicates.map(d => (
              <div key={d.id} className="flex items-center gap-2 text-xs">
                <Link
                  href={`/issues/${d.id}`}
                  className="font-medium hover:underline"
                  style={{ color: '#6c5dd3' }}
                >
                  {d.title}
                </Link>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                  {d.status}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ color: '#8b7fd4' }}>
                  {d.severity}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: '#92400e' }}>
            You can still create a new issue if this is a different problem.
          </p>
        </div>
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
      <input type="hidden" name="type" value={prefill.type ?? (fromAssessment ? 'assessment_finding' : 'general')} />
      {prefill.assessment_id && <input type="hidden" name="assessment_id" value={prefill.assessment_id} />}
      {prefill.finding_id && <input type="hidden" name="finding_id" value={prefill.finding_id} />}
      {prefill.finding_ids?.map(fid => (
        <input key={fid} type="hidden" name="finding_ids" value={fid} />
      ))}

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
