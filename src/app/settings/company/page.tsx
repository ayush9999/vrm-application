import { requireCurrentUser } from '@/lib/current-user'
import { getCompanyProfile, getComplianceStandards, ALL_COMPLIANCE_STANDARDS } from '@/lib/db/org-settings'
import { COUNTRIES } from '@/lib/countries'
import { CompanyProfileForm } from './_components/CompanyProfileForm'
import { updateCompanyProfileAction, updateComplianceStandardsAction } from './actions'

export default async function CompanyProfileSettingsPage() {
  const user = await requireCurrentUser()
  const [profile, selectedStandards] = await Promise.all([
    getCompanyProfile(user.orgId),
    getComplianceStandards(user.orgId),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Company Profile</h2>
        <p className="text-sm mt-1" style={{ color: '#8b7fd4' }}>
          Information about your organisation. Compliance standards drive reporting and review item filtering.
        </p>
      </div>

      <CompanyProfileForm
        profile={profile!}
        countries={COUNTRIES}
        canEdit={user.role === 'site_admin'}
        updateAction={updateCompanyProfileAction}
        allStandards={ALL_COMPLIANCE_STANDARDS.map((s) => ({ code: s.code, name: s.name }))}
        selectedStandards={selectedStandards}
        updateStandardsAction={updateComplianceStandardsAction}
      />
    </div>
  )
}
