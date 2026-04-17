'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorReviewPackStatus } from '@/types/review-pack'

interface ApprovalRecord {
  id: string
  level: number
  user_id: string
  user_name: string | null
  decision: string
  comment: string | null
  decided_at: string
}

interface Props {
  vendorId: string
  vendorReviewPackId: string
  status: VendorReviewPackStatus
  lockedAt: string | null
  lockedByName: string | null
  reopenReason: string | null
  approvals: ApprovalRecord[]
  isSiteAdmin: boolean
  submitForApprovalAction: (vendorId: string, vrpId: string) => Promise<{ success?: boolean; message?: string }>
  approveReviewAction: (vendorId: string, vrpId: string, decision: 'approved' | 'approved_with_exception' | 'sent_back', comment: string | null) => Promise<{ success?: boolean; message?: string }>
  reopenReviewAction: (vendorId: string, vrpId: string, reason: string) => Promise<{ success?: boolean; message?: string }>
}

const DECISION_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  submitted:                { label: 'Submitted',          bg: 'rgba(99,102,241,0.1)',   color: '#6366f1' },
  approved:                 { label: 'Approved',           bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception:  { label: 'Approved (Exc)',     bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  sent_back:                { label: 'Sent Back',          bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
}

export function ApprovalChain({
  vendorId,
  vendorReviewPackId,
  status,
  lockedAt,
  lockedByName,
  reopenReason,
  approvals,
  isSiteAdmin,
  submitForApprovalAction,
  approveReviewAction,
  reopenReviewAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [approverComment, setApproverComment] = useState('')
  const [showApproverForm, setShowApproverForm] = useState(false)
  const [reopenInput, setReopenInput] = useState('')
  const [showReopen, setShowReopen] = useState(false)

  const handleSubmitForApproval = () => {
    setError(null)
    startTransition(async () => {
      const r = await submitForApprovalAction(vendorId, vendorReviewPackId)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed')
    })
  }

  const handleApproverDecision = (decision: 'approved' | 'approved_with_exception' | 'sent_back') => {
    setError(null)
    startTransition(async () => {
      const r = await approveReviewAction(vendorId, vendorReviewPackId, decision, approverComment.trim() || null)
      if (r.success) {
        setShowApproverForm(false)
        setApproverComment('')
        router.refresh()
      } else setError(r.message ?? 'Failed')
    })
  }

  const handleReopen = () => {
    if (!reopenInput.trim()) { setError('Reason is required'); return }
    setError(null)
    startTransition(async () => {
      const r = await reopenReviewAction(vendorId, vendorReviewPackId, reopenInput.trim())
      if (r.success) {
        setShowReopen(false)
        setReopenInput('')
        router.refresh()
      } else setError(r.message ?? 'Failed')
    })
  }

  const isLocked = status === 'locked' || status === 'approved' || status === 'approved_with_exception'

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>Approval Chain</h3>
        {isLocked && lockedAt && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#059669' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5 7V5a3 3 0 016 0v2" />
            </svg>
            Locked {new Date(lockedAt).toLocaleDateString()}{lockedByName && ` by ${lockedByName}`}
          </div>
        )}
      </div>

      {/* Timeline of approval steps */}
      {approvals.length > 0 && (
        <div className="space-y-2">
          {approvals.map((a) => {
            const style = DECISION_STYLE[a.decision] ?? { label: a.decision, bg: 'rgba(148,163,184,0.15)', color: '#64748b' }
            return (
              <div key={a.id} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(108,93,211,0.03)' }}>
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: style.color }}
                >
                  {a.level}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: '#1e1550' }}>{a.user_name ?? 'Unknown'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ background: style.bg, color: style.color }}>
                      {style.label}
                    </span>
                    <span className="text-[10px]" style={{ color: '#a99fd8' }}>
                      {new Date(a.decided_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {a.comment && <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{a.comment}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reopen reason if it was reopened */}
      {reopenReason && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(245,158,11,0.05)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }}>
          <span className="font-bold">Reopened:</span> {reopenReason}
        </div>
      )}

      {/* Actions based on current status */}
      {status === 'in_progress' && (
        <button
          type="button"
          onClick={handleSubmitForApproval}
          disabled={isPending}
          className="text-xs font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending ? 'Submitting…' : 'Submit for Approval'}
        </button>
      )}

      {status === 'sent_back' && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: '#e11d48' }}>
            This review was sent back for revision. Make the requested changes, then re-submit.
          </p>
          <button
            type="button"
            onClick={handleSubmitForApproval}
            disabled={isPending}
            className="text-xs font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            {isPending ? 'Re-submitting…' : 'Re-submit for Approval'}
          </button>
        </div>
      )}

      {status === 'awaiting_approval' && !showApproverForm && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: '#8b7fd4' }}>
            This review is awaiting approval decision.
          </p>
          <button
            type="button"
            onClick={() => setShowApproverForm(true)}
            className="text-xs font-semibold px-4 py-2 rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            Make Decision
          </button>
        </div>
      )}

      {showApproverForm && (
        <div className="space-y-3 p-3 rounded-xl" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
          <textarea
            value={approverComment}
            onChange={(e) => setApproverComment(e.target.value)}
            rows={2}
            placeholder="Comment (optional for approval, required for send-back)…"
            className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => handleApproverDecision('approved')} disabled={isPending} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50" style={{ background: '#059669' }}>
              {isPending ? '…' : 'Approve'}
            </button>
            <button type="button" onClick={() => handleApproverDecision('approved_with_exception')} disabled={isPending} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
              {isPending ? '…' : 'Approve with Exception'}
            </button>
            <button type="button" onClick={() => handleApproverDecision('sent_back')} disabled={isPending} className="text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
              {isPending ? '…' : 'Send Back'}
            </button>
            <button type="button" onClick={() => setShowApproverForm(false)} className="text-xs px-3 py-1.5" style={{ color: '#a99fd8' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reopen button for locked reviews (admin only) */}
      {isLocked && isSiteAdmin && !showReopen && (
        <button
          type="button"
          onClick={() => setShowReopen(true)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.06)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          Reopen Review
        </button>
      )}

      {showReopen && (
        <div className="space-y-2 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <label className="block text-xs font-bold" style={{ color: '#d97706' }}>Reason for reopening (required):</label>
          <textarea
            value={reopenInput}
            onChange={(e) => setReopenInput(e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
            style={{ border: '1px solid rgba(245,158,11,0.2)', color: '#1e1550' }}
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleReopen} disabled={isPending} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50" style={{ background: '#d97706' }}>
              {isPending ? 'Reopening…' : 'Confirm Reopen'}
            </button>
            <button type="button" onClick={() => setShowReopen(false)} className="text-xs px-3 py-1.5" style={{ color: '#a99fd8' }}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}
    </div>
  )
}
