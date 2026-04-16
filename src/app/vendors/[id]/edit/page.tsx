import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorById } from '@/lib/db/vendors'
import { getVendorCategories } from '@/lib/db/vendor-categories'
import { getOrgUsers } from '@/lib/db/organizations'
import { listCustomFields, getVendorCustomFieldValues } from '@/lib/db/custom-fields'
import { VendorForm } from '../../_components/VendorForm'
import { updateVendorAction } from '../../actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditVendorPage({ params }: PageProps) {
  const { id } = await params
  const user = await requireCurrentUser()

  const [vendor, categories, users, customFields, customFieldValues] = await Promise.all([
    getVendorById(user.orgId, id),
    getVendorCategories(user.orgId),
    getOrgUsers(user.orgId),
    listCustomFields(user.orgId, 'vendor'),
    getVendorCustomFieldValues(id),
  ])

  if (!vendor) notFound()

  const boundAction = updateVendorAction.bind(null, id)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/vendors/${id}`}
          className="inline-flex items-center gap-1 text-sm transition-colors hover:opacity-70"
          style={{ color: '#a99fd8' }}
        >
          ← Back to {vendor.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-3 tracking-tight" style={{ color: '#1e1550' }}>Edit Vendor</h1>
      </div>

      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <VendorForm
          action={boundAction}
          categories={categories}
          users={users}
          defaultValues={vendor}
          customFields={customFields}
          customFieldValues={customFieldValues}
          submitLabel="Update Vendor"
          cancelHref={`/vendors/${id}`}
        />
      </div>
    </div>
  )
}
