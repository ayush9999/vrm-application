import sql from '@/lib/db/pool'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import type { VendorStatus, VendorApprovalStatus } from '@/types/vendor'
import type { ActivityLogEntry } from '@/types/activity'

export interface DashboardData {
  totals: {
    vendors: number
    activeVendors: number
    criticalVendors: number
  }
  operational: {
    awaitingDocuments: number       // vendors with at least one missing required evidence
    underReview: number              // approval_status = in_internal_review
    approvalsPending: number         // approval_status = waiting_on_vendor or in_internal_review
    approvedWithException: number    // approval_status = approved_with_exception
    openRemediations: number
    overdueRemediations: number
    docsExpired: number
    docsExpiring30: number
    docsExpiring60: number
    reviewsDueThisMonth: number
    criticalNotReady: number         // tier 1 vendors with readiness < 80%
    suspendedOrBlocked: number
  }
  highRiskVendors: HighRiskVendor[]
  recentRemediations: RecentRemediation[]
  recentActivity: ActivityLogEntry[]
}

export interface HighRiskVendor {
  id: string
  name: string
  approval_status: VendorApprovalStatus
  criticality_tier: number | null
  riskBand: 'low' | 'medium' | 'high' | 'critical'
  riskScore: number
  readinessPct: number
  openRemediations: number
}

export interface RecentRemediation {
  id: string
  title: string
  severity: string
  status: string
  due_date: string | null
  vendor_name: string
  vendor_id: string
}

export async function getDashboardData(orgId: string): Promise<DashboardData> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]
  const in60Days = new Date(Date.now() + 60 * 86_400_000).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  // All 5 queries pipelined on one Postgres connection
  const [vendors, docs, issues, recentIssues, activity] = await Promise.all([
    sql<{
      id: string; name: string; status: VendorStatus; is_critical: boolean
      criticality_tier: number | null; approval_status: VendorApprovalStatus
      next_review_due_at: string | null
    }[]>`
      SELECT id, name, status, is_critical, criticality_tier, approval_status, next_review_due_at
      FROM vendors
      WHERE org_id = ${orgId} AND deleted_at IS NULL AND archived_at IS NULL
    `,
    sql<{ expiry_date: string | null; evidence_status: string }[]>`
      SELECT expiry_date, evidence_status
      FROM vendor_documents
      WHERE org_id = ${orgId} AND deleted_at IS NULL
    `,
    sql<{ id: string; status: string; severity: string; due_date: string | null; vendor_id: string }[]>`
      SELECT id, status, severity, due_date, vendor_id
      FROM issues
      WHERE org_id = ${orgId} AND deleted_at IS NULL
    `,
    sql<{ id: string; title: string; severity: string; status: string; due_date: string | null; vendor_id: string; vendor_name: string }[]>`
      SELECT i.id, i.title, i.severity, i.status, i.due_date, i.vendor_id, v.name AS vendor_name
      FROM issues i
      JOIN vendors v ON v.id = i.vendor_id
      WHERE i.org_id = ${orgId}
        AND i.deleted_at IS NULL
        AND i.status IN ('open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred')
      ORDER BY i.created_at DESC
      LIMIT 5
    `,
    sql<ActivityLogEntry[]>`
      SELECT * FROM activity_log
      WHERE org_id = ${orgId}
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ])

  // Compute risk + readiness for every vendor (also uses direct Postgres internally)
  const metrics = await getVendorListMetrics(
    vendors.map((v) => ({ id: v.id, approval_status: v.approval_status })),
  )

  // Doc expiry counts
  let docsExpired = 0
  let docsExpiring30 = 0
  let docsExpiring60 = 0
  for (const d of docs) {
    if (d.evidence_status !== 'approved' || !d.expiry_date) continue
    if (d.expiry_date < todayStr) docsExpired++
    else if (d.expiry_date <= in30Days) docsExpiring30++
    else if (d.expiry_date <= in60Days) docsExpiring60++
  }

  // Remediation counts
  const openStatuses = new Set(['open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred'])
  let openRemediations = 0
  let overdueRemediations = 0
  const remediationsByVendor = new Map<string, number>()
  for (const i of issues) {
    if (!openStatuses.has(i.status)) continue
    openRemediations++
    if (i.due_date && i.due_date < todayStr && i.status !== 'deferred') overdueRemediations++
    remediationsByVendor.set(i.vendor_id, (remediationsByVendor.get(i.vendor_id) ?? 0) + 1)
  }

  // Operational metrics across vendors
  let awaitingDocuments = 0
  let underReview = 0
  let approvalsPending = 0
  let approvedWithException = 0
  let criticalNotReady = 0
  let suspendedOrBlocked = 0
  let reviewsDueThisMonth = 0

  for (const v of vendors) {
    const m = metrics.get(v.id)
    if (m && m.missingEvidenceCount > 0) awaitingDocuments++
    if (v.approval_status === 'in_internal_review') underReview++
    if (v.approval_status === 'waiting_on_vendor' || v.approval_status === 'in_internal_review') approvalsPending++
    if (v.approval_status === 'approved_with_exception') approvedWithException++
    if (v.approval_status === 'suspended' || v.approval_status === 'blocked') suspendedOrBlocked++
    if (v.criticality_tier === 1 && m && m.readinessPct < 80) criticalNotReady++
    if (v.next_review_due_at && v.next_review_due_at <= endOfMonth) reviewsDueThisMonth++
  }

  // Top 8 highest-risk vendors
  const enriched: HighRiskVendor[] = vendors
    .map((v) => {
      const m = metrics.get(v.id)
      return {
        id: v.id,
        name: v.name,
        approval_status: v.approval_status,
        criticality_tier: v.criticality_tier,
        riskBand: m?.risk.band ?? 'critical',
        riskScore: m?.risk.score ?? 0,
        readinessPct: m?.readinessPct ?? 0,
        openRemediations: remediationsByVendor.get(v.id) ?? 0,
      }
    })
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      const diff = order[a.riskBand] - order[b.riskBand]
      if (diff !== 0) return diff
      return a.riskScore - b.riskScore
    })

  const highRiskVendors = enriched.filter((v) => v.riskBand === 'critical' || v.riskBand === 'high').slice(0, 8)

  const recentRemediations: RecentRemediation[] = recentIssues.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    status: r.status,
    due_date: r.due_date,
    vendor_id: r.vendor_id,
    vendor_name: r.vendor_name ?? 'Unknown',
  }))

  return {
    totals: {
      vendors: vendors.length,
      activeVendors: vendors.filter((v) => v.status === 'active').length,
      criticalVendors: vendors.filter((v) => v.is_critical).length,
    },
    operational: {
      awaitingDocuments,
      underReview,
      approvalsPending,
      approvedWithException,
      openRemediations,
      overdueRemediations,
      docsExpired,
      docsExpiring30,
      docsExpiring60,
      reviewsDueThisMonth,
      criticalNotReady,
      suspendedOrBlocked,
    },
    highRiskVendors,
    recentRemediations,
    recentActivity: activity as unknown as ActivityLogEntry[],
  }
}
