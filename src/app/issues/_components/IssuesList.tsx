'use client'

import { useState } from 'react'
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

interface AssessmentGroup {
  title: string
  code: string | null
  vendorName: string
  assessmentId: string
  issues: Issue[]
}

export function IssuesList({ issues, today }: { issues: Issue[]; today: string }) {
  const assessmentGroups = new Map<string, AssessmentGroup>()
  const standaloneIssues: Issue[] = []

  for (const issue of issues) {
    if (issue.assessment_id && issue.source === 'assessment') {
      const key = issue.assessment_id
      if (!assessmentGroups.has(key)) {
        assessmentGroups.set(key, {
          title: issue.assessment_title ?? 'Assessment',
          code: issue.assessment_code ?? null,
          vendorName: issue.vendor_name ?? 'Unknown',
          assessmentId: issue.assessment_id,
          issues: [],
        })
      }
      assessmentGroups.get(key)!.issues.push(issue)
    } else {
      standaloneIssues.push(issue)
    }
  }

  const groupList = [...assessmentGroups.values()]
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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

      {/* Assessment groups — collapsed by default */}
      {groupList.map((group) => {
        const isOpen = expanded.has(group.assessmentId)
        const openCount = group.issues.filter(i => i.status === 'open' || i.status === 'in_progress' || i.status === 'blocked').length
        const highestSev = group.issues.reduce((worst, i) => {
          const order = ['critical', 'high', 'medium', 'low']
          return order.indexOf(i.severity) < order.indexOf(worst) ? i.severity : worst
        }, 'low' as string)
        const sevStyle = SEVERITY_STYLE[highestSev] ?? SEVERITY_STYLE.medium

        return (
          <div key={group.assessmentId}>
            {/* Group row — clickable to expand */}
            <div
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-[rgba(109,93,211,0.02)]"
              style={{ borderBottom: '1px solid rgba(109,93,211,0.05)' }}
              onClick={() => toggle(group.assessmentId)}
            >
              {/* Expand chevron */}
              <svg
                width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 transition-transform"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M4 6l4 4 4-4" />
              </svg>

              {/* Assessment info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {group.code && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0"
                    style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                  >
                    {group.code}
                  </span>
                )}
                <span className="text-[13px] font-semibold truncate" style={{ color: '#1e1550' }}>
                  {group.title}
                </span>
              </div>

              {/* Inline summary */}
              <span
                className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase shrink-0"
                style={{ background: sevStyle.bg, color: sevStyle.color }}
              >
                {highestSev}
              </span>
              <span className="text-[11px] shrink-0 w-[80px]" style={{ color: '#8b7fd4' }}>
                {group.issues.length} issue{group.issues.length !== 1 ? 's' : ''}
                {openCount > 0 && <span style={{ color: '#d97706' }}> · {openCount} open</span>}
              </span>
              <span className="text-[11px] shrink-0 w-[80px] truncate" style={{ color: '#8b7fd4' }}>
                {group.vendorName}
              </span>
              <span className="w-[72px] shrink-0" />
              <span className="w-[56px] shrink-0" />
              <span className="w-3 shrink-0" />
            </div>

            {/* Expanded child rows */}
            {isOpen && group.issues.map((issue, idx) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                today={today}
                indent
                last={idx === group.issues.length - 1}
              />
            ))}
          </div>
        )
      })}

      {/* Standalone issues — always visible as flat rows */}
      {standaloneIssues.map((issue, idx) => (
        <IssueRow
          key={issue.id}
          issue={issue}
          today={today}
          last={idx === standaloneIssues.length - 1 && groupList.length === 0}
        />
      ))}
    </div>
  )
}

// ─── Single issue row ─────────────────────────────────────────────────────────

function IssueRow({
  issue,
  today,
  indent = false,
  last = false,
}: {
  issue: Issue
  today: string
  indent?: boolean
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
        paddingLeft: indent ? '2.5rem' : undefined,
        background: indent ? 'rgba(109,93,211,0.015)' : undefined,
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
