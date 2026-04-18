import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReview } from '@/lib/db/vendor-reviews'
import { getVendorReviewItems } from '@/lib/db/review-packs'
import type { VendorReviewPack, VendorReviewItem } from '@/types/review-pack'

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  not_started:              { label: 'Not Started',    bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  in_progress:              { label: 'In Progress',    bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  submitted:                { label: 'Submitted',      bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  approved:                 { label: 'Approved',       bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception:  { label: 'Approved (Exc)', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  done:                     { label: 'Done',           bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  cancelled:                { label: 'Cancelled',      bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

const TYPE_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  onboarding: { label: 'Onboarding',  bg: 'rgba(109,93,211,0.1)',  color: '#6c5dd3' },
  scheduled:  { label: 'Scheduled',   bg: 'rgba(14,165,233,0.1)',  color: '#0284c7' },
  on_demand:  { label: 'On Demand',   bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
}

const DECISION_STYLE: Record<string, { label: string; color: string }> = {
  not_started:        { label: 'Pending',     color: '#94a3b8' },
  pass:               { label: 'Pass',        color: '#059669' },
  fail:               { label: 'Fail',        color: '#e11d48' },
  na:                 { label: 'N/A',         color: '#64748b' },
  needs_follow_up:    { label: 'Follow-up',   color: '#d97706' },
  exception_approved: { label: 'Exception',   color: '#7c3aed' },
}

interface PageProps {
  params: Promise<{ id: string; reviewId: string }>
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { id: vendorId, reviewId } = await params
  const user = await requireCurrentUser()

  const [vendor, review] = await Promise.all([
    getVendorById(user.orgId, vendorId),
    getVendorReview(reviewId),
  ])
  if (!vendor || !review) notFound()

  const packs = review.packs ?? []

  // Fetch items for all packs in parallel
  const packItems = await Promise.all(
    packs.map((p) => getVendorReviewItems(p.id)),
  )

  const totalItems = packItems.reduce((s, items) => s + items.length, 0)
  const passedItems = packItems.reduce((s, items) => s + items.filter((i) => i.decision === 'pass' || i.decision === 'exception_approved').length, 0)
  const failedItems = packItems.reduce((s, items) => s + items.filter((i) => i.decision === 'fail').length, 0)
  const applicableItems = packItems.reduce((s, items) => s + items.filter((i) => i.decision !== 'na').length, 0)
  const readinessPct = applicableItems > 0 ? Math.round((passedItems / applicableItems) * 100) : 0

  const statusStyle = STATUS_STYLE[review.status] ?? STATUS_STYLE.not_started
  const typeStyle = TYPE_STYLE[review.review_type] ?? TYPE_STYLE.on_demand

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs" style={{ color: '#a99fd8' }}>
        <Link href="/vendors" className="hover:text-[#6c5dd3] transition-colors" style={{ color: '#a99fd8' }}>Vendors</Link>
        <span>/</span>
        <Link href={`/vendors/${vendorId}`} className="hover:text-[#6c5dd3] transition-colors" style={{ color: '#a99fd8' }}>{vendor.name}</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>{review.review_code}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
              {review.review_code}
            </h1>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase" style={{ background: typeStyle.bg, color: typeStyle.color }}>
              {typeStyle.label}
            </span>
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {statusStyle.label}
            </span>
          </div>
          <p className="text-sm" style={{ color: '#8b7fd4' }}>
            {vendor.name} {vendor.vendor_code ? `(${vendor.vendor_code})` : ''}
            {review.reviewer_name && <> · Reviewer: {review.reviewer_name}</>}
            {review.approver_name && <> · Approver: {review.approver_name}</>}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Readiness" value={`${readinessPct}%`} color={readinessPct >= 80 ? '#059669' : readinessPct >= 50 ? '#6c5dd3' : '#d97706'} />
        <StatCard label="Total Items" value={String(totalItems)} color="#1e1550" />
        <StatCard label="Passed" value={String(passedItems)} color="#059669" />
        <StatCard label="Failed" value={String(failedItems)} color="#e11d48" />
        <StatCard label="Packs" value={`${packs.length}`} color="#6c5dd3" />
      </div>

      {/* Pack sections */}
      <div className="space-y-4">
        {packs.map((pack, packIdx) => {
          const items = packItems[packIdx] ?? []
          const packApplicable = items.filter((i) => i.decision !== 'na').length
          const packPassed = items.filter((i) => i.decision === 'pass' || i.decision === 'exception_approved').length
          const packPct = packApplicable > 0 ? Math.round((packPassed / packApplicable) * 100) : 0

          return (
            <div
              key={pack.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
            >
              {/* Pack header */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.02)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
                    {pack.review_pack_name ?? 'Unknown Pack'}
                  </span>
                  {pack.review_pack_code && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3' }}>
                      {pack.review_pack_code}
                    </span>
                  )}
                  {pack.is_excluded && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.15)', color: '#64748b' }}>
                      Excluded
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums" style={{ color: packPct >= 80 ? '#059669' : '#6c5dd3' }}>
                    {packPassed}/{packApplicable} passed · {packPct}%
                  </span>
                  <Link
                    href={`/vendors/${vendorId}/reviews/${pack.id}`}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
                    style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
                  >
                    Review Items →
                  </Link>
                </div>
              </div>

              {/* Items list */}
              <div>
                {items.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs" style={{ color: '#a99fd8' }}>No review items</div>
                ) : (
                  items.map((item, i) => {
                    const dec = DECISION_STYLE[item.decision] ?? DECISION_STYLE.not_started
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-5 py-2.5"
                        style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(109,93,211,0.04)' : 'none' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dec.color }} />
                        <span className="flex-1 text-sm" style={{ color: '#1e1550' }}>
                          {item.requirement_name}
                        </span>
                        {item.compliance_references && item.compliance_references.length > 0 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.05)', color: '#8b7fd4' }}>
                            {item.compliance_references[0].standard}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0"
                          style={{ background: `${dec.color}18`, color: dec.color }}
                        >
                          {dec.label}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 1px 4px rgba(109,93,211,0.04)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  )
}
