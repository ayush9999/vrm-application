'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ReviewItem {
  id: string
  decision: string
  reviewer_comment: string | null
  review_requirements: {
    id: string
    name: string
    description: string | null
    required: boolean
    linked_evidence_requirement_id: string | null
  }
}

interface EvidenceRow {
  id: string
  evidence_status: string
  evidence_requirement_id: string
  current_version_id: string | null
  evidence_requirements: {
    id: string
    name: string
    required: boolean
    expiry_applies: boolean
    review_pack_id: string
  }
}

interface Props {
  token: string
  vendor: { id: string; name: string; vendor_code: string | null }
  pack: { id: string; status: string; review_packs: { id: string; name: string; code: string | null; description: string | null } }
  items: ReviewItem[]
  evidence: EvidenceRow[]
  submitReviewAction: (
    token: string,
    reviewItemId: string,
    selfDecision: 'pass' | 'fail' | 'na',
    comment: string | null,
  ) => Promise<{ success: boolean; message?: string }>
  uploadEvidenceAction: (
    token: string,
    evidenceId: string,
    formData: FormData,
  ) => Promise<{ success: boolean; message?: string }>
  finalizeAction: (token: string) => Promise<{ success: boolean; message?: string }>
}

export function PortalClient({
  token,
  vendor,
  pack,
  items,
  evidence,
  submitReviewAction,
  uploadEvidenceAction,
  finalizeAction,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'evidence' | 'questions'>('evidence')
  const [isFinalizing, startFinalize] = useTransition()
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  const handleFinalize = () => {
    if (!confirm('Submit your responses now? You won\'t be able to make further changes after this.')) return
    setFinalizeError(null)
    startFinalize(async () => {
      const r = await finalizeAction(token)
      if (r.success) router.refresh()
      else setFinalizeError(r.message ?? 'Failed to submit')
    })
  }

  // Match evidence to requirements (so we always show all required items even if no evidence row)
  const evidenceByReqId = new Map<string, EvidenceRow>()
  for (const e of evidence) evidenceByReqId.set(e.evidence_requirement_id, e)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
              Vendor Onboarding Questionnaire
            </p>
            <h1 className="text-xl font-semibold mt-1" style={{ color: '#1e1550' }}>{pack.review_packs.name}</h1>
            <p className="text-sm mt-1" style={{ color: '#4a4270' }}>
              <span style={{ color: '#a99fd8' }}>For: </span>
              {vendor.name}
              {vendor.vendor_code && <span className="font-mono ml-2" style={{ color: '#a99fd8' }}>({vendor.vendor_code})</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="text-sm font-medium px-5 py-2 rounded-full text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
          >
            {isFinalizing ? 'Submitting…' : 'Submit Responses'}
          </button>
        </div>
        {pack.review_packs.description && (
          <p className="text-xs mt-3" style={{ color: '#a99fd8' }}>{pack.review_packs.description}</p>
        )}
        {finalizeError && (
          <p className="text-xs mt-2" style={{ color: '#e11d48' }}>{finalizeError}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: 'rgba(109,93,211,0.1)' }}>
        <button
          type="button"
          onClick={() => setTab('evidence')}
          className="px-4 py-2 text-sm font-medium border-b-2"
          style={tab === 'evidence' ? { color: '#6c5dd3', borderColor: '#6c5dd3' } : { color: '#a99fd8', borderColor: 'transparent' }}
        >
          Evidence ({evidence.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('questions')}
          className="px-4 py-2 text-sm font-medium border-b-2"
          style={tab === 'questions' ? { color: '#6c5dd3', borderColor: '#6c5dd3' } : { color: '#a99fd8', borderColor: 'transparent' }}
        >
          Questions ({items.length})
        </button>
      </div>

      {tab === 'evidence' && (
        <section className="space-y-3">
          <p className="text-sm" style={{ color: '#4a4270' }}>
            Upload the documents listed below. You can replace a file by re-uploading.
          </p>
          {evidence.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: 'white', border: '1px dashed rgba(109,93,211,0.2)' }}>
              <p className="text-sm" style={{ color: '#a99fd8' }}>No evidence requirements yet.</p>
            </div>
          ) : (
            evidence.map((e) => (
              <PortalEvidenceRow key={e.id} token={token} row={e} uploadAction={uploadEvidenceAction} />
            ))
          )}
        </section>
      )}

      {tab === 'questions' && (
        <section className="space-y-3">
          <p className="text-sm" style={{ color: '#4a4270' }}>
            Answer the questions below to the best of your ability. Your point of contact will review your responses.
          </p>
          {items.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={{ background: 'white', border: '1px dashed rgba(109,93,211,0.2)' }}>
              <p className="text-sm" style={{ color: '#a99fd8' }}>No review questions for this pack.</p>
            </div>
          ) : (
            items.map((it) => (
              <PortalQuestionRow key={it.id} token={token} item={it} submitAction={submitReviewAction} />
            ))
          )}
        </section>
      )}

      <p className="text-[11px] text-center pt-4" style={{ color: '#a99fd8' }}>
        Powered by VRM · This link is private — do not share
      </p>
    </div>
  )
}

