'use client'

import { useState, useTransition } from 'react'
import type { EvidenceByPack, EvidenceRow, EvidenceVersion } from '@/lib/evidence-ui'
import { computeEvidenceUiStatus } from '@/lib/evidence-ui'
import type { EvidenceStatus } from '@/types/review-pack'

interface EvidenceTabProps {
  vendorId: string
  groups: EvidenceByPack[]
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
}

const STATUS_OPTIONS: { value: EvidenceStatus; label: string }[] = [
  { value: 'under_review', label: 'Mark Under Review' },
  { value: 'approved',     label: 'Approve' },
  { value: 'rejected',     label: 'Reject' },
  { value: 'waived',       label: 'Waive' },
]

export function EvidenceTab({
  vendorId,
  groups,
  uploadEvidenceAction,
  setEvidenceStatusAction,
  requestEvidenceAction,
  getVersionsAction,
  getDownloadUrlAction,
}: EvidenceTabProps) {
  if (groups.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'white', border: '1px dashed rgba(109,93,211,0.2)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: '#1e1550' }}>No evidence requirements yet</p>
        <p className="text-xs" style={{ color: '#a99fd8' }}>
          Evidence requirements appear here once Review Packs are assigned to this vendor.
          Go to the Reviews tab to apply Review Packs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <PackGroup
          key={group.pack_id ?? '__unlinked__'}
          vendorId={vendorId}
          group={group}
          uploadAction={uploadEvidenceAction}
          setStatusAction={setEvidenceStatusAction}
          requestAction={requestEvidenceAction}
          getVersionsAction={getVersionsAction}
          getDownloadUrlAction={getDownloadUrlAction}
        />
      ))}
    </div>
  )
}

function PackGroup({
  vendorId,
  group,
  uploadAction,
  setStatusAction,
  requestAction,
  getVersionsAction,
  getDownloadUrlAction,
}: {
  vendorId: string
  group: EvidenceByPack
  uploadAction: EvidenceTabProps['uploadEvidenceAction']
  setStatusAction: EvidenceTabProps['setEvidenceStatusAction']
  requestAction: EvidenceTabProps['requestEvidenceAction']
  getVersionsAction: EvidenceTabProps['getVersionsAction']
  getDownloadUrlAction: EvidenceTabProps['getDownloadUrlAction']
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#a99fd8' }}>
        <span>{group.pack_name}</span>
        {group.pack_code && (
          <span className="font-mono text-[10px]" style={{ color: '#c4bae8' }}>{group.pack_code}</span>
        )}
        <span className="text-[10px] ml-auto font-normal" style={{ color: '#a99fd8' }}>
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
  uploadAction,
  setStatusAction,
  requestAction,
  getVersionsAction,
  getDownloadUrlAction,
  isLast,
}: {
  vendorId: string
  row: EvidenceRow
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

  // Expiry countdown (only if applicable)
  const expiryInfo = (() => {
    if (!ui.showExpiry || !row.expiry_date) return null
    const exp = new Date(row.expiry_date)
    const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
    if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: '#e11d48' }
    if (days <= 30) return { label: `${days}d left`, color: '#d97706' }
    return { label: `Valid ${exp.toLocaleDateString()}`, color: '#a99fd8' }
  })()

  return (
    <div style={{ borderBottom: isLast ? undefined : '1px solid rgba(109,93,211,0.06)' }}>
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[rgba(109,93,211,0.02)]"
        onClick={() => setIsOpen((v) => !v)}
      >
        {/* Status indicator */}
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ui.color }} />

        {/* Name + required */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
              {row.requirement_name ?? 'Untitled requirement'}
            </span>
            {row.requirement_required && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                Required
              </span>
            )}
          </div>
          {row.file_name && (
            <div className="text-[11px] mt-0.5 truncate" style={{ color: '#8b7fd4' }}>
              {row.file_name}
            </div>
          )}
        </div>

        {/* Expiry */}
        {expiryInfo && (
          <span className="text-[10px] font-medium shrink-0" style={{ color: expiryInfo.color }}>
            {expiryInfo.label}
          </span>
        )}

        {/* Status badge */}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
          style={{ background: ui.bg, color: ui.color }}
        >
          {ui.label}
        </span>

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
        <div className="px-4 pb-4 pt-1 space-y-3" style={{ background: 'rgba(109,93,211,0.02)' }}>
          {row.requirement_description && (
            <p className="text-xs leading-relaxed" style={{ color: '#4a4270' }}>
              {row.requirement_description}
            </p>
          )}

          {/* Upload */}
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

          {/* Reviewer comment */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
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

          {/* Status actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSetStatus(opt.value)}
                disabled={isPending}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  background: 'rgba(109,93,211,0.06)',
                  color: '#6c5dd3',
                  border: '1px solid rgba(109,93,211,0.12)',
                }}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRequest}
              disabled={isPending}
              className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: 'rgba(245,158,11,0.08)',
                color: '#d97706',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              Request from Vendor
            </button>
          </div>

          {/* Version history toggle */}
          <div>
            <button
              type="button"
              onClick={loadVersions}
              className="text-[11px] font-medium hover:underline"
              style={{ color: '#6c5dd3' }}
            >
              {showVersions ? '▼ Hide version history' : '▶ Show version history'}
              {versionsLoading && ' …'}
            </button>
            {showVersions && versions && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)' }}>
                {versions.length === 0 ? (
                  <p className="px-3 py-2 text-xs" style={{ color: '#a99fd8' }}>No previous uploads.</p>
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
                      <span style={{ color: '#a99fd8' }}>{v.uploaded_by_name ?? 'Unknown'}</span>
                      <span style={{ color: '#a99fd8' }}>
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
