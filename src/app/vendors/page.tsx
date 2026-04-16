import Link from 'next/link'
import { Suspense } from 'react'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendors } from '@/lib/db/vendors'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import { VendorSearch } from './_components/VendorSearch'
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
  searchParams: Promise<{ search?: string; status?: string; critical?: string }>
}

export default async function VendorsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const user = await requireCurrentUser()

  const vendors = await getVendors(user.orgId, {
    search: params.search,
    status: (params.status as VendorStatus) || undefined,
    criticalOnly: params.critical === 'true',
  })

  const metrics = await getVendorListMetrics(vendors.map((v) => v.id))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>
            {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
          </p>
        </div>
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

      {/* Search / Filter */}
      <div className="mb-5">
        <Suspense>
          <VendorSearch />
        </Suspense>
      </div>

      {/* Table */}
      {vendors.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl bg-white"
          style={{ border: '1.5px dashed rgba(109,93,211,0.2)' }}
        >
          <p className="text-sm font-medium" style={{ color: '#6b5fa8' }}>No vendors found.</p>
          <p className="text-xs mt-1.5" style={{ color: '#a99fd8' }}>
            Try adjusting your filters or{' '}
            <Link href="/vendors/new" className="underline underline-offset-2 hover:opacity-80" style={{ color: '#6c5dd3' }}>
              add a vendor
            </Link>
            .
          </p>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl bg-white"
          style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
        >
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(109,93,211,0.08)', background: 'rgba(109,93,211,0.03)' }}>
                {['Name', 'Type', 'Owner', 'Criticality', 'Approval', 'Readiness', 'Missing', 'Open Rem.'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: '#a99fd8' }}
                  >
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const approvalBadge = APPROVAL_BADGE[v.approval_status]
                const m = metrics.get(v.id) ?? { readinessPct: 0, applicable: 0, completed: 0, missingEvidenceCount: 0, openRemediationCount: 0 }
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
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/vendors/${v.id}/edit`}
                        className="text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:opacity-80"
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
