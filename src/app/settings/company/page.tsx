import { requireCurrentUser } from '@/lib/current-user'
import { getCompanyProfile } from '@/lib/db/org-settings'
import { COUNTRIES } from '@/lib/countries'
import { CompanyProfileForm } from './_components/CompanyProfileForm'
import { updateCompanyProfileAction } from './actions'

export default async function CompanyProfileSettingsPage() {
  const user = await requireCurrentUser()
  const profile = await getCompanyProfile(user.orgId)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Company Profile</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Information about your organisation. Used to drive defaults across the system.
        </p>
      </div>

      <CompanyProfileForm
        profile={profile!}
        countries={COUNTRIES}
        canEdit={user.role === 'site_admin'}
        updateAction={updateCompanyProfileAction}
      />
    </div>
  )
}
