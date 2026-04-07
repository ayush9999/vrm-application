import React from 'react'
import Link from 'next/link'
import { requireCurrentUser } from '@/lib/current-user'
import { getDashboardData } from '@/lib/db/dashboard'
import type { ActivityLogEntry } from '@/types/activity'

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const data = await getDashboardData(user.orgId)
  const {
    vendors, documents, disputes, incidents, issues,
    recentIssues, highRiskVendors,
    assessmentPipeline, reviewDueVendors, pendingHumanReviews, recentActivity,
  } = data

  const activeAssessments =
    assessmentPipeline.draft +
    assessmentPipeline.in_review +
    assessmentPipeline.pending_ai_review +
    assessmentPipeline.pending_human_review

  // Attention items
  const overdueVendors = reviewDueVendors.filter(v => v.daysOverdue > 0)
  const totalOverdue = issues.overdue + documents.expired + overdueVendors.length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1e1550' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#a99fd8' }}>Overview of your vendor risk programme</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/issues"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
            style={{ background: 'rgba(109,93,211,0.08)', color: '#6c5dd3', border: '1px solid rgba(109,93,211,0.15)' }}
          >
            View Issues
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

      {/* ── Hero stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total Vendors"
          value={vendors.total}
          sub={`${vendors.byStatus.active} active · ${vendors.critical} critical`}
          href="/vendors"
          icon="building"
          accent="brand"
        />
        <StatCard
          label="Open Issues"
          value={issues.total}
          sub={issues.bySeverity.critical + issues.bySeverity.high > 0
            ? `${issues.bySeverity.critical + issues.bySeverity.high} critical/high`
            : 'no critical issues'}
          href="/issues"
          icon="issue"
          accent={issues.bySeverity.critical > 0 ? 'rose' : issues.bySeverity.high > 0 ? 'amber' : 'brand'}
        />
        <StatCard
          label="Overdue"
          value={totalOverdue}
          sub={`${issues.overdue} issues · ${documents.expired} docs`}
          href="/issues"
          icon="clock"
          accent={totalOverdue > 0 ? 'rose' : 'brand'}
        />
        <StatCard
          label="High-Risk Vendors"
          value={vendors.critical}
          sub={vendors.critical > 0 ? 'require close monitoring' : 'none flagged'}
          href="/vendors"
          icon="shield"
          accent={vendors.critical > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Assessments"
          value={activeAssessments}
          sub={assessmentPipeline.pending_human_review > 0
            ? `${assessmentPipeline.pending_human_review} awaiting sign-off`
            : `${assessmentPipeline.completed} completed`}
          href="/assessments"
          icon="clipboard"
          accent={assessmentPipeline.pending_human_review > 0 ? 'amber' : 'brand'}
        />
      </div>

      {/* ── Attention banner ── */}
      {totalOverdue > 0 && (
        <div
          className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(225,29,72,0.04) 0%, rgba(245,158,11,0.04) 100%)', border: '1px solid rgba(225,29,72,0.12)' }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#e11d48' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#e11d48' }}>Needs Attention</span>
          </div>
          {issues.overdue > 0 && (
            <Link href="/issues" className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.15)' }}>
              {issues.overdue} overdue issue{issues.overdue !== 1 ? 's' : ''}
            </Link>
          )}
          {documents.expired > 0 && (
            <Link href="/vendors" className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80" style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.15)' }}>
              {documents.expired} expired doc{documents.expired !== 1 ? 's' : ''}
            </Link>
          )}
          {overdueVendors.length > 0 && (
            <Link href="/vendors" className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80" style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }}>
              {overdueVendors.length} review{overdueVendors.length !== 1 ? 's' : ''} overdue
            </Link>
          )}
          {pendingHumanReviews.length > 0 && (
            <Link href="/assessments" className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:opacity-80" style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }}>
              {pendingHumanReviews.length} assessment{pendingHumanReviews.length !== 1 ? 's' : ''} awaiting review
            </Link>
          )}
        </div>
      )}

      {/* ── Issue severity breakdown + Recent issues ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Issue severity breakdown */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
              Issues by Severity
            </h2>
            <Link href="/issues" className="text-xs font-medium transition-colors hover:opacity-70" style={{ color: '#6c5dd3' }}>
              View all →
            </Link>
          </div>

          {issues.total === 0 ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(5,150,105,0.08)' }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8.5l3.5 3.5 6.5-8" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: '#059669' }}>All clear</p>
              <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>No open issues</p>
            </div>
          ) : (
            <div className="space-y-3">
              <SeverityBar label="Critical" count={issues.bySeverity.critical} total={issues.total} color="#e11d48" bgColor="rgba(225,29,72,0.1)" />
              <SeverityBar label="High"     count={issues.bySeverity.high}     total={issues.total} color="#dc2626" bgColor="rgba(239,68,68,0.1)" />
              <SeverityBar label="Medium"   count={issues.bySeverity.medium}   total={issues.total} color="#d97706" bgColor="rgba(245,158,11,0.1)" />
              <SeverityBar label="Low"      count={issues.bySeverity.low}      total={issues.total} color="#64748b" bgColor="rgba(148,163,184,0.15)" />
            </div>
          )}

          {/* Status summary row */}
          {issues.total > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'rgba(109,93,211,0.08)' }}>
              <StatusChip label="Open" count={issues.open} color="#d97706" />
              <StatusChip label="In Progress" count={issues.inProgress} color="#0ea5e9" />
              <StatusChip label="Overdue" count={issues.overdue} color="#e11d48" />
            </div>
          )}
        </div>

        {/* Recent open issues */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
              Recent Issues
            </h2>
            <Link href="/issues" className="text-xs font-medium transition-colors hover:opacity-70" style={{ color: '#6c5dd3' }}>
              View all →
            </Link>
          </div>

          {recentIssues.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#c4bae8' }}>No open issues</p>
          ) : (
            <div className="space-y-1">
              {recentIssues.map(issue => {
                const sevColor = SEV_COLOR[issue.severity] ?? SEV_COLOR.medium
                const isOverdue = issue.due_date && issue.due_date < new Date().toISOString().split('T')[0] && issue.status !== 'deferred'
                return (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[rgba(109,93,211,0.03)] group"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: sevColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-[#6c5dd3] transition-colors" style={{ color: '#1e1550' }}>
                        {issue.title}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#a99fd8' }}>
                        {issue.vendor_name}
                        {issue.due_date && (
                          <span style={{ color: isOverdue ? '#e11d48' : undefined }}>
                            {' · '}
                            {isOverdue ? 'Overdue' : `Due ${new Date(issue.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                      style={{ background: `${sevColor}18`, color: sevColor }}
                    >
                      {issue.severity}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Middle row: High-risk vendors + Assessment pipeline + Vendor status ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* High-risk vendors */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>
              High-Risk Vendors
            </h2>
            <Link href="/vendors" className="text-xs font-medium transition-colors hover:opacity-70" style={{ color: '#6c5dd3' }}>
              View all →
            </Link>
          </div>

          {highRiskVendors.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(5,150,105,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1.5L2 5v4.5c0 3 2.5 5 6 6.5 3.5-1.5 6-3.5 6-6.5V5L8 1.5z" />
                  <path d="M5.5 8l2 2 3.5-4" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: '#059669' }}>No high-risk vendors</p>
              <p className="text-xs mt-0.5" style={{ color: '#a99fd8' }}>All vendors are within tolerance</p>
            </div>
          ) : (
            <div className="space-y-2">
              {highRiskVendors.map(v => (
                <Link
                  key={v.id}
                  href={`/vendors/${v.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[rgba(109,93,211,0.03)] group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}
                  >
                    {v.criticality_tier ? `T${v.criticality_tier}` : '!'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-[#6c5dd3] transition-colors" style={{ color: '#1e1550' }}>
                      {v.name}
                    </p>
                    <p className="text-[11px]" style={{ color: '#a99fd8' }}>
                      {v.status.replace(/_/g, ' ')}
                      {v.openIssueCount > 0 && (
                        <span style={{ color: '#e11d48' }}> · {v.openIssueCount} open issue{v.openIssueCount !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Assessment pipeline */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Assessment Pipeline</h2>
            <Link href="/assessments" className="text-xs font-medium transition-colors hover:opacity-70" style={{ color: '#6c5dd3' }}>
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            <PipelineRow label="Draft"           count={assessmentPipeline.draft}                dot="#94a3b8" />
            <PipelineRow label="In Review"       count={assessmentPipeline.in_review}            dot="#8b5cf6" />
            <PipelineRow label="Pending AI"      count={assessmentPipeline.pending_ai_review}    dot="#0ea5e9" />
            <PipelineRow label="Pending Human"   count={assessmentPipeline.pending_human_review} dot="#d97706" highlight={assessmentPipeline.pending_human_review > 0} />
            <PipelineRow label="Submitted"       count={assessmentPipeline.submitted}            dot="#6366f1" />
            <PipelineRow label="Completed"       count={assessmentPipeline.completed}            dot="#059669" />
          </div>

          {/* Upcoming reviews */}
          {reviewDueVendors.length > 0 && (
            <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Reviews Due Soon</h3>
              {reviewDueVendors.filter(v => v.daysOverdue <= 0).slice(0, 3).map(v => {
                const daysLeft = Math.abs(v.daysOverdue)
                return (
                  <Link
                    key={v.id}
                    href={`/vendors/${v.id}`}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[rgba(109,93,211,0.03)] transition-colors"
                  >
                    <span className="text-xs font-medium truncate" style={{ color: '#1e1550' }}>{v.name}</span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: daysLeft <= 7 ? 'rgba(245,158,11,0.1)' : 'rgba(109,93,211,0.06)',
                        color: daysLeft <= 7 ? '#d97706' : '#8b7fd4',
                      }}
                    >
                      {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Vendor status */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
        >
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Vendor Status</h2>
          <VendorStatusBar label="Active"       count={vendors.byStatus.active}       total={vendors.total} color="#059669" />
          <VendorStatusBar label="Under Review" count={vendors.byStatus.under_review} total={vendors.total} color="#d97706" />
          <VendorStatusBar label="Suspended"    count={vendors.byStatus.suspended}    total={vendors.total} color="#e11d48" />

          {/* Doc summary */}
          <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(109,93,211,0.08)' }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a99fd8' }}>Documents</h3>
            <div className="flex items-center gap-3">
              {documents.expired > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(225,29,72,0.06)', color: '#e11d48' }}>
                  {documents.expired} expired
                </span>
              )}
              {documents.expiringSoon > 0 && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', color: '#d97706' }}>
                  {documents.expiringSoon} expiring soon
                </span>
              )}
              {documents.expired === 0 && documents.expiringSoon === 0 && (
                <span className="text-[11px] font-medium" style={{ color: '#059669' }}>All docs current</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'white', border: '1px solid rgba(109,93,211,0.1)', boxShadow: '0 2px 12px rgba(109,93,211,0.08)' }}
      >
        <h2 className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: '#a99fd8' }}>Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: '#c4bae8' }}>No activity yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
            {recentActivity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Severity color map ──────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: '#e11d48',
  high: '#dc2626',
  medium: '#d97706',
  low: '#64748b',
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

type Accent = 'brand' | 'amber' | 'rose' | 'emerald'

const ACCENT: Record<Accent, { num: string; border: string; glow: string }> = {
  brand:   { num: 'text-violet-300',  border: 'border-t-violet-500',  glow: 'hover:shadow-[0_12px_36px_rgba(109,93,211,0.22)]' },
  amber:   { num: 'text-amber-300',   border: 'border-t-amber-400',   glow: 'hover:shadow-[0_12px_36px_rgba(251,191,36,0.22)]' },
  rose:    { num: 'text-rose-300',    border: 'border-t-rose-400',    glow: 'hover:shadow-[0_12px_36px_rgba(251,113,133,0.22)]' },
  emerald: { num: 'text-emerald-300', border: 'border-t-emerald-400', glow: 'hover:shadow-[0_12px_36px_rgba(52,211,153,0.18)]' },
}

const ICONS: Record<string, React.ReactNode> = {
  building: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 14h13M2.5 14V5L7.5 2l5 3v9M5.5 14v-3.5h4V14M5.5 7h1M8.5 7h1M5.5 10h1M8.5 10h1" />
    </svg>
  ),
  clipboard: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="9" height="11" rx="1" />
      <path d="M5.5 2V1.5M9.5 2V1.5M5 6h5M5 8.5h3" />
    </svg>
  ),
  issue: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="7.5" r="6" />
      <path d="M7.5 4.5v3.5M7.5 10.5h.01" />
    </svg>
  ),
  clock: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="7.5" r="6" />
      <path d="M7.5 4v4l2.5 1.5" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 1L2 3.5v4c0 3.5 2.5 5.5 5.5 7 3-1.5 5.5-3.5 5.5-7v-4L7.5 1z" />
      <path d="M7.5 5v3M7.5 10h.01" />
    </svg>
  ),
}

function StatCard({
  label, value, sub, href, accent = 'brand', icon,
}: {
  label: string; value: number; sub: string; href: string; accent?: Accent; icon: string
}) {
  const a = ACCENT[accent]
  return (
    <Link
      href={href}
      className={`group relative flex flex-col bg-zinc-900 rounded-2xl p-5 border-t-2 ${a.border} ring-1 ring-white/[0.07] overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:ring-white/[0.14] ${a.glow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="flex items-start justify-between mb-4">
        <span className="text-[10px] font-semibold text-zinc-200 uppercase tracking-widest leading-none">{label}</span>
        <span className={a.num}>{ICONS[icon]}</span>
      </div>
      <span className={`text-3xl font-bold tracking-tight leading-none ${a.num}`}>{value}</span>
      <span className="text-[11px] text-zinc-400 mt-2 leading-tight">{sub}</span>
    </Link>
  )
}

// ─── Severity bar ────────────────────────────────────────────────────────────

function SeverityBar({ label, count, total, color, bgColor }: {
  label: string; count: number; total: number; color: string; bgColor: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
          <span className="text-xs font-medium" style={{ color: '#1e1550' }}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums" style={{ color }}>{count}</span>
          <span className="text-[10px]" style={{ color: '#a99fd8' }}>{pct}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${bgColor})` }}
        />
      </div>
    </div>
  )
}

// ─── Status chip ─────────────────────────────────────────────────────────────

function StatusChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[11px] font-medium" style={{ color: '#4a4270' }}>{label}</span>
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{count}</span>
    </div>
  )
}

// ─── Pipeline row ────────────────────────────────────────────────────────────

function PipelineRow({ label, count, dot, highlight = false }: {
  label: string; count: number; dot: string; highlight?: boolean
}) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-xl transition-colors"
      style={{ background: highlight && count > 0 ? 'rgba(245,158,11,0.06)' : 'transparent' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
        <span className="text-xs font-medium" style={{ color: highlight && count > 0 ? '#d97706' : '#4a4270' }}>{label}</span>
      </div>
      <span
        className="text-sm font-bold tabular-nums"
        style={{ color: highlight && count > 0 ? '#d97706' : count > 0 ? '#1e1550' : '#c4bae8' }}
      >
        {count}
      </span>
    </div>
  )
}

// ─── Vendor status bar ───────────────────────────────────────────────────────

function VendorStatusBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: '#4a4270' }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tabular-nums" style={{ color }}>{count}</span>
          <span className="text-[10px]" style={{ color: '#a99fd8' }}>{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(109,93,211,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Activity row ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  created:                { label: 'Created',         color: '#059669' },
  updated:                { label: 'Updated',         color: '#6366f1' },
  deleted:                { label: 'Deleted',         color: '#e11d48' },
  document_uploaded:      { label: 'Doc uploaded',    color: '#0ea5e9' },
  custom_document_added:  { label: 'Custom doc',      color: '#0ea5e9' },
  document_updated:       { label: 'Doc updated',     color: '#6366f1' },
  dispute_created:        { label: 'Dispute raised',  color: '#d97706' },
  dispute_status_updated: { label: 'Dispute updated', color: '#d97706' },
  evidence_promoted:      { label: 'Evidence saved',  color: '#059669' },
  status_changed:         { label: 'Status changed',  color: '#8b5cf6' },
  issue_created:          { label: 'Issue created',   color: '#dc2626' },
  issue_resolved:         { label: 'Issue resolved',  color: '#059669' },
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
