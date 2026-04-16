'use client'

import Link from 'next/link'
import type { Issue } from '@/types/issue'

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  critical: { bg: 'rgba(225,29,72,0.1)', color: '#e11d48' },
  high:     { bg: 'rgba(239,68,68,0.1)',  color: '#dc2626' },
  medium:   { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  low:      { bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

const STATUS_STYLE: Record<string, { dot: string; color: string; label: string }> = {
  open:        { dot: '#d97706', color: '#d97706', label: 'Open' },
  in_progress: { dot: '#0ea5e9', color: '#0ea5e9', label: 'In Progress' },
  blocked:     { dot: '#e11d48', color: '#e11d48', label: 'Blocked' },
  deferred:    { dot: '#64748b', color: '#64748b', label: 'Deferred' },
  resolved:    { dot: '#059669', color: '#059669', label: 'Resolved' },
  closed:      { dot: '#94a3b8', color: '#94a3b8', label: 'Closed' },
}

export function IssuesList({ issues, today }: { issues: Issue[]; today: string }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.07)' }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-3 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest"
        style={{ background: 'rgba(109,93,211,0.03)', borderBottom: '1px solid rgba(109,93,211,0.06)', color: '#a99fd8' }}
      >
        <span className="w-5 shrink-0" />
        <span className="flex-1">Issue</span>
        <span className="w-[56px] shrink-0 text-center">Severity</span>
        <span className="w-[80px] shrink-0">Status</span>
        <span className="w-[80px] shrink-0">Vendor</span>
        <span className="w-[72px] shrink-0">Owner</span>
        <span className="w-[56px] shrink-0 text-right">Due</span>
        <span className="w-3 shrink-0" />
      </div>

      {/* Flat list of all issues */}
      {issues.map((issue, idx) => (
        <IssueRow
          key={issue.id}
          issue={issue}
          today={today}
          last={idx === issues.length - 1}
        />
      ))}
    </div>
  )
}

// ─── Single issue row ─────────────────────────────────────────────────────────

function IssueRow({
  issue,
  today,
  last = false,
}: {
  issue: Issue
  today: string
  last?: boolean
}) {
  const sev = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.medium
  const sts = STATUS_STYLE[issue.status] ?? STATUS_STYLE.open
  const isOverdue = (issue.status === 'open' || issue.status === 'in_progress' || issue.status === 'blocked') && issue.due_date && issue.due_date < today
  const dueDateStr = issue.due_date
    ? new Date(issue.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  return (
    <Link
      href={`/issues/${issue.id}`}
      className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-[rgba(109,93,211,0.02)] group"
      style={{
        borderBottom: last ? undefined : '1px solid rgba(109,93,211,0.04)',
      }}
    >
      {/* Severity dot */}
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sev.color }} />

      {/* Title */}
      <span className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: '#1e1550' }}>
        {issue.title}
      </span>

      {/* Severity */}
      <span
        className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase shrink-0 w-[56px] text-center"
        style={{ background: sev.bg, color: sev.color }}
      >
        {issue.severity}
      </span>

      {/* Status */}
      <span className="flex items-center gap-1 shrink-0 w-[80px]">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sts.dot }} />
        <span className="text-[11px] font-medium" style={{ color: sts.color }}>{sts.label}</span>
        {isOverdue && <span className="text-[9px] font-bold" style={{ color: '#e11d48' }}>!</span>}
      </span>

      {/* Vendor */}
      <span className="text-[11px] truncate w-[80px] shrink-0" style={{ color: '#8b7fd4' }}>
        {issue.vendor_name}
      </span>

      {/* Owner */}
      <span className="text-[11px] truncate w-[72px] shrink-0" style={{ color: '#8b7fd4' }}>
        {issue.owner_name ?? '—'}
      </span>

      {/* Due date */}
      <span
        className="text-[11px] w-[56px] shrink-0 text-right"
        style={{ color: isOverdue ? '#e11d48' : '#a99fd8' }}
      >
        {dueDateStr ?? '—'}
      </span>

      {/* Chevron */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#c4bae8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <path d="M6 4l4 4-4 4" />
      </svg>
    </Link>
  )
}
