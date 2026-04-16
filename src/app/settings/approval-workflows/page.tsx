import { requireCurrentUser } from '@/lib/current-user'
import { getDefaultApprovers } from '@/lib/db/org-settings'
import { getOrgUsers } from '@/lib/db/organizations'
import { ApproverPicker } from './_components/ApproverPicker'
import { setDefaultApproverAction } from './actions'

const TIERS = [
  { tier: 1, label: 'Tier 1 — Critical' },
  { tier: 2, label: 'Tier 2 — High' },
  { tier: 3, label: 'Tier 3 — Medium' },
  { tier: 4, label: 'Tier 4 — Low' },
  { tier: 5, label: 'Tier 5 — Very Low' },
]

export default async function ApprovalWorkflowsSettingsPage() {
  const user = await requireCurrentUser()
  const [approvers, users] = await Promise.all([
    getDefaultApprovers(user.orgId),
    getOrgUsers(user.orgId),
  ])

  const approverByTier = new Map(approvers.map((a) => [a.criticality_tier, a.approver_user_id]))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight" style={{ color: '#1e1550' }}>Approval Workflows</h2>
        <p className="text-sm mt-1" style={{ color: '#a99fd8' }}>
          Set the default approver for each criticality tier. Used as a fallback suggestion on vendor approvals — does not auto-assign yet.
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.06)' }}
      >
        {TIERS.map((t, i) => (
          <div
            key={t.tier}
            className="flex items-center gap-4 px-5 py-3"
            style={{ borderBottom: i === TIERS.length - 1 ? undefined : '1px solid rgba(109,93,211,0.06)' }}
          >
            <span className="text-sm font-semibold w-40 shrink-0" style={{ color: '#1e1550' }}>{t.label}</span>
            <div className="flex-1">
              <ApproverPicker
                tier={t.tier}
                currentApproverId={approverByTier.get(t.tier) ?? null}
                users={users}
                canEdit={user.role === 'site_admin'}
                setAction={setDefaultApproverAction}
              />
            </div>
          </div>
        ))}
      </div>

      {user.role !== 'site_admin' && (
        <p className="text-xs" style={{ color: '#d97706' }}>Read-only — only site admins can configure approvers.</p>
      )}
    </div>
  )
}
