'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { VendorReview, VendorReviewStatus, ReviewType } from '@/types/review-pack'

const STATUS_STYLE: Record<VendorReviewStatus, { label: string; bg: string; color: string; dot: string }> = {
  not_started:              { label: 'Not Started',      bg: 'rgba(148,163,184,0.12)', color: '#64748b', dot: '#94a3b8' },
  in_progress:              { label: 'In Progress',      bg: 'rgba(14,165,233,0.1)',   color: '#0284c7', dot: '#0ea5e9' },
  submitted:                { label: 'Submitted',        bg: 'rgba(245,158,11,0.1)',   color: '#d97706', dot: '#f59e0b' },
  approved:                 { label: 'Approved',         bg: 'rgba(5,150,105,0.1)',    color: '#059669', dot: '#10b981' },
  approved_with_exception:  { label: 'Approved (Exc)',   bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed', dot: '#8b5cf6' },
  done:                     { label: 'Done',             bg: 'rgba(5,150,105,0.1)',    color: '#059669', dot: '#10b981' },
  cancelled:                { label: 'Cancelled',        bg: 'rgba(148,163,184,0.12)', color: '#64748b', dot: '#94a3b8' },
}

const TYPE_STYLE: Record<ReviewType, { label: string; bg: string; color: string }> = {
  onboarding: { label: 'Onboarding', bg: 'rgba(109,93,211,0.1)',  color: '#6c5dd3' },
  scheduled:  { label: 'Scheduled',  bg: 'rgba(14,165,233,0.1)',  color: '#0284c7' },
  on_demand:  { label: 'On Demand',  bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
}

const PACK_STATUS: Record<string, { label: string; color: string }> = {
  not_started:              { label: 'Not Started',    color: '#94a3b8' },
  in_progress:              { label: 'In Progress',    color: '#0ea5e9' },
  submitted:                { label: 'Submitted',      color: '#6366f1' },
  awaiting_approval:        { label: 'Awaiting',       color: '#7c3aed' },
  approved:                 { label: 'Approved',       color: '#059669' },
  approved_with_exception:  { label: 'Approved (Exc)', color: '#d97706' },
  locked:                   { label: 'Locked',         color: '#059669' },
  sent_back:                { label: 'Sent Back',      color: '#d97706' },
  upcoming:                 { label: 'Upcoming',       color: '#0ea5e9' },
  blocked:                  { label: 'Blocked',        color: '#e11d48' },
}

interface Props {
  reviews: VendorReview[]
  vendorId: string
}

export function ReviewTimelineClient({ reviews, vendorId }: Props) {
  // Sort: active first, then upcoming, then completed
  const sorted = [...reviews].sort((a, b) => {
    const order: Record<VendorReviewStatus, number> = {
      in_progress: 0, submitted: 1, not_started: 2,
      approved: 3, approved_with_exception: 3, done: 4, cancelled: 5,
    }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(sorted.length > 0 ? [sorted[0].id] : []),
  )

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div
        className="absolute left-5 top-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(to bottom, #6c5dd3 0%, rgba(109,93,211,0.1) 100%)' }}
      />

      <div className="space-y-0">
        {sorted.map((review) => {
          const sty = STATUS_STYLE[review.status]
          const typeSty = TYPE_STYLE[review.review_type] ?? TYPE_STYLE.onboarding
          const isExpanded = expanded.has(review.id)
          const isComplete = ['approved', 'approved_with_exception', 'done'].includes(review.status)
          const packs = review.packs ?? []

          const dateStr = review.completed_at
            ? new Date(review.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : review.due_at
            ? new Date(review.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : new Date(review.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          const dateLabel = isComplete ? 'Completed' : review.due_at ? 'Due' : 'Created'

          return (
            <div key={review.id} className="relative pl-12 pb-6">
              {/* Timeline dot */}
              <div
                className="absolute left-3.5 top-4 w-3 h-3 rounded-full ring-2 ring-white"
                style={{ background: sty.dot }}
              />

              {/* Date label */}
              <div className="text-[10px] font-medium mb-1.5 flex items-center gap-2" style={{ color: '#8b7fd4' }}>
                <span className="uppercase tracking-wider">{dateLabel}</span>
                <span className="font-semibold">{dateStr}</span>
              </div>

              {/* Review card */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: isComplete ? 'rgba(5,150,105,0.02)' : 'white',
                  border: `1px solid ${isComplete ? 'rgba(5,150,105,0.15)' : 'rgba(109,93,211,0.1)'}`,
                  boxShadow: '0 1px 4px rgba(109,93,211,0.04)',
                }}
              >
                {/* Review header — clickable to expand */}
                <button
                  type="button"
                  onClick={() => toggle(review.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[rgba(109,93,211,0.02)] transition-colors"
                >
                  {/* Chevron */}
                  <span
                    className="text-xs shrink-0 transition-transform"
                    style={{ color: '#a99fd8', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ▸
                  </span>

                  {/* Review code */}
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0"
                    style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                  >
                    {review.review_code}
                  </span>

                  {/* Type badge */}
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: typeSty.bg, color: typeSty.color }}
                  >
                    {typeSty.label}
                  </span>

                  {/* Status badge */}
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: sty.bg, color: sty.color }}
                  >
                    {sty.label}
                  </span>

                  {/* Spacer */}
                  <span className="flex-1" />

                  {/* Readiness */}
                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: (review.readiness_pct ?? 0) >= 80 ? '#059669' : '#6c5dd3' }}>
                    {review.readiness_pct ?? 0}%
                  </span>

                  {/* Pack count */}
                  <span className="text-[10px] shrink-0" style={{ color: '#a99fd8' }}>
                    {packs.length} pack{packs.length !== 1 ? 's' : ''}
                  </span>

                  {/* Open link */}
                  <Link
                    href={`/vendors/${vendorId}/reviews/view/${review.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-lg shrink-0 hover:opacity-80"
                    style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
                  >
                    Open Full Review →
                  </Link>
                </button>

                {/* Expanded: pack sections */}
                {isExpanded && packs.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
                    {packs.map((pack, i) => {
                      const counts = pack.item_counts ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
                      const applicable = counts.total - counts.na
                      const pct = applicable > 0 ? Math.round((counts.passed / applicable) * 100) : 0
                      const packSty = PACK_STATUS[pack.status] ?? PACK_STATUS.not_started
                      const isLast = i === packs.length - 1
                      const connector = isLast ? '└──' : '├──'

                      return (
                        <div
                          key={pack.id}
                          className="flex items-center gap-3 px-5 py-3"
                          style={{ borderBottom: isLast ? 'none' : '1px solid rgba(109,93,211,0.04)' }}
                        >
                          {/* Tree connector */}
                          <span className="text-[10px] font-mono shrink-0" style={{ color: '#c4bae8', width: 24 }}>
                            {connector}
                          </span>

                          {/* Pack name */}
                          <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: '#1e1550' }}>
                            {pack.review_pack_name ?? 'Unknown Pack'}
                          </span>

                          {/* Pack status */}
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0"
                            style={{ background: `${packSty.color}14`, color: packSty.color }}
                          >
                            {packSty.label}
                          </span>

                          {/* Progress bar */}
                          <div className="shrink-0" style={{ width: 100 }}>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)',
                                }}
                              />
                            </div>
                          </div>

                          {/* Counts */}
                          <span className="text-[10px] tabular-nums shrink-0" style={{ color: '#8b7fd4', width: 52, textAlign: 'right' }}>
                            {counts.passed}/{applicable} passed
                          </span>

                          {/* Percentage */}
                          <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: pct === 100 ? '#059669' : '#6c5dd3', width: 28, textAlign: 'right' }}>
                            {pct}%
                          </span>
                        </div>
                      )
                    })}

                    {/* Review meta footer */}
                    <div
                      className="flex items-center gap-3 px-5 py-2.5 text-[10px] flex-wrap"
                      style={{ borderTop: '1px solid rgba(109,93,211,0.06)', color: '#a99fd8' }}
                    >
                      {review.reviewer_name && <span>Reviewer: <strong style={{ color: '#6c5dd3' }}>{review.reviewer_name}</strong></span>}
                      {review.approver_name && <span>Approver: <strong style={{ color: '#6c5dd3' }}>{review.approver_name}</strong></span>}
                      {review.due_at && <span>Due: {new Date(review.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    </div>
                  </div>
                )}

                {/* Expanded but no packs */}
                {isExpanded && packs.length === 0 && (
                  <div className="px-5 py-6 text-center text-xs" style={{ color: '#a99fd8', borderTop: '1px solid rgba(109,93,211,0.06)' }}>
                    No packs in this review yet.
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Timeline start marker */}
        <div className="relative pl-12 pb-2 pt-2">
          <div
            className="absolute left-3.5 top-4 w-3 h-3 rounded-full ring-2 ring-white"
            style={{ background: '#6c5dd3' }}
          />
          <div className="text-[11px] font-medium pt-1" style={{ color: '#8b7fd4' }}>
            Vendor review journey started
          </div>
        </div>
      </div>
    </div>
  )
}