// ─── Evidence row ─────────────────────────────────────────────────────────────

function PortalEvidenceRow({
  token,
  row,
  uploadAction,
}: {
  token: string
  row: EvidenceRow
  uploadAction: Props['uploadEvidenceAction']
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleUpload = (formData: FormData) => {
    setMessage(null)
    startTransition(async () => {
      const r = await uploadAction(token, row.id, formData)
      if (r.success) {
        setMessage('Uploaded')
        router.refresh()
      } else {
        setMessage(r.message ?? 'Upload failed')
      }
    })
  }

  const isUploaded = row.evidence_status === 'uploaded' || row.evidence_status === 'approved' || row.evidence_status === 'under_review'

  return (
    <div className="rounded-xl p-4 bg-white" style={{ border: '1px solid rgba(109,93,211,0.1)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
              {row.evidence_requirements.name}
            </span>
            {row.evidence_requirements.required && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                Required
              </span>
            )}
            {isUploaded && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                ✓ Uploaded
              </span>
            )}
          </div>
        </div>
      </div>
      <form action={handleUpload} className="flex items-center gap-2 mt-3">
        <input
          type="file"
          name="file"
          required
          className="text-xs flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: '#6c5dd3' }}
        >
          {isPending ? 'Uploading…' : isUploaded ? 'Replace' : 'Upload'}
        </button>
      </form>
      {message && <p className="text-[10px] mt-1" style={{ color: message === 'Uploaded' ? '#059669' : '#e11d48' }}>{message}</p>}
    </div>
  )
}

// ─── Question row ─────────────────────────────────────────────────────────────

function PortalQuestionRow({
  token,
  item,
  submitAction,
}: {
  token: string
  item: ReviewItem
  submitAction: Props['submitReviewAction']
}) {
  const [decision, setDecision] = useState<'pass' | 'fail' | 'na' | null>(null)
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  // Detect if there's already a vendor self-attestation in the comment
  const existingPrefix = item.reviewer_comment?.match(/^\[Vendor self-attested (PASS|FAIL|NA)\]/)
  const submitted = !!existingPrefix

  const handleSubmit = () => {
    if (!decision) {
      setMessage('Please pick a response')
      return
    }
    setMessage(null)
    startTransition(async () => {
      const r = await submitAction(token, item.id, decision, comment.trim() || null)
      if (r.success) setMessage('Submitted')
      else setMessage(r.message ?? 'Failed')
    })
  }

  return (
    <div className="rounded-xl p-4 bg-white" style={{ border: '1px solid rgba(109,93,211,0.1)' }}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-sm font-medium" style={{ color: '#1e1550' }}>
          {item.review_requirements.name}
        </span>
        {item.review_requirements.required && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
            Required
          </span>
        )}
        {submitted && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ml-auto" style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
            ✓ {existingPrefix![1]}
          </span>
        )}
      </div>
      {item.review_requirements.description && (
        <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{item.review_requirements.description}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {(['pass', 'fail', 'na'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setDecision(opt)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={
              decision === opt
                ? { background: opt === 'pass' ? '#059669' : opt === 'fail' ? '#e11d48' : '#64748b', color: 'white' }
                : { background: 'rgba(108,93,211,0.04)', color: '#6c5dd3', border: '1px solid rgba(108,93,211,0.15)' }
            }
          >
            {opt === 'pass' ? 'Yes' : opt === 'fail' ? 'No' : 'N/A'}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Add a comment (optional)…"
        className="mt-3 w-full rounded-lg px-3 py-2 text-xs focus:outline-none"
        style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#1e1550' }}
      />
      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !decision}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: '#6c5dd3' }}
        >
          {isPending ? 'Saving…' : 'Submit response'}
        </button>
        {message && <p className="text-[10px]" style={{ color: message === 'Submitted' ? '#059669' : '#e11d48' }}>{message}</p>}
      </div>
    </div>
  )
}
