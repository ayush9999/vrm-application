'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { VendorReviewPack, VendorReviewPackStatus, VendorReview, VendorReviewStatus, ReviewType } from '@/types/review-pack'
import type { VendorPackAssignment } from '@/lib/db/vendor-pack-assignments'

const STATUS_STYLE: Record<VendorReviewPackStatus, { bg: string; color: string; label: string }> = {
  not_started:              { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Not Started' },
  in_progress:              { bg: 'rgba(14,165,233,0.1)',   color: '#0284c7', label: 'In Progress' },
  submitted:                { bg: 'rgba(99,102,241,0.1)',   color: '#6366f1', label: 'Submitted' },
  awaiting_approval:        { bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed', label: 'Awaiting Approval' },
  sent_back:                { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Sent Back' },
  approved:                 { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Approved' },
  approved_with_exception:  { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Approved (Exception)' },
  blocked:                  { bg: 'rgba(225,29,72,0.1)',    color: '#e11d48', label: 'Blocked' },
  upcoming:                 { bg: 'rgba(14,165,233,0.08)',  color: '#0ea5e9', label: 'Upcoming' },
  locked:                   { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Locked' },
}

const REVIEW_STATUS_STYLE: Record<VendorReviewStatus, { bg: string; color: string; label: string; strikethrough?: boolean }> = {
  not_started:             { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Not Started' },
  in_progress:             { bg: 'rgba(14,165,233,0.1)',   color: '#0284c7', label: 'In Progress' },
  submitted:               { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Submitted' },
  approved:                { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Approved' },
  approved_with_exception: { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Approved (Exception)' },
  done:                    { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Done' },
  cancelled:               { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Cancelled', strikethrough: true },
}

const REVIEW_TYPE_STYLE: Record<ReviewType, { bg: string; color: string }> = {
  onboarding: { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  scheduled:  { bg: 'rgba(14,165,233,0.08)', color: '#0284c7' },
  on_demand:  { bg: 'rgba(245,158,11,0.08)', color: '#d97706' },
}

interface ReviewsTabProps {
  vendorId: string
  assignments: VendorPackAssignment[]
  reviewPacks: VendorReviewPack[]
  availablePacks: { id: string; name: string; code: string | null }[]
  assignPackAction: (vendorId: string, reviewPackId: string) => Promise<{ success?: boolean; message?: string }>
  removePackAction: (vendorId: string, reviewPackId: string) => Promise<{ success?: boolean; message?: string }>
  vendorReviews: VendorReview[]
}

export function ReviewsTab({ vendorId, assignments, reviewPacks, availablePacks, assignPackAction, removePackAction, vendorReviews }: ReviewsTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAssign, setShowAssign] = useState(false)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (vendorReviews.length > 0) initial.add(vendorReviews[0].id)
    return initial
  })

  const toggleReview = (reviewId: string) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev)
      if (next.has(reviewId)) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
  }

  const assignedPackIds = new Set(assignments.map((a) => a.review_pack_id))
  const unassignedPacks = availablePacks.filter((p) => !assignedPackIds.has(p.id))

  const handleAssign = (packId: string) => {
    startTransition(async () => {
      await assignPackAction(vendorId, packId)
      setShowAssign(false)
      router.refresh()
    })
  }

  const handleRemove = (packId: string) => {
    if (!confirm('Remove this pack? Future scheduled reviews won\'t include it. Existing reviews are not affected.')) return
    startTransition(async () => {
      await removePackAction(vendorId, packId)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Assigned Packs (Configuration) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Assigned Packs</h2>
            <p className="text-xs mt-0.5" style={{ color: '#8b7fd4' }}>
              Packs assigned to this vendor. Scheduled reviews pull from this list.
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAssign((v) => !v)}
              disabled={unassignedPacks.length === 0 || isPending}
              className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
            >
              + Add Pack
            </button>
            {showAssign && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAssign(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.15)', boxShadow: '0 4px 16px rgba(109,93,211,0.15)' }}>
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4', borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
                    Assign a pack
                  </div>
                  {unassignedPacks.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleAssign(p.id)} disabled={isPending} className="w-full text-left px-3 py-2 text-xs hover:bg-[rgba(109,93,211,0.04)] disabled:opacity-50" style={{ color: '#1e1550' }}>
                      <span className="font-medium">{p.name}</span>
                      {p.code && <span className="ml-1.5 font-mono text-[10px]" style={{ color: '#a99fd8' }}>{p.code}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {assignments.length === 0 ? (
          <p className="text-xs py-3 px-4 rounded-lg" style={{ background: 'rgba(109,93,211,0.03)', color: '#8b7fd4' }}>
            No packs assigned. Click "+ Add Pack" to start.
          </p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg text-xs"
                style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.12)' }}
              >
                <span className="font-medium" style={{ color: '#1e1550' }}>{a.pack_name}</span>
                {a.pack_code && <span className="font-mono text-[10px]" style={{ color: '#a99fd8' }}>{a.pack_code}</span>}
                <button
                  type="button"
                  onClick={() => handleRemove(a.review_pack_id)}
                  disabled={isPending}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  style={{ color: '#a99fd8' }}
                  title="Remove pack"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 2: Review History (Grouped by Vendor Review) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>
            Reviews ({vendorReviews.length})
          </h2>
          <Link
            href={`/reviews/${vendorId}`}
            className="text-xs font-semibold px-4 py-1.5 rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Full Timeline →
          </Link>
        </div>

        {vendorReviews.length === 0 ? (
          <p className="text-xs py-3 px-4 rounded-lg" style={{ background: 'rgba(109,93,211,0.03)', color: '#8b7fd4' }}>
            No reviews yet. Create one from the{' '}
            <Link href="/reviews" className="underline" style={{ color: '#6c5dd3' }}>Reviews module</Link>.
          </p>
        ) : (
          <div className="space-y-3">
            {vendorReviews.map((review) => {
              const isExpanded = expandedReviews.has(review.id)
              const rSty = REVIEW_STATUS_STYLE[review.status]
              const tSty = REVIEW_TYPE_STYLE[review.review_type]
              const readiness = review.readiness_pct ?? 0
              const dateStr = review.due_at
                ? new Date(review.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : review.created_at
                  ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : null
              const packs = review.packs ?? []

              return (
                <div
                  key={review.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.05)' }}
                >
                  {/* Review header — clickable to expand/collapse */}
                  <button
                    type="button"
                    onClick={() => toggleReview(review.id)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[rgba(109,93,211,0.02)]"
                  >
                    {/* Chevron */}
                    <svg
                      width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      className="shrink-0 transition-transform"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>

                    {/* Review code */}
                    <span
                      className="text-xs font-mono font-semibold px-2 py-0.5 rounded shrink-0"
                      style={{ background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }}
                    >
                      {review.review_code}
                    </span>

                    {/* Review type badge */}
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
                      style={{ background: tSty.bg, color: tSty.color }}
                    >
                      {review.review_type.replace('_', ' ')}
                    </span>

                    {/* Status badge */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0${rSty.strikethrough ? ' line-through' : ''}`}
                      style={{ background: rSty.bg, color: rSty.color }}
                    >
                      {rSty.label}
                    </span>

                    {/* Spacer */}
                    <span className="flex-1" />

                    {/* Readiness percentage */}
                    <span className="text-xs font-bold shrink-0" style={{ color: readiness === 100 ? '#059669' : '#6c5dd3' }}>
                      {readiness}%
                    </span>

                    {/* Date */}
                    {dateStr && (
                      <span className="text-[11px] shrink-0" style={{ color: '#a99fd8' }}>
                        {dateStr}
                      </span>
                    )}

                    {/* Open link */}
                    <Link
                      href={`/vendors/${vendorId}/reviews/view/${review.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg shrink-0 transition-colors hover:opacity-80"
                      style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
                    >
                      Open →
                    </Link>
                  </button>

                  {/* Expanded: pack list */}
                  {isExpanded && (
                    <div className="px-4 pb-3" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
                      {packs.length === 0 ? (
                        <p className="text-xs py-3" style={{ color: '#8b7fd4' }}>No packs in this review.</p>
                      ) : (
                        <div className="pt-2 space-y-0">
                          {packs.map((pack, idx) => {
                            const counts = pack.item_counts ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
                            const applicable = counts.total - counts.na
                            const pct = applicable > 0 ? Math.round((counts.passed / applicable) * 100) : 0
                            const isLast = idx === packs.length - 1
                            const packSty = STATUS_STYLE[pack.status]

                            return (
                              <div key={pack.id} className="flex items-center gap-3 py-2">
                                {/* Tree connector */}
                                <span className="text-xs shrink-0 w-6 text-right select-none" style={{ color: '#c4bfe6', fontFamily: 'monospace' }}>
                                  {isLast ? '└──' : '├──'}
                                </span>

                                {/* Pack name */}
                                <span className="text-xs font-medium truncate min-w-0" style={{ color: '#1e1550' }}>
                                  {pack.review_pack_name ?? 'Pack'}
                                </span>

                                {/* Pack status badge (small) */}
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                                  style={{ background: packSty.bg, color: packSty.color }}
                                >
                                  {packSty.label}
                                </span>

                                {/* Spacer */}
                                <span className="flex-1" />

                                {/* Item progress */}
                                {applicable > 0 ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px]" style={{ color: '#8b7fd4' }}>
                                      {counts.passed}/{applicable} passed
                                    </span>
                                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-bold w-8 text-right" style={{ color: pct === 100 ? '#059669' : '#6c5dd3' }}>
                                      {pct}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[11px]" style={{ color: '#a99fd8' }}>
                                    {counts.total > 0 ? `0/${counts.total} started` : 'No items'}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
