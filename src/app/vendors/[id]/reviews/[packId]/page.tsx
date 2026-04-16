import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviewItems, getVendorListMetrics } from '@/lib/db/review-packs'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import { createServerClient } from '@/lib/supabase/server'
import { ReviewPackClient } from './_components/ReviewPackClient'
import { PortalPanel } from './_components/PortalPanel'
import {
  setReviewItemDecisionAction,
  aiAssistReviewItemAction,
  createPortalLinkAction,
  revokePortalLinkAction,
} from './actions'
import { uploadEvidenceFileAction } from '../../evidence-actions'
import { listPortalLinks } from '@/lib/db/vendor-portal'

interface PageProps {
  params: Promise<{ id: string; packId: string }>
}

export default async function ReviewPackDetailPage({ params }: PageProps) {
  const { id: vendorId, packId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  // Fetch the vendor_review_pack + parent review_pack
  const supabase = await createServerClient()
  const { data: vrp } = await supabase
    .from('vendor_review_packs')
    .select(`
      *,
      review_packs!inner ( id, name, code, description )
    `)
    .eq('id', packId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!vrp) notFound()

  const items = await getVendorReviewItems(packId)
  const pack = (vrp as { review_packs: { id: string; name: string; code: string | null; description: string | null } }).review_packs

  // Vendor-level risk + readiness for the header badges
  const metricsMap = await getVendorListMetrics([{ id: vendorId, approval_status: vendor.approval_status }])
  const m = metricsMap.get(vendorId)
  const riskStyle = m ? RISK_BAND_STYLE[m.risk.band] : null

  // Portal links for this pack
  const portalLinks = await listPortalLinks(packId)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/vendors" className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Vendors</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>{vendor.name}</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}?tab=reviews`} className="hover:text-[#6c5dd3]" style={{ color: '#a99fd8' }}>Reviews</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{pack.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{pack.name}</h1>
            {pack.description && (
              <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>{pack.description}</p>
            )}
          </div>
          {/* Vendor-level summary badges */}
          {m && riskStyle && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
                  Vendor Risk
                </div>
                <span
                  className="inline-flex items-center gap-1.5 mt-1 text-xs px-2 py-0.5 rounded-full font-bold uppercase"
                  style={{ background: riskStyle.bg, color: riskStyle.color }}
                  title={m.risk.formula}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskStyle.dot }} />
                  {riskStyle.label} · {m.risk.score}
                </span>
              </div>
              <div className="h-10 w-px" style={{ background: 'rgba(109,93,211,0.1)' }} />
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6c5dd3' }}>
                  Vendor Readiness
                </div>
                <div className="text-sm font-semibold mt-1" style={{ color: '#1e1550' }}>
                  {m.readinessPct}% · {m.completed} / {m.applicable}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <PortalPanel
          vendorId={vendorId}
          vendorReviewPackId={packId}
          initialLinks={portalLinks}
          createAction={createPortalLinkAction}
          revokeAction={revokePortalLinkAction}
        />
      </div>

      <ReviewPackClient
        vendorId={vendorId}
        packId={packId}
        items={items}
        setDecisionAction={setReviewItemDecisionAction}
        aiAssistAction={aiAssistReviewItemAction}
        uploadEvidenceAction={uploadEvidenceFileAction}
      />
    </div>
  )
}
