'use client'

import type { ActivityLogEntry } from '@/types/activity'

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-100 text-emerald-700',
  updated: 'bg-[rgba(109,93,211,0.12)] text-[#6c5dd3]',
  deleted: 'bg-rose-100 text-rose-600',
  document_uploaded: 'bg-[rgba(109,93,211,0.12)] text-[#6c5dd3]',
  custom_document_added: 'bg-[rgba(139,127,212,0.12)] text-[#8b7fd4]',
  document_updated: 'bg-[rgba(109,93,211,0.12)] text-[#6c5dd3]',
  dispute_created: 'bg-amber-100 text-amber-700',
  dispute_status_updated: 'bg-amber-100 text-amber-700',
}

interface ActivityTabProps {
  activityLog: ActivityLogEntry[]
}

export function ActivityTab({ activityLog }: ActivityTabProps) {
  if (activityLog.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center" style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}>
        <p className="text-sm" style={{ color: '#a99fd8' }}>No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activityLog.map((entry, i) => {
          const colorClass = ACTION_COLORS[entry.action] ?? 'bg-[rgba(109,93,211,0.06)] text-[#a99fd8]'
          const isLast = i === activityLog.length - 1

          return (
            <li key={entry.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-[rgba(109,93,211,0.06)]"
                    aria-hidden
                  />
                )}
                <div className="relative flex items-start gap-3">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ring-4 ring-white ${colorClass} shrink-0 font-medium`}
                  >
                    {entry.action[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm" style={{ color: '#1e1550' }}>
                      {entry.title ?? `${entry.entity_type} ${entry.action}`}
                    </p>
                    {entry.description && (
                      <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>{entry.description}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
