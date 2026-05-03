'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { EvidenceByPack, EvidenceRow, EvidenceVersion } from '@/lib/evidence-ui'
import { computeEvidenceUiStatus } from '@/lib/evidence-ui'
import type { EvidenceStatus } from '@/types/review-pack'
import type { EvidenceRequestSummary, EvidenceRequest, EvidenceRequestItemStatus } from '@/lib/db/evidence-requests'

interface ActiveRequestEntry {
  request_id: string
  sent_at: string
  status: EvidenceRequestItemStatus
  replied_at: string | null
}

interface EvidenceTabProps {
  vendorId: string
  vendorName: string
  vendorPrimaryEmail: string | null
  groups: EvidenceByPack[]
  requests: EvidenceRequestSummary[]
  activeRequestByDoc: Record<string, ActiveRequestEntry>
  uploadEvidenceAction: (
    vendorId: string,
    evidenceId: string,
    formData: FormData,
  ) => Promise<{ message?: string; success?: boolean }>
  setEvidenceStatusAction: (
    vendorId: string,
    evidenceId: string,
    status: EvidenceStatus,
    comment: string | null,
  ) => Promise<{ message?: string; success?: boolean }>
  requestEvidenceAction: (
    vendorId: string,
    evidenceId: string,
  ) => Promise<{ message?: string; success?: boolean }>
  getVersionsAction: (
    vendorId: string,
    evidenceId: string,
  ) => Promise<{ versions?: EvidenceVersion[]; message?: string }>
  getDownloadUrlAction: (
    fileKey: string,
  ) => Promise<{ url?: string; message?: string }>
  createRequestAction: (
    vendorId: string,
    input: {
      vendorDocumentIds: string[]
      message: string | null
      dueDate: string | null
      recipientEmails: string[]
      expiryDays: number
    },
  ) => Promise<{ url?: string; request?: EvidenceRequest; message?: string }>
  cancelRequestAction: (
    vendorId: string,
    requestId: string,
  ) => Promise<{ success?: boolean; message?: string }>
  deleteRequestAction: (
    vendorId: string,
    requestId: string,
  ) => Promise<{ success?: boolean; message?: string }>
}

