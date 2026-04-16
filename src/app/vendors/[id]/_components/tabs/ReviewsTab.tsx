'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { VendorReviewPack, VendorReviewPackStatus } from '@/types/review-pack'

const STATUS_STYLE: Record<VendorReviewPackStatus, { bg: string; color: string; label: string }> = {
  not_started:              { bg: 'rgba(148,163,184,0.15)', color: '#64748b', label: 'Not Started' },
  in_progress:              { bg: 'rgba(14,165,233,0.1)',   color: '#0284c7', label: 'In Progress' },
  submitted:                { bg: 'rgba(99,102,241,0.1)',   color: '#6366f1', label: 'Submitted' },
  approved:                 { bg: 'rgba(5,150,105,0.1)',    color: '#059669', label: 'Approved' },
  approved_with_exception:  { bg: 'rgba(245,158,11,0.1)',   color: '#d97706', label: 'Approved (Exception)' },
  blocked:                  { bg: 'rgba(225,29,72,0.1)',    color: '#e11d48', label: 'Blocked' },
}

interface ReviewsTabProps {
  vendorId: string
  reviewPacks: VendorReviewPack[]
  reapplyReviewPacksAction: () => Promise<{ message?: string; success?: boolean }>
}

export function ReviewsTab({ vendorId, reviewPacks, reapplyReviewPacksAction }: ReviewsTabProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleReapply = () => {
    setMessage(null)
    startTransition(async () => {
      const result = await reapplyReviewPacksAction()
      if (result.success) {
        setMessage('Review packs re-applied. Refresh to see updates.')
      } else {
        setMessage(result.message ?? 'Failed to re-apply review packs')
      }
    })
  }

  if (reviewPacks.length === 0) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'white', border: '1px dashed rgba(109,93,211,0.2)' }}
        >
          <p className="text-sm font-medium mb-2" style={{ color: '#1e1550' }}>
            No Review Packs assigned yet
          </p>
          <p className="text-xs mb-4" style={{ color: '#a99fd8' }}>
            Review Packs are auto-assigned based on the vendor&apos;s service type, criticality, and data access level.
          </p>
          <button
            type="button"
            onClick={handleReapply}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Applying…' : 'Apply Review Packs Now'}
          </button>
          {message && (
            <p className="text-xs mt-3" style={{ color: '#6c5dd3' }}>{message}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with re-apply */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#1e1550' }}>
            Assigned Review Packs ({reviewPacks.length})
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
            Each pack contains the evidence and review items needed to onboard or re-review this vendor.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReapply}
          disabled={isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
        >
          {isPending ? 'Re-applying…' : 'Re-apply packs'}
        </button>
      </div>

      {message && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }}
        >
          {message}
        </div>
      )}

      {/* Review pack cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {reviewPacks.map((pack) => {
          const counts = pack.item_counts ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
          const applicable = counts.total - counts.na
          const completed = counts.passed
          const pct = applicable > 0 ? Math.round((completed / applicable) * 100) : 0
          const statusStyle = STATUS_STYLE[pack.status]

          return (
            <Link
              key={pack.id}
              href={`/vendors/${vendorId}/reviews/${pack.id}`}
              className="block rounded-2xl p-4 transition-all hover:-translate-y-0.5"
              style={{
                background: 'white',
                border: '1px solid rgba(109,93,211,0.1)',
                boxShadow: '0 2px 12px rgba(109,93,211,0.06)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold truncate" style={{ color: '#1e1550' }}>
                    {pack.review_pack_name ?? 'Review Pack'}
                  </h3>
                  {pack.review_pack_code && (
                    <span className="text-[10px] font-mono" style={{ color: '#a99fd8' }}>
                      {pack.review_pack_code}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2"
                  style={{ background: statusStyle.bg, color: statusStyle.color }}
                >
                  {statusStyle.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: '#8b7fd4' }}>
                    {completed} / {applicable} applicable items
                  </span>
                  <span className="font-bold" style={{ color: pct === 100 ? '#059669' : pct >= 50 ? '#6c5dd3' : '#a99fd8' }}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)',
                    }}
                  />
                </div>
              </div>

              {/* Item counts */}
              <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
                <Mini label="Pass"   count={counts.passed}      color="#059669" />
                <Mini label="Fail"   count={counts.failed}      color="#e11d48" />
                <Mini label="Open"   count={counts.not_started} color="#a99fd8" />
                {counts.na > 0 && <Mini label="N/A" count={counts.na} color="#94a3b8" />}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Mini({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1 h-1 rounded-full" style={{ background: color }} />
      <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#a99fd8' }}>{label}</span>
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{count}</span>
    </div>
  )
}
