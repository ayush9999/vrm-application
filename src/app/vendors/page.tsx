import Link from 'next/link'
import { Suspense } from 'react'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendors } from '@/lib/db/vendors'
import { VendorSearch } from './_components/VendorSearch'
import type { VendorStatus } from '@/types/vendor'

const STATUS_BADGE: Record<VendorStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' },
  under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' },
  suspended: { label: 'Suspended', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' },
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
                {['Name', 'Code', 'Status', 'Critical', 'Category', 'Internal Owner', 'Compliance'].map((h) => (
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
                const badge = STATUS_BADGE[v.status]
                return (
                  <tr
                    key={v.id}
                    className="group transition-colors hover:bg-[rgba(109,93,211,0.03)]"
                    style={{ borderBottom: '1px solid rgba(109,93,211,0.06)' }}
                  >
                    <td className="px-4 py-3.5 font-medium" style={{ color: '#1e1550' }}>
                      <Link
                        href={`/vendors/${v.id}`}
                        className="transition-colors hover:text-[#6c5dd3]"
                        style={{ color: '#1e1550' }}
                      >
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: '#a99fd8' }}>{v.vendor_code ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {v.is_critical ? (
                        <span className="text-amber-500 text-sm" title="Critical">★</span>
                      ) : (
                        <span style={{ color: 'rgba(109,93,211,0.25)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: '#6b5fa8' }}>
                      {v.vendor_categories?.name ?? <span style={{ color: '#c4bae8' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5" style={{ color: '#6b5fa8' }}>
                      {v.internal_owner?.name ?? v.internal_owner?.email ?? <span style={{ color: '#c4bae8' }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: '#c4bae8' }}>—</td>
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
