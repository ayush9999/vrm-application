'use client'

import { useState, useMemo } from 'react'
import type { ActivityLogEntry } from '@/types/activity'

// ─── Action → human-readable label + color + category ─────────────────────────

type Category = 'evidence' | 'reviews' | 'remediation' | 'approvals' | 'incidents' | 'admin'

interface ActionMeta {
  label: string
  color: string
  bg: string
  category: Category
}

const ACTIONS: Record<string, ActionMeta> = {
  // Approvals
  approval_status_changed:    { label: 'Approval status changed', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  category: 'approvals' },
  // Evidence
  evidence_uploaded:          { label: 'Evidence uploaded',       color: '#0284c7', bg: 'rgba(14,165,233,0.1)',  category: 'evidence' },
  evidence_approved:          { label: 'Evidence approved',       color: '#059669', bg: 'rgba(5,150,105,0.1)',   category: 'evidence' },
  evidence_rejected:          { label: 'Evidence rejected',       color: '#e11d48', bg: 'rgba(225,29,72,0.1)',   category: 'evidence' },
  evidence_under_review:      { label: 'Evidence under review',   color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  category: 'evidence' },
  evidence_waived:            { label: 'Evidence waived',         color: '#64748b', bg: 'rgba(148,163,184,0.15)', category: 'evidence' },
  evidence_requested:         { label: 'Evidence requested',      color: '#d97706', bg: 'rgba(245,158,11,0.1)',  category: 'evidence' },
  // Remediation
  issue_created:              { label: 'Remediation created',     color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   category: 'remediation' },
  issue_resolved:             { label: 'Remediation resolved',    color: '#059669', bg: 'rgba(5,150,105,0.1)',   category: 'remediation' },
  issue_closed:               { label: 'Remediation closed',      color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', category: 'remediation' },
  issue_auto_resolved:        { label: 'Remediation auto-resolved', color: '#059669', bg: 'rgba(5,150,105,0.1)', category: 'remediation' },
  // Incidents
  incident_created:           { label: 'Incident created',        color: '#e11d48', bg: 'rgba(225,29,72,0.1)',   category: 'incidents' },
  incident_resolved:          { label: 'Incident resolved',       color: '#059669', bg: 'rgba(5,150,105,0.1)',   category: 'incidents' },
  // Admin
  created:                    { label: 'Created',                 color: '#059669', bg: 'rgba(5,150,105,0.1)',   category: 'admin' },
  updated:                    { label: 'Updated',                 color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  category: 'admin' },
  deleted:                    { label: 'Deleted',                 color: '#e11d48', bg: 'rgba(225,29,72,0.1)',   category: 'admin' },
  status_changed:             { label: 'Status changed',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  category: 'admin' },
}

const FILTERS: { value: Category | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'evidence',    label: 'Evidence' },
  { value: 'reviews',     label: 'Reviews' },
  { value: 'remediation', label: 'Remediation' },
  { value: 'approvals',   label: 'Approvals' },
  { value: 'incidents',   label: 'Incidents' },
  { value: 'admin',       label: 'Admin' },
]

interface ActivityTabProps {
  activityLog: ActivityLogEntry[]
}

export function ActivityTab({ activityLog }: ActivityTabProps) {
  const [filter, setFilter] = useState<Category | 'all'>('all')

  const visible = useMemo(() => {
    if (filter === 'all') return activityLog
    return activityLog.filter((e) => (ACTIONS[e.action]?.category ?? 'admin') === filter)
  }, [activityLog, filter])

  if (activityLog.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}>
        <p className="text-sm" style={{ color: '#a99fd8' }}>No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={
              filter === f.value
                ? { background: '#6c5dd3', color: 'white' }
                : { background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {visible.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: '#a99fd8' }}>No activity in this category.</p>
      ) : (
        <div className="flow-root">
          <ul className="-mb-6">
            {visible.map((entry, i) => {
              const meta = ACTIONS[entry.action] ?? { label: humanize(entry.action), color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', category: 'admin' as Category }
              const isLast = i === visible.length - 1
              return (
                <li key={entry.id}>
                  <div className="relative pb-6">
                    {!isLast && (
                      <span
                        className="absolute left-4 top-8 -ml-px h-full w-px"
                        style={{ background: 'rgba(108,93,211,0.18)' }}
                        aria-hidden
                      />
                    )}
                    <div className="relative flex items-start gap-3">
                      {/* Actor avatar */}
                      <ActorAvatar name={entry.actor_name ?? null} />

                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs font-medium" style={{ color: '#1e1550' }}>
                            {entry.title ?? `${humanize(entry.entity_type)} ${humanize(entry.action)}`}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{entry.description}</p>
                        )}
                        <p className="text-[11px] mt-1" style={{ color: '#a99fd8' }}>
                          {entry.actor_name && <span>by {entry.actor_name} · </span>}
                          {new Date(entry.created_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function ActorAvatar({ name }: { name: string | null }) {
  const initials = name
    ? name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0 ring-4 ring-white"
      style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
      title={name ?? 'Unknown'}
    >
      {initials}
    </span>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
