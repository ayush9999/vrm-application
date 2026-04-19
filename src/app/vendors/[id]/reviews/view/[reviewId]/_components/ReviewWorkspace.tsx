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
  { value: 'pass',               label: 'Pass',       color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  { value: 'fail',               label: 'Fail',       color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  { value: 'needs_follow_up',    label: 'Follow-up',  color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  { value: 'exception_approved', label: 'Exception',  color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { value: 'rejected',           label: 'Rejected',   color: '#be123c', bg: 'rgba(190,18,60,0.1)' },
  { value: 'deferred',           label: 'Deferred',   color: '#0284c7', bg: 'rgba(14,165,233,0.1)' },
  { value: 'na',                 label: 'N/A',        color: '#64748b', bg: 'rgba(148,163,184,0.12)' },
]

const DECISION_LABEL: Record<string, { label: string; color: string }> = {
  not_started:        { label: 'Pending',    color: '#94a3b8' },
  pass:               { label: 'Pass',       color: '#059669' },
  fail:               { label: 'Fail',       color: '#e11d48' },
  na:                 { label: 'N/A',        color: '#64748b' },
  needs_follow_up:    { label: 'Follow-up',  color: '#d97706' },
  exception_approved: { label: 'Exception',  color: '#7c3aed' },
  rejected:           { label: 'Rejected',   color: '#be123c' },
  deferred:           { label: 'Deferred',   color: '#0284c7' },
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
  reopenReviewAction?: (vendorId: string, reviewId: string) => Promise<{ success?: boolean; message?: string }>
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReviewWorkspace({
  vendorId, review, packs, packItemsMap, orgUsers,
  setDecisionAction, aiAssistAction, uploadEvidenceAction,
  startReviewAction, submitForApprovalAction, approveReviewAction, reopenReviewAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [activePack, setActivePack] = useState(packs[0]?.id ?? '')
  const [itemsState, setItemsState] = useState(packItemsMap)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')
  const [exportSections, setExportSections] = useState({
    items: true, decisions: true, compliance: true, evidence: true, comments: false,
  })
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

  const handleReopen = () => {
    if (!reopenReviewAction) return
    if (!confirm('Are you sure you want to reopen this review? It will revert to in-progress and unlock all items.')) return
    setError(null)
    startTransition(async () => {
      const r = await reopenReviewAction(vendorId, review.id)
      if (r.success) router.refresh()
      else setError(r.message ?? 'Failed to reopen')
    })
  }

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const toggleAllCurrentItems = () => {
    const allIds = currentItems.map((i) => i.id)
    const allSelected = allIds.every((id) => selectedItems.has(id))
    if (allSelected) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(allIds))
    }
  }

  const handleBulkDecision = (decision: ReviewItemDecision) => {
    setError(null)
    setShowBulkMenu(false)
    const itemIds = Array.from(selectedItems)
    startTransition(async () => {
      for (const itemId of itemIds) {
        const r = await setDecisionAction(vendorId, activePack, itemId, decision, null)
        if (!r.success) {
          setError(r.message ?? 'Failed')
          return
        }
      }
      setItemsState((prev) => ({
        ...prev,
        [activePack]: prev[activePack].map((i) =>
          selectedItems.has(i.id) ? { ...i, decision } : i,
        ),
      }))
      setSelectedItems(new Set())
    })
  }

  const handleExport = async () => {
    const allItems: Array<{ packName: string; name: string; decision: string; comment: string | null; refs: string; evidence: string }> = []
    for (const pack of packs) {
      const items = itemsState[pack.id] ?? []
      for (const item of items) {
        allItems.push({
          packName: pack.review_pack_name ?? '',
          name: item.requirement_name ?? '',
          decision: (DECISION_LABEL[item.decision] ?? DECISION_LABEL.not_started).label,
          comment: exportSections.comments ? (item.reviewer_comment ?? '') : '',
          refs: exportSections.compliance ? (item.compliance_references?.map((r) => `${r.standard} ${r.reference}`).join('; ') ?? '') : '',
          evidence: exportSections.evidence ? (item.linked_evidence_name ? `${item.linked_evidence_name} (${item.linked_evidence_status ?? 'unknown'})` : '') : '',
        })
      }
    }

    if (exportFormat === 'csv') {
      const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      const headers = ['Pack', 'Requirement', 'Decision']
      if (exportSections.compliance) headers.push('Compliance Refs')
      if (exportSections.evidence) headers.push('Evidence')
      if (exportSections.comments) headers.push('Comment')

      const lines = [
        `# Review: ${review.review_code}`,
        `# Type: ${review.review_type}`,
        `# Status: ${review.status}`,
        `# Exported: ${new Date().toISOString()}`,
        '',
        headers.join(','),
        ...allItems.map((row) => {
          const cols = [esc(row.packName), esc(row.name), esc(row.decision)]
          if (exportSections.compliance) cols.push(esc(row.refs))
          if (exportSections.evidence) cols.push(esc(row.evidence))
          if (exportSections.comments) cols.push(esc(row.comment ?? ''))
          return cols.join(',')
        }),
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${review.review_code}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pw = doc.internal.pageSize.getWidth()

      doc.setFontSize(16)
      doc.setTextColor(30, 21, 80)
      doc.text(review.review_code, 14, 16)
      doc.setFontSize(9)
      doc.setTextColor(139, 127, 212)
      doc.text(`Type: ${review.review_type} · Status: ${review.status} · Exported: ${new Date().toLocaleString()}`, 14, 22)

      const head = ['Pack', 'Requirement', 'Decision']
      if (exportSections.compliance) head.push('Compliance')
      if (exportSections.evidence) head.push('Evidence')
      if (exportSections.comments) head.push('Comment')

      const body = allItems.map((row) => {
        const cols = [row.packName, row.name, row.decision]
        if (exportSections.compliance) cols.push(row.refs)
        if (exportSections.evidence) cols.push(row.evidence)
        if (exportSections.comments) cols.push(row.comment ?? '')
        return cols
      })

      autoTable(doc, {
        startY: 28,
        head: [head],
        body,
        theme: 'grid',
        headStyles: { fillColor: [248, 247, 252], textColor: [108, 93, 211], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: [30, 21, 80], cellPadding: 2 },
        alternateRowStyles: { fillColor: [252, 251, 255] },
        margin: { left: 14, right: 14 },
      })

      const pageCount = doc.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFontSize(7)
        doc.setTextColor(169, 159, 216)
        doc.text(`VRM · ${review.review_code} · Page ${p}/${pageCount}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
      }
      doc.save(`${review.review_code}-${new Date().toISOString().split('T')[0]}.pdf`)
    }
    setShowExport(false)
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

        {/* Right: readiness + export */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Export button */}
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
          >
            ↓ Export
          </button>

          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums" style={{ color: stats.pct >= 80 ? '#059669' : stats.pct >= 50 ? '#6c5dd3' : '#d97706' }}>
              {stats.pct}%
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>
              {stats.passed}/{stats.total} complete
            </div>
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
            {review.status === 'submitted' && <>Review submitted. Approve, send back, or approve with exception.</>}
            {isLocked && <>Review finalized. All items are read-only.{reopenReviewAction && <> Need changes? Reopen the review.</>}</>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
            {review.status === 'submitted' && (
              <>
                <button onClick={() => handleApprove('sent_back')} disabled={isPending}
                  className="text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-50"
                  style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }}>
                  {isPending ? '…' : 'Send Back'}
                </button>
                <button onClick={() => handleApprove('approved_with_exception')} disabled={isPending}
                  className="text-sm font-semibold px-4 py-2 rounded-full text-white disabled:opacity-50"
                  style={{ background: '#7c3aed' }}>
                  {isPending ? '…' : 'Approve with Exception'}
                </button>
                <button onClick={() => handleApprove('approved')} disabled={isPending}
                  className="text-sm font-semibold px-5 py-2 rounded-full text-white disabled:opacity-50"
                  style={{ background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.3)' }}>
                  {isPending ? '…' : 'Approve'}
                </button>
              </>
            )}
            {isLocked && reopenReviewAction && (
              <button onClick={handleReopen} disabled={isPending}
                className="text-sm font-medium px-4 py-2 rounded-full disabled:opacity-50"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}>
                {isPending ? 'Reopening…' : 'Reopen Review'}
              </button>
            )}
          </div>
        </div>

        {/* Comment field for submitted state */}
        {review.status === 'submitted' && (
          <div className="px-5 pb-3">
            <input
              value={approverComment}
              onChange={(e) => setApproverComment(e.target.value)}
              placeholder="Add a comment (optional for approval, recommended for send-back)…"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ border: '1px solid rgba(109,93,211,0.15)', color: '#1e1550' }}
            />
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
                onClick={() => { setActivePack(pack.id); setOpenItemId(null); setSelectedItems(new Set()) }}
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

      {/* ── Bulk toolbar (when items selected) ── */}
      {isReviewing && selectedItems.size > 0 && (
        <div
          className="rounded-xl mb-3 px-4 py-2.5 flex items-center gap-3"
          style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.12)' }}
        >
          <span className="text-xs font-semibold" style={{ color: '#6c5dd3' }}>
            {selectedItems.size} selected
          </span>
          <span className="text-[10px]" style={{ color: '#8b7fd4' }}>Mark as:</span>
          {DECISION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleBulkDecision(opt.value)}
              disabled={isPending}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full disabled:opacity-50 transition-all"
              style={{ background: opt.bg, color: opt.color, border: `1px solid ${opt.color}25` }}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setSelectedItems(new Set())}
            className="text-[10px] ml-auto"
            style={{ color: '#a99fd8' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Items list ── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
      >
        {/* Header row with select all */}
        {isReviewing && currentItems.length > 0 && (
          <div
            className="flex items-center gap-2.5 px-4 py-2"
            style={{ background: 'rgba(109,93,211,0.02)', borderBottom: '1px solid rgba(109,93,211,0.06)' }}
          >
            <input
              type="checkbox"
              checked={currentItems.length > 0 && currentItems.every((i) => selectedItems.has(i.id))}
              onChange={toggleAllCurrentItems}
              className="w-3.5 h-3.5 rounded"
              style={{ accentColor: '#6c5dd3' }}
            />
            <span className="text-[10px] font-medium" style={{ color: '#8b7fd4' }}>Select all</span>
          </div>
        )}

        {/* Progress bar */}
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
            const refs = item.compliance_references ?? []
            const hasEvidence = !!item.linked_evidence_name
            const evidenceColor = item.linked_evidence_status === 'approved' ? '#059669'
              : item.linked_evidence_status === 'missing' || item.linked_evidence_status === 'rejected' ? '#e11d48'
              : item.linked_evidence_status === 'uploaded' || item.linked_evidence_status === 'under_review' ? '#d97706'
              : '#94a3b8'
            const isSelected = selectedItems.has(item.id)

            return (
              <div key={item.id} style={{ borderBottom: i < currentItems.length - 1 ? '1px solid rgba(109,93,211,0.06)' : 'none', background: isSelected ? 'rgba(109,93,211,0.03)' : 'transparent' }}>
                {/* Item row */}
                <div className="flex items-center gap-2.5 px-4 py-3 hover:bg-[rgba(109,93,211,0.02)] transition-colors">
                  {/* Checkbox (only when reviewing) */}
                  {isReviewing && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(item.id)}
                      className="w-3.5 h-3.5 rounded shrink-0"
                      style={{ accentColor: '#6c5dd3' }}
                    />
                  )}

                  {/* Decision indicator */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dec.color }} />

                  {/* Item name — clickable to expand */}
                  <button
                    type="button"
                    onClick={() => setOpenItemId(isOpen ? null : item.id)}
                    className="flex-1 text-sm text-left min-w-0 truncate"
                    style={{ color: '#1e1550' }}
                  >
                    {item.requirement_name}
                  </button>

                  {/* Compliance refs */}
                  {refs.length > 0 && (
                    <span className="flex items-center gap-1 shrink-0">
                      {refs.slice(0, 2).map((ref, ri) => (
                        <span key={ri} className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                          {ref.standard} {ref.reference}
                        </span>
                      ))}
                      {refs.length > 2 && (
                        <span className="text-[8px]" style={{ color: '#a99fd8' }}>+{refs.length - 2}</span>
                      )}
                    </span>
                  )}

                  {/* Evidence status dot */}
                  {hasEvidence && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: evidenceColor }}
                      title={`Evidence: ${item.linked_evidence_status}`}
                    />
                  )}

                  {/* Decision badge — clickable dropdown when reviewing */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isReviewing) setOpenItemId(openItemId === item.id ? null : item.id)
                      }}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase transition-all"
                      style={{
                        background: `${dec.color}14`,
                        color: dec.color,
                        cursor: isReviewing ? 'pointer' : 'default',
                        border: isReviewing ? `1px solid ${dec.color}30` : 'none',
                      }}
                    >
                      {dec.label} {isReviewing && '▾'}
                    </button>
                  </div>
                </div>

                {/* Expanded: decision options + details */}
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 space-y-2.5" style={{ background: 'rgba(109,93,211,0.015)' }}>
                    {/* Decision grid (when reviewing) */}
                    {isReviewing && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DECISION_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleDecision(activePack, item.id, opt.value)}
                            disabled={isPending}
                            className="text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                            style={
                              item.decision === opt.value
                                ? { background: opt.color, color: 'white' }
                                : { background: opt.bg, color: opt.color, border: `1px solid ${opt.color}25` }
                            }
                          >
                            {opt.label}
                          </button>
                        ))}
                        {item.creates_remediation_on_fail && (
                          <span className="text-[9px] ml-auto" style={{ color: '#d97706' }}>
                            Failing creates a remediation
                          </span>
                        )}
                      </div>
                    )}

                    {/* Evidence + comment row */}
                    <div className="flex items-center gap-4 flex-wrap text-[11px]">
                      {hasEvidence && (
                        <span style={{ color: '#4a4270' }}>
                          Evidence: <strong>{item.linked_evidence_name}</strong>
                          <span className="ml-1 text-[9px] font-bold uppercase" style={{ color: evidenceColor }}>
                            {item.linked_evidence_status}
                          </span>
                          {item.linked_evidence_id && (
                            <Link
                              href={`/vendors/${vendorId}?tab=evidence`}
                              className="ml-1.5 font-medium hover:opacity-70"
                              style={{ color: '#6c5dd3' }}
                            >
                              View
                            </Link>
                          )}
                        </span>
                      )}
                      {item.reviewer_comment && (
                        <span className="italic" style={{ color: '#6a6860' }}>
                          &ldquo;{item.reviewer_comment}&rdquo;
                        </span>
                      )}
                      {isLocked && isDecided && (
                        <span style={{ color: '#8b7fd4' }}>
                          <strong style={{ color: dec.color }}>{dec.label}</strong>
                          {item.decided_at && <> · {new Date(item.decided_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
                        </span>
                      )}
                    </div>
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

      {/* ── Export Modal ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: 'white', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold" style={{ color: '#1e1550' }}>Export Review</h3>
              <p className="text-xs mt-0.5" style={{ color: '#8b7fd4' }}>
                {review.review_code} · {packs.length} pack{packs.length !== 1 ? 's' : ''} · {stats.total} items
              </p>
            </div>

            {/* Format */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8b7fd4' }}>Format</div>
              <div className="flex items-center gap-2">
                {(['csv', 'pdf'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setExportFormat(f)}
                    className="text-xs font-medium px-4 py-1.5 rounded-full flex-1 uppercase"
                    style={exportFormat === f ? { background: '#6c5dd3', color: 'white' } : { background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* What to include */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#8b7fd4' }}>Include</div>
              <div className="space-y-1">
                {[
                  { key: 'items' as const, label: 'Review items & decisions', locked: true },
                  { key: 'decisions' as const, label: 'Decision status per item', locked: true },
                  { key: 'compliance' as const, label: 'Compliance references' },
                  { key: 'evidence' as const, label: 'Evidence status' },
                  { key: 'comments' as const, label: 'Reviewer comments' },
                ].map((s) => (
                  <label key={s.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={exportSections[s.key]}
                      onChange={() => {
                        if (s.locked) return
                        setExportSections((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                      }}
                      disabled={s.locked}
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: '#6c5dd3' }}
                    />
                    <span className="text-xs" style={{ color: s.locked ? '#a99fd8' : '#4a4270' }}>{s.label}</span>
                    {s.locked && <span className="text-[9px]" style={{ color: '#c4bae8' }}>Required</span>}
                  </label>
                ))}
              </div>
            </div>

            {/* Packs included */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8b7fd4' }}>Packs included</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {packs.map((p) => (
                  <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}>
                    {p.review_pack_name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(109,93,211,0.06)' }}>
              <button onClick={() => setShowExport(false)} className="text-xs px-3 py-1.5" style={{ color: '#a99fd8' }}>
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isPending}
                className="text-xs font-semibold px-4 py-1.5 rounded-full text-white disabled:opacity-50"
                style={{ background: '#6c5dd3' }}
              >
                {isPending ? 'Exporting…' : `↓ Download ${exportFormat.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
