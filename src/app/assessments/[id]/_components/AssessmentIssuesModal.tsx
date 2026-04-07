'use client'

import { useState, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type {
  VendorAssessment,
  AssessmentItem,
  AssessmentFinding,
  AssessmentFramework,
} from '@/types/assessment'
import type { Issue } from '@/types/issue'
import type { OrgUser } from '@/lib/db/organizations'
import type { FindingIssueLink } from '@/lib/db/issues'
import { createIssueAction } from '@/app/issues/actions'
import { Spinner } from '@/app/_components/Spinner'

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'rgba(225,29,72,0.1)', color: '#e11d48' },
  high:     { bg: 'rgba(239,68,68,0.1)',  color: '#dc2626' },
  medium:   { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  low:      { bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: 'rgba(245,158,11,0.1)', color: '#d97706', label: 'Open' },
  in_progress: { bg: 'rgba(14,165,233,0.1)', color: '#0ea5e9', label: 'In Progress' },
  blocked:       { bg: 'rgba(225,29,72,0.1)',  color: '#e11d48', label: 'Blocked' },
  deferred:    { bg: 'rgba(148,163,184,0.12)', color: '#64748b', label: 'Deferred' },
  resolved:    { bg: 'rgba(5,150,105,0.1)',  color: '#059669', label: 'Resolved' },
  closed:      { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Closed' },
}

interface Props {
  assessment: VendorAssessment
  items: AssessmentItem[]
  findings: AssessmentFinding[]
  frameworks: AssessmentFramework[]
  issues: Issue[]
  orgUsers: OrgUser[]
  findingIssueLinks: FindingIssueLink[]
  onClose: () => void
}

export function AssessmentIssuesModal({
  assessment,
  items,
  findings,
  frameworks,
  issues,
  orgUsers,
  findingIssueLinks,
  onClose,
}: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [state, formAction, isPending] = useActionState(createIssueAction, {})

  useEffect(() => {
    if (state.success) {
      setShowForm(false)
      router.refresh()
    }
  }, [state.success, router])

  // Group items by framework for the control picker
  const frameworkById = new Map(frameworks.map(f => [f.id, f]))

  // Only flagged controls (needs_attention or high_risk)
  const flaggedItems = items.filter(
    i => i.status === 'needs_attention' || i.status === 'high_risk'
  )

  const vendorId = assessment.vendor?.id ?? ''
  const vendorName = assessment.vendor?.name ?? 'Unknown'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(30,21,80,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative"
        style={{ boxShadow: '0 25px 50px rgba(109,93,211,0.25)' }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white rounded-t-2xl"
          style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#1e1550' }}>
              Issues & Remediation
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
              Create and track issues from this assessment
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
              >
                + Create Issue
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: '#a99fd8' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Create issue form */}
          {showForm && (
            <CreateIssueForm
              vendorId={vendorId}
              vendorName={vendorName}
              assessmentId={assessment.id}
              flaggedItems={flaggedItems}
              findings={findings}
              frameworks={frameworks}
              frameworkById={frameworkById}
              orgUsers={orgUsers}
              state={state}
              formAction={formAction}
              isPending={isPending}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Success message */}
          {state.success && state.issueId && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)', color: '#059669' }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8.5l3 3 5-6" />
              </svg>
              Issue created.{' '}
              <Link href={`/issues/${state.issueId}`} className="font-semibold underline underline-offset-2">
                View issue →
              </Link>
            </div>
          )}

          {/* Existing issues */}
          <div>
            <h3
              className="text-[11px] font-bold uppercase tracking-widest mb-3"
              style={{ color: '#a99fd8' }}
            >
              Issues from this Assessment ({issues.length})
            </h3>

            {issues.length === 0 ? (
              <div
                className="text-center py-10 rounded-xl"
                style={{ border: '1.5px dashed rgba(109,93,211,0.2)', background: 'rgba(109,93,211,0.02)' }}
              >
                <p className="text-sm font-medium" style={{ color: '#a99fd8' }}>No issues created yet</p>
                <p className="text-xs mt-1" style={{ color: '#c4bae8' }}>
                  Create issues from flagged controls or findings to track remediation.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {issues.map(issue => {
                  const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.medium
                  const sts = STATUS_STYLE[issue.status] ?? STATUS_STYLE.open
                  return (
                    <Link
                      key={issue.id}
                      href={`/issues/${issue.id}`}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:shadow-sm"
                      style={{ border: '1px solid rgba(109,93,211,0.1)', background: 'white' }}
                    >
                      <span
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ background: sev.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
                            {issue.title}
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                            style={{ background: sev.bg, color: sev.color }}
                          >
                            {issue.severity}
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: sts.bg, color: sts.color }}
                          >
                            {sts.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#8b7fd4' }}>
                          {issue.owner_name && <span>→ {issue.owner_name}</span>}
                          {issue.due_date && (
                            <span>Due {new Date(issue.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#c4bae8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Issue Form ───────────────────────────────────────────────────────

function CreateIssueForm({
  vendorId,
  vendorName,
  assessmentId,
  flaggedItems,
  findings,
  frameworks,
  frameworkById,
  orgUsers,
  state,
  formAction,
  isPending,
  onCancel,
}: {
  vendorId: string
  vendorName: string
  assessmentId: string
  flaggedItems: AssessmentItem[]
  findings: AssessmentFinding[]
  frameworks: AssessmentFramework[]
  frameworkById: Map<string, AssessmentFramework>
  orgUsers: OrgUser[]
  state: { message?: string; success?: boolean }
  formAction: (payload: FormData) => void
  isPending: boolean
  onCancel: () => void
}) {
  const [selectedControl, setSelectedControl] = useState('')
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState('medium')

  // When a control is selected, auto-fill title and severity
  const handleControlChange = (controlId: string) => {
    setSelectedControl(controlId)
    const item = flaggedItems.find(i => i.id === controlId)
    if (item) {
      setTitle(item.title)
      setSeverity(item.status === 'high_risk' ? 'high' : 'medium')
    }
  }

  const toggleFinding = (id: string) => {
    setSelectedFindings(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group flagged items by framework
  const itemsByFramework = new Map<string, AssessmentItem[]>()
  for (const item of flaggedItems) {
    const fwId = item.framework_id ?? '__none__'
    if (!itemsByFramework.has(fwId)) itemsByFramework.set(fwId, [])
    itemsByFramework.get(fwId)!.push(item)
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.12)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>New Issue</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-2 py-1 rounded-lg"
          style={{ color: '#a99fd8' }}
        >
          Cancel
        </button>
      </div>

      {state.message && !state.success && (
        <p className="text-xs text-rose-500">{state.message}</p>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="vendor_id" value={vendorId} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <input type="hidden" name="source" value="assessment" />
      <input type="hidden" name="type" value={selectedFindings.size > 1 ? 'grouped' : 'control_level'} />
      {[...selectedFindings].map(fid => (
        <input key={fid} type="hidden" name="finding_ids" value={fid} />
      ))}
      {selectedControl && (
        <>
          <input type="hidden" name="control_ids" value={selectedControl} />
          {(() => {
            const item = flaggedItems.find(i => i.id === selectedControl)
            return item?.framework_item_id ? (
              <input type="hidden" name="framework_item_ids" value={item.framework_item_id} />
            ) : null
          })()}
        </>
      )}

      {/* Control picker */}
      {flaggedItems.length > 0 && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>
            Flagged Control
          </label>
          <select
            value={selectedControl}
            onChange={e => handleControlChange(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          >
            <option value="">Select a control (optional)…</option>
            {[...itemsByFramework.entries()].map(([fwId, fwItems]) => {
              const fw = frameworkById.get(fwId)
              return (
                <optgroup key={fwId} label={fw?.name ?? 'Other'}>
                  {fwItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.status === 'high_risk' ? '🔴' : '🟡'} {item.title}
                      {item.category ? ` (${item.category})` : ''}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>
      )}

      {/* Finding picker — checkbox multi-select */}
      {findings.length > 0 && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b5fa8' }}>
            Link Findings ({selectedFindings.size} selected)
          </label>
          <div
            className="max-h-32 overflow-y-auto rounded-lg p-2 space-y-1"
            style={{ border: '1px solid rgba(109,93,211,0.15)', background: 'white' }}
          >
            {findings.map(f => (
              <label
                key={f.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedFindings.has(f.id)}
                  onChange={() => toggleFinding(f.id)}
                  className="shrink-0 accent-[#6c5dd3]"
                />
                <span className="flex-1 truncate" style={{ color: '#1e1550' }}>{f.title}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                  style={{
                    color: f.severity === 'high' ? '#e11d48' : f.severity === 'medium' ? '#d97706' : '#64748b',
                    background: f.severity === 'high' ? 'rgba(225,29,72,0.1)' : f.severity === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                  }}
                >
                  {f.severity}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Title *</label>
        <input
          name="title"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Missing SOC 2 report, Weak access controls…"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Description</label>
        <textarea
          name="description"
          rows={2}
          placeholder="Describe the issue and expected resolution…"
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
            value={severity}
            onChange={e => setSeverity(e.target.value)}
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

      {/* Vendor chip (read-only context) */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#8b7fd4' }}>
        <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.06)' }}>
          {vendorName}
        </span>
        <span>•</span>
        <span>from assessment</span>
      </div>

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
