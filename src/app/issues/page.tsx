import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getIssues } from '@/lib/db/issues'
import type { IssueStatus, IssueSeverity } from '@/types/issue'
import { IssuesList } from './_components/IssuesList'

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; search?: string; overdue?: string; vendor_id?: string }>
}) {
  const user = await requireCurrentUser()
  const params = await searchParams
  const statusFilter = params.status as IssueStatus | undefined
  const severityFilter = params.severity as IssueSeverity | undefined
  const search = params.search
  const overdue = params.overdue === '1'
  const vendorId = params.vendor_id

  const issues = await getIssues(user.orgId, {
    status: statusFilter ? statusFilter : undefined,
    severity: severityFilter,
    search,
    overdue: overdue || undefined,
    vendorId,
  })

  const today = new Date().toISOString().split('T')[0]
  const openCount = issues.filter(i => i.status === 'open' || i.status === 'in_progress' || i.status === 'blocked').length
  const overdueCount = issues.filter(i => (i.status === 'open' || i.status === 'in_progress' || i.status === 'blocked') && i.due_date && i.due_date < today).length
  const criticalCount = issues.filter(i => i.severity === 'critical' && i.status !== 'closed').length

  const STATUS_FILTERS: { key: string; label: string }[] = [
    { key: '', label: `All (${issues.length})` },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'deferred', label: 'Deferred' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'closed', label: 'Closed' },
  ]

  return (
    <div className="px-6 py-5 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Issues & Remediation</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>
            Track vendor gaps, risks, and follow-up actions
          </p>
        </div>
        <Link
          href="/issues/new"
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)', boxShadow: '0 4px 12px rgba(108,93,211,0.3)' }}
        >
          + New Issue
        </Link>
      </div>

      {/* Stats + filter combined row */}
      <div
        className="flex items-center gap-5 px-5 py-3 rounded-2xl"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 8px rgba(109,93,211,0.07)' }}
      >
        <div className="flex items-center gap-5 pr-5" style={{ borderRight: '1px solid rgba(109,93,211,0.1)' }}>
          {[
            { label: 'Open', value: openCount, color: '#d97706' },
            { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? '#e11d48' : '#059669' },
            { label: 'Critical', value: criticalCount, color: criticalCount > 0 ? '#e11d48' : '#059669' },
          ].map(s => (
            <div key={s.label} className="text-center min-w-[52px]">
              <p className="text-lg font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#a99fd8' }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {STATUS_FILTERS.map(f => (
            <Link
              key={f.key}
              href={f.key ? `/issues?status=${f.key}` : '/issues'}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
              style={(statusFilter ?? '') === f.key
                ? { background: '#6c5dd3', color: '#fff' }
                : { color: '#6b5fa8' }
              }
            >
              {f.label}
            </Link>
          ))}
        </div>

        {overdueCount > 0 && (
          <Link
            href="/issues?overdue=1"
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0"
            style={overdue
              ? { background: '#e11d48', color: '#fff' }
              : { background: 'rgba(225,29,72,0.08)', color: '#e11d48' }
            }
          >
            {overdueCount} overdue
          </Link>
        )}
      </div>

      {/* Issues list */}
      {issues.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl"
          style={{ border: '1.5px dashed rgba(109,93,211,0.2)', background: 'rgba(109,93,211,0.02)' }}
        >
          <p className="text-sm font-medium" style={{ color: '#a99fd8' }}>No issues found</p>
          <p className="text-xs mt-1" style={{ color: '#c4bae8' }}>
            Issues are created from assessments or manually from this page.
          </p>
        </div>
      ) : (
        <IssuesList issues={issues} today={today} />
      )}
    </div>
  )
}
