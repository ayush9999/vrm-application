import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorCategories } from '@/lib/db/vendor-categories'
import { getOrgUsers } from '@/lib/db/organizations'
import { COUNTRIES } from '@/lib/countries'
import { OnboardingWizard } from './_components/OnboardingWizard'
import { createVendorFromWizardAction, previewMatchedReviewPacksAction } from '@/app/vendors/actions'

export default async function NewVendorWizardPage() {
  const user = await requireCurrentUser()
  const [categories, users] = await Promise.all([
    getVendorCategories(user.orgId),
    getOrgUsers(user.orgId),
  ])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-xs" style={{ color: '#6b5fa8' }}>
        <Link href="/vendors" className="transition-colors hover:text-[#6c5dd3]" style={{ color: '#6b5fa8' }}>
          Vendors
        </Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#1e1550' }}>Add Vendor</span>
      </div>

      {/* Title row with back button */}
      <div className="mb-6 flex items-start gap-3">
        <Link
          href="/vendors"
          aria-label="Back to vendors"
          className="shrink-0 flex items-center justify-center rounded-full transition-all hover:shadow-sm"
          style={{
            width: 36,
            height: 36,
            background: 'white',
            border: '1px solid rgba(108,93,211,0.18)',
            color: '#6c5dd3',
            marginTop: 4,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4l-4 4 4 4" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
            Add Vendor
          </h1>
          <p className="text-sm mt-1" style={{ color: '#5d5285' }}>
            Follow the steps to onboard a new vendor — classify, assign review packs, and optionally request evidence.
          </p>
        </div>
      </div>

      <OnboardingWizard
        categories={categories}
        users={users}
        countries={COUNTRIES}
        createAction={createVendorFromWizardAction}
        previewAction={previewMatchedReviewPacksAction}
      />
    </div>
  )
}
