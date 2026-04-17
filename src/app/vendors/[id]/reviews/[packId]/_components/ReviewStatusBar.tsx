'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorReviewPackStatus } from '@/types/review-pack'

interface Props {
  vendorId: string
  packId: string
  status: VendorReviewPackStatus
  lockedAt: string | null
  lockedByName: string | null
  reviewerName: string | null
  approverName: string | null
  submitForApprovalAction: (vendorId: string, vrpId: string) => Promise<{ success?: boolean; message?: string }>
  approveReviewAction: (vendorId: string, vrpId: string, decision: 'approved' | 'approved_with_exception' | 'sent_back', comment: string | null) => Promise<{ success?: boolean; message?: string }>
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; color: string; label: string; description: string }> = {
  not_started:       { bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.2)', color: '#64748b', label: 'Not Started',       description: 'Review items and evidence below. Start reviewing to begin.' },
  in_progress:       { bg: 'rgba(14,165,233,0.04)',  border: 'rgba(14,165,233,0.2)',  color: '#0284c7', label: 'In Progress',       description: 'Review all items below, then submit for approval when done.' },
  awaiting_approval: { bg: 'rgba(124,58,237,0.04)',  border: 'rgba(124,58,237,0.2)',  color: '#7c3aed', label: 'Awaiting Approval', description: 'Reviewer has submitted. Approver needs to make a decision.' },
  sent_back:         { bg: 'rgba(245,158,11,0.04)',  border: 'rgba(245,158,11,0.2)',  color: '#d97706', label: 'Sent Back',         description: 'Approver sent this back for revision. Address the feedback and re-submit.' },
  submitted:         { bg: 'rgba(99,102,241,0.04)',  border: 'rgba(99,102,241,0.2)',  color: '#6366f1', label: 'Submitted',         description: 'Review submitted for processing.' },
  approved:          { bg: 'rgba(5,150,105,0.04)',   border: 'rgba(5,150,105,0.2)',   color: '#059669', label: 'Approved',           description: 'This review has been approved and is now locked.' },
  approved_with_exception: { bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.2)', color: '#d97706', label: 'Approved (Exception)', description: 'This review was approved with exceptions noted.' },
  locked:            { bg: 'rgba(5,150,105,0.04)',   border: 'rgba(5,150,105,0.2)',   color: '#059669', label: 'Locked',             description: 'This review is finalized and read-only.' },
  upcoming:          { bg: 'rgba(14,165,233,0.04)',  border: 'rgba(14,165,233,0.2)',  color: '#0ea5e9', label: 'Upcoming',           description: 'This review is scheduled but not yet started.' },
  blocked:           { bg: 'rgba(225,29,72,0.04)',   border: 'rgba(225,29,72,0.2)',   color: '#e11d48', label: 'Blocked',            description: 'This review is blocked. Resolve the blockers to proceed.' },
}

export function ReviewStatusBar({
  vendorId,
  packId,
  status,
  lockedAt,
  lockedByName,
  reviewerName,
  approverName,
  submitForApprovalAction,
  approveReviewAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [approverComment, setApproverComment] = useState('')

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      const r = await submitForApprovalAction(vendorId, packId)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed')
    })
  }

  const handleApprove = (decision: 'approved' | 'approved_with_exception' | 'sent_back') => {
    setError(null)
    startTransition(async () => {
      const r = await approveReviewAction(vendorId, packId, decision, approverComment.trim() || null)
      if (r.success) { setShowApproveForm(false); router.refresh() }
      else setError(r.message ?? 'Failed')
    })
  }

  return (
    <div
      className="rounded-xl px-5 py-3 mb-4"
      style={{ background: config.bg, border: `1px solid ${config.border}` }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-bold uppercase shrink-0"
            style={{ background: `${config.color}15`, color: config.color }}
          >
            {config.label}
          </span>
          <span className="text-xs" style={{ color: '#4a4270' }}>{config.description}</span>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2 shrink-0">
          {(status === 'in_progress' || status === 'sent_back') && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 2px 8px rgba(108,93,211,0.3)' }}
            >
              {isPending ? 'Submitting…' : status === 'sent_back' ? 'Re-submit for Approval' : 'Submit for Approval'}
            </button>
          )}

          {status === 'awaiting_approval' && !showApproveForm && (
            <button
              type="button"
              onClick={() => setShowApproveForm(true)}
              className="text-sm font-semibold px-5 py-2 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 2px 8px rgba(5,150,105,0.3)' }}
            >
              Review & Approve
            </button>
          )}

          {(status === 'approved' || status === 'approved_with_exception' || status === 'locked') && lockedAt && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#059669' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="7" width="10" height="7" rx="1.5" />
                <path d="M5 7V5a3 3 0 016 0v2" />
              </svg>
              Finalized {new Date(lockedAt).toLocaleDateString()}
              {lockedByName && ` by ${lockedByName}`}
            </div>
          )}
        </div>
      </div>

      {/* Approver decision form */}
      {showApproveForm && (
        <div className="mt-3 pt-3 space-y-3" style={{ borderTop: `1px solid ${config.border}` }}>
          <textarea
            value={approverComment}
            onChange={(e) => setApproverComment(e.target.value)}
            rows={2}
            placeholder="Comment (optional for approval, recommended for send-back)…"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => handleApprove('approved')} disabled={isPending} className="text-sm font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#059669' }}>
              ✓ Approve
            </button>
            <button type="button" onClick={() => handleApprove('approved_with_exception')} disabled={isPending} className="text-sm font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
              Approve with Exception
            </button>
            <button type="button" onClick={() => handleApprove('sent_back')} disabled={isPending} className="text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-50" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
              Send Back
            </button>
            <button type="button" onClick={() => setShowApproveForm(false)} className="text-sm px-3 py-2" style={{ color: '#a99fd8' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assigned people */}
      {(reviewerName || approverName) && (
        <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: '#8b7fd4' }}>
          {reviewerName && <span>Reviewer: <span className="font-medium" style={{ color: '#4a4270' }}>{reviewerName}</span></span>}
          {approverName && <span>Approver: <span className="font-medium" style={{ color: '#4a4270' }}>{approverName}</span></span>}
        </div>
      )}

      {error && <p className="text-xs mt-2" style={{ color: '#e11d48' }}>{error}</p>}
    </div>
  )
}
