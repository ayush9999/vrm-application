'use client'

import { useState, useTransition } from 'react'
import type { EvidenceRequest } from '@/lib/db/evidence-requests'

interface RequestItem {
  id: string
  status: 'pending' | 'replied'
  replied_at: string | null
  vendor_document_id: string
  vendor_documents: {
    id: string
    evidence_status: string
    evidence_requirement_id: string
    evidence_requirements: {
      id: string
      name: string
      description: string | null
      required: boolean
      expiry_applies: boolean
      accepted_formats: string | null
      review_pack_id: string
      review_packs: { id: string; name: string; code: string | null }
    }
  }
}

interface Props {
  token: string
  request: EvidenceRequest
  vendor: { id: string; name: string; vendor_code: string | null }
  items: RequestItem[]
  uploadAction: (
    token: string,
    vendorDocumentId: string,
    formData: FormData,
  ) => Promise<{ success: boolean; message?: string }>
}

export function RequestPortalClient({ token, request, vendor, items, uploadAction }: Props) {
  const replied = items.filter((i) => i.status === 'replied').length
  const total = items.length
  const pct = total > 0 ? Math.round((replied / total) * 100) : 0

  // Group by review pack
  const grouped = items.reduce<Record<string, { packName: string; packCode: string | null; items: RequestItem[] }>>(
    (acc, item) => {
      const pack = item.vendor_documents.evidence_requirements.review_packs
      const key = pack?.id ?? 'other'
      if (!acc[key]) {
        acc[key] = { packName: pack?.name ?? 'Other', packCode: pack?.code ?? null, items: [] }
      }
      acc[key].items.push(item)
      return acc
    },
    {},
  )

  const allReplied = replied === total

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>Evidence request</p>
        <h1 className="text-xl font-semibold mt-1" style={{ color: '#1e1550' }}>{vendor.name}</h1>
        {request.message && (
          <p className="text-sm mt-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(108,93,211,0.04)', color: '#4a4270', borderLeft: '3px solid #6c5dd3' }}>
            “{request.message}”
          </p>
        )}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.08)' }}>
            <div
              className="h-full transition-all"
              style={{ width: `${Math.max(pct, replied > 0 ? 4 : 0)}%`, background: pct === 100 ? '#059669' : '#6c5dd3' }}
            />
          </div>
          <span className="text-sm tabular-nums" style={{ color: '#1e1550' }}>
            <strong>{replied}</strong>/{total} uploaded
          </span>
        </div>
        {request.due_date && (
          <p className="text-xs mt-2" style={{ color: '#6b5fa8' }}>
            Due by {new Date(request.due_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>

      {allReplied && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.18)' }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="7" />
            <path d="M5 8l2 2 4-4" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1e1550' }}>All uploads received</p>
            <p className="text-xs" style={{ color: '#4a4270' }}>You can close this page. The reviewer has been notified.</p>
          </div>
        </div>
      )}

      {/* Items grouped by pack */}
      {Object.entries(grouped).map(([key, group]) => (
        <section key={key}>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#6b5fa8' }}>
            {group.packName} {group.packCode && <span className="font-mono" style={{ color: '#c4bae8' }}>· {group.packCode}</span>}
          </h2>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}>
            {group.items.map((item, i) => (
              <RequestItemRow
                key={item.id}
                token={token}
                item={item}
                uploadAction={uploadAction}
                isLast={i === group.items.length - 1}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-xs" style={{ color: '#6b5fa8' }}>
        Link expires {new Date(request.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}

function RequestItemRow({
  token,
  item,
  uploadAction,
  isLast,
}: {
  token: string
  item: RequestItem
  uploadAction: Props['uploadAction']
  isLast: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [justUploaded, setJustUploaded] = useState(false)

  const req = item.vendor_documents.evidence_requirements
  const replied = item.status === 'replied' || justUploaded

  const handleUpload = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await uploadAction(token, item.vendor_document_id, formData)
      if (result.success) setJustUploaded(true)
      else setError(result.message ?? 'Upload failed')
    })
  }

  return (
    <div
      className="px-4 py-4 space-y-3"
      style={{ borderBottom: isLast ? undefined : '1px solid rgba(109,93,211,0.06)', background: replied ? 'rgba(5,150,105,0.03)' : undefined }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {replied ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: '#059669' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l3 3 6-6" />
              </svg>
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full" style={{ background: 'rgba(108,93,211,0.1)', color: '#6c5dd3', fontSize: 11, fontWeight: 600 }}>
              ○
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: '#1e1550' }}>{req.name}</span>
            {req.required && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                Required
              </span>
            )}
          </div>
          {req.description && (
            <p className="text-xs mt-1" style={{ color: '#4a4270' }}>{req.description}</p>
          )}
          {req.accepted_formats && (
            <p className="text-xs mt-1" style={{ color: '#6b5fa8' }}>
              Accepted: {req.accepted_formats}
            </p>
          )}
        </div>
      </div>

      {!replied && (
        <form action={handleUpload} className="flex items-center gap-2">
          <label
            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium flex-1"
            style={{ border: '1px solid rgba(109,93,211,0.2)', color: '#6c5dd3', background: 'rgba(109,93,211,0.03)' }}
          >
            <input
              type="file"
              name="file"
              required
              className="hidden"
              onChange={(e) => {
                const span = e.target.closest('label')?.querySelector('[data-filename]') as HTMLElement | null
                if (span && e.target.files?.[0]) span.textContent = e.target.files[0].name
              }}
            />
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#6c5dd3" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 12V4M5 7l3-3 3 3M3 14h10" />
            </svg>
            <span data-filename className="truncate" style={{ color: '#4a4270' }}>Choose file</span>
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-lg text-white disabled:opacity-50 shrink-0"
            style={{ background: '#6c5dd3' }}
          >
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}

      {replied && (
        <p className="text-xs ml-8" style={{ color: '#059669' }}>
          ✓ Uploaded — thank you
        </p>
      )}

      {error && <p className="text-xs ml-8" style={{ color: '#e11d48' }}>{error}</p>}
    </div>
  )
}
