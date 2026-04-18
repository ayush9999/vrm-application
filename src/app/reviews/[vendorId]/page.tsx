import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviews } from '@/lib/db/vendor-reviews'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import { ReviewTimelineClient } from './_components/ReviewTimelineClient'

interface PageProps {
  params: Promise<{ vendorId: string }>
}

export default async function VendorReviewJourneyPage({ params }: PageProps) {
  const { vendorId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  const [reviews, metricsMap] = await Promise.all([
    getVendorReviews(vendorId),
    getVendorListMetrics([{ id: vendorId, approval_status: vendor.approval_status }]),
  ])
  const m = metricsMap.get(vendorId)
  const riskStyle = m ? RISK_BAND_STYLE[m.risk.band] : null

  const activeCount = reviews.filter((r) => ['not_started', 'in_progress', 'submitted'].includes(r.status)).length
  const completedCount = reviews.filter((r) => ['approved', 'approved_with_exception', 'done'].includes(r.status)).length

  return (
    <div className="px-6 py-5 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs mb-6" style={{ color: '#a99fd8' }}>
        <Link href="/reviews" className="hover:text-[#6c5dd3]">Reviews</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{vendor.name}</span>
      </div>

      {/* Header card */}
      <div
        className="rounded-2xl p-5 mb-8 flex items-center justify-between gap-6 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, rgba(108,93,211,0.04) 0%, rgba(124,107,224,0.02) 100%)',
          border: '1px solid rgba(109,93,211,0.12)',
        }}
      >
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>{vendor.name}</h1>
            {vendor.vendor_code && (
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.08)', color: '#6b5fa8' }}>
                {vendor.vendor_code}
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: '#8b7fd4' }}>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} — {activeCount} active, {completedCount} completed
          </p>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          {m && (
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>Readiness</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: m.readinessPct === 100 ? '#059669' : '#6c5dd3' }}>
                {m.readinessPct}%
              </div>
            </div>
          )}
          {riskStyle && (
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>Risk</div>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold uppercase mt-0.5" style={{ background: riskStyle.bg, color: riskStyle.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskStyle.dot }} />
                {riskStyle.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {reviews.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No reviews yet</p>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            <Link href={`/vendors/${vendorId}?tab=reviews`} className="underline" style={{ color: '#6c5dd3' }}>Apply review packs</Link> from the vendor profile.
          </p>
        </div>
      ) : (
        <ReviewTimelineClient reviews={reviews} vendorId={vendorId} />
      )}
    </div>
  )
}
