'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VendorDocumentsData, SuggestedDocument, CustomDocument, AssessmentDocRequest, DocStatus } from '@/types/document'
import type { FormState } from '@/types/common'
import { Spinner } from '@/app/_components/Spinner'
import type { FrameworkReadiness, ControlStatus } from '@/lib/db/compliance'
import { getDocumentDownloadUrlAction } from '@/app/vendors/[id]/actions'

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[rgba(109,93,211,0.2)] bg-white px-3 py-2 text-sm text-[#1e1550] placeholder:text-[#c4bae8] shadow-sm focus:border-[#6c5dd3] focus:outline-none focus:ring-1 focus:ring-[#6c5dd3] transition-colors'
const labelCls = 'block text-xs font-semibold text-[#6b5fa8] mb-1'

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocStatus, { label: string; className: string }> = {
  missing:  { label: 'Missing',        className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
  pending:  { label: 'Pending Upload', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  uploaded: { label: 'Uploaded',       className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  expired:  { label: 'Expired',        className: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20' },
}

function DocStatusBadge({ status }: { status: DocStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Expiry label with urgency ─────────────────────────────────────────────────

function ExpiryLabel({ date }: { date: string }) {
  const exp = new Date(date)
  const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
  const formatted = exp.toLocaleDateString()

  if (daysLeft < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Expired {formatted}
      </span>
    )
  }
  if (daysLeft <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        {daysLeft}d left · {formatted}
      </span>
    )
  }
  if (daysLeft <= 90) {
    return (
      <span className="text-xs text-amber-600">
        {formatted} ({daysLeft}d)
      </span>
    )
  }
  return <span className="text-xs" style={{ color: '#4a4270' }}>{formatted}</span>
}

// ─── Shared upload button ──────────────────────────────────────────────────────

function UploadBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? 'bg-[rgba(109,93,211,0.08)] text-[#6b5fa8] hover:bg-[rgba(109,93,211,0.12)]'
          : 'text-white hover:opacity-90 shadow-sm'
      }`}
      style={active ? {} : { background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
    >
      {!active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8V2M2 5l3-3 3 3" />
        </svg>
      )}
      {active ? 'Cancel' : 'Upload'}
    </button>
  )
}

// ─── Upload inline form ────────────────────────────────────────────────────────

function UploadForm({
  docTypeId,
  vendorDocId,
  action,
  onClose,
}: {
  docTypeId: string
  vendorDocId: string | null
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, {})
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    if (state.success) {
      router.refresh()
      onClose()
    }
  }, [state.success, router, onClose])

  return (
    <form
      action={formAction}
      className="mt-2 p-4 rounded-lg space-y-3" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.1)' }}
    >
      <input type="hidden" name="doc_type_id" value={docTypeId} />
      {vendorDocId && <input type="hidden" name="vendor_doc_id" value={vendorDocId} />}

      {state.message && (
        <p className="text-xs text-rose-600 font-medium">{state.message}</p>
      )}

      {/* File picker */}
      <div>
        <label className={labelCls}>Select File</label>
        <label className="flex items-center gap-3 w-full cursor-pointer rounded-lg border-2 border-dashed border-[rgba(109,93,211,0.2)] bg-white px-4 py-4 hover:border-[#6c5dd3] hover:bg-[rgba(109,93,211,0.06)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 11V3M5 6l3-3 3 3" /><path d="M2 13h12" />
          </svg>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <p className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: '#4a4270' }}>Click to choose a file</p>
                <p className="text-xs" style={{ color: '#a99fd8' }}>PDF, DOC, PNG, JPG, XLSX…</p>
              </>
            )}
          </div>
          {fileName && (
            <span className="text-xs text-emerald-600 font-semibold shrink-0">Ready</span>
          )}
          <input
            type="file"
            name="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFileName(f.name)
            }}
          />
        </label>
      </div>

      <div>
        <label className={labelCls}>Expiry Date</label>
        <input
          name="expiry_date"
          type="date"
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending ? <Spinner /> : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8V2M2 5l3-3 3 3" />
            </svg>
          )}
          {isPending ? 'Uploading…' : 'Upload Document'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#a99fd8] hover:text-[#6c5dd3] px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── View / Download button ────────────────────────────────────────────────────

function ViewDocButton({ fileKey, fileName }: { fileKey: string | null; fileName: string | null }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Only show for real storage paths (not placeholder: keys)
  if (!fileKey || fileKey.startsWith('placeholder:')) return null

  async function handleClick() {
    if (!fileKey) return
    setLoading(true)
    setErr(null)
    const result = await getDocumentDownloadUrlAction(fileKey)
    setLoading(false)
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else {
      setErr(result.message ?? 'Could not open file.')
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={fileName ? `View/download ${fileName}` : 'View/download file'}
        className="inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
        style={{ color: '#6c5dd3' }}
      >
        {loading ? (
          <span className="text-[10px]">…</span>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 9V1M4 6l3 3 3-3" />
              <path d="M1 11h12v2H1z" />
            </svg>
            View
          </>
        )}
      </button>
      {err && <span className="text-[10px] text-rose-500" title={err}>!</span>}
    </span>
  )
}

// ─── Delete document button ────────────────────────────────────────────────────

function DeleteDocButton({
  vendorDocId,
  deleteAction,
  confirmMessage,
  label = 'Delete',
}: {
  vendorDocId: string
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  confirmMessage: string
  label?: string
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(deleteAction, {})

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault()
      }}
    >
      <input type="hidden" name="vendor_doc_id" value={vendorDocId} />
      {state.message && <span className="text-xs text-rose-600 mr-1">{state.message}</span>}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1 text-xs text-[#a99fd8] hover:text-rose-600 font-medium transition-colors disabled:opacity-50"
      >
        {isPending && <Spinner size={11} />}
        {isPending ? 'Deleting…' : label}
      </button>
    </form>
  )
}

// ─── Add Custom Document form ──────────────────────────────────────────────────

function AddCustomDocForm({
  action,
  onClose,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  onClose: () => void
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, {})
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    if (state.success) {
      router.refresh()
      onClose()
    }
  }, [state.success, router, onClose])

  const err = state.errors ?? {}

  return (
    <form
      action={formAction}
      className="mb-4 p-4 rounded-lg space-y-3" style={{ background: 'rgba(109,93,211,0.03)', border: '1px solid rgba(109,93,211,0.1)' }}
    >
      <p className="text-xs font-semibold" style={{ color: '#1e1550' }}>Add Custom Document</p>

      {state.message && <p className="text-xs text-rose-600">{state.message}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            Document Name <span className="text-rose-500">*</span>
          </label>
          <input
            name="custom_doc_name"
            type="text"
            autoFocus
            placeholder="e.g. GDPR Data Agreement"
            className={inputCls}
          />
          {err.custom_doc_name && (
            <p className="text-xs text-rose-600 mt-1">{err.custom_doc_name[0]}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Document Category</label>
          <select name="custom_doc_category" className={inputCls} defaultValue="">
            <option value="">Select category…</option>
            <option value="Vendor Security Assessment">Vendor Security Assessment</option>
            <option value="Operational Vendor Risk">Operational Vendor Risk</option>
            <option value="Financial Stability Review">Financial Stability Review</option>
            <option value="Data Privacy Review">Data Privacy Review</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* File picker */}
      <div>
        <label className={labelCls}>File <span className="text-[#c4bae8] font-normal">(optional)</span></label>
        <label className="flex items-center gap-3 w-full cursor-pointer rounded-lg border-2 border-dashed border-[rgba(109,93,211,0.2)] bg-white px-4 py-3 hover:border-[#6c5dd3] hover:bg-[rgba(109,93,211,0.06)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 11V3M5 6l3-3 3 3" /><path d="M2 13h12" />
          </svg>
          <div className="flex-1 min-w-0">
            {fileName ? (
              <p className="text-sm font-medium truncate" style={{ color: '#1e1550' }}>{fileName}</p>
            ) : (
              <p className="text-sm" style={{ color: '#4a4270' }}>Click to choose a file</p>
            )}
          </div>
          {fileName && (
            <span className="text-xs text-emerald-600 font-semibold shrink-0">Ready</span>
          )}
          <input
            type="file"
            name="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFileName(f.name)
            }}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>File Name</label>
          <input
            name="file_name"
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="filename.pdf"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Expiry Date <span className="text-[#c4bae8] font-normal">(optional)</span></label>
          <input
            name="expiry_date"
            type="date"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 justify-center rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
        >
          {isPending && <Spinner />}
          {isPending ? 'Adding…' : '+ Add Document'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[#a99fd8] hover:text-[#6c5dd3] px-2 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Row: Suggested document ───────────────────────────────────────────────────

function SuggestedDocRow({
  doc,
  isUploading,
  onUploadClick,
  uploadDocAction,
  onUploadClose,
  deleteDocAction,
}: {
  doc: SuggestedDocument
  isUploading: boolean
  onUploadClick: () => void
  uploadDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  onUploadClose: () => void
  deleteDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const hasFile = doc.status === 'uploaded' || doc.status === 'expired'
  const canUpload = !hasFile

  return (
    <>
      <tr className={`hover:bg-[rgba(109,93,211,0.03)] transition-colors ${isUploading ? 'bg-[rgba(109,93,211,0.06)]' : ''}`}>
        <td className="px-4 py-3 font-medium" style={{ color: '#1e1550' }}>{doc.doc_type_name}</td>
        <td className="px-4 py-3">
          {doc.is_required ? (
            <span className="text-xs font-semibold text-rose-600">Mandatory</span>
          ) : (
            <span className="text-xs" style={{ color: '#a99fd8' }}>Recommended</span>
          )}
        </td>
        <td className="px-4 py-3">
          <DocStatusBadge status={doc.status} />
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: '#4a4270' }}>
          {doc.expiry_date ? <ExpiryLabel date={doc.expiry_date} /> : '—'}
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: '#4a4270' }}>
          <div className="flex items-center gap-2">
            <span className="font-mono truncate max-w-[180px]" title={doc.current_file_name ?? undefined}>
              {doc.current_file_name ?? (
                doc.current_file_key?.startsWith('placeholder:')
                  ? <span className="italic text-amber-600">Pending</span>
                  : '—'
              )}
            </span>
            <ViewDocButton fileKey={doc.current_file_key} fileName={doc.current_file_name} />
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            {hasFile && doc.vendor_doc_id && (
              <DeleteDocButton
                vendorDocId={doc.vendor_doc_id}
                deleteAction={deleteDocAction}
                confirmMessage="Delete this file? Status will revert to Missing and you can re-upload."
              />
            )}
            {(canUpload || isUploading) && (
              <UploadBtn active={isUploading} onClick={onUploadClick} />
            )}
          </div>
        </td>
      </tr>
      {isUploading && (
        <tr>
          <td colSpan={6} className="px-4 pb-4">
            <UploadForm
              docTypeId={doc.doc_type_id}
              vendorDocId={doc.vendor_doc_id}
              action={uploadDocAction}
              onClose={onUploadClose}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Row: Custom document ──────────────────────────────────────────────────────

function CustomDocRow({
  doc,
  isUploading,
  onUploadClick,
  onUploadClose,
  uploadDocAction,
  deleteDocAction,
  deleteCustomDocAction,
}: {
  doc: CustomDocument
  isUploading: boolean
  onUploadClick: () => void
  onUploadClose: () => void
  uploadDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteCustomDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  const hasFile = doc.status === 'uploaded' || doc.status === 'expired'
  const canUpload = !hasFile

  return (
    <>
      <tr className={`hover:bg-[rgba(109,93,211,0.03)] transition-colors ${isUploading ? 'bg-[rgba(109,93,211,0.06)]' : ''}`}>
        <td className="px-4 py-3">
          <div className="font-medium" style={{ color: '#1e1550' }}>{doc.doc_type_name}</div>
          {doc.category && doc.category !== 'Other' && (
            <div className="text-xs text-[#6c5dd3] mt-0.5">{doc.category}</div>
          )}
        </td>
        <td className="px-4 py-3">
          <DocStatusBadge status={doc.status} />
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: '#4a4270' }}>
          {doc.expiry_date ? <ExpiryLabel date={doc.expiry_date} /> : '—'}
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: '#4a4270' }}>
          <div className="flex items-center gap-2">
            <span className="font-mono truncate max-w-[180px]" title={doc.current_file_name ?? undefined}>
              {doc.current_file_name ?? (
                doc.current_file_key?.startsWith('placeholder:')
                  ? <span className="italic text-amber-600">Pending</span>
                  : '—'
              )}
            </span>
            <ViewDocButton fileKey={doc.current_file_key} fileName={doc.current_file_name} />
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            {hasFile && (
              <DeleteDocButton
                vendorDocId={doc.vendor_doc_id}
                deleteAction={deleteDocAction}
                confirmMessage="Delete this file? Status will revert to Missing and you can re-upload."
              />
            )}
            {(canUpload || isUploading) && (
              <UploadBtn active={isUploading} onClick={onUploadClick} />
            )}
            <span className="text-[#c4bae8] select-none">|</span>
            <DeleteDocButton
              vendorDocId={doc.vendor_doc_id}
              deleteAction={deleteCustomDocAction}
              confirmMessage="Remove this custom document entirely? This cannot be undone."
              label="Remove"
            />
          </div>
        </td>
      </tr>
      {isUploading && (
        <tr>
          <td colSpan={5} className="px-4 pb-4">
            <UploadForm
              docTypeId={doc.doc_type_id}
              vendorDocId={doc.vendor_doc_id}
              action={uploadDocAction}
              onClose={onUploadClose}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Framework Evidence Requirements section (kept for reference — now unused) ──

const EVIDENCE_STATUS_CONFIG: Record<ControlStatus, { icon: string; label: string; badgeCls: string }> = {
  satisfied:        { icon: '✓', label: 'Uploaded',          badgeCls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  evidence_present: { icon: '◑', label: 'Pending Review',    badgeCls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20' },
  missing:          { icon: '✗', label: 'Missing',           badgeCls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
  expired:          { icon: '⚠', label: 'Expired',           badgeCls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20' },
  needs_assessment: { icon: '○', label: 'Needs Assessment',  badgeCls: 'bg-[rgba(109,93,211,0.04)] text-[#a99fd8] ring-1 ring-[rgba(109,93,211,0.15)]' },
}

function FrameworkEvidenceSection({
  frameworkReadiness,
  uploadDocAction,
  uploadingDocTypeId,
  onUploadToggle,
  onUploadClose,
  deleteDocAction,
}: {
  frameworkReadiness: FrameworkReadiness[]
  uploadDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  uploadingDocTypeId: string | null
  onUploadToggle: (docTypeId: string) => void
  onUploadClose: () => void
  deleteDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  if (frameworkReadiness.length === 0) {
    return (
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Framework Evidence Requirements</h3>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>Required by your assigned Vendor Risk Frameworks</p>
        </div>
        <div className="rounded-lg border border-dashed border-[rgba(109,93,211,0.2)] px-5 py-8 text-center">
          <p className="text-sm" style={{ color: '#4a4270' }}>No risk frameworks assigned to this vendor.</p>
          <p className="text-xs mt-1.5" style={{ color: '#a99fd8' }}>
            Go to the <span className="font-medium" style={{ color: '#4a4270' }}>Overview</span> tab and add a Vendor Risk Framework under "Risk Frameworks" to see evidence requirements here.
          </p>
        </div>
      </section>
    )
  }

  // Collect all document_check items across frameworks, keyed by doc_type_id to deduplicate
  // We show per-framework grouping so keep them separate
  const docFrameworks = frameworkReadiness
    .map((fw) => {
      const docItems = fw.items.filter(
        (item) => item.item_type === 'document_check' && item.expected_document_type_id,
      )
      const assessmentItems = fw.items.filter(
        (item) => item.item_type !== 'document_check' || !item.expected_document_type_id,
      )
      return { fw, docItems, assessmentItemCount: assessmentItems.length }
    })
    .filter(({ docItems, assessmentItemCount }) => docItems.length > 0 || assessmentItemCount > 0)

  if (docFrameworks.length === 0) {
    return null
  }

  const totalMissing = frameworkReadiness.reduce((sum, fw) => sum + fw.missing + fw.expired, 0)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Framework Evidence Requirements</h3>
          <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>Required by your assigned Vendor Risk Frameworks</p>
        </div>
        {totalMissing > 0 && (
          <span className="text-xs font-semibold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full ring-1 ring-rose-200">
            {totalMissing} gap{totalMissing !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {docFrameworks.map(({ fw, docItems, assessmentItemCount }) => (
          <div
            key={fw.framework_id}
            className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)' }}
          >
            {/* Framework header */}
            <div className="flex items-center gap-3 px-5 py-3" style={{ background: 'rgba(109,93,211,0.03)', borderBottom: '1px solid rgba(109,93,211,0.08)' }}>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(109,93,211,0.1)', color: '#6c5dd3' }}
              >
                {fw.framework_name}
              </span>
              <div className="flex items-center gap-3 ml-1">
                <span className="text-xs text-emerald-600 font-medium">✓ {fw.satisfied}</span>
                {fw.missing > 0 && <span className="text-xs text-rose-600 font-medium">✗ {fw.missing} missing</span>}
                {fw.expired > 0 && <span className="text-xs text-amber-600 font-medium">⚠ {fw.expired} expired</span>}
              </div>
              {fw.score !== null && (
                <span
                  className={`ml-auto text-xs font-bold ${
                    fw.score >= 80 ? 'text-emerald-600' : fw.score >= 40 ? 'text-amber-600' : 'text-rose-600'
                  }`}
                >
                  {fw.score}%
                </span>
              )}
            </div>

            {/* Document evidence rows */}
            {docItems.length > 0 && (
              <table className="min-w-full text-sm divide-y divide-[rgba(109,93,211,0.06)]">
                <thead className="bg-white">
                  <tr>
                    {['Evidence Document', 'Status', ''].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-2 text-left text-xs font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[rgba(109,93,211,0.04)]">
                  {docItems.map((item) => {
                    const cfg = EVIDENCE_STATUS_CONFIG[item.status]
                    const hasFile = item.status === 'satisfied' || item.status === 'expired'
                    const canUpload = item.status === 'missing' || item.status === 'expired'
                    const isUploading = uploadingDocTypeId === item.expected_document_type_id
                    return (
                      <>
                        <tr
                          key={item.framework_item_id}
                          className={`hover:bg-[rgba(109,93,211,0.03)] transition-colors ${isUploading ? 'bg-[rgba(109,93,211,0.06)]' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium" style={{ color: '#1e1550' }}>{item.doc_type_name ?? item.title}</p>
                            {item.doc_type_name && item.doc_type_name !== item.title && (
                              <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>{item.title}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeCls}`}>
                              <span>{cfg.icon}</span> {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {hasFile && item.vendor_doc_id && (
                                <DeleteDocButton
                                  vendorDocId={item.vendor_doc_id}
                                  deleteAction={deleteDocAction}
                                  confirmMessage="Delete this file? Status will revert to Missing and you can re-upload."
                                />
                              )}
                              {canUpload && item.expected_document_type_id && (
                                <UploadBtn active={isUploading} onClick={() => onUploadToggle(item.expected_document_type_id!)} />
                              )}
                            </div>
                          </td>
                        </tr>
                        {isUploading && item.expected_document_type_id && (
                          <tr key={`${item.framework_item_id}-upload`}>
                            <td colSpan={3} className="px-4 pb-4">
                              <UploadForm
                                docTypeId={item.expected_document_type_id}
                                vendorDocId={null}
                                action={uploadDocAction}
                                onClose={onUploadClose}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Manual assessment controls count */}
            {assessmentItemCount > 0 && (
              <div className="px-5 py-2.5 bg-[rgba(109,93,211,0.04)] border-t" style={{ borderColor: 'rgba(109,93,211,0.06)' }}>
                <p className="text-xs" style={{ color: '#a99fd8' }}>
                  <span className="font-medium" style={{ color: '#4a4270' }}>+{assessmentItemCount}</span> control{assessmentItemCount !== 1 ? 's' : ''} require manual assessment (not document-based)
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Checklist group ───────────────────────────────────────────────────────────

function ChecklistGroup({
  label,
  labelCls,
  items,
  uploadingDocTypeId,
  onUploadToggle,
  onUploadClose,
  uploadDocAction,
  deleteDocAction,
}: {
  label: string
  labelCls: string
  items: { doc_type_id: string; doc_type_name: string; status: DocStatus; vendor_doc_id: string | null; current_file_name: string | null; current_file_key: string | null; expiry_date: string | null }[]
  uploadingDocTypeId: string | null
  onUploadToggle: (id: string) => void
  onUploadClose: () => void
  uploadDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${labelCls}`}>{label}</span>
        <span className="text-xs" style={{ color: '#a99fd8' }}>{items.length} document{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)' }}>
        <table className="min-w-full text-sm divide-y divide-[rgba(109,93,211,0.06)]">
          <thead className="bg-[rgba(109,93,211,0.03)]">
            <tr>
              {['Document', 'Status', 'Expiry', 'File', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[rgba(109,93,211,0.06)]">
            {items.map((item) => (
              <>
                <tr
                  key={item.doc_type_id}
                  className={`hover:bg-[rgba(109,93,211,0.03)] transition-colors ${uploadingDocTypeId === item.doc_type_id ? 'bg-[rgba(109,93,211,0.06)]' : ''}`}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: '#1e1550' }}>{item.doc_type_name}</td>
                  <td className="px-4 py-3"><DocStatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#4a4270' }}>
                    {item.expiry_date ? <ExpiryLabel date={item.expiry_date} /> : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: '#4a4270' }}>
                    <span className="inline-flex items-center gap-2">
                      {item.current_file_name ?? (
                        item.current_file_key?.startsWith('placeholder:')
                          ? <span className="italic text-amber-600">Pending</span>
                          : '—'
                      )}
                      <ViewDocButton fileKey={item.current_file_key} fileName={item.current_file_name} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {(item.status === 'uploaded' || item.status === 'expired') && item.vendor_doc_id && (
                        <DeleteDocButton
                          vendorDocId={item.vendor_doc_id}
                          deleteAction={deleteDocAction}
                          confirmMessage="Delete this file? Status will revert to Missing."
                        />
                      )}
                      {(item.status === 'missing' || item.status === 'expired' || item.status === 'pending') && (
                        <UploadBtn
                          active={uploadingDocTypeId === item.doc_type_id}
                          onClick={() => onUploadToggle(item.doc_type_id)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
                {uploadingDocTypeId === item.doc_type_id && (
                  <tr key={`${item.doc_type_id}-upload`}>
                    <td colSpan={5} className="px-4 pb-4">
                      <UploadForm
                        docTypeId={item.doc_type_id}
                        vendorDocId={item.vendor_doc_id}
                        action={uploadDocAction}
                        onClose={onUploadClose}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Documents Tab ────────────────────────────────────────────────────────

interface DocumentsTabProps {
  documents: VendorDocumentsData
  assessmentDocRequests: AssessmentDocRequest[]
  uploadDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  addCustomDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
  deleteCustomDocAction: (prevState: FormState, formData: FormData) => Promise<FormState>
}

type ChecklistItem = {
  doc_type_id: string
  doc_type_name: string
  required: boolean
  status: DocStatus
  vendor_doc_id: string | null
  current_file_name: string | null
  current_file_key: string | null
  expiry_date: string | null
}

export function DocumentsTab({
  documents,
  assessmentDocRequests,
  uploadDocAction,
  addCustomDocAction,
  deleteDocAction,
  deleteCustomDocAction,
}: DocumentsTabProps) {
  const [uploadingDocTypeId, setUploadingDocTypeId] = useState<string | null>(null)
  const [showAddCustom, setShowAddCustom] = useState(false)

  // Build merged deduplicated checklist from category templates + framework evidence
  const checklistMap = new Map<string, ChecklistItem>()
  for (const doc of documents.suggested) {
    checklistMap.set(doc.doc_type_id, {
      doc_type_id: doc.doc_type_id,
      doc_type_name: doc.doc_type_name,
      required: doc.is_required,
      status: doc.status,
      vendor_doc_id: doc.vendor_doc_id,
      current_file_name: doc.current_file_name,
      current_file_key: doc.current_file_key,
      expiry_date: doc.expiry_date,
    })
  }
  for (const req of assessmentDocRequests) {
    const existing = checklistMap.get(req.doc_type_id)
    if (existing) {
      // Escalate to required if any framework marks it required
      if (req.required && !existing.required) checklistMap.set(req.doc_type_id, { ...existing, required: true })
    } else {
      checklistMap.set(req.doc_type_id, {
        doc_type_id: req.doc_type_id,
        doc_type_name: req.doc_type_name,
        required: req.required,
        status: req.status,
        vendor_doc_id: req.vendor_doc_id,
        current_file_name: req.current_file_name,
        current_file_key: req.current_file_key,
        expiry_date: req.expiry_date,
      })
    }
  }
  const checklist = [...checklistMap.values()]
  const requiredDocs = checklist.filter(d => d.required)
  const recommendedDocs = checklist.filter(d => !d.required)

  return (
    <div className="space-y-8">

      {/* ── Document Checklist (merged: category templates + framework evidence, deduped) ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Document Checklist</h3>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>
              Deduplicated document requirements from category standards and assigned risk frameworks
            </p>
          </div>
          {checklist.length > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#4a4270' }}>
              <span className="font-medium text-emerald-600">{checklist.filter(d => d.status === 'uploaded').length} uploaded</span>
              <span>·</span>
              <span className="font-medium text-rose-600">{checklist.filter(d => d.status === 'missing').length} missing</span>
            </div>
          )}
        </div>

        {checklist.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgba(109,93,211,0.2)] px-5 py-8 text-center">
            <p className="text-sm" style={{ color: '#4a4270' }}>No document requirements yet.</p>
            <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>Assign a vendor category or create an assessment to see requirements.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requiredDocs.length > 0 && (
              <ChecklistGroup
                label="Required"
                labelCls="bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                items={requiredDocs}
                uploadingDocTypeId={uploadingDocTypeId}
                onUploadToggle={(id) => setUploadingDocTypeId(uploadingDocTypeId === id ? null : id)}
                onUploadClose={() => setUploadingDocTypeId(null)}
                uploadDocAction={uploadDocAction}
                deleteDocAction={deleteDocAction}
              />
            )}
            {recommendedDocs.length > 0 && (
              <ChecklistGroup
                label="Recommended"
                labelCls="bg-[rgba(109,93,211,0.06)] text-[#6b5fa8] ring-1 ring-[rgba(109,93,211,0.15)]"
                items={recommendedDocs}
                uploadingDocTypeId={uploadingDocTypeId}
                onUploadToggle={(id) => setUploadingDocTypeId(uploadingDocTypeId === id ? null : id)}
                onUploadClose={() => setUploadingDocTypeId(null)}
                uploadDocAction={uploadDocAction}
                deleteDocAction={deleteDocAction}
              />
            )}
          </div>
        )}
      </section>

      {/* ── Section D: Custom documents ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1e1550' }}>Custom Documents</h3>
            <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>Org-specific additions</p>
          </div>
          {!showAddCustom && (
            <button
              onClick={() => setShowAddCustom(true)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:opacity-80"
              style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#6c5dd3' }}
            >
              + Add Document
            </button>
          )}
        </div>

        {showAddCustom && (
          <AddCustomDocForm
            action={addCustomDocAction}
            onClose={() => setShowAddCustom(false)}
          />
        )}

        {documents.custom.length === 0 && !showAddCustom ? (
          <div className="rounded-lg border border-dashed border-[rgba(109,93,211,0.2)] px-5 py-8 text-center">
            <p className="text-sm" style={{ color: '#4a4270' }}>No custom documents added yet.</p>
            <p className="text-xs mt-1" style={{ color: '#a99fd8' }}>Add org-specific documents not covered by the standard set.</p>
          </div>
        ) : (
          documents.custom.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)' }}>
              <table className="min-w-full text-sm divide-y divide-[rgba(109,93,211,0.06)]">
                <thead className="bg-[rgba(109,93,211,0.03)]">
                  <tr>
                    {['Document', 'Status', 'Expiry', 'File', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[rgba(109,93,211,0.06)]">
                  {documents.custom.map((doc) => (
                    <CustomDocRow
                      key={doc.vendor_doc_id}
                      doc={doc}
                      isUploading={uploadingDocTypeId === doc.doc_type_id}
                      onUploadClick={() =>
                        setUploadingDocTypeId(
                          uploadingDocTypeId === doc.doc_type_id ? null : doc.doc_type_id,
                        )
                      }
                      onUploadClose={() => setUploadingDocTypeId(null)}
                      uploadDocAction={uploadDocAction}
                      deleteDocAction={deleteDocAction}
                      deleteCustomDocAction={deleteCustomDocAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      {/* ── Section E: Document history ── */}
      {documents.history.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1e1550' }}>Upload History</h3>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)' }}>
            <table className="min-w-full text-sm divide-y divide-[rgba(109,93,211,0.06)]">
              <thead className="bg-[rgba(109,93,211,0.03)]">
                <tr>
                  {['Document', 'File', 'Uploaded', 'AI Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[rgba(109,93,211,0.06)]">
                {documents.history.map((v) => (
                  <tr key={v.version_id} className="hover:bg-[rgba(109,93,211,0.03)]">
                    <td className="px-4 py-2.5 font-medium" style={{ color: '#1e1550' }}>{v.doc_type_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#4a4270' }}>
                      {v.file_name ?? (
                        <span className="italic" style={{ color: '#a99fd8' }}>
                          {v.file_key.startsWith('placeholder:') ? '(placeholder)' : v.file_key}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#4a4270' }}>
                      {new Date(v.uploaded_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs italic" style={{ color: '#a99fd8' }}>
                      {v.ai_status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
