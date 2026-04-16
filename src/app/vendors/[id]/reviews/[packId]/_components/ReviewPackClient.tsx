'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import type { VendorReviewItem, ReviewItemDecision } from '@/types/review-pack'

const DECISIONS: { value: ReviewItemDecision; label: string; color: string; bg: string }[] = [
  { value: 'pass',               label: 'Pass',               color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  { value: 'fail',               label: 'Fail',               color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  { value: 'needs_follow_up',    label: 'Needs Follow-up',    color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  { value: 'na',                 label: 'N/A',                color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
  { value: 'exception_approved', label: 'Exception Approved', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
]

const FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'pass',        label: 'Passed' },
  { value: 'fail',        label: 'Failed' },
  { value: 'na',          label: 'N/A' },
] as const

type Filter = (typeof FILTERS)[number]['value']

interface Props {
  vendorId: string
  packId: string
  items: VendorReviewItem[]
  setDecisionAction: (
    vendorId: string,
    packId: string,
    itemId: string,
    decision: ReviewItemDecision,
    comment: string | null,
  ) => Promise<{ message?: string; success?: boolean; remediationId?: string }>
  aiAssistAction: (
    itemId: string,
  ) => Promise<{ suggestion?: ReviewItemDecision; rationale?: string; message?: string }>
  uploadEvidenceAction: (
    vendorId: string,
    evidenceId: string,
    formData: FormData,
  ) => Promise<{ message?: string; success?: boolean }>
}

export function ReviewPackClient({ vendorId, packId, items: initialItems, setDecisionAction, aiAssistAction, uploadEvidenceAction }: Props) {
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<Filter>('all')
  const [openItem, setOpenItem] = useState<string | null>(null)

  const visible = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.decision === filter)
  }, [items, filter])

  const counts = useMemo(() => {
    const total = items.length
    const passed = items.filter((i) => i.decision === 'pass').length
    const failed = items.filter((i) => i.decision === 'fail').length
    const not_started = items.filter((i) => i.decision === 'not_started').length
    const na = items.filter((i) => i.decision === 'na').length
    const applicable = total - na
    const pct = applicable > 0 ? Math.round((passed / applicable) * 100) : 0
    return { total, passed, failed, not_started, na, applicable, pct }
  }, [items])

  const [createdRemediation, setCreatedRemediation] = useState<{ itemId: string; remediationId: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelectedIds(new Set(visible.map((v) => v.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDecision = async (decision: ReviewItemDecision) => {
    const ids = Array.from(selectedIds)
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.id)
          ? { ...i, decision, decided_at: new Date().toISOString() }
          : i,
      ),
    )
    clearSelection()
    // Fire all in parallel
    await Promise.all(ids.map((id) => setDecisionAction(vendorId, packId, id, decision, null)))
  }

  const handleSetDecision = async (itemId: string, decision: ReviewItemDecision, comment: string | null) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, decision, reviewer_comment: comment, decided_at: new Date().toISOString() }
          : i,
      ),
    )
    const result = await setDecisionAction(vendorId, packId, itemId, decision, comment)
    if (!result.success) {
      window.location.reload()
      return
    }
    if (result.remediationId) {
      setCreatedRemediation({ itemId, remediationId: result.remediationId })
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, created_remediation_id: result.remediationId! } : i)),
      )
    }
  }

  return (
    <div className="space-y-4">
      {/* Remediation created banner */}
      {createdRemediation && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: 'rgba(225,29,72,0.05)', border: '1px solid rgba(225,29,72,0.15)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#e11d48' }} />
            <span className="text-xs font-semibold" style={{ color: '#be123c' }}>
              A remediation has been auto-created for the failed item.
            </span>
          </div>
          <Link
            href={`/issues/${createdRemediation.remediationId}`}
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: 'white', color: '#e11d48', border: '1px solid rgba(225,29,72,0.3)' }}
          >
            View Remediation →
          </Link>
        </div>
      )}

      {/* Summary bar */}
      <div
        className="rounded-2xl p-4 flex items-center gap-6"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Readiness</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: counts.pct === 100 ? '#059669' : '#6c5dd3' }}>
              {counts.pct}%
            </span>
            <span className="text-xs" style={{ color: '#a99fd8' }}>
              {counts.passed} / {counts.applicable} applicable
            </span>
          </div>
        </div>
        <div className="h-10 w-px" style={{ background: 'rgba(109,93,211,0.1)' }} />
        <SummaryStat label="Total"       count={counts.total}       color="#4a4270" />
        <SummaryStat label="Passed"      count={counts.passed}      color="#059669" />
        <SummaryStat label="Failed"      count={counts.failed}      color="#e11d48" />
        <SummaryStat label="Not Started" count={counts.not_started} color="#a99fd8" />
        <SummaryStat label="N/A"         count={counts.na}          color="#94a3b8" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className="text-xs font-medium px-3 py-1.5 rounded-full transition-all"
            style={
              filter === f.value
                ? { background: '#6c5dd3', color: 'white' }
                : { background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-xl sticky top-2 z-10"
          style={{ background: '#1c1c2e', color: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
        >
          <span className="text-xs font-semibold">
            {selectedIds.size} selected
          </span>
          <div className="h-5 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => handleBulkDecision('pass')}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: 'rgba(5,150,105,0.2)', color: '#10b981' }}
          >
            Mark Pass
          </button>
          <button
            type="button"
            onClick={() => handleBulkDecision('na')}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: 'rgba(148,163,184,0.2)', color: '#cbd5e1' }}
          >
            Mark N/A
          </button>
          <button
            type="button"
            onClick={() => handleBulkDecision('not_started')}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
          >
            Reset to Skip
          </button>
          <button type="button" onClick={selectAllVisible} className="ml-auto text-xs hover:underline opacity-80">
            Select all visible ({visible.length})
          </button>
          <button type="button" onClick={clearSelection} className="text-xs hover:underline opacity-80">
            Clear
          </button>
        </div>
      )}

      {/* Items */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm" style={{ color: '#a99fd8' }}>
            No items match this filter.
          </p>
        ) : (
          visible.map((item, idx) => (
            <ReviewItemRow
              key={item.id}
              vendorId={vendorId}
              item={item}
              isOpen={openItem === item.id}
              onToggle={() => setOpenItem(openItem === item.id ? null : item.id)}
              onSetDecision={(decision, comment) => handleSetDecision(item.id, decision, comment)}
              onAiAssist={() => aiAssistAction(item.id)}
              uploadEvidenceAction={uploadEvidenceAction}
              isLast={idx === visible.length - 1}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SummaryStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color }}>{count}</div>
    </div>
  )
}

