import { notFound } from 'next/navigation'
import { getEvidenceRequestByToken } from '@/lib/db/evidence-requests'
import { RequestPortalClient } from './_components/RequestPortalClient'
import { uploadRequestEvidenceAction } from './actions'

interface PageProps {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function RequestPortalPage({ params }: PageProps) {
  const { token } = await params
  const ctx = await getEvidenceRequestByToken(token)
  if (!ctx) notFound()

  if (ctx.liveStatus !== 'sent' && ctx.liveStatus !== 'partially_replied') {
    const reason =
      ctx.liveStatus === 'expired'   ? 'expired' :
      ctx.liveStatus === 'cancelled' ? 'been cancelled' :
      ctx.liveStatus === 'completed' ? 'been completed' :
                                       'closed'
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#ecedf2' }}>
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8" style={{ border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}>
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: 'rgba(225,29,72,0.08)' }}
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="7" />
              <path d="M5 5l6 6M11 5l-6 6" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold mb-2" style={{ color: '#1e1550' }}>
            This request has {reason}
          </h1>
          <p className="text-sm" style={{ color: '#6b5fa8' }}>
            Please contact your point of contact for a new link if you still need to upload.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#ecedf2' }}>
      <RequestPortalClient
        token={token}
        request={ctx.request}
        vendor={ctx.vendor!}
        items={ctx.items as unknown as Array<{
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
        }>}
        uploadAction={uploadRequestEvidenceAction}
      />
    </div>
  )
}
