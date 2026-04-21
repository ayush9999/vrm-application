import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getCachedReviewsByVendor } from '@/lib/db/cached'
import { getReviewPacks } from '@/lib/db/review-packs'
import { getVendors } from '@/lib/db/vendors'
import { getOrgUsers } from '@/lib/db/organizations'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import type { ReviewVendorRow } from '@/lib/db/reviews-by-vendor'
import { CreateReviewButton } from './_components/CreateReviewButton'
import { createReviewAction } from './create-actions'

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function ReviewsPage({ searchParams }: PageProps) {
  const user = await requireCurrentUser()
  const sp = await searchParams
  const filter = sp.filter

  const [allVendors2, vendorsPage, packs, orgUsers] = await Promise.all([
    getCachedReviewsByVendor(user.orgId),
    getVendors(user.orgId, { pageSize: 500 }),
    getReviewPacks(user.orgId),
    getOrgUsers(user.orgId),
  ])

  // Apply filter
  const today = new Date()
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  let vendors = allVendors2
  if (filter === 'due') {
    // Only vendors with next_due_at within this month
    vendors = allVendors2.filter((v) => v.next_due_at && String(v.next_due_at).split('T')[0] <= endOfMonth)
  } else if (filter === 'overdue') {
    vendors = allVendors2.filter((v) => v.overdue_count > 0)
  }

  const allVendors = vendorsPage.rows.map((v) => ({ id: v.id, name: v.name, vendor_code: v.vendor_code }))
  const allPacks = packs.map((p) => ({ id: p.id, name: p.name, code: p.code }))

  const totalActive = vendors.reduce((s, v) => s + v.active_packs, 0)
  const totalOverdue = vendors.reduce((s, v) => s + v.overdue_count, 0)
  const totalUpcoming = vendors.reduce((s, v) => s + v.upcoming_packs, 0)
  const vendorsAwaitingApproval = vendors.filter((v) => v.active_packs > 0).length

  return (
    <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Reviews</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b7fd4' }}>
            Vendor review status across your organisation. Click a vendor to see their full review journey.
          </p>
        </div>
        <CreateReviewButton
          vendors={allVendors}
          packs={allPacks}
          users={orgUsers}
          createAction={createReviewAction}
        />
      </div>

      {/* Filter banner */}
      {filter && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.15)' }}>
          <div className="text-sm" style={{ color: '#4a4270' }}>
            Filtered: <strong style={{ color: '#6c5dd3' }}>{filter === 'due' ? 'Reviews due this month' : filter === 'overdue' ? 'Overdue reviews' : filter}</strong>
            <span className="ml-2" style={{ color: '#8b7fd4' }}>
              ({vendors.length} vendor{vendors.length !== 1 ? 's' : ''})
            </span>
          </div>
          <Link href="/reviews" className="text-xs font-medium" style={{ color: '#6c5dd3' }}>
            Clear filter ✕
          </Link>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active Reviews" value={totalActive} color="#6c5dd3" />
        <Stat label="Overdue" value={totalOverdue} color={totalOverdue > 0 ? '#e11d48' : '#a99fd8'} />
        <Stat label="Upcoming" value={totalUpcoming} color="#0ea5e9" />
        <Stat label="Vendors In Review" value={vendorsAwaitingApproval} color="#7c3aed" />
      </div>

      {/* Vendor list */}
      {vendors.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No vendors with reviews yet.</p>
          <p className="text-xs mt-1" style={{ color: '#8b7fd4' }}>
            <Link href="/vendors/new" className="underline hover:opacity-80" style={{ color: '#6c5dd3' }}>Add a vendor</Link> to get started.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
                  {['Vendor', 'Reviews', 'Readiness', 'Risk', 'Next Due', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <VendorRow key={v.vendor_id} v={v} todayStr={todayStr} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function VendorRow({ v, todayStr }: { v: ReviewVendorRow; todayStr: string }) {
  const risk = RISK_BAND_STYLE[v.risk_band]
  const isOverdue = v.overdue_count > 0
  const dueStr = v.next_due_at
    ? new Date(v.next_due_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—'
  const duePast = v.next_due_at ? v.next_due_at.split('T')[0] < todayStr : false

  return (
    <tr
      className="hover:bg-[rgba(109,93,211,0.02)] transition-colors cursor-pointer"
      style={{ borderBottom: '1px solid rgba(109,93,211,0.04)' }}
    >
      <td className="px-4 py-3.5">
        <Link href={`/reviews/${v.vendor_id}`} className="block">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: '#1e1550' }}>{v.vendor_name}</span>
            {v.vendor_criticality_tier && (
              <span
                className="text-[9px] px-1 rounded font-bold shrink-0"
                style={
                  v.vendor_criticality_tier <= 2
                    ? { background: 'rgba(225,29,72,0.1)', color: '#e11d48' }
                    : { background: 'rgba(109,93,211,0.05)', color: '#6c5dd3' }
                }
              >T{v.vendor_criticality_tier}</span>
            )}
            {isOverdue && <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: '#e11d48' }} />}
          </div>
          {v.vendor_code && <div className="text-[10px] font-mono mt-0.5" style={{ color: '#a99fd8' }}>{v.vendor_code}</div>}
        </Link>
      </td>
      <td className="px-4 py-3.5">
        <Link href={`/reviews/${v.vendor_id}`} className="block">
          <div className="flex items-center gap-2 flex-wrap">
            {v.active_packs > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(14,165,233,0.1)', color: '#0284c7' }}>
                {v.active_packs} active
              </span>
            )}
            {v.upcoming_packs > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(14,165,233,0.06)', color: '#0ea5e9' }}>
                {v.upcoming_packs} upcoming
              </span>
            )}
            {v.completed_packs > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                {v.completed_packs} done
              </span>
            )}
            {v.overdue_count > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(225,29,72,0.1)', color: '#e11d48' }}>
                {v.overdue_count} overdue
              </span>
            )}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3.5">
        <div className="min-w-[90px]">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-bold tabular-nums" style={{ color: v.readiness_pct === 100 ? '#059669' : v.readiness_pct >= 50 ? '#6c5dd3' : '#d97706' }}>
              {v.readiness_pct}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
            <div className="h-full rounded-full" style={{ width: `${v.readiness_pct}%`, background: v.readiness_pct === 100 ? '#059669' : 'linear-gradient(90deg, #6c5dd3, #7c6be0)' }} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
          style={{ background: risk.bg, color: risk.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: risk.dot }} />
          {risk.label}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span
          className="text-xs"
          style={{ color: duePast ? '#e11d48' : '#4a4270', fontWeight: duePast ? 600 : 400 }}
        >
          {dueStr}
          {duePast && <span className="ml-1 text-[9px] font-bold uppercase">Overdue</span>}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <ApprovalChip status={v.vendor_approval_status} />
      </td>
      <td className="px-4 py-3.5 text-right">
        <Link
          href={`/reviews/${v.vendor_id}`}
          className="text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
        >
          View Journey →
        </Link>
      </td>
    </tr>
  )
}

function ApprovalChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:                   { label: 'Draft',          bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
    waiting_on_vendor:       { label: 'Waiting Vendor', bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
    in_internal_review:      { label: 'In Review',      bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
    approved:                { label: 'Approved',       bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
    approved_with_exception: { label: 'Approved (Exc)', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
    blocked:                 { label: 'Blocked',        bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
    suspended:               { label: 'Suspended',      bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
    offboarded:              { label: 'Offboarded',     bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  }
  const s = map[status] ?? { label: status, bg: 'rgba(148,163,184,0.1)', color: '#64748b' }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}>
      <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  )
}
