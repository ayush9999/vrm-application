import Link from 'next/link'
import { Suspense } from 'react'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendors } from '@/lib/db/vendors'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import { VendorSearch } from './_components/VendorSearch'
import { QuickApprovalMenu } from './_components/QuickApprovalMenu'
import type { VendorStatus, VendorApprovalStatus } from '@/types/vendor'

const STATUS_BADGE: Record<VendorStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  suspended: { label: 'Suspended', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
}

const APPROVAL_BADGE: Record<VendorApprovalStatus, { label: string; bg: string; color: string }> = {
  draft:                   { label: 'Draft',          bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
  waiting_on_vendor:       { label: 'Waiting Vendor', bg: 'rgba(245,158,11,0.1)',   color: '#d97706' },
  in_internal_review:      { label: 'In Review',      bg: 'rgba(14,165,233,0.1)',   color: '#0284c7' },
  approved:                { label: 'Approved',       bg: 'rgba(5,150,105,0.1)',    color: '#059669' },
  approved_with_exception: { label: 'Approved (Exc)', bg: 'rgba(124,58,237,0.1)',   color: '#7c3aed' },
  blocked:                 { label: 'Blocked',        bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  suspended:               { label: 'Suspended',      bg: 'rgba(225,29,72,0.1)',    color: '#e11d48' },
  offboarded:              { label: 'Offboarded',     bg: 'rgba(148,163,184,0.15)', color: '#64748b' },
}

interface PageProps {
  searchParams: Promise<{
    search?: string; status?: string; critical?: string;
    sort?: string; dir?: string; page?: string
  }>
}

const SORTABLE: Record<string, { label: string; field: 'name' | 'created_at' | 'criticality_tier' | 'next_review_due_at' | 'approval_status' }> = {
  Name:        { label: 'Name',        field: 'name' },
  Approval:    { label: 'Approval',    field: 'approval_status' },
  Criticality: { label: 'Criticality', field: 'criticality_tier' },
}

export default async function VendorsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const user = await requireCurrentUser()

  const sort = (params.sort as 'name' | 'created_at' | 'criticality_tier' | 'next_review_due_at' | 'approval_status') ?? 'name'
  const sortDir = (params.dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const pageSize = 25

  const result = await getVendors(user.orgId, {
    search: params.search,
    status: (params.status as VendorStatus) || undefined,
    criticalOnly: params.critical === 'true',
    sort,
    sortDir,
    page,
    pageSize,
  })
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
    sp.set('sort', sort)
    sp.set('dir', sortDir)
    sp.set('page', String(page))
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) sp.delete(k)
      else sp.set(k, v)
    }
    return `/vendors?${sp.toString()}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>
            {result.total} vendor{result.total !== 1 ? 's' : ''}
            {result.total > pageSize && (
              <span> · page {page} of {result.totalPages}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/vendors/export"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            ↓ Export CSV
          </a>
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
                  <p className="text-xs mt-1.5" style={{ color: '#8b7fd4' }}>
                    <Link href="/vendors" className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6c5dd3' }}>
                      Clear filters
                    </Link>
                    {' '}to see all vendors.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium" style={{ color: '#1e1550' }}>No vendors yet.</p>
                  <p className="text-xs mt-1.5" style={{ color: '#8b7fd4' }}>
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
        <div
          className="overflow-x-auto rounded-2xl bg-white"
          style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
        >
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
                {['Name', 'Type', 'Owner', 'Criticality', 'Approval', 'Readiness', 'Risk', 'Missing', 'Open Rem.'].map((h) => {
                  const sortable = SORTABLE[h]
                  if (!sortable) {
                    return (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest"
                        style={{ color: '#a99fd8' }}
                      >
                        {h}
                      </th>
                    )
                  }
                  const isActive = sort === sortable.field
                  const nextDir = isActive && sortDir === 'asc' ? 'desc' : 'asc'
                  return (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
                      <Link href={buildHref({ sort: sortable.field, dir: nextDir, page: '1' })} className="inline-flex items-center gap-1 hover:text-[#6c5dd3] transition-colors">
                        {h}
                        {isActive && (
                          <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </Link>
                    </th>
                  )
                })}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const approvalBadge = APPROVAL_BADGE[v.approval_status]
                const m = metrics.get(v.id) ?? {
                  readinessPct: 0, applicable: 0, completed: 0, missingEvidenceCount: 0, openRemediationCount: 0,
                  risk: { score: 0, band: 'critical' as const, rawScore: 0, remediationPenalty: 0, isApprovalOverride: false, formula: 'No data' },
                }
                return (
                  <tr
                    key={v.id}
                    className="group transition-colors hover:bg-[rgba(109,93,211,0.03)]"
                    style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}
                  >
                    <td className="px-4 py-3.5 font-medium" style={{ color: '#1e1550' }}>
                      <Link
                        href={`/vendors/${v.id}`}
                        className="transition-colors hover:text-[#6c5dd3] flex items-center gap-2"
                        style={{ color: '#1e1550' }}
                      >
                        <span>{v.name}</span>
                        {v.is_critical && <span className="text-amber-500 text-xs" title="Critical">★</span>}
                      </Link>
                      {v.vendor_code && (
                        <div className="text-[10px] font-mono mt-0.5" style={{ color: '#a99fd8' }}>{v.vendor_code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: '#6b5fa8' }}>
                      <ServiceTypeChip type={v.service_type} />
                      {v.vendor_categories?.name && (
                        <div className="text-[10px] mt-0.5" style={{ color: '#a99fd8' }}>{v.vendor_categories.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: '#6b5fa8' }}>
                      {v.internal_owner?.name ?? v.internal_owner?.email ?? <span style={{ color: '#c4bae8' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {v.criticality_tier ? (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={
                            v.criticality_tier === 1
                              ? { background: 'rgba(225,29,72,0.1)', color: '#e11d48' }
                              : v.criticality_tier === 2
                              ? { background: 'rgba(245,158,11,0.1)', color: '#d97706' }
                              : { background: 'rgba(109,93,211,0.05)', color: '#6c5dd3' }
                          }
                        >
                          T{v.criticality_tier}
                        </span>
                      ) : (
                        <span style={{ color: '#c4bae8' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                        style={{ background: approvalBadge.bg, color: approvalBadge.color }}
                      >
                        {approvalBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ReadinessCell pct={m.readinessPct} applicable={m.applicable} completed={m.completed} />
                    </td>
                    <td className="px-4 py-3.5">
                      <RiskBadgeCell band={m.risk.band} score={m.risk.score} formula={m.risk.formula} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {m.missingEvidenceCount > 0 ? (
                        <span className="text-xs font-bold" style={{ color: '#d97706' }}>{m.missingEvidenceCount}</span>
                      ) : (
                        <span className="text-xs" style={{ color: '#c4bae8' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {m.openRemediationCount > 0 ? (
                        <span className="text-xs font-bold" style={{ color: '#e11d48' }}>{m.openRemediationCount}</span>
                      ) : (
                        <span className="text-xs" style={{ color: '#c4bae8' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <QuickApprovalMenu vendorId={v.id} current={v.approval_status} />
                      <Link
                        href={`/vendors/${v.id}/edit`}
                        className="text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:opacity-80 ml-2"
                        style={{ color: '#6c5dd3' }}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: '#a99fd8' }}>
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

function ServiceTypeChip({ type }: { type: string }) {
  const labels: Record<string, string> = {
    saas: 'SaaS',
    contractor: 'Contractor',
    supplier: 'Supplier',
    logistics: 'Logistics',
    professional_services: 'Prof. Services',
    other: 'Other',
  }
  return (
    <span className="text-xs font-medium" style={{ color: '#1e1550' }}>
      {labels[type] ?? type}
    </span>
  )
}

function RiskBadgeCell({ band, score, formula }: { band: 'low' | 'medium' | 'high' | 'critical'; score: number; formula: string }) {
  const style = RISK_BAND_STYLE[band]
  return (
    <div className="group relative inline-block">
      <span
        className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap"
        style={{ background: style.bg, color: style.color }}
        title={formula}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
        {style.label}
        <span className="font-mono opacity-70">{score}</span>
      </span>
    </div>
  )
}

function ReadinessCell({ pct, applicable, completed }: { pct: number; applicable: number; completed: number }) {
  if (applicable === 0) {
    return <span className="text-xs" style={{ color: '#c4bae8' }}>No packs</span>
  }
  const color = pct === 100 ? '#059669' : pct >= 50 ? '#6c5dd3' : pct > 0 ? '#d97706' : '#a99fd8'
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
        <span className="text-[10px]" style={{ color: '#a99fd8' }}>{completed} / {applicable}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
