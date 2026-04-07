import { requireCurrentUser } from '@/lib/current-user'
import { getFrameworks } from '@/lib/db/assessments'
import { getOrgFrameworkSelections } from '@/lib/db/organizations'
import { FrameworkSelector } from './_components/FrameworkSelector'
import { saveOrgFrameworksAction } from './actions'

export default async function FrameworkSettingsPage() {
  const user = await requireCurrentUser()

  const [allFrameworks, selections] = await Promise.all([
    getFrameworks(user.orgId, 'compliance_standard'),
    getOrgFrameworkSelections(user.orgId),
  ])

  const selectedIds = new Set(selections.map((s) => s.framework_id))

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Compliance Standards</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Choose the compliance standards your organisation is measured against for audit and reporting purposes.
        </p>
      </div>

      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 2px 12px rgba(109,93,211,0.08)', border: '1px solid rgba(109,93,211,0.1)' }}
      >
        <FrameworkSelector
          frameworks={allFrameworks}
          selectedIds={selectedIds}
          action={saveOrgFrameworksAction}
        />
      </div>
    </div>
  )
}
