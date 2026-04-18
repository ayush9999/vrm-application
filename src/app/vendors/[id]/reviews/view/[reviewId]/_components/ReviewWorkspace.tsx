'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type {
  VendorReview,
  VendorReviewPack,
  VendorReviewItem,
  VendorReviewStatus,
  ReviewItemDecision,
  ReviewType,
} from '@/types/review-pack'
import type { OrgUser } from '@/lib/db/organizations'

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'start', label: 'Start' },
  { key: 'review', label: 'Review' },
  { key: 'submit', label: 'Submit' },
  { key: 'approve', label: 'Approve' },
  { key: 'done', label: 'Done' },
]

function getActiveStep(status: VendorReviewStatus): number {
  if (status === 'not_started') return 0
  if (status === 'in_progress') return 1
  if (status === 'submitted') return 2
  if (status === 'approved' || status === 'approved_with_exception' || status === 'done') return 4
  return 1
}

const TYPE_STYLE: Record<ReviewType, { label: string; bg: string; color: string }> = {
  onboarding: { label: 'Onboarding', bg: 'rgba(109,93,211,0.1)', color: '#6c5dd3' },
  scheduled: { label: 'Scheduled', bg: 'rgba(14,165,233,0.1)', color: '#0284c7' },
  on_demand: { label: 'On Demand', bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
}

const DECISION_OPTIONS: { value: ReviewItemDecision; label: string; color: string; bg: string }[] = [
  { value: 'pass', label: 'Pass', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  { value: 'fail', label: 'Fail', color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  { value: 'needs_follow_up', label: 'Follow-up', color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  { value: 'na', label: 'N/A', color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
]

const DECISION_LABEL: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Pending', color: '#94a3b8' },
  pass: { label: 'Pass', color: '#059669' },
  fail: { label: 'Fail', color: '#e11d48' },
  na: { label: 'N/A', color: '#64748b' },
  needs_follow_up: { label: 'Follow-up', color: '#d97706' },
  exception_approved: { label: 'Exception', color: '#7c3aed' },
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  vendorId: string
  review: VendorReview
  packs: VendorReviewPack[]
  packItemsMap: Record<string, VendorReviewItem[]>
  orgUsers: OrgUser[]
  setDecisionAction: (
    vendorId: string, packId: string, itemId: string,
    decision: ReviewItemDecision, comment: string | null,
  ) => Promise<{ success?: boolean; message?: string }>
  aiAssistAction: (itemId: string) => Promise<{ suggestion?: ReviewItemDecision; rationale?: string; message?: string }>
  uploadEvidenceAction: (vendorId: string, evidenceId: string, formData: FormData) => Promise<{ success?: boolean; message?: string }>
  startReviewAction: (vendorId: string, reviewId: string) => Promise<{ success?: boolean; message?: string }>
  submitForApprovalAction: (vendorId: string, reviewId: string) => Promise<{ success?: boolean; message?: string }>
  approveReviewAction: (vendorId: string, reviewId: string, decision: 'approved' | 'approved_with_exception' | 'sent_back', comment: string | null) => Promise<{ success?: boolean; message?: string }>
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReviewWorkspace({
  vendorId, review, packs, packItemsMap, orgUsers,
  setDecisionAction, aiAssistAction, uploadEvidenceAction,
  startReviewAction, submitForApprovalAction, approveReviewAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [activePack, setActivePack] = useState(packs[0]?.id ?? '')
  const [itemsState, setItemsState] = useState(packItemsMap)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [approverComment, setApproverComment] = useState('')

  const activeStep = getActiveStep(review.status)
  const isLocked = ['approved', 'approved_with_exception', 'done'].includes(review.status)
  const isReviewing = review.status === 'in_progress'
  const typeSty = TYPE_STYLE[review.review_type] ?? TYPE_STYLE.on_demand

  // Aggregate stats across all packs
  const stats = useMemo(() => {
    let total = 0, passed = 0, failed = 0, pending = 0
    for (const items of Object.values(itemsState)) {
      for (const item of items) {
        if (item.decision === 'na') continue
        total++
        if (item.decision === 'pass' || item.decision === 'exception_approved') passed++
        else if (item.decision === 'fail') failed++
        else pending++
      }
    }
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0
    return { total, passed, failed, pending, pct }
  }, [itemsState])

  // Per-pack stats for the tab bar
  const packStats = useMemo(() => {
    const map: Record<string, { total: number; done: number; pct: number }> = {}
    for (const pack of packs) {
      const items = itemsState[pack.id] ?? []
      const applicable = items.filter((i) => i.decision !== 'na').length
      const done = items.filter((i) => i.decision === 'pass' || i.decision === 'exception_approved').length
      map[pack.id] = { total: applicable, done, pct: applicable > 0 ? Math.round((done / applicable) * 100) : 0 }
    }
    return map
  }, [itemsState, packs])

  const currentItems = itemsState[activePack] ?? []

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleStart = () => {
    setError(null)
    startTransition(async () => {
      const r = await startReviewAction(vendorId, review.id)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed to start review')
    })
  }

  const handleSubmit = () => {
    setError(null)
    startTransition(async () => {
      const r = await submitForApprovalAction(vendorId, review.id)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed to submit')
    })
  }

  const handleApprove = (decision: 'approved' | 'approved_with_exception' | 'sent_back') => {
    setError(null)
    startTransition(async () => {
      const r = await approveReviewAction(vendorId, review.id, decision, approverComment.trim() || null)
      if (r.success) { setShowApproveForm(false); router.refresh() }
      else setError(r.message ?? 'Failed')
    })
  }

  const handleDecision = (packId: string, itemId: string, decision: ReviewItemDecision) => {
    setError(null)
    startTransition(async () => {
      const r = await setDecisionAction(vendorId, packId, itemId, decision, null)
      if (r.success) {
        setItemsState((prev) => ({
          ...prev,
          [packId]: prev[packId].map((i) => i.id === itemId ? { ...i, decision } : i),
        }))
      } else {
        setError(r.message ?? 'Failed')
      }
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
              {review.review_code}
            </h1>
            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded" style={{ background: typeSty.bg, color: typeSty.color }}>
              {typeSty.label}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            {review.reviewer_name && <>Reviewer: {review.reviewer_name}</>}
            {review.approver_name && <> · Approver: {review.approver_name}</>}
            {review.due_at && <> · Due: {new Date(review.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</>}
          </p>
        </div>

        {/* Overall readiness */}
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold tabular-nums" style={{ color: stats.pct >= 80 ? '#059669' : stats.pct >= 50 ? '#6c5dd3' : '#d97706' }}>
            {stats.pct}%
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>
            {stats.passed}/{stats.total} complete
          </div>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div
        className="rounded-xl mb-5 overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 1px 4px rgba(109,93,211,0.04)' }}
      >
        <div className="flex items-center px-5 py-3" style={{ background: 'rgba(109,93,211,0.02)', borderBottom: '1px solid rgba(109,93,211,0.06)' }}>
          {STEPS.map((step, i) => {
            const isDone = i < activeStep
            const isCurrent = i === activeStep
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={
                      isDone ? { background: '#059669', color: 'white' }
                      : isCurrent ? { background: '#6c5dd3', color: 'white', boxShadow: '0 0 0 3px rgba(108,93,211,0.2)' }
                      : { background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
                    }
                  >
                    {isDone ? '✓' : i + 1}
                  </span>
                  <span className="text-[11px] font-semibold hidden sm:inline" style={{ color: isDone ? '#059669' : isCurrent ? '#6c5dd3' : '#c4bae8' }}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 h-px" style={{ background: isDone ? '#059669' : 'rgba(148,163,184,0.15)' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Action bar */}
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="text-sm flex-1" style={{ color: '#4a4270' }}>
            {review.status === 'not_started' && <>Click <strong>Start Review</strong> to begin reviewing all packs.</>}
            {review.status === 'in_progress' && <>{stats.pending > 0 ? <><strong>{stats.pending}</strong> items remaining. </> : <>All items reviewed. </>}Submit when ready.</>}
            {review.status === 'submitted' && <>Waiting for approver decision.</>}
            {isLocked && <>Review finalized. All items are read-only.</>}
          </div>

          {review.status === 'not_started' && (
            <button onClick={handleStart} disabled={isPending}
              className="text-sm font-semibold px-6 py-2.5 rounded-full text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}>
              {isPending ? 'Starting…' : 'Start Review'}
            </button>
          )}
          {review.status === 'in_progress' && (
            <button onClick={handleSubmit} disabled={isPending}
              className="text-sm font-semibold px-6 py-2.5 rounded-full text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}>
              {isPending ? 'Submitting…' : 'Submit for Approval'}
            </button>
          )}
          {review.status === 'submitted' && !showApproveForm && (
            <button onClick={() => setShowApproveForm(true)}
              className="text-sm font-semibold px-6 py-2.5 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}>
              Review & Approve
            </button>
          )}
        </div>

        {/* Approve form */}
        {showApproveForm && (
          <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
            <textarea value={approverComment} onChange={(e) => setApproverComment(e.target.value)}
              rows={2} placeholder="Comment (optional for approval, recommended for send-back)…"
              className="w-full rounded-lg px-3 py-2 text-sm mt-3 focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }} />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => handleApprove('approved')} disabled={isPending}
                className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#059669' }}>
                Approve
              </button>
              <button onClick={() => handleApprove('approved_with_exception')} disabled={isPending}
                className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
                Approve with Exception
              </button>
              <button onClick={() => handleApprove('sent_back')} disabled={isPending}
                className="text-sm font-semibold px-5 py-2 rounded-full disabled:opacity-50"
                style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                Send Back
              </button>
              <button onClick={() => setShowApproveForm(false)} className="text-sm px-3 py-2" style={{ color: '#a99fd8' }}>Cancel</button>
            </div>
          </div>
        )}

        {error && <div className="px-5 pb-3"><p className="text-xs" style={{ color: '#e11d48' }}>{error}</p></div>}
      </div>

      {/* ── Pack tabs ── */}
      {packs.length > 1 && (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {packs.map((pack) => {
            const ps = packStats[pack.id] ?? { total: 0, done: 0, pct: 0 }
            const isActive = activePack === pack.id
            return (
              <button
                key={pack.id}
                onClick={() => { setActivePack(pack.id); setOpenItemId(null) }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0"
                style={isActive
                  ? { background: '#6c5dd3', color: 'white' }
                  : { background: 'rgba(109,93,211,0.04)', color: '#4a4270', border: '1px solid rgba(109,93,211,0.08)' }
                }
              >
                {pack.review_pack_name ?? 'Pack'}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={isActive
                    ? { background: 'rgba(255,255,255,0.2)', color: 'white' }
                    : { background: ps.pct === 100 ? 'rgba(5,150,105,0.1)' : 'rgba(109,93,211,0.08)', color: ps.pct === 100 ? '#059669' : '#6c5dd3' }
                  }
                >
                  {ps.done}/{ps.total}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Single pack header (when only 1 pack) ── */}
      {packs.length === 1 && packs[0] && (
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
            {packs[0].review_pack_name}
          </span>
          {packs[0].review_pack_code && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}>
              {packs[0].review_pack_code}
            </span>
          )}
        </div>
      )}

      {/* ── Items list ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
      >
        {/* Mini progress bar at top of card */}
        <div className="h-1" style={{ background: 'rgba(109,93,211,0.04)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${packStats[activePack]?.pct ?? 0}%`,
              background: (packStats[activePack]?.pct ?? 0) === 100
                ? '#059669'
                : 'linear-gradient(90deg, #6c5dd3, #7c6be0)',
            }}
          />
        </div>

        {currentItems.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm" style={{ color: '#a99fd8' }}>
            No review items in this pack.
          </div>
        ) : (
          currentItems.map((item, i) => {
            const dec = DECISION_LABEL[item.decision] ?? DECISION_LABEL.not_started
            const isOpen = openItemId === item.id
            const isDecided = item.decision !== 'not_started'

            return (
              <div key={item.id} style={{ borderBottom: i < currentItems.length - 1 ? '1px solid rgba(109,93,211,0.06)' : 'none' }}>
                {/* Item row */}
                <button
                  type="button"
                  onClick={() => setOpenItemId(isOpen ? null : item.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[rgba(109,93,211,0.02)] transition-colors"
                >
                  {/* Decision indicator */}
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: dec.color }}
                  />

                  {/* Item name */}
                  <span className="flex-1 text-sm min-w-0" style={{ color: '#1e1550' }}>
                    {item.requirement_name}
                    {item.requirement_description && (
                      <span className="text-[11px] ml-2" style={{ color: '#a99fd8' }}>
                        {item.requirement_description.substring(0, 60)}{item.requirement_description.length > 60 ? '…' : ''}
                      </span>
                    )}
                  </span>

                  {/* Compliance refs */}
                  {item.compliance_references && item.compliance_references.length > 0 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                      {item.compliance_references[0].standard} {item.compliance_references[0].reference}
                    </span>
                  )}

                  {/* Decision badge */}
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0"
                    style={{ background: `${dec.color}14`, color: dec.color }}
                  >
                    {dec.label}
                  </span>

                  {/* Chevron */}
                  <span className="text-xs shrink-0 transition-transform" style={{ color: '#c4bae8', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    ▸
                  </span>
                </button>

                {/* Expanded: decision buttons */}
                {isOpen && isReviewing && (
                  <div className="px-5 pb-4 pt-1 flex items-center gap-2 flex-wrap" style={{ background: 'rgba(109,93,211,0.015)' }}>
                    <span className="text-[11px] mr-1" style={{ color: '#8b7fd4' }}>Decision:</span>
                    {DECISION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleDecision(activePack, item.id, opt.value)}
                        disabled={isPending}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                        style={
                          item.decision === opt.value
                            ? { background: opt.color, color: 'white' }
                            : { background: opt.bg, color: opt.color, border: `1px solid ${opt.color}30` }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}

                    {/* Linked evidence */}
                    {item.linked_evidence_name && (
                      <span className="text-[10px] ml-auto" style={{ color: '#8b7fd4' }}>
                        Evidence: <strong>{item.linked_evidence_name}</strong>
                        {item.linked_evidence_status && (
                          <span className="ml-1 uppercase font-bold" style={{ color: item.linked_evidence_status === 'approved' ? '#059669' : '#d97706' }}>
                            {item.linked_evidence_status}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded but locked: show decision info */}
                {isOpen && isLocked && isDecided && (
                  <div className="px-5 pb-3 pt-1 text-xs" style={{ color: '#8b7fd4', background: 'rgba(109,93,211,0.015)' }}>
                    Decision: <strong style={{ color: dec.color }}>{dec.label}</strong>
                    {item.reviewer_comment && <> · {item.reviewer_comment}</>}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Sticky bottom bar (when reviewing) ── */}
      {isReviewing && stats.pending > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-4 px-6 py-3"
          style={{ background: 'rgba(255,255,255,0.95)', borderTop: '1px solid rgba(109,93,211,0.1)', backdropFilter: 'blur(8px)' }}
        >
          <div className="text-sm" style={{ color: '#4a4270' }}>
            <strong>{stats.passed + stats.failed}</strong> of <strong>{stats.total}</strong> items reviewed
            {stats.failed > 0 && <span style={{ color: '#e11d48' }}> · {stats.failed} failed</span>}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ width: 120, background: 'rgba(109,93,211,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${stats.pct}%`, background: stats.pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }}
            />
          </div>
          {stats.pending === 0 && (
            <button onClick={handleSubmit} disabled={isPending}
              className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
              style={{ background: '#6c5dd3' }}>
              Submit for Approval
            </button>
          )}
        </div>
      )}
    </div>
  )
}
