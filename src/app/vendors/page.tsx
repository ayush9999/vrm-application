import Link from 'next/link'
import { Suspense } from 'react'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendors, getVendorsLite } from '@/lib/db/vendors'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import { VendorSearch } from './_components/VendorSearch'
import { ExportDialog } from './_components/ExportDialog'
import { VendorsTable, type VendorRowMetrics } from './_components/VendorsTable'
import type { VendorStatus } from '@/types/vendor'

interface PageProps {
  searchParams: Promise<{
    search?: string; status?: string; critical?: string;
    approval?: string; evidence?: string;
    sort?: string; dir?: string; page?: string
  }>
}

export default async function VendorsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const user = await requireCurrentUser()

  const sort = (params.sort as 'name' | 'created_at' | 'criticality_tier' | 'next_review_due_at' | 'approval_status') ?? 'name'
  const sortDir = (params.dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = 25

  const [result, vendorsLite] = await Promise.all([
    getVendors(user.orgId, {
      search: params.search,
      status: (params.status as VendorStatus) || undefined,
      criticalOnly: params.critical === 'true',
      notApprovedOnly: params.approval === 'not_approved',
      hasMissingEvidence: params.evidence === 'missing',
      sort,
      sortDir,
      page,
      pageSize,
    }),
    getVendorsLite(user.orgId),
  ])
  const vendors = result.rows

  const metrics = await getVendorListMetrics(
    vendors.map((v) => ({ id: v.id, approval_status: v.approval_status })),
  )

  // Build query string preserving filters
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    if (params.search) sp.set('search', params.search)
    if (params.status) sp.set('status', params.status)
    if (params.critical) sp.set('critical', params.critical)
    if (params.approval) sp.set('approval', params.approval)
    if (params.evidence) sp.set('evidence', params.evidence)
    sp.set('sort', sort)
    sp.set('dir', sortDir)
    sp.set('page', String(page))
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) sp.delete(k)
      else sp.set(k, v)
    }
    return `/vendors?${sp.toString()}`
  }

  const hasDrillFilter = params.approval === 'not_approved' || params.evidence === 'missing' || params.critical === 'true'

  return (
    <div className="px-6 py-5 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b5fa8' }}>
            {result.total} vendor{result.total !== 1 ? 's' : ''}
            {result.total > pageSize && (
              <span> · page {page} of {result.totalPages}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDialog vendors={vendorsLite} />
          <Link
            href="/vendors/new"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)',
              boxShadow: '0 4px 12px rgba(108,93,211,0.3)',
            }}
          >
            + Add Vendor
          </Link>
        </div>
      </div>

      {/* Drill-down filter banner (set when arrived from a dashboard click) */}
      {hasDrillFilter && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-4" style={{ background: 'rgba(109,93,211,0.06)', border: '1px solid rgba(109,93,211,0.15)' }}>
          <div className="text-sm flex items-center gap-2 flex-wrap" style={{ color: '#4a4270' }}>
            <span>Filtered:</span>
            {params.approval === 'not_approved' && (
              <strong style={{ color: '#6c5dd3' }}>Not approved</strong>
            )}
            {params.evidence === 'missing' && (
              <strong style={{ color: '#6c5dd3' }}>Has missing evidence</strong>
            )}
            {params.critical === 'true' && (
              <strong style={{ color: '#6c5dd3' }}>Critical only</strong>
            )}
            <span style={{ color: '#5d5285' }}>
              ({result.total} vendor{result.total !== 1 ? 's' : ''})
            </span>
          </div>
          <Link href="/vendors" className="text-xs font-medium" style={{ color: '#6c5dd3' }}>
            Clear filter ✕
          </Link>
        </div>
      )}

      {/* Search / Filter */}
      <div className="mb-5">
        <Suspense>
          <VendorSearch />
        </Suspense>
      </div>

      {/* Table */}
      {vendors.length === 0 ? (
        (() => {
          const hasFilters = !!params.search || !!params.status || params.critical === 'true'
          return (
            <div
              className="text-center py-20 rounded-2xl bg-white"
              style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}
            >
              {hasFilters ? (
                <>
                  <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No vendors match your filters.</p>
                  <p className="text-xs mt-1.5" style={{ color: '#5d5285' }}>
                    <Link href="/vendors" className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6c5dd3' }}>
                      Clear filters
                    </Link>
                    {' '}to see all vendors.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No vendors yet.</p>
                  <p className="text-xs mt-1.5" style={{ color: '#5d5285' }}>
                    Get started with the{' '}
                    <Link href="/vendors/new/wizard" className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6c5dd3' }}>
                      guided setup
                    </Link>
                    {' '}or{' '}
                    <Link href="/vendors/new" className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6c5dd3' }}>
                      add manually
                    </Link>
                    .
                  </p>
                </>
              )}
            </div>
          )
        })()
      ) : (
        <VendorsTable
          vendors={vendors}
          metrics={Object.fromEntries(
            vendors.map((v) => {
              const m = metrics.get(v.id) ?? {
                readinessPct: 0, applicable: 0, completed: 0, missingEvidenceCount: 0, openRemediationCount: 0,
                risk: { score: 0, band: 'critical' as const, rawScore: 0, remediationPenalty: 0, isApprovalOverride: false, formula: 'No data' },
              }
              return [v.id, m as VendorRowMetrics]
            }),
          )}
        />
      )}

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: '#6b5fa8' }}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, result.total)} of {result.total}
          </p>
          <div className="flex items-center gap-1.5">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
              >
                ← Prev
              </Link>
            )}
            <span className="text-xs px-2" style={{ color: '#4a4270' }}>
              {page} / {result.totalPages}
            </span>
            {page < result.totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.12)' }}
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