// All status options surfaced through the status-badge dropdown.
const ALL_STATUS_OPTIONS: { value: EvidenceStatus; label: string; color: string; bg: string }[] = [
  { value: 'approved',     label: 'Approved',     color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  { value: 'rejected',     label: 'Rejected',     color: '#e11d48', bg: 'rgba(225,29,72,0.1)' },
  { value: 'under_review', label: 'Under review', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { value: 'waived',       label: 'Waived',       color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
]

export function EvidenceTab({
  vendorId,
  vendorName,
  vendorPrimaryEmail,
  groups,
  requests,
  activeRequestByDoc,
  uploadEvidenceAction,
  setEvidenceStatusAction,
  requestEvidenceAction,
  getVersionsAction,
  getDownloadUrlAction,
  createRequestAction,
  cancelRequestAction,
  deleteRequestAction,
}: EvidenceTabProps) {
  const [requestModalOpen, setRequestModalOpen] = useState(false)

  const totalRequirements = useMemo(
    () => groups.reduce((s, g) => s + g.rows.length, 0),
    [groups],
  )

  if (groups.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'white', border: '1px dashed rgba(109,93,211,0.2)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: '#1e1550' }}>No evidence requirements yet</p>
        <p className="text-xs" style={{ color: '#6b5fa8' }}>
          Evidence requirements appear here once Review Packs are assigned to this vendor.
          Go to the Reviews tab to apply Review Packs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: '#6b5fa8' }}>
          {groups.length} pack{groups.length === 1 ? '' : 's'} · {totalRequirements} requirement{totalRequirements === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={() => setRequestModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ background: '#6c5dd3' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2L7.5 8.5M14 2l-4.5 12-2-5.5L2 6l12-4z" />
          </svg>
          Request from vendor
        </button>
      </div>

      {/* Request history (collapsible) */}
      {requests.length > 0 && (
        <RequestsHistoryCard
          vendorId={vendorId}
          requests={requests}
          cancelAction={cancelRequestAction}
          deleteAction={deleteRequestAction}
        />
      )}

      {groups.map((group) => (
        <PackGroup
          key={group.pack_id ?? '__unlinked__'}
          vendorId={vendorId}
          group={group}
          activeRequestByDoc={activeRequestByDoc}
          uploadAction={uploadEvidenceAction}
          setStatusAction={setEvidenceStatusAction}
          requestAction={requestEvidenceAction}
          getVersionsAction={getVersionsAction}
          getDownloadUrlAction={getDownloadUrlAction}
        />
      ))}

      {requestModalOpen && (
        <RequestEvidenceModal
          vendorId={vendorId}
          vendorName={vendorName}
          vendorPrimaryEmail={vendorPrimaryEmail}
          groups={groups}
          activeRequestByDoc={activeRequestByDoc}
          createAction={createRequestAction}
          onClose={() => setRequestModalOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Requests history card ───────────────────────────────────────────────────

function RequestsHistoryCard({
  vendorId,
  requests,
  cancelAction,
  deleteAction,
}: {
  vendorId: string
  requests: EvidenceRequestSummary[]
  cancelAction: EvidenceTabProps['cancelRequestAction']
  deleteAction: EvidenceTabProps['deleteRequestAction']
}) {
  const [expanded, setExpanded] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const openCount = requests.filter((r) => r.status === 'sent' || r.status === 'partially_replied').length
  const completedCount = requests.filter((r) => r.status === 'completed').length

  const handleCancel = (requestId: string) => {
    if (!confirm('Cancel this request? The portal link will stop working.')) return
    setCancellingId(requestId)
    startTransition(async () => {
      await cancelAction(vendorId, requestId)
      setCancellingId(null)
    })
  }

  const handleDelete = (requestId: string) => {
    if (!confirm('Delete this request? This removes it from the history.')) return
    setDeletingId(requestId)
    startTransition(async () => {
      await deleteAction(vendorId, requestId)
      setDeletingId(null)
    })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)', background: 'white' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-[rgba(109,93,211,0.02)]"
        style={{ background: 'rgba(109,93,211,0.04)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6c5dd3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 4.5l5.5 4 5.5-4" />
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4a4270' }}>
          Requests
        </span>
        <span className="text-xs" style={{ color: '#6b5fa8' }}>
          {openCount} open · {completedCount} completed
        </span>
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#6b5fa8" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className="ml-auto transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="divide-y divide-[rgba(109,93,211,0.06)]">
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              onCancel={() => handleCancel(r.id)}
              onDelete={() => handleDelete(r.id)}
              cancelling={cancellingId === r.id}
              deleting={deletingId === r.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const REQUEST_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  sent:              { label: 'Sent',              color: '#0284c7', bg: 'rgba(14,165,233,0.1)' },
  partially_replied: { label: 'Partially replied', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  completed:         { label: 'Completed',         color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  cancelled:         { label: 'Cancelled',         color: '#64748b', bg: 'rgba(148,163,184,0.15)' },
}

function RequestRow({
  request,
  onCancel,
  onDelete,
  cancelling,
  deleting,
}: {
  request: EvidenceRequestSummary
  onCancel: () => void
  onDelete: () => void
  cancelling: boolean
  deleting: boolean
}) {
  const style = REQUEST_STATUS_STYLE[request.status] ?? REQUEST_STATUS_STYLE.sent
  const pct = request.total_items > 0 ? Math.round((request.replied_items / request.total_items) * 100) : 0
  const sent = new Date(request.sent_at)
  const sentAgo = formatRelativeDate(sent)
  const overdue = request.due_date && new Date(request.due_date) < new Date() && request.status !== 'completed' && request.status !== 'cancelled'

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal/req/${request.token}` : ''
  const [copied, setCopied] = useState(false)

  return (
    <div className="px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-start">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: style.color, background: style.bg }}>
            {style.label}
          </span>
          {overdue && (
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: '#e11d48', background: 'rgba(225,29,72,0.1)' }}>
              Overdue
            </span>
          )}
          <span className="text-xs" style={{ color: '#6b5fa8' }}>
            Sent {sentAgo}
            {request.created_by_name ? ` · by ${request.created_by_name}` : ''}
            {request.due_date ? ` · due ${new Date(request.due_date).toLocaleDateString()}` : ''}
          </span>
        </div>

        {request.message && (
          <p className="text-xs" style={{ color: '#4a4270' }}>“{request.message}”</p>
        )}

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-[260px] h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.08)' }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.max(pct, request.replied_items > 0 ? 4 : 0)}%`,
                background: pct === 100 ? '#059669' : '#6c5dd3',
              }}
            />
          </div>
          <span className="text-xs tabular-nums" style={{ color: '#4a4270' }}>
            {request.replied_items}/{request.total_items} replied
          </span>
        </div>

        {request.recipient_emails.length > 0 && (
          <p className="text-xs truncate" style={{ color: '#6b5fa8' }} title={request.recipient_emails.join(', ')}>
            To: {request.recipient_emails.join(', ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {request.status !== 'cancelled' && (
          <button
            type="button"
            onClick={() => {
              if (!portalUrl) return
              navigator.clipboard.writeText(portalUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={{ background: copied ? '#059669' : 'rgba(109,93,211,0.06)', color: copied ? 'white' : '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
        <RequestRowMenu
          canCancel={request.status === 'sent' || request.status === 'partially_replied'}
          onCancel={onCancel}
          onDelete={onDelete}
          cancelling={cancelling}
          deleting={deleting}
        />
      </div>
    </div>
  )
}

function RequestRowMenu({
  canCancel,
  onCancel,
  onDelete,
  cancelling,
  deleting,
}: {
  canCancel: boolean
  onCancel: () => void
  onDelete: () => void
  cancelling: boolean
  deleting: boolean
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const t = triggerRef.current
      if (!t) return
      const rect = t.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const busy = cancelling || deleting

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(109,93,211,0.08)] disabled:opacity-50"
        style={{ color: '#6b5fa8', border: '1px solid rgba(109,93,211,0.12)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 rounded-xl overflow-hidden"
          style={{
            top: coords.top,
            right: coords.right,
            minWidth: 180,
            background: 'white',
            border: '1px solid rgba(108,93,211,0.18)',
            boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
          }}
        >
          {canCancel && (
            <button
              type="button"
              onClick={() => { setOpen(false); onCancel() }}
              disabled={busy}
              className="w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(109,93,211,0.06)] disabled:opacity-50 inline-flex items-center gap-2"
              style={{ color: '#1e1550' }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6.5" />
                <path d="M5 5l6 6" />
              </svg>
              {cancelling ? 'Cancelling…' : 'Cancel request'}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete() }}
            disabled={busy}
            className="w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-rose-50 disabled:opacity-50 inline-flex items-center gap-2"
            style={{ color: '#e11d48' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l1 9.5a1 1 0 001 .9h2a1 1 0 001-.9L11 4" />
            </svg>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Request evidence modal ──────────────────────────────────────────────────

function RequestEvidenceModal({
  vendorId,
  vendorName,
  vendorPrimaryEmail,
  groups,
  activeRequestByDoc,
  createAction,
  onClose,
}: {
  vendorId: string
  vendorName: string
  vendorPrimaryEmail: string | null
  groups: EvidenceByPack[]
  activeRequestByDoc: Record<string, ActiveRequestEntry>
  createAction: EvidenceTabProps['createRequestAction']
  onClose: () => void
}) {
  // Default selection: items that are missing/expired/rejected/stale (i.e., need attention)
  const initialSelection = useMemo(() => {
    const set = new Set<string>()
    for (const g of groups) {
      for (const row of g.rows) {
        const ui = computeEvidenceUiStatus(row)
        const needsAttention = ui.status === 'missing' || ui.status === 'expired' || ui.status === 'rejected' || ui.isStale
        const alreadyOpen = !!activeRequestByDoc[row.id] && activeRequestByDoc[row.id].status === 'pending'
        if (needsAttention && !alreadyOpen) set.add(row.id)
      }
    }
    return set
  }, [groups, activeRequestByDoc])

  const [selected, setSelected] = useState<Set<string>>(initialSelection)
  const [emails, setEmails] = useState<string[]>(vendorPrimaryEmail ? [vendorPrimaryEmail] : [''])
  const [message, setMessage] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [expiryDays, setExpiryDays] = useState('14')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const toggleRow = (id: string) =>
    setSelected((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const togglePack = (rowIds: string[]) => {
    const allSel = rowIds.every((id) => selected.has(id))
    setSelected((p) => {
      const next = new Set(p)
      if (allSel) for (const id of rowIds) next.delete(id)
      else for (const id of rowIds) next.add(id)
      return next
    })
  }

  const submit = () => {
    setError(null)
    const cleanEmails = emails.map((e) => e.trim()).filter((e) => e.length > 0)
    if (selected.size === 0) {
      setError('Select at least one item to request')
      return
    }
    startTransition(async () => {
      const r = await createAction(vendorId, {
        vendorDocumentIds: Array.from(selected),
        message: message.trim() || null,
        dueDate: dueDate || null,
        recipientEmails: cleanEmails,
        expiryDays: parseInt(expiryDays, 10) || 14,
      })
      if (r.url) setResultUrl(r.url)
      else setError(r.message ?? 'Failed to create request')
    })
  }

  const buildMailto = (url: string) => {
    const to = emails.filter((e) => e.trim()).join(',')
    const subject = encodeURIComponent(`Evidence request — ${vendorName}`)
    const body = encodeURIComponent(
      `${message ? message + '\n\n' : ''}Please upload the requested documents using this link:\n${url}\n\n${dueDate ? `Due by ${dueDate}.\n` : ''}This link expires in ${expiryDays} days.`,
    )
    return `mailto:${to}?subject=${subject}&body=${body}`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(30,21,80,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white"
        style={{ border: '1px solid rgba(108,93,211,0.18)', boxShadow: '0 20px 48px rgba(30,21,80,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(108,93,211,0.08)' }}>
          <h3 className="text-base font-semibold" style={{ color: '#1e1550' }}>Request evidence from {vendorName}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#5d5285' }}>
            Select what to ask for. We&apos;ll generate a portal link the vendor can use to upload — no login required.
          </p>
        </div>

        {resultUrl === null ? (
          <>
            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Item selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
                    What to request <span style={{ color: '#6b5fa8' }}>({selected.size} selected)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = groups.flatMap((g) => g.rows.map((r) => r.id))
                      const allSelected = allIds.every((id) => selected.has(id))
                      setSelected(allSelected ? new Set() : new Set(allIds))
                    }}
                    className="text-xs font-medium hover:underline"
                    style={{ color: '#6c5dd3' }}
                  >
                    {groups.flatMap((g) => g.rows.map((r) => r.id)).every((id) => selected.has(id)) ? 'Clear all' : 'Select all'}
                  </button>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,93,211,0.12)' }}>
                  {groups.map((g, gi) => {
                    const rowIds = g.rows.map((r) => r.id)
                    const allPackSel = rowIds.length > 0 && rowIds.every((id) => selected.has(id))
                    const somePackSel = !allPackSel && rowIds.some((id) => selected.has(id))
                    return (
                      <div key={g.pack_id ?? gi} className={gi > 0 ? 'border-t border-[rgba(108,93,211,0.08)]' : ''}>
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-[rgba(108,93,211,0.04)]"
                          onClick={() => togglePack(rowIds)}
                          style={{ background: 'rgba(108,93,211,0.02)' }}
                        >
                          <input
                            type="checkbox"
                            checked={allPackSel}
                            ref={(el) => { if (el) el.indeterminate = somePackSel }}
                            onChange={() => togglePack(rowIds)}
                            className="h-4 w-4 rounded"
                            style={{ accentColor: '#6c5dd3' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#4a4270' }}>
                            {g.pack_name ?? 'Other'}
                          </span>
                          <span className="text-xs" style={{ color: '#6b5fa8' }}>
                            {rowIds.filter((id) => selected.has(id)).length}/{rowIds.length}
                          </span>
                        </div>
                        <div>
                          {g.rows.map((row) => {
                            const ui = computeEvidenceUiStatus(row)
                            const isSel = selected.has(row.id)
                            const active = activeRequestByDoc[row.id]
                            return (
                              <label
                                key={row.id}
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-[rgba(108,93,211,0.03)]"
                                style={{ borderTop: '1px solid rgba(108,93,211,0.04)' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleRow(row.id)}
                                  className="h-4 w-4 rounded shrink-0"
                                  style={{ accentColor: '#6c5dd3' }}
                                />
                                <span className="text-sm flex-1 truncate" style={{ color: '#1e1550' }}>
                                  {row.requirement_name ?? 'Untitled requirement'}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: ui.bg, color: ui.color }}>
                                  {ui.label}
                                </span>
                                {active && active.status === 'pending' && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                                    Already requested
                                  </span>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6c5dd3' }}>
                  Send to <span className="font-normal" style={{ color: '#6b5fa8' }}>(comma-separated for multiple)</span>
                </label>
                {emails.map((email, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        const next = [...emails]
                        next[i] = e.target.value
                        setEmails(next)
                      }}
                      placeholder="contact@vendor.com"
                      className="flex-1 rounded-lg px-3 py-2 text-sm"
                      style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                    />
                    {emails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEmails(emails.filter((_, j) => j !== i))}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-rose-50"
                        style={{ color: '#e11d48' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEmails([...emails, ''])}
                  className="text-xs font-medium hover:underline"
                  style={{ color: '#6c5dd3' }}
                >
                  + Add another recipient
                </button>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6c5dd3' }}>
                  Message <span className="font-normal" style={{ color: '#6b5fa8' }}>(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Hi — could you upload these by Friday? Thanks."
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]"
                  style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                />
              </div>

              {/* Due date + expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6c5dd3' }}>
                    Due date <span className="font-normal" style={{ color: '#6b5fa8' }}>(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#6c5dd3' }}>
                    Link expires in
                  </label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
                  >
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
              </div>

              {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid rgba(108,93,211,0.08)' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="text-sm font-medium px-3 py-1.5 rounded-full hover:opacity-70 disabled:opacity-50"
                style={{ color: '#5d5285' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || selected.size === 0}
                className="text-sm font-medium px-4 py-1.5 rounded-full text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
              >
                {isPending ? 'Sending…' : `Send request (${selected.size})`}
              </button>
            </div>
          </>
        ) : (
          // Result view — show URL with copy + mailto buttons
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <div className="rounded-xl p-3" style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)' }}>
              <div className="flex items-center gap-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3.5 3.5 6.5-8" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: '#1e1550' }}>Request created</p>
              </div>
              <p className="text-xs" style={{ color: '#4a4270' }}>
                Send this link to the vendor. They&apos;ll see only the items you selected and can upload without logging in.
              </p>
            </div>

            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(108,93,211,0.04)', border: '1px solid rgba(108,93,211,0.1)' }}>
              <code className="flex-1 truncate font-mono text-xs" style={{ color: '#1e1550' }}>{resultUrl}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resultUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="text-xs font-medium px-2 py-0.5 rounded shrink-0"
                style={{ background: copied ? '#059669' : 'rgba(108,93,211,0.1)', color: copied ? 'white' : '#6c5dd3' }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {emails.some((e) => e.trim()) && (
              <a
                href={buildMailto(resultUrl)}
                className="block w-full text-center text-sm font-medium px-4 py-2 rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
              >
                Open in mail client →
              </a>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium px-4 py-1.5 rounded-full"
                style={{ background: 'rgba(108,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.12)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pack group + row ────────────────────────────────────────────────────────

function PackGroup({
  vendorId,
  group,
  activeRequestByDoc,
  uploadAction,
  setStatusAction,
  requestAction,
  getVersionsAction,
  getDownloadUrlAction,
}: {
  vendorId: string
  group: EvidenceByPack
  activeRequestByDoc: Record<string, ActiveRequestEntry>
  uploadAction: EvidenceTabProps['uploadEvidenceAction']
  setStatusAction: EvidenceTabProps['setEvidenceStatusAction']
  requestAction: EvidenceTabProps['requestEvidenceAction']
  getVersionsAction: EvidenceTabProps['getVersionsAction']
  getDownloadUrlAction: EvidenceTabProps['getDownloadUrlAction']
}) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#6b5fa8' }}>
        <span>{group.pack_name}</span>
        {group.pack_code && (
          <span className="font-mono text-xs" style={{ color: '#c4bae8' }}>{group.pack_code}</span>
        )}
        <span className="text-xs ml-auto font-normal" style={{ color: '#6b5fa8' }}>
          {group.rows.length} item{group.rows.length !== 1 ? 's' : ''}
        </span>
      </h3>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        {group.rows.map((row, idx) => (
          <EvidenceRowItem
            key={row.id}
            vendorId={vendorId}
            row={row}
            activeRequest={activeRequestByDoc[row.id] ?? null}
            uploadAction={uploadAction}
            setStatusAction={setStatusAction}
            requestAction={requestAction}
            getVersionsAction={getVersionsAction}
            getDownloadUrlAction={getDownloadUrlAction}
            isLast={idx === group.rows.length - 1}
          />
        ))}
      </div>
    </section>
  )
}

function EvidenceRowItem({
  vendorId,
  row,
  activeRequest,
  uploadAction,
  setStatusAction,
  requestAction,
  getVersionsAction,
  getDownloadUrlAction,
  isLast,
}: {
  vendorId: string
  row: EvidenceRow
  activeRequest: ActiveRequestEntry | null
  uploadAction: EvidenceTabProps['uploadEvidenceAction']
  setStatusAction: EvidenceTabProps['setEvidenceStatusAction']
  requestAction: EvidenceTabProps['requestEvidenceAction']
  getVersionsAction: EvidenceTabProps['getVersionsAction']
  getDownloadUrlAction: EvidenceTabProps['getDownloadUrlAction']
  isLast: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reviewerComment, setReviewerComment] = useState(row.verification_notes ?? '')
  const [versions, setVersions] = useState<EvidenceVersion[] | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)

  const loadVersions = async () => {
    setShowVersions((v) => !v)
    if (versions !== null) return
    setVersionsLoading(true)
    const result = await getVersionsAction(vendorId, row.id)
    setVersionsLoading(false)
    if (result.versions) setVersions(result.versions)
    else if (result.message) setError(result.message)
  }

  const handleDownload = async (fileKey: string) => {
    const r = await getDownloadUrlAction(fileKey)
    if (r.url) window.open(r.url, '_blank')
    else if (r.message) setError(r.message)
  }

  const ui = computeEvidenceUiStatus(row)

  const handleUpload = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await uploadAction(vendorId, row.id, formData)
      if (!result.success) setError(result.message ?? 'Upload failed')
    })
  }

  const handleSetStatus = (status: EvidenceStatus) => {
    setError(null)
    startTransition(async () => {
      const result = await setStatusAction(vendorId, row.id, status, reviewerComment.trim() || null)
      if (!result.success) setError(result.message ?? 'Failed to update status')
    })
  }

  const handleRequest = () => {
    setError(null)
    startTransition(async () => {
      const result = await requestAction(vendorId, row.id)
      if (!result.success) setError(result.message ?? 'Failed to request')
    })
  }

  const expiryInfo = (() => {
    if (!ui.showExpiry || !row.expiry_date) return null
    const exp = new Date(row.expiry_date)
    const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
    if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: '#e11d48' }
    if (days <= 30) return { label: `${days}d left`, color: '#d97706' }
    return { label: `Valid ${exp.toLocaleDateString()}`, color: '#6b5fa8' }
  })()

  const requestChip = activeRequest
    ? activeRequest.status === 'replied'
      ? { label: `Replied ${formatRelativeDate(new Date(activeRequest.replied_at ?? activeRequest.sent_at))}`, color: '#059669', bg: 'rgba(5,150,105,0.1)' }
      : { label: `Requested ${formatRelativeDate(new Date(activeRequest.sent_at))}`, color: '#0284c7', bg: 'rgba(14,165,233,0.1)' }
    : null

  return (
    <div style={{ borderBottom: isLast ? undefined : '1px solid rgba(109,93,211,0.06)' }}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[rgba(109,93,211,0.02)]"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ui.color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
              {row.requirement_name ?? 'Untitled requirement'}
            </span>
            {row.requirement_required && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                Required
              </span>
            )}
          </div>
          {row.file_name && (
            <div className="text-xs mt-0.5 truncate" style={{ color: '#5d5285' }}>
              {row.file_name}
            </div>
          )}
        </div>

        {requestChip && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{ background: requestChip.bg, color: requestChip.color }}
          >
            {requestChip.label}
          </span>
        )}

        {expiryInfo && (
          <span className="text-xs font-medium shrink-0" style={{ color: expiryInfo.color }}>
            {expiryInfo.label}
          </span>
        )}

        {ui.isStale && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}
            title={`Approved ${ui.staleDays}d ago — past refresh window of ${row.requirement_refresh_after_days}d`}
          >
            Stale {ui.staleDays}d
          </span>
        )}

        <StatusBadgeDropdown
          currentStatus={row.evidence_status}
          fallbackLabel={ui.label}
          fallbackColor={ui.color}
          fallbackBg={ui.bg}
          onSetStatus={handleSetStatus}
          disabled={isPending}
        />

        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#6b5fa8" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3" style={{ background: 'rgba(109,93,211,0.02)' }}>
          {row.requirement_description && (
            <p className="text-xs leading-relaxed" style={{ color: '#4a4270' }}>
              {row.requirement_description}
            </p>
          )}

          {ui.isStale && (
            <div
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <div className="text-xs" style={{ color: '#854f0b' }}>
                Last verified <strong>{ui.staleDays} days ago</strong>. Refresh window is{' '}
                <strong>{row.requirement_refresh_after_days} days</strong> — ask the vendor to re-upload.
              </div>
              <button
                type="button"
                onClick={handleRequest}
                disabled={isPending}
                className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap disabled:opacity-50"
                style={{ background: '#d97706', color: 'white' }}
              >
                Request refresh
              </button>
            </div>
          )}

          <form action={handleUpload} className="flex items-center gap-2 max-w-md">
            <label
              className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium flex-1"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#6c5dd3', background: 'rgba(109,93,211,0.03)' }}
            >
              <input type="file" name="file" required className="hidden" onChange={(e) => {
                const span = e.target.closest('label')?.querySelector('[data-filename]') as HTMLElement | null
                if (span && e.target.files?.[0]) span.textContent = e.target.files[0].name
              }} />
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6c5dd3" strokeWidth="1.5" strokeLinecap="round"><path d="M8 12V4M5 7l3-3 3 3M3 14h10" /></svg>
              <span data-filename className="truncate" style={{ color: '#4a4270' }}>
                {row.file_name ? 'Replace file' : 'Choose file'}
              </span>
            </label>
            {row.requirement_expiry_applies && (
              <input
                type="date"
                name="expiry_date"
                defaultValue={row.expiry_date ?? ''}
                className="text-xs px-2 py-1.5 rounded-lg"
                style={{ border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550', width: 130 }}
              />
            )}
            <button
              type="submit"
              disabled={isPending}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-white disabled:opacity-50 shrink-0"
              style={{ background: '#6c5dd3' }}
            >
              {isPending ? 'Uploading…' : 'Upload'}
            </button>
          </form>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6b5fa8' }}>
              Reviewer Comment
            </label>
            <textarea
              value={reviewerComment}
              onChange={(e) => setReviewerComment(e.target.value)}
              rows={2}
              placeholder="Add a comment (optional)…"
              className="mt-1 w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[rgba(108,93,211,0.12)]"
              style={{ border: '1px solid rgba(109,93,211,0.2)', background: 'white', color: '#1e1550' }}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={loadVersions}
              className="text-xs font-medium hover:underline"
              style={{ color: '#6c5dd3' }}
            >
              {showVersions ? '▼ Hide version history' : '▶ Show version history'}
              {versionsLoading && ' …'}
            </button>
            {showVersions && versions && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
                {versions.length === 0 ? (
                  <p className="px-3 py-2 text-xs" style={{ color: '#6b5fa8' }}>No previous uploads.</p>
                ) : (
                  versions.map((v, i) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 px-3 py-2 text-xs"
                      style={{ borderBottom: i === versions.length - 1 ? undefined : '1px solid rgba(109,93,211,0.06)' }}
                    >
                      <span className="font-medium truncate flex-1" style={{ color: '#1e1550' }}>
                        {v.file_name ?? 'Unnamed file'}
                      </span>
                      <span style={{ color: '#6b5fa8' }}>{v.uploaded_by_name ?? 'Unknown'}</span>
                      <span style={{ color: '#6b5fa8' }}>
                        {new Date(v.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownload(v.file_key)}
                        className="font-medium hover:underline"
                        style={{ color: '#6c5dd3' }}
                      >
                        Download
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs" style={{ color: '#e11d48' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Status badge with dropdown ──────────────────────────────────────────────

function StatusBadgeDropdown({
  currentStatus,
  fallbackLabel,
  fallbackColor,
  fallbackBg,
  onSetStatus,
  disabled,
}: {
  currentStatus: EvidenceStatus
  fallbackLabel: string
  fallbackColor: string
  fallbackBg: string
  onSetStatus: (s: EvidenceStatus) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Position the menu under the trigger using viewport coords (escapes any
  // overflow:hidden ancestors). Recompute on scroll / resize while open.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const t = triggerRef.current
      if (!t) return
      const rect = t.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? undefined : 'Click to change status'}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider transition-all cursor-pointer hover:shadow-sm disabled:cursor-default disabled:opacity-60"
        style={{
          background: fallbackBg,
          color: fallbackColor,
          border: `1px solid ${withAlpha(fallbackColor, 0.35)}`,
          boxShadow: open ? `0 0 0 3px ${withAlpha(fallbackColor, 0.18)}` : undefined,
        }}
      >
        {fallbackLabel}
        <svg
          width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.85 }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 rounded-xl overflow-hidden"
          style={{
            top: coords.top,
            right: coords.right,
            minWidth: 200,
            background: 'white',
            border: '1px solid rgba(108,93,211,0.18)',
            boxShadow: '0 8px 24px rgba(30,21,80,0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-widest" style={{ color: '#6b5fa8', borderBottom: '1px solid rgba(108,93,211,0.06)' }}>
            Set status
          </div>
          {ALL_STATUS_OPTIONS.map((opt) => {
            const isCurrent = currentStatus === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (!isCurrent) onSetStatus(opt.value)
                }}
                disabled={isCurrent}
                className="w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(109,93,211,0.04)] disabled:cursor-default flex items-center gap-2"
                style={{ color: '#1e1550' }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color }} />
                <span className="flex-1">{opt.label}</span>
                {isCurrent && <span style={{ color: opt.color }}>✓</span>}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`
}

function formatRelativeDate(d: Date): string {
  const diffMs = Date.now() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}
