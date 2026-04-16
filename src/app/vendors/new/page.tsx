import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorCategories } from '@/lib/db/vendor-categories'
import { getOrgUsers } from '@/lib/db/organizations'
import { listCustomFields } from '@/lib/db/custom-fields'
import { VendorForm } from '../_components/VendorForm'
import { createVendorAction } from '../actions'

export default async function NewVendorPage() {
  const user = await requireCurrentUser()
  const [categories, users, customFields] = await Promise.all([
    getVendorCategories(user.orgId),
    getOrgUsers(user.orgId),
    listCustomFields(user.orgId, 'vendor'),
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
        <div className="flex items-end justify-between flex-wrap gap-3 mt-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Add Vendor</h1>
            <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
              Quick form. Prefer a guided walkthrough? Use the wizard.
            </p>
          </div>
          <Link
            href="/vendors/new/wizard"
            className="text-sm font-medium px-4 py-2 rounded-full transition-colors"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            Switch to guided wizard →
          </Link>
        </div>
      </div>

      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <VendorForm
          action={createVendorAction}
          categories={categories}
          users={users}
          customFields={customFields}
          submitLabel="Create Vendor & Continue"
          cancelHref="/vendors"
        />
      </div>
    </div>
  )
}
