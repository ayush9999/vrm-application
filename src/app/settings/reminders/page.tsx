import { requireCurrentUser } from '@/lib/current-user'
import { getReminderRules } from '@/lib/db/org-settings'
import { ReminderRulesForm } from './_components/ReminderRulesForm'
import { setReminderRulesAction } from './actions'

export default async function RemindersSettingsPage() {
  const user = await requireCurrentUser()
  const rules = await getReminderRules(user.orgId)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Reminder Rules</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Choose which automated email alerts your team receives.
        </p>
        <p className="text-xs mt-2 px-3 py-2 rounded-lg inline-block" style={{ background: 'rgba(245,158,11,0.06)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}>
          ⚠ Email delivery is not yet wired up. These preferences are saved but no emails will be sent until SMTP is configured.
        </p>
      </div>

      <ReminderRulesForm
        rules={rules}
        canEdit={user.role === 'site_admin'}
        saveAction={setReminderRulesAction}
      />
    </div>
  )
}
