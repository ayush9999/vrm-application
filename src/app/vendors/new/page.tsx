import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorCategories } from '@/lib/db/vendor-categories'
import { getOrgUsers } from '@/lib/db/organizations'
import { VendorForm } from '../_components/VendorForm'
import { createVendorAction } from '../actions'

export default async function NewVendorPage() {
  const user = await requireCurrentUser()
  const [categories, users] = await Promise.all([
    getVendorCategories(user.orgId),
    getOrgUsers(user.orgId),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-1 text-sm transition-colors hover:opacity-70"
          style={{ color: '#a99fd8' }}
        >
          ← Back to Vendors
        </Link>
        <h1 className="text-2xl font-semibold mt-3 tracking-tight" style={{ color: '#1e1550' }}>Add Vendor</h1>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          After saving, you&apos;ll be taken to the Documents tab to upload required documents.
        </p>
      </div>

      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <VendorForm
          action={createVendorAction}
          categories={categories}
          users={users}
          submitLabel="Create Vendor & Continue"
          cancelHref="/vendors"
        />
      </div>
    </div>
  )
}
