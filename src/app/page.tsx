import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getCachedDashboardData } from '@/lib/db/cached'
import { RISK_BAND_STYLE } from '@/lib/risk-score'
import type { ActivityLogEntry } from '@/types/activity'

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const data = await getCachedDashboardData(user.orgId)
  const { totals, operational, highRiskVendors, recentRemediations, recentActivity } = data

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>Operational overview of your vendor risk programme</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/issues"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            View Remediation
          </Link>
          <Link
            href="/vendors/new/wizard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            ⚡ Guided Setup
          </Link>
          <Link
            href="/vendors/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6c5dd3 0%, #7c6be0 100%)' }}
          >
            + Add Vendor
          </Link>
        </div>
      </div>

      {/* ── Top totals row ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat label="Total Vendors"     value={totals.vendors}        sub={`${totals.activeVendors} active`} href="/vendors" accent="brand" />
        <BigStat label="Critical Vendors"  value={totals.criticalVendors} sub={`${operational.criticalNotReady} not fully ready`} href="/vendors?critical=true" accent={operational.criticalNotReady > 0 ? 'amber' : 'brand'} />
        <BigStat label="Open Remediations" value={operational.openRemediations} sub={`${operational.overdueRemediations} overdue`} href="/issues" accent={operational.overdueRemediations > 0 ? 'rose' : 'brand'} />
        <BigStat label="Reviews Due"       value={operational.reviewsDueThisMonth} sub="this month" href="/vendors" accent="amber" />
      </div>

      {/* ── Operational metrics ── */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: '#6c5dd3' }}>Operational Metrics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SmallStat label="Awaiting Documents"    value={operational.awaitingDocuments}    color="#d97706" />
          <SmallStat label="Under Review"           value={operational.underReview}           color="#0284c7" />
          <SmallStat label="Approvals Pending"      value={operational.approvalsPending}      color="#7c3aed" />
          <SmallStat label="Approved (Exception)"   value={operational.approvedWithException} color="#7c3aed" />
          <SmallStat label="Docs Expired"           value={operational.docsExpired}            color="#e11d48" />
          <SmallStat label="Docs Expiring (30d)"    value={operational.docsExpiring30}         color="#d97706" />
          <SmallStat label="Docs Expiring (60d)"    value={operational.docsExpiring60}         color="#d97706" />
          <SmallStat label="Suspended / Blocked"    value={operational.suspendedOrBlocked}     color="#e11d48" />
        </div>
      </section>

      {/* ── High-risk vendors + Recent remediations ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="High-Risk Vendors" linkLabel="View all" href="/vendors">
          {highRiskVendors.length === 0 ? (
            <EmptyState message="None at this risk level" sub="No vendors currently rated High or Critical" emerald />
          ) : (
            <div className="space-y-1">
              {highRiskVendors.map((v) => {
                const risk = RISK_BAND_STYLE[v.riskBand]
                return (
                  <Link
                    key={v.id}
                    href={`/vendors/${v.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-[rgba(109,93,211,0.03)] group"
                  >
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                      style={{ background: risk.bg, color: risk.color }}
                    >
                      {risk.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-[#6c5dd3] transition-colors" style={{ color: '#1e1550' }}>
                        {v.name}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#a99fd8' }}>
                        Score {v.riskScore} · Readiness {v.readinessPct}%
                        {v.openRemediations > 0 && <span style={{ color: '#e11d48' }}> · {v.openRemediations} open rem.</span>}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>

        <Card title="Recent Remediations" linkLabel="View all" href="/issues">
          {recentRemediations.length === 0 ? (
            <EmptyState message="No open remediations" sub="" emerald />
          ) : (
            <div className="space-y-1">
              {recentRemediations.map((r) => (
                <Link
                  key={r.id}
                  href={`/issues/${r.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:bg-[rgba(109,93,211,0.03)] group"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[r.severity] ?? SEV_COLOR.medium }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-[#6c5dd3] transition-colors" style={{ color: '#1e1550' }}>
                      {r.title}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#a99fd8' }}>
                      {r.vendor_name}
                      {r.due_date && <span> · Due {new Date(r.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                    </p>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                    style={{ background: `${SEV_COLOR[r.severity]}1a`, color: SEV_COLOR[r.severity] ?? SEV_COLOR.medium }}
                  >
                    {r.severity}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent activity ── */}
      <Card title="Recent Activity" linkLabel="" href="">
        {recentActivity.length === 0 ? (
          <EmptyState message="No activity yet" sub="" />
        ) : (
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {recentActivity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Big totals stat ─────────────────────────────────────────────────────────

type Accent = 'brand' | 'amber' | 'rose' | 'emerald'
const ACCENT: Record<Accent, { num: string; border: string }> = {
  brand:   { num: 'text-violet-300',  border: 'border-t-violet-500' },
  amber:   { num: 'text-amber-300',   border: 'border-t-amber-400' },
  rose:    { num: 'text-rose-300',    border: 'border-t-rose-400' },
  emerald: { num: 'text-emerald-300', border: 'border-t-emerald-400' },
}

function BigStat({ label, value, sub, href, accent = 'brand' }: { label: string; value: number; sub: string; href: string; accent?: Accent }) {
  const a = ACCENT[accent]
  return (
    <Link
      href={href}
      className={`group relative flex flex-col bg-zinc-900 rounded-2xl p-5 border-t-2 ${a.border} ring-1 ring-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:ring-white/[0.14]`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-[10px] font-semibold text-zinc-200 uppercase tracking-widest leading-none">{label}</span>
      </div>
      <span className={`text-3xl font-bold tracking-tight leading-none ${a.num}`}>{value}</span>
      <span className="text-[11px] text-zinc-400 mt-2 leading-tight">{sub}</span>
    </Link>
  )
}

function SmallStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 1px 4px rgba(109,93,211,0.04)' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8b7fd4' }}>{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1" style={{ color: value > 0 ? color : '#c4bae8' }}>{value}</div>
    </div>
  )
}

function Card({ title, linkLabel, href, children }: { title: string; linkLabel: string; href: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>{title}</h2>
        {linkLabel && (
          <Link href={href} className="text-xs font-medium transition-colors hover:opacity-70" style={{ color: '#6c5dd3' }}>
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message, sub, emerald = false }: { message: string; sub?: string; emerald?: boolean }) {
  return (
    <div className="flex flex-col items-center py-8">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
        style={{ background: emerald ? 'rgba(5,150,105,0.08)' : 'rgba(108,93,211,0.06)' }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={emerald ? '#059669' : '#a99fd8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5l3.5 3.5 6.5-8" />
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: emerald ? '#059669' : '#1e1550' }}>{message}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#8b7fd4' }}>{sub}</p>}
    </div>
  )
}

const SEV_COLOR: Record<string, string> = {
  critical: '#e11d48',
  high: '#dc2626',
  medium: '#d97706',
  low: '#64748b',
}

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  created:                    { label: 'Created',           color: '#059669' },
  updated:                    { label: 'Updated',           color: '#6366f1' },
  deleted:                    { label: 'Deleted',           color: '#e11d48' },
  approval_status_changed:    { label: 'Approval changed',  color: '#7c3aed' },
  evidence_uploaded:          { label: 'Evidence uploaded', color: '#0ea5e9' },
  evidence_approved:          { label: 'Evidence approved', color: '#059669' },
  evidence_rejected:          { label: 'Evidence rejected', color: '#e11d48' },
  evidence_under_review:      { label: 'Evidence in review', color: '#7c3aed' },
  evidence_waived:            { label: 'Evidence waived',   color: '#64748b' },
  evidence_requested:         { label: 'Evidence requested', color: '#d97706' },
  status_changed:             { label: 'Status changed',    color: '#8b5cf6' },
  issue_created:              { label: 'Remediation created', color: '#dc2626' },
  issue_resolved:             { label: 'Remediation resolved', color: '#059669' },
  issue_closed:               { label: 'Remediation closed', color: '#94a3b8' },
  issue_auto_resolved:        { label: 'Auto-resolved',     color: '#059669' },
}

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const { label, color } = ACTION_CONFIG[entry.action] ?? { label: entry.action.replace(/_/g, ' '), color: '#94a3b8' }
  const time = new Date(entry.created_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug" style={{ color: '#4a4270' }}>
          <span className="font-semibold mr-1" style={{ color }}>{label}</span>
          {entry.title ?? entry.action}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#c4bae8' }}>{time}</p>
      </div>
    </div>
  )
}
