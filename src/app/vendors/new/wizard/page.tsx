import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getVendorCategories } from '@/lib/db/vendor-categories'
import { getOrgUsers } from '@/lib/db/organizations'
import { COUNTRIES } from '@/lib/countries'
import { OnboardingWizard } from './_components/OnboardingWizard'
import { createVendorAction, previewMatchedReviewPacksAction } from '@/app/vendors/actions'

export default async function NewVendorWizardPage() {
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
        <div className="flex items-end justify-between flex-wrap gap-3 mt-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>
              New Vendor — Guided Setup
            </h1>
            <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
              We&apos;ll walk you through the basics, classify the vendor, preview the matching Review Packs, and create the evidence checklist.
            </p>
          </div>
          <Link
            href="/vendors/new"
            className="text-sm font-medium px-4 py-2 rounded-full transition-colors"
            style={{ background: 'rgba(109,93,211,0.06)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            Use single form →
          </Link>
        </div>
      </div>

      <OnboardingWizard
        categories={categories}
        users={users}
        countries={COUNTRIES}
        createAction={createVendorAction}
        previewAction={previewMatchedReviewPacksAction}
      />
    </div>
  )
}
