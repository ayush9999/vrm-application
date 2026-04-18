import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorReviewPacks, getVendorListMetrics } from '@/lib/db/review-packs'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import type { VendorReviewPack, VendorReviewPackStatus } from '@/types/review-pack'
import { JourneyCardActions } from './_components/JourneyCardActions'
import { submitReviewForApprovalAction, approveReviewAction } from '../../vendors/[id]/reviews/actions'

const STATUS_STYLE: Record<VendorReviewPackStatus, { label: string; bg: string; color: string; dot: string }> = {
  not_started:              { label: 'Not Started',       bg: 'rgba(148,163,184,0.1)',  color: '#64748b', dot: '#94a3b8' },
  in_progress:              { label: 'In Progress',       bg: 'rgba(14,165,233,0.08)',  color: '#0284c7', dot: '#0ea5e9' },
  awaiting_approval:        { label: 'Awaiting Approval', bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed', dot: '#8b5cf6' },
  sent_back:                { label: 'Sent Back',         bg: 'rgba(245,158,11,0.08)',  color: '#d97706', dot: '#f59e0b' },
  submitted:                { label: 'Submitted',         bg: 'rgba(99,102,241,0.08)',  color: '#6366f1', dot: '#818cf8' },
  approved:                 { label: 'Approved',          bg: 'rgba(5,150,105,0.08)',   color: '#059669', dot: '#10b981' },
  approved_with_exception:  { label: 'Approved (Exc)',    bg: 'rgba(245,158,11,0.08)',  color: '#d97706', dot: '#f59e0b' },
  locked:                   { label: 'Locked',            bg: 'rgba(5,150,105,0.08)',   color: '#059669', dot: '#10b981' },
  upcoming:                 { label: 'Upcoming',          bg: 'rgba(14,165,233,0.06)',  color: '#0ea5e9', dot: '#38bdf8' },
  blocked:                  { label: 'Blocked',           bg: 'rgba(225,29,72,0.08)',   color: '#e11d48', dot: '#f43f5e' },
}

interface PageProps {
  params: Promise<{ vendorId: string }>
}

export default async function VendorReviewJourneyPage({ params }: PageProps) {
  const { vendorId } = await params
  const user = await requireCurrentUser()

  const vendor = await getVendorById(user.orgId, vendorId)
  if (!vendor) notFound()

  const packs = await getVendorReviewPacks(vendorId)
  const metricsMap = await getVendorListMetrics([{ id: vendorId, approval_status: vendor.approval_status }])
  const m = metricsMap.get(vendorId)
  const riskStyle = m ? RISK_BAND_STYLE[m.risk.band] : null

  const todayStr = new Date().toISOString().split('T')[0]

  // Sort all packs by relevance: active first, then upcoming by due date, then completed newest first
  const sorted = [...packs].sort((a, b) => {
    const activeStatuses = ['in_progress', 'awaiting_approval', 'sent_back', 'not_started']
    const aActive = activeStatuses.includes(a.status) ? 0 : a.status === 'upcoming' ? 1 : a.status === 'blocked' ? 2 : 3
    const bActive = activeStatuses.includes(b.status) ? 0 : b.status === 'upcoming' ? 1 : b.status === 'blocked' ? 2 : 3
    if (aActive !== bActive) return aActive - bActive
    // Within same group, sort by date
    const aDate = String(a.due_at ?? a.completed_at ?? a.created_at ?? '9999')
    const bDate = String(b.due_at ?? b.completed_at ?? b.created_at ?? '9999')
    if (aActive <= 1) return aDate.localeCompare(bDate) // active/upcoming: earliest first
    return bDate.localeCompare(aDate) // completed: newest first
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
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
            {sorted.length} reviews — {sorted.filter((p) => ['in_progress', 'awaiting_approval', 'sent_back', 'not_started'].includes(p.status)).length} active,{' '}
            {sorted.filter((p) => p.status === 'upcoming').length} upcoming,{' '}
            {sorted.filter((p) => ['approved', 'approved_with_exception', 'locked'].includes(p.status)).length} completed
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
      {sorted.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No reviews yet</p>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            <Link href={`/vendors/${vendorId}?tab=reviews`} className="underline" style={{ color: '#6c5dd3' }}>Apply review packs</Link> from the vendor profile.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline center line */}
          <div
            className="absolute left-5 top-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(to bottom, #6c5dd3 0%, rgba(109,93,211,0.15) 100%)' }}
          />

          <div className="space-y-0">
            {sorted.map((pack, idx) => {
              const sty = STATUS_STYLE[pack.status]
              const counts = pack.item_counts ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
              const applicable = counts.total - counts.na
              const pct = applicable > 0 ? Math.round((counts.passed / applicable) * 100) : 0
              const isOverdue = pack.due_at && pack.due_at.split('T')[0] < todayStr && !['approved', 'approved_with_exception', 'locked'].includes(pack.status)
              const isCompleted = ['approved', 'approved_with_exception', 'locked'].includes(pack.status)
              const dateStr = isCompleted && pack.completed_at
                ? new Date(pack.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : pack.due_at
                ? new Date(pack.due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : new Date(pack.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              const dateLabel = isCompleted ? 'Completed' : pack.due_at ? (isOverdue ? 'Overdue' : 'Due') : 'Created'

              return (
                <div key={pack.id} className="relative pl-12 pb-6">
                  {/* Timeline dot */}
                  <div
                    className="absolute left-3.5 top-4 w-3 h-3 rounded-full ring-2 ring-white"
                    style={{ background: sty.dot }}
                  />

                  {/* Date label */}
                  <div className="text-[10px] font-medium mb-1.5 flex items-center gap-2" style={{ color: isOverdue ? '#e11d48' : '#8b7fd4' }}>
                    <span className="uppercase tracking-wider">{dateLabel}</span>
                    <span className="font-semibold">{dateStr}</span>
                    {isOverdue && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>Overdue</span>}
                  </div>

                  {/* Card */}
                  <Link
                    href={`/vendors/${vendorId}/reviews/${pack.id}`}
                    className="block rounded-xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{
                      background: isCompleted ? 'rgba(5,150,105,0.02)' : 'white',
                      border: `1px solid ${isOverdue ? 'rgba(225,29,72,0.2)' : isCompleted ? 'rgba(5,150,105,0.15)' : 'rgba(109,93,211,0.1)'}`,
                      boxShadow: '0 1px 4px rgba(109,93,211,0.04)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>
                          {pack.review_pack_name ?? 'Review Pack'}
                        </span>
                        <ReviewTypeBadge type={pack.review_type} />
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                          style={{ background: sty.bg, color: sty.color }}
                        >
                          {pack.status === 'locked' ? '🔒 ' : ''}{sty.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <JourneyCardActions
                          vendorId={vendorId}
                          packId={pack.id}
                          status={pack.status}
                          submitAction={submitReviewForApprovalAction}
                          approveAction={approveReviewAction}
                        />
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(109,93,211,0.04)', color: '#6c5dd3' }}>
                          Open →
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {applicable > 0 && (
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : isOverdue ? '#e11d48' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }}
                          />
                        </div>
                        <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: pct === 100 ? '#059669' : '#6c5dd3' }}>
                          {pct}%
                        </span>
                        <span className="text-[10px] shrink-0" style={{ color: '#a99fd8' }}>
                          {counts.passed}/{applicable}
                        </span>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[10px] flex-wrap" style={{ color: '#8b7fd4' }}>
                      {pack.review_pack_code && <span className="font-mono">{pack.review_pack_code}</span>}
                      {counts.failed > 0 && <span style={{ color: '#e11d48' }}>{counts.failed} failed</span>}
                      {counts.not_started > 0 && <span>{counts.not_started} pending</span>}
                      {pack.matched_rule && <span className="italic ml-auto">{pack.matched_rule}</span>}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Compare link */}
      {sorted.filter((p) => ['approved', 'approved_with_exception', 'locked'].includes(p.status)).length >= 2 && (
        <div className="text-center pt-4 mt-2">
          <Link
            href={`/vendors/${vendorId}/reviews/compare`}
            className="text-sm font-medium px-5 py-2 rounded-full inline-flex items-center gap-1.5"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            Compare completed reviews →
          </Link>
        </div>
      )}
    </div>
  )
}

function ReviewTypeBadge({ type }: { type?: string }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    onboarding: { label: 'Onboarding', bg: 'rgba(14,165,233,0.08)', color: '#0284c7' },
    scheduled:  { label: 'Scheduled',  bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
    on_demand:  { label: 'On-Demand',  bg: 'rgba(245,158,11,0.08)', color: '#d97706' },
  }
  const c = config[type ?? 'onboarding'] ?? config.onboarding
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}