// ─── Single item row + drawer ──────────────────────────────────────────────

function ReviewItemRow({
  vendorId,
  item,
  isOpen,
  onToggle,
  onSetDecision,
  onAiAssist,
  uploadEvidenceAction,
  isLast,
  isSelected,
  onToggleSelect,
}: {
  vendorId: string
  item: VendorReviewItem
  isOpen: boolean
  onToggle: () => void
  onSetDecision: (decision: ReviewItemDecision, comment: string | null) => Promise<void> | void
  onAiAssist: () => Promise<{ suggestion?: ReviewItemDecision; rationale?: string; message?: string }>
  uploadEvidenceAction: (
    vendorId: string,
    evidenceId: string,
    formData: FormData,
  ) => Promise<{ message?: string; success?: boolean }>
  isLast: boolean
  isSelected: boolean
  onToggleSelect: () => void
}) {
  const [comment, setComment] = useState(item.reviewer_comment ?? '')
  const [aiResult, setAiResult] = useState<{ suggestion?: ReviewItemDecision; rationale?: string } | null>(null)
  const [isAiPending, startAi] = useTransition()
  const [isPending, startDecision] = useTransition()
  const [isUploading, startUpload] = useTransition()
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const handleUpload = (formData: FormData) => {
    if (!item.linked_evidence_id) {
      setUploadMessage('No evidence requirement is linked to this review item.')
      return
    }
    setUploadMessage(null)
    startUpload(async () => {
      const r = await uploadEvidenceAction(vendorId, item.linked_evidence_id!, formData)
      if (r.success) setUploadMessage('Evidence uploaded successfully.')
      else setUploadMessage(r.message ?? 'Upload failed')
    })
  }

  const decisionStyle = DECISIONS.find((d) => d.value === item.decision)

  const handleAi = () => {
    setAiResult(null)
    startAi(async () => {
      const r = await onAiAssist()
      setAiResult(r)
    })
  }

  const handleDecide = (decision: ReviewItemDecision) => {
    startDecision(() => onSetDecision(decision, comment.trim() || null))
  }

  return (
    <div style={{ borderBottom: isLast ? undefined : '1px solid rgba(109,93,211,0.06)' }}>
      {/* Row header — clickable */}
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-[rgba(109,93,211,0.02)]"
        onClick={onToggle}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onToggleSelect()
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded shrink-0"
          style={{ accentColor: '#6c5dd3' }}
        />

        {/* Decision indicator */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: decisionStyle?.color ?? '#cbd5e1' }}
        />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>
            {item.requirement_name ?? 'Review item'}
          </div>
          {item.compliance_references && item.compliance_references.length > 0 && (
            <div className="text-[10px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: '#a99fd8' }}>
              {item.compliance_references.slice(0, 3).map((ref, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded font-mono"
                  style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}
                >
                  {ref.standard} {ref.reference}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Decision badge */}
        {decisionStyle && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
            style={{ background: decisionStyle.bg, color: decisionStyle.color }}
          >
            {decisionStyle.label}
          </span>
        )}

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#a99fd8" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>

      {/* Drawer */}
      {isOpen && (
        <div className="px-5 pb-4 pt-1 space-y-3" style={{ background: 'rgba(109,93,211,0.02)' }}>
          {/* Description */}
          {item.requirement_description && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#a99fd8' }}>
                What this requires
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#4a4270' }}>
                {item.requirement_description}
              </p>
            </div>
          )}

          {/* Compliance refs (full) */}
          {item.compliance_references && item.compliance_references.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
                Compliance References
              </summary>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {item.compliance_references.map((ref, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded font-mono text-[10px]"
                    style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3' }}
                  >
                    {ref.standard} — {ref.reference}
                  </span>
                ))}
              </div>
            </details>
          )}

          {/* Comment field */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
              Reviewer Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Add a comment (optional)…"
              className="mt-1 w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]"
              style={{ border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }}
            />
          </div>

          {/* Evidence upload (if this requirement has linked evidence) */}
          {item.linked_evidence_requirement_id && (
            <div className="rounded-lg p-2 flex items-center gap-2" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
              <span className="text-[10px] font-bold uppercase tracking-widest shrink-0" style={{ color: '#a99fd8' }}>
                Evidence:
              </span>
              <form action={handleUpload} className="flex items-center gap-2 flex-1">
                <input
                  type="file"
                  name="file"
                  required
                  className="text-xs flex-1"
                  style={{ color: '#4a4270' }}
                />
                <button
                  type="submit"
                  disabled={isUploading || !item.linked_evidence_id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: '#6c5dd3' }}
                  title={!item.linked_evidence_id ? 'No evidence row is linked yet — re-apply Review Packs from the Reviews tab' : ''}
                >
                  {isUploading ? 'Uploading…' : 'Upload'}
                </button>
              </form>
              {uploadMessage && (
                <span className="text-[10px]" style={{ color: uploadMessage.includes('success') ? '#059669' : '#e11d48' }}>
                  {uploadMessage}
                </span>
              )}
            </div>
          )}

          {/* Existing remediation link */}
          {item.created_remediation_id && (
            <div className="text-xs flex items-center gap-2">
              <span style={{ color: '#a99fd8' }}>Remediation:</span>
              <Link
                href={`/issues/${item.created_remediation_id}`}
                className="font-medium hover:underline"
                style={{ color: '#e11d48' }}
              >
                View open remediation →
              </Link>
            </div>
          )}

          {/* Decision buttons + AI Assist */}
          <div className="flex items-center gap-2 flex-wrap">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleDecide(d.value)}
                disabled={isPending}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={
                  item.decision === d.value
                    ? { background: d.color, color: 'white' }
                    : { background: d.bg, color: d.color, border: `1px solid ${d.color}33` }
                }
              >
                {d.label}
              </button>
            ))}

            <div className="ml-auto">
              <button
                type="button"
                onClick={handleAi}
                disabled={isAiPending}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgba(108,93,211,0.1), rgba(124,107,224,0.1))', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.2)' }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
                </svg>
                {isAiPending ? 'Analyzing…' : 'AI Assist'}
              </button>
            </div>
          </div>

          {/* AI suggestion result */}
          {aiResult && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{ background: 'rgba(108,93,211,0.05)', border: '1px solid rgba(108,93,211,0.15)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
                  AI Suggestion
                </span>
                {aiResult.suggestion && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      background: DECISIONS.find((d) => d.value === aiResult.suggestion)?.bg,
                      color: DECISIONS.find((d) => d.value === aiResult.suggestion)?.color,
                    }}
                  >
                    {DECISIONS.find((d) => d.value === aiResult.suggestion)?.label}
                  </span>
                )}
              </div>
              <p style={{ color: '#4a4270' }}>{aiResult.rationale}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
