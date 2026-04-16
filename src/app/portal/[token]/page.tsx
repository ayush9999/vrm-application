import { notFound } from 'next/navigation'
import { getPortalContextByToken } from '@/lib/db/vendor-portal'
import { PortalClient } from './_components/PortalClient'
import {
  portalSubmitReviewResponseAction,
  portalUploadEvidenceAction,
  portalFinalizeAction,
} from './actions'

interface PageProps {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function PortalPage({ params }: PageProps) {
  const { token } = await params
  const ctx = await getPortalContextByToken(token)
  if (!ctx) notFound()

  if (ctx.status !== 'active') {
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
            Link {ctx.status === 'expired' ? 'expired' : ctx.status === 'revoked' ? 'revoked' : 'already submitted'}
          </h1>
          <p className="text-sm" style={{ color: '#a99fd8' }}>
            {ctx.status === 'expired'
              ? 'This portal link has passed its expiry date. Please contact your point of contact for a new link.'
              : ctx.status === 'revoked'
              ? 'This portal link has been revoked.'
              : 'You\'ve already submitted your responses on this link. Contact your point of contact if you need to make changes.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#ecedf2' }}>
      <PortalClient
        token={token}
        vendor={ctx.vendor!}
        pack={ctx.pack!}
        items={ctx.items as unknown as Array<{
          id: string
          decision: string
          reviewer_comment: string | null
          review_requirements: { id: string; name: string; description: string | null; required: boolean; linked_evidence_requirement_id: string | null }
        }>}
        evidence={ctx.evidence as unknown as Array<{
          id: string
          evidence_status: string
          evidence_requirement_id: string
          current_version_id: string | null
          evidence_requirements: { id: string; name: string; required: boolean; expiry_applies: boolean; review_pack_id: string }
        }>}
        submitReviewAction={portalSubmitReviewResponseAction}
        uploadEvidenceAction={portalUploadEvidenceAction}
        finalizeAction={portalFinalizeAction}
      />
    </div>
  )
}
