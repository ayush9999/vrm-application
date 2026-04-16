import { requireCurrentUser } from '@/lib/current-user'
import { listCustomFields } from '@/lib/db/custom-fields'
import { CustomFieldsClient } from './_components/CustomFieldsClient'
import { createCustomFieldAction, deleteCustomFieldAction } from './actions'

export default async function CustomFieldsSettingsPage() {
  const user = await requireCurrentUser()
  const fields = await listCustomFields(user.orgId, 'vendor')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Custom Fields — Vendors</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Define org-specific extra fields to capture on every vendor profile.
        </p>
        <p className="text-xs mt-2 px-3 py-2 rounded-lg inline-block" style={{ background: 'rgba(5,150,105,0.06)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
          ✓ Field definitions are saved AND rendered on the vendor create/edit forms.
        </p>
      </div>

      <CustomFieldsClient
        fields={fields}
        canEdit={user.role === 'site_admin'}
        createAction={createCustomFieldAction}
        deleteAction={deleteCustomFieldAction}
      />
    </div>
  )
}
