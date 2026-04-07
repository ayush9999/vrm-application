'use client'

import { useState, useRef, useActionState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Issue, IssueEvidence, IssueFormState, IssueStatus } from '@/types/issue'
import type { OrgUser } from '@/lib/db/organizations'
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

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const REVIEW_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.1)', color: '#d97706', label: 'Pending Review' },
  accepted: { bg: 'rgba(5,150,105,0.1)',  color: '#059669', label: 'Accepted' },
  rejected: { bg: 'rgba(225,29,72,0.1)',  color: '#e11d48', label: 'Rejected' },
}

export function IssueDetailClient({
  issue,
  orgUsers,
  docTypes,
  updateAction,
  noteAction,
  uploadEvidenceAction,
  reviewEvidenceAction,
  deleteEvidenceAction,
  changeStatusAction,
  promoteEvidenceAction,
}: {
  issue: Issue
  orgUsers: OrgUser[]
  docTypes: { id: string; name: string }[]
  updateAction: (prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  noteAction: (prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  uploadEvidenceAction: (prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  reviewEvidenceAction: (evidenceId: string, prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  deleteEvidenceAction: (evidenceId: string, issueId: string) => Promise<void>
  changeStatusAction: (issueId: string, status: IssueStatus) => Promise<void>
  promoteEvidenceAction: (evidenceId: string, issueId: string, vendorId: string, prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [updateState, updateFormAction, updatePending] = useActionState(updateAction, {})
  const [noteState, noteFormAction, notePending] = useActionState(noteAction, {})

  useEffect(() => {
    if (updateState.success) { setEditing(false); router.refresh() }
  }, [updateState.success, router])

  useEffect(() => {
    if (noteState.success) router.refresh()
  }, [noteState.success, router])

  const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.medium
  const sts = STATUS_STYLE[issue.status] ?? STATUS_STYLE.open
  const isClosed = issue.status === 'closed' || issue.status === 'resolved'
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = !isClosed && issue.due_date && issue.due_date < today

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
      >
        {/* Title + badges + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{issue.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background: sev.bg, color: sev.color }}>
                {issue.severity}
              </span>
              <StatusDropdown
                issueId={issue.id}
                currentStatus={issue.status}
                changeStatusAction={changeStatusAction}
              />
              {issue.disposition === 'accepted_risk' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700">
                  Accepted Risk
                </span>
              )}
              {isOverdue && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                  Overdue
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.06)', color: '#8b7fd4' }}>
                {issue.source} · {issue.type.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditing(e => !e)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Vendor</span>
            <p className="font-medium mt-0.5" style={{ color: '#1e1550' }}>
              <Link href={`/vendors/${issue.vendor_id}`} className="hover:underline">{issue.vendor_name ?? 'Unknown'}</Link>
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Owner</span>
            <p className="font-medium mt-0.5" style={{ color: '#1e1550' }}>{issue.owner_name ?? 'Unassigned'}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Due Date</span>
            <p className="font-medium mt-0.5" style={{ color: isOverdue ? '#e11d48' : '#1e1550' }}>
              {issue.due_date ? new Date(issue.due_date).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Created</span>
            <p className="font-medium mt-0.5" style={{ color: '#1e1550' }}>
              {new Date(issue.created_at).toLocaleDateString()}
            </p>
          </div>
          {issue.assessment_id && (
            <div className="col-span-2 sm:col-span-4">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Assessment</span>
              <p className="font-medium mt-0.5 flex items-center gap-2">
                {issue.assessment_code && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                  >
                    {issue.assessment_code}
                  </span>
                )}
                <Link
                  href={`/assessments/${issue.assessment_id}`}
                  className="hover:underline"
                  style={{ color: '#1e1550' }}
                >
                  {issue.assessment_title ?? 'View Assessment'}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        {issue.description && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Description</span>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#4a4270' }}>{issue.description}</p>
          </div>
        )}

        {/* Remediation plan */}
        {issue.remediation_plan && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Remediation Plan</span>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#4a4270' }}>{issue.remediation_plan}</p>
          </div>
        )}

        {/* Accepted risk info */}
        {issue.disposition === 'accepted_risk' && issue.accepted_reason && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(109,93,211,0.04)', border: '1px solid rgba(109,93,211,0.1)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>Accepted Risk Reason</span>
            <p className="text-sm mt-1" style={{ color: '#4a4270' }}>{issue.accepted_reason}</p>
            {issue.accepted_at && (
              <p className="text-[10px] mt-1" style={{ color: '#a99fd8' }}>
                Accepted on {new Date(issue.accepted_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Resolution notes */}
        {issue.resolution_notes && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#059669' }}>Resolution Notes</span>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#4a4270' }}>{issue.resolution_notes}</p>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <form
          action={updateFormAction}
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Update Issue</h2>
          {updateState.message && !updateState.success && (
            <p className="text-xs text-rose-500">{updateState.message}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Status</label>
              <select name="status" defaultValue={issue.status} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Severity</label>
              <select name="severity" defaultValue={issue.severity} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Disposition</label>
              <select name="disposition" defaultValue={issue.disposition} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }}>
                <option value="remediate">Remediate</option>
                <option value="accepted_risk">Accepted Risk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Due Date</label>
              <input name="due_date" type="date" defaultValue={issue.due_date ?? ''} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }} />
            </div>
          </div>

          {/* Owner picker */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Owner</label>
            <select name="owner_user_id" defaultValue={issue.owner_user_id ?? ''} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }}>
              <option value="">Unassigned</option>
              {orgUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email ?? u.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Remediation Plan</label>
            <textarea name="remediation_plan" rows={2} defaultValue={issue.remediation_plan ?? ''} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Resolution Notes</label>
            <textarea name="resolution_notes" rows={2} defaultValue={issue.resolution_notes ?? ''} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Accepted Risk Reason</label>
            <textarea name="accepted_reason" rows={2} defaultValue={issue.accepted_reason ?? ''} placeholder="Only needed if disposition is Accepted Risk" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" style={{ border: '1px solid rgba(109,93,211,0.2)' }} />
          </div>

          <button
            type="submit"
            disabled={updatePending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
          >
            {updatePending && <Spinner />}
            {updatePending ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      )}

      {/* Evidence section */}
      <EvidenceSection
        issue={issue}
        docTypes={docTypes}
        uploadAction={uploadEvidenceAction}
        reviewAction={reviewEvidenceAction}
        deleteAction={deleteEvidenceAction}
        promoteAction={promoteEvidenceAction}
      />

      {/* Linked Controls */}
      {issue.controls && issue.controls.length > 0 && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Linked Controls</h2>
          <div className="space-y-1.5">
            {issue.controls.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.08)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{
                  background: c.control_status === 'satisfactory' ? '#059669' : c.control_status === 'high_risk' ? '#e11d48' : '#a99fd8'
                }} />
                <span className="text-xs font-medium" style={{ color: '#1e1550' }}>{c.control_title ?? 'Unknown control'}</span>
                {c.framework_name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ color: '#6c5dd3', background: 'rgba(109,93,211,0.08)' }}>
                    {c.framework_name}
                  </span>
                )}
                {c.control_status && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto" style={{ color: '#8b7fd4', background: 'rgba(109,93,211,0.06)' }}>
                    {c.control_status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Findings */}
      {issue.findings && issue.findings.length > 0 && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Linked Findings</h2>
          <div className="space-y-1.5">
            {issue.findings.map(f => {
              const fsev = SEVERITY_STYLE[f.finding_severity ?? 'medium'] ?? SEVERITY_STYLE.medium
              return (
                <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.08)' }}>
                  <span className="text-xs font-medium" style={{ color: '#1e1550' }}>{f.finding_title ?? 'Finding'}</span>
                  {f.finding_severity && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ml-auto" style={{ background: fsev.bg, color: fsev.color }}>
                      {f.finding_severity}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Activity + Add Note */}
      <div
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
      >
        <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Activity</h2>

        {/* Add note form */}
        <form action={noteFormAction} className="flex gap-2">
          <input
            name="note"
            placeholder="Add a note…"
            required
            className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none"
            style={{ border: '1px solid rgba(109,93,211,0.2)' }}
          />
          <button
            type="submit"
            disabled={notePending}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: '#6c5dd3' }}
          >
            {notePending ? <Spinner /> : 'Add'}
          </button>
        </form>
        {noteState.message && !noteState.success && (
          <p className="text-xs text-rose-500">{noteState.message}</p>
        )}

        {/* Activity timeline */}
        {issue.activity && issue.activity.length > 0 ? (
          <div className="space-y-2">
            {issue.activity.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-300 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: '#1e1550' }}>{a.user_name ?? 'System'}</span>
                    <span style={{ color: '#a99fd8' }}>{a.action.replace(/_/g, ' ')}</span>
                    {a.old_value && a.new_value && (
                      <span style={{ color: '#8b7fd4' }}>{a.old_value} → {a.new_value}</span>
                    )}
                    <span className="ml-auto text-[10px]" style={{ color: '#c4bae8' }}>
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  {a.note && <p className="mt-0.5" style={{ color: '#4a4270' }}>{a.note}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#c4bae8' }}>No activity yet.</p>
        )}
      </div>
    </div>
  )
}

// ─── Status dropdown (Jira-style) ───────────────────────────────────────────

function StatusDropdown({
  issueId,
  currentStatus,
  changeStatusAction,
}: {
  issueId: string
  currentStatus: IssueStatus
  changeStatusAction: (issueId: string, status: IssueStatus) => Promise<void>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const sts = STATUS_STYLE[currentStatus] ?? STATUS_STYLE.open

  const handleSelect = (status: IssueStatus) => {
    if (status === currentStatus) { setOpen(false); return }
    setOpen(false)
    startTransition(async () => {
      await changeStatusAction(issueId, status)
      router.refresh()
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 disabled:opacity-60"
        style={{ background: sts.bg, color: sts.color, ['--tw-ring-color' as string]: sts.color }}
      >
        {isPending ? <Spinner /> : null}
        {sts.label}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] rounded-xl py-1 shadow-lg"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.12)' }}
        >
          {STATUS_OPTIONS.map(opt => {
            const optSts = STATUS_STYLE[opt.value] ?? STATUS_STYLE.open
            const isActive = opt.value === currentStatus
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-[rgba(109,93,211,0.04)]"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: optSts.color }}
                />
                <span className="font-medium" style={{ color: isActive ? optSts.color : '#1e1550' }}>
                  {opt.label}
                </span>
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={optSts.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                    <path d="M3 8.5l3.5 3.5 6.5-8" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Evidence section ───────────────────────────────────────────────────────

function EvidenceSection({
  issue,
  docTypes,
  uploadAction,
  reviewAction,
  deleteAction,
  promoteAction,
}: {
  issue: Issue
  docTypes: { id: string; name: string }[]
  uploadAction: (prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  reviewAction: (evidenceId: string, prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  deleteAction: (evidenceId: string, issueId: string) => Promise<void>
  promoteAction: (evidenceId: string, issueId: string, vendorId: string, prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
}) {
  const router = useRouter()
  const [showUpload, setShowUpload] = useState(false)
  const [saveAsDoc, setSaveAsDoc] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [uploadState, uploadFormAction, uploadPending] = useActionState(uploadAction, {})

  useEffect(() => {
    if (uploadState.success) { setShowUpload(false); setSelectedFileName(''); setSaveAsDoc(false); router.refresh() }
  }, [uploadState.success, router])

  const evidence = issue.evidence ?? []
  const pendingCount = evidence.filter(e => e.review_status === 'pending').length
  const acceptedCount = evidence.filter(e => e.review_status === 'accepted').length
  const rejectedCount = evidence.filter(e => e.review_status === 'rejected').length

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
            Remediation Evidence
          </h2>
          {evidence.length > 0 && (
            <div className="flex items-center gap-1.5">
              {acceptedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
                  {acceptedCount} accepted
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                  {pendingCount} pending
                </span>
              )}
              {rejectedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                  {rejectedCount} rejected
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowUpload(s => !s)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
        >
          {showUpload ? 'Cancel' : '+ Upload Evidence'}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <form action={uploadFormAction} className="space-y-3 p-3 rounded-xl" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.08)' }}>
          {uploadState.message && !uploadState.success && (
            <p className="text-xs text-rose-500">{uploadState.message}</p>
          )}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Upload File</label>
            <label
              className="flex items-center gap-3 w-full cursor-pointer rounded-lg px-3 py-3 transition-colors hover:bg-[rgba(109,93,211,0.04)]"
              style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#8b7fd4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 11V3M5 6l3-3 3 3" /><path d="M2 13h12" />
              </svg>
              <div className="flex-1 min-w-0">
                {selectedFileName ? (
                  <p className="text-xs font-medium truncate" style={{ color: '#1e1550' }}>{selectedFileName}</p>
                ) : (
                  <p className="text-xs" style={{ color: '#6b5fa8' }}>Click to choose a file (PDF, DOC, PNG, JPG, XLSX…)</p>
                )}
              </div>
              {selectedFileName && (
                <span className="text-[10px] font-semibold shrink-0" style={{ color: '#059669' }}>Ready</span>
              )}
              <input
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.txt"
                className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setSelectedFileName(f.name)
                }}
              />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Evidence Name</label>
            <input
              name="file_name"
              placeholder="Auto-filled from file name, or type manually"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>File URL</label>
            <input
              name="file_url"
              placeholder="Or paste a link instead (optional)"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Notes</label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Describe what this evidence proves…"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
          </div>

          {/* Save as vendor document option */}
          <input type="hidden" name="vendor_id" value={issue.vendor_id} />
          {saveAsDoc && <input type="hidden" name="save_as_vendor_doc" value="1" />}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsDoc}
                onChange={e => setSaveAsDoc(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-medium" style={{ color: '#6b5fa8' }}>
                Also save as vendor document
              </span>
            </label>
            {saveAsDoc && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6b5fa8' }}>Document Type *</label>
                <select
                  name="doc_type_id"
                  required
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                >
                  <option value="">Select document type…</option>
                  {docTypes.map(dt => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={uploadPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
          >
            {uploadPending && <Spinner />}
            {uploadPending ? 'Uploading…' : 'Upload Evidence'}
          </button>
        </form>
      )}

      {/* Evidence list */}
      {evidence.length === 0 && !showUpload ? (
        <div className="text-center py-6 rounded-xl" style={{ border: '1.5px dashed rgba(109,93,211,0.15)', background: 'rgba(109,93,211,0.02)' }}>
          <p className="text-xs font-medium" style={{ color: '#a99fd8' }}>No evidence uploaded yet</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#c4bae8' }}>
            Attach remediation proof to support resolution of this issue.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {evidence.map(ev => (
            <EvidenceCard
              key={ev.id}
              evidence={ev}
              issueId={issue.id}
              vendorId={issue.vendor_id}
              docTypes={docTypes}
              reviewAction={reviewAction}
              deleteAction={deleteAction}
              promoteAction={promoteAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single evidence card ───────────────────────────────────────────────────

function EvidenceCard({
  evidence,
  issueId,
  vendorId,
  docTypes,
  reviewAction,
  deleteAction,
  promoteAction,
}: {
  evidence: IssueEvidence
  issueId: string
  vendorId: string
  docTypes: { id: string; name: string }[]
  reviewAction: (evidenceId: string, prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
  deleteAction: (evidenceId: string, issueId: string) => Promise<void>
  promoteAction: (evidenceId: string, issueId: string, vendorId: string, prev: IssueFormState, formData: FormData) => Promise<IssueFormState>
}) {
  const router = useRouter()
  const [showReview, setShowReview] = useState(false)
  const [showPromote, setShowPromote] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const boundReview = reviewAction.bind(null, evidence.id)
  const boundPromote = promoteAction.bind(null, evidence.id, issueId, vendorId)
  const [reviewState, reviewFormAction, reviewPending] = useActionState(boundReview, {})
  const [promoteState, promoteFormAction, promotePending] = useActionState(boundPromote, {})

  useEffect(() => {
    if (reviewState.success) { setShowReview(false); router.refresh() }
  }, [reviewState.success, router])

  useEffect(() => {
    if (promoteState.success) { setShowPromote(false); router.refresh() }
  }, [promoteState.success, router])

  const rvs = REVIEW_STATUS_STYLE[evidence.review_status] ?? REVIEW_STATUS_STYLE.pending

  const handleDelete = async () => {
    if (!confirm('Remove this evidence?')) return
    setDeleting(true)
    try {
      await deleteAction(evidence.id, issueId)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${
          evidence.review_status === 'accepted' ? 'rgba(5,150,105,0.2)'
          : evidence.review_status === 'rejected' ? 'rgba(225,29,72,0.2)'
          : 'rgba(109,93,211,0.1)'
        }`,
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Left stripe */}
        <span
          className="w-1 self-stretch rounded-full shrink-0"
          style={{ background: rvs.color }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>
              {evidence.file_name}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
              style={{ background: rvs.bg, color: rvs.color }}
            >
              {rvs.label}
            </span>
            {evidence.vendor_document_id && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
              >
                Vendor Doc
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: '#8b7fd4' }}>
            <span>Uploaded {new Date(evidence.uploaded_at).toLocaleDateString()}</span>
            {evidence.file_url && (
              <a
                href={evidence.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: '#6c5dd3' }}
              >
                View file →
              </a>
            )}
          </div>
          {evidence.notes && (
            <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{evidence.notes}</p>
          )}
          {evidence.review_notes && (
            <p className="text-xs mt-1 italic" style={{ color: evidence.review_status === 'rejected' ? '#e11d48' : '#059669' }}>
              Review: {evidence.review_notes}
            </p>
          )}
          {evidence.reviewed_at && (
            <p className="text-[10px] mt-0.5" style={{ color: '#c4bae8' }}>
              Reviewed {new Date(evidence.reviewed_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {evidence.review_status === 'pending' && (
            <button
              onClick={() => setShowReview(s => !s)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
            >
              Review
            </button>
          )}
          {evidence.review_status === 'accepted' && !evidence.vendor_document_id && (
            <button
              onClick={() => setShowPromote(s => !s)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.15)' }}
            >
              {showPromote ? 'Cancel' : 'Promote'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-[10px] font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            style={{ color: '#e11d48' }}
          >
            {deleting ? '…' : '×'}
          </button>
        </div>
      </div>

      {/* Inline review form */}
      {showReview && (
        <form action={reviewFormAction} className="px-4 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
          <input type="hidden" name="issue_id" value={issueId} />
          {reviewState.message && !reviewState.success && (
            <p className="text-xs text-rose-500 mt-2">{reviewState.message}</p>
          )}
          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a99fd8' }}>Review Notes</label>
            <textarea
              name="review_notes"
              rows={2}
              placeholder="Why are you accepting or rejecting this evidence?"
              className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              name="review_status"
              value="accepted"
              disabled={reviewPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: '#059669' }}
            >
              {reviewPending ? <Spinner /> : '✓'} Accept
            </button>
            <button
              type="submit"
              name="review_status"
              value="rejected"
              disabled={reviewPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: '#e11d48' }}
            >
              {reviewPending ? <Spinner /> : '✗'} Reject
            </button>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="text-xs px-2 py-1.5"
              style={{ color: '#a99fd8' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Inline promote form */}
      {showPromote && (
        <form action={promoteFormAction} className="px-4 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(5,150,105,0.08)' }}>
          {promoteState.message && !promoteState.success && (
            <p className="text-xs text-rose-500 mt-2">{promoteState.message}</p>
          )}
          <div className="pt-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#059669' }}>
              Save as Vendor Document
            </label>
            <select
              name="doc_type_id"
              required
              className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
              style={{ border: '1px solid rgba(5,150,105,0.2)', color: '#1e1550' }}
            >
              <option value="">Select document type…</option>
              {docTypes.map(dt => (
                <option key={dt.id} value={dt.id}>{dt.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={promotePending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: '#059669' }}
            >
              {promotePending ? <Spinner /> : '↗'} Promote to Vendor Docs
            </button>
            <button
              type="button"
              onClick={() => setShowPromote(false)}
              className="text-xs px-2 py-1.5"
              style={{ color: '#a99fd8' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
