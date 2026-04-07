import { requireCurrentUser } from '@/lib/current-user'
import { getVendors } from '@/lib/db/vendors'
import { getOrgUsers } from '@/lib/db/organizations'
import { NewIssueForm } from './_components/NewIssueForm'

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireCurrentUser()
  const [vendors, orgUsers, sp] = await Promise.all([
    getVendors(user.orgId, {}),
    getOrgUsers(user.orgId),
    searchParams,
  ])

  // finding_ids can be repeated: ?finding_ids=a&finding_ids=b
  const findingIdsRaw = sp.finding_ids
  const findingIds = Array.isArray(findingIdsRaw)
    ? findingIdsRaw
    : findingIdsRaw
    ? [findingIdsRaw]
    : []

  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  const prefill = {
    vendor_id: str(sp.vendor_id),
    title: str(sp.title),
    severity: str(sp.severity),
    source: str(sp.source),
    assessment_id: str(sp.assessment_id),
    finding_id: str(sp.finding_id),
    finding_ids: findingIds,
    description: str(sp.description),
    type: str(sp.type),
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Create Issue</h1>
        <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>
          Track a vendor gap, risk, or follow-up action
        </p>
      </div>
      <NewIssueForm vendors={vendors} orgUsers={orgUsers} prefill={prefill} />
    </div>
  )
}
