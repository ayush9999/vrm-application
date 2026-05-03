import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getCachedReviewsByVendor } from '@/lib/db/cached'
import { getReviewPacks } from '@/lib/db/review-packs'
import { getVendors } from '@/lib/db/vendors'
import { getOrgUsers } from '@/lib/db/organizations'
import sql from '@/lib/db/pool'
import { CreateReviewButton } from './_components/CreateReviewButton'
import { ReviewsTable } from './_components/ReviewsTable'
import { createReviewAction } from './create-actions'

interface PageProps {
  searchParams: Promise<{ filter?: string; pack?: string; readiness?: string }>
}

export default async function ReviewsPage({ searchParams }: PageProps) {
  const user = await requireCurrentUser()
  const sp = await searchParams
  const filter = sp.filter
  const packCode = sp.pack
  const readinessFilter = sp.readiness // 'on_track' | 'below_30'

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

  // Pack filter — narrows to vendors that have the named pack assigned
  let packLabel: string | null = null
  if (packCode) {
    const packMatch = packs.find((p) => p.code === packCode)
    packLabel = packMatch?.name ?? packCode
    if (packMatch) {
      const rows = await sql<{ vendor_id: string }[]>`
        SELECT DISTINCT vendor_id
        FROM vendor_review_packs
        WHERE org_id = ${user.orgId}
          AND review_pack_id = ${packMatch.id}
          AND deleted_at IS NULL
      `
      const vendorIds = new Set(rows.map((r) => r.vendor_id))
      vendors = vendors.filter((v) => vendorIds.has(v.vendor_id))
    } else {
      vendors = []
    }
  }

  // Readiness filter — narrows by aggregate readiness_pct band
  if (readinessFilter === 'on_track') {
    vendors = vendors.filter((v) => v.readiness_pct >= 60)
  } else if (readinessFilter === 'below_30') {
    vendors = vendors.filter((v) => v.readiness_pct < 30)
  }

  const allVendors = vendorsPage.rows.map((v) => ({ id: v.id, name: v.name, vendor_code: v.vendor_code }))
  const allPacks = packs.map((p) => ({ id: p.id, name: p.name, code: p.code }))

  const totalActive = vendors.reduce((s, v) => s + v.active_packs, 0)
  const totalOverdue = vendors.reduce((s, v) => s + v.overdue_count, 0)
  const totalUpcoming = vendors.reduce((s, v) => s + v.upcoming_packs, 0)
  const vendorsAwaitingApproval = vendors.filter((v) => v.active_packs > 0).length

  return (
    <div className="px-6 py-5 max-w-screen-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Reviews</h1>
          <p className="text-sm mt-0.5" style={{ color: '#5d5285' }}>
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
      {(filter || packCode || readinessFilter) && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.15)' }}>
          <div className="text-sm flex items-center gap-2 flex-wrap" style={{ color: '#4a4270' }}>
            <span>Filtered:</span>
            {filter && (
              <strong style={{ color: '#6c5dd3' }}>
                {filter === 'due' ? 'Reviews due this month' : filter === 'overdue' ? 'Overdue reviews' : filter}
              </strong>
            )}
            {packCode && (
              <strong style={{ color: '#6c5dd3' }}>Pack: {packLabel}</strong>
            )}
            {readinessFilter && (
              <strong style={{ color: '#6c5dd3' }}>
                {readinessFilter === 'on_track' ? 'Readiness ≥ 60%' : readinessFilter === 'below_30' ? 'Readiness &lt; 30%' : readinessFilter}
              </strong>
            )}
            <span style={{ color: '#5d5285' }}>
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
        <Stat label="Overdue" value={totalOverdue} color={totalOverdue > 0 ? '#e11d48' : '#6b5fa8'} />
        <Stat label="Upcoming" value={totalUpcoming} color="#0ea5e9" />
        <Stat label="Vendors In Review" value={vendorsAwaitingApproval} color="#7c3aed" />
      </div>

      {/* Vendor list */}
      {vendors.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: '1.5px dashed rgba(109,93,211,0.2)' }}>
          <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No vendors with reviews yet.</p>
          <p className="text-xs mt-1" style={{ color: '#5d5285' }}>
            <Link href="/vendors/new" className="underline hover:opacity-80" style={{ color: '#6c5dd3' }}>Add a vendor</Link> to get started.
          </p>
        </div>
      ) : (
        <ReviewsTable vendors={vendors} todayStr={todayStr} />
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#5d5285' }}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  )
}
