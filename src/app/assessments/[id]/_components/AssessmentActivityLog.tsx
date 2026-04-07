'use client'

import { useState } from 'react'
import type { ActivityLogEntry } from '@/types/activity'

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  assessment_created:             { label: 'Created',              icon: '✦', color: '#6c5dd3' },
  assessment_submitted:           { label: 'Submitted',            icon: '↗', color: '#6c5dd3' },
  assessment_completed:           { label: 'Completed',            icon: '✓', color: '#059669' },
  assessment_reopened:            { label: 'Reopened',             icon: '↺', color: '#d97706' },
  assessment_ai_review_triggered: { label: 'AI Review Triggered',  icon: '🤖', color: '#0ea5e9' },
  assessment_human_review_started:{ label: 'Human Review Started', icon: '👤', color: '#8b5cf6' },
  assessment_deleted:             { label: 'Deleted',              icon: '✗', color: '#e11d48' },
}

export function AssessmentActivityLog({ entries }: { entries: ActivityLogEntry[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
        style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.2)' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="7" />
          <path d="M8 4v4l2.5 1.5" />
        </svg>
        Activity Log
        {entries.length > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full leading-none"
            style={{ background: 'rgba(109,93,211,0.12)', color: '#6b5fa8' }}
          >
            {entries.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            style={{ border: '1px solid rgba(109,93,211,0.15)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(109,93,211,0.1)' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Assessment Activity Log</h3>
                <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
                  History of status changes and key actions
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-[rgba(109,93,211,0.06)]"
                style={{ color: '#a99fd8' }}
              >
                ✕
              </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {entries.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#a99fd8' }}>
                  No activity recorded yet.
                </p>
              ) : (
                <div className="relative">
                  {/* Vertical timeline line */}
                  <div
                    className="absolute left-[11px] top-2 bottom-2 w-px"
                    style={{ background: 'rgba(109,93,211,0.12)' }}
                  />

                  <div className="space-y-4">
                    {entries.map((entry) => {
                      const config = ACTION_LABELS[entry.action] ?? {
                        label: entry.action.replace(/_/g, ' ').replace(/^assessment /, ''),
                        icon: '•',
                        color: '#94a3b8',
                      }
                      const meta = entry.metadata_json as { from?: string; to?: string } | null
                      const date = new Date(entry.created_at)

                      return (
                        <div key={entry.id} className="flex gap-3 relative">
                          {/* Dot */}
                          <div
                            className="w-[23px] h-[23px] rounded-full flex items-center justify-center text-[11px] shrink-0 z-10"
                            style={{ background: `${config.color}15`, color: config.color, border: `1.5px solid ${config.color}30` }}
                          >
                            {config.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
                                {config.label}
                              </span>
                              {meta?.from && meta?.to && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.06)', color: '#a99fd8' }}>
                                  {meta.from.replace(/_/g, ' ')} → {meta.to.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: '#a99fd8' }}>
                              {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {entry.description && (
                              <p className="text-xs mt-1" style={{ color: '#6b5fa8' }}>{entry.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
