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
  startReviewAction: (vendorId: string, vrpId: string) => Promise<{ success?: boolean; message?: string }>
}

// Steps in the lifecycle — for the visual step indicator
const STEPS = [
  { key: 'start',   label: 'Start' },
  { key: 'review',  label: 'Review' },
  { key: 'submit',  label: 'Submit' },
  { key: 'approve', label: 'Approve' },
  { key: 'done',    label: 'Done' },
]

function getActiveStep(status: VendorReviewPackStatus): number {
  if (status === 'not_started' || status === 'upcoming') return 0
  if (status === 'in_progress' || status === 'sent_back') return 1
  if (status === 'submitted' || status === 'awaiting_approval') return 2
  if (status === 'approved' || status === 'approved_with_exception' || status === 'locked') return 4
  return 1
}

export function ReviewStatusBar({
  vendorId, packId, status, lockedAt, lockedByName,
  reviewerName, approverName,
  submitForApprovalAction, approveReviewAction, startReviewAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [approverComment, setApproverComment] = useState('')

  const activeStep = getActiveStep(status)
  const isLocked = status === 'approved' || status === 'approved_with_exception' || status === 'locked'

  const handleStart = () => {
    setError(null)
    startTransition(async () => {
      const r = await startReviewAction(vendorId, packId)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed')
    })
  }

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
      className="rounded-2xl mb-4 overflow-hidden"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.12)', boxShadow: '0 2px 12px rgba(109,93,211,0.06)' }}
    >
      {/* Step indicator */}
      <div className="flex items-center px-5 py-3" style={{ background: 'rgba(109,93,211,0.03)', borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
        {STEPS.map((step, i) => {
          const isDone = i < activeStep
          const isCurrent = i === activeStep
          const isSentBack = status === 'sent_back' && i === 1
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={
                    isDone
                      ? { background: '#059669', color: 'white' }
                      : isCurrent
                      ? { background: '#6c5dd3', color: 'white', boxShadow: '0 0 0 3px rgba(108,93,211,0.2)' }
                      : isSentBack
                      ? { background: '#d97706', color: 'white' }
                      : { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
                  }
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span
                  className="text-[11px] font-semibold hidden sm:inline"
                  style={{ color: isDone ? '#059669' : isCurrent ? '#6c5dd3' : '#a99fd8' }}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2 h-px" style={{ background: isDone ? '#059669' : 'rgba(148,163,184,0.2)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Action area */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Context text */}
          <div className="flex-1 min-w-0">
            {(status === 'not_started' || status === 'upcoming') && (
              <p className="text-sm" style={{ color: '#4a4270' }}>
                Ready to begin? Click <strong>Start Review</strong> to begin the assessment. Review each item and upload evidence.
              </p>
            )}
            {status === 'in_progress' && (
              <p className="text-sm" style={{ color: '#4a4270' }}>
                Review all items below. When done, click <strong>Submit for Approval</strong> to send to the approver.
              </p>
            )}
            {status === 'sent_back' && (
              <p className="text-sm" style={{ color: '#d97706' }}>
                The approver sent this back for revision. Address the feedback, then <strong>re-submit</strong>.
              </p>
            )}
            {status === 'awaiting_approval' && (
              <p className="text-sm" style={{ color: '#7c3aed' }}>
                Submitted for approval. The approver can <strong>approve, reject, or send back</strong>.
              </p>
            )}
            {isLocked && (
              <p className="text-sm flex items-center gap-1.5" style={{ color: '#059669' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5 7V5a3 3 0 016 0v2" />
                </svg>
                Finalized{lockedAt ? ` on ${new Date(lockedAt).toLocaleDateString()}` : ''}{lockedByName ? ` by ${lockedByName}` : ''}. This review is now read-only.
              </p>
            )}
          </div>

          {/* Primary action button */}
          <div className="flex items-center gap-2 shrink-0">
            {(status === 'not_started' || status === 'upcoming') && (
              <button
                type="button"
                onClick={handleStart}
                disabled={isPending}
                className="text-sm font-semibold px-6 py-2.5 rounded-full text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
              >
                {isPending ? 'Starting…' : 'Start Review'}
              </button>
            )}

            {(status === 'in_progress' || status === 'sent_back') && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="text-sm font-semibold px-6 py-2.5 rounded-full text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
              >
                {isPending ? 'Submitting…' : 'Submit for Approval'}
              </button>
            )}

            {status === 'awaiting_approval' && !showApproveForm && (
              <button
                type="button"
                onClick={() => setShowApproveForm(true)}
                className="text-sm font-semibold px-6 py-2.5 rounded-full text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
              >
                Review & Approve
              </button>
            )}
          </div>
        </div>

        {/* Assigned people */}
        {(reviewerName || approverName) && (
          <div className="flex items-center gap-4 mt-2 pt-2 text-[11px]" style={{ color: '#8b7fd4', borderTop: '1px solid rgba(109,93,211,0.06)' }}>
            {reviewerName && <span>Reviewer: <strong style={{ color: '#4a4270' }}>{reviewerName}</strong></span>}
            {approverName && <span>Approver: <strong style={{ color: '#4a4270' }}>{approverName}</strong></span>}
          </div>
        )}

        {/* Approver decision form */}
        {showApproveForm && (
          <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
            <textarea
              value={approverComment}
              onChange={(e) => setApproverComment(e.target.value)}
              rows={2}
              placeholder="Comment (optional for approval, recommended for send-back)…"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550', background: 'white' }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => handleApprove('approved')} disabled={isPending} className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#059669' }}>
                ✓ Approve
              </button>
              <button type="button" onClick={() => handleApprove('approved_with_exception')} disabled={isPending} className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
                Approve with Exception
              </button>
              <button type="button" onClick={() => handleApprove('sent_back')} disabled={isPending} className="text-sm font-semibold px-5 py-2 rounded-full disabled:opacity-50" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                ✕ Send Back
              </button>
              <button type="button" onClick={() => setShowApproveForm(false)} className="text-sm px-3 py-2" style={{ color: '#a99fd8' }}>Cancel</button>
            </div>
          </div>
        )}

        {error && <p className="text-xs mt-2" style={{ color: '#e11d48' }}>{error}</p>}
      </div>
    </div>
  )
}
