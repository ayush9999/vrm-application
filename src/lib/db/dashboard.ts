import { createServerClient } from '@/lib/supabase/server'
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
  const supabase = await createServerClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]
  const in60Days = new Date(Date.now() + 60 * 86_400_000).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    vendorsRes,
    docsRes,
    issuesRes,
    recentIssuesRes,
    activityRes,
  ] = await Promise.all([
    supabase
      .from('vendors')
      .select('id, name, status, is_critical, criticality_tier, approval_status, next_review_due_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .is('archived_at', null),

    supabase
      .from('vendor_documents')
      .select('expiry_date, evidence_status')
      .eq('org_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('issues')
      .select('id, status, severity, due_date, vendor_id')
      .eq('org_id', orgId)
      .is('deleted_at', null),

    supabase
      .from('issues')
      .select('id, title, severity, status, due_date, vendor_id, vendors(name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred'])
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('activity_log')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  type VendorRow = {
    id: string
    name: string
    status: VendorStatus
    is_critical: boolean
    criticality_tier: number | null
    approval_status: VendorApprovalStatus
    next_review_due_at: string | null
  }
  const vendors = (vendorsRes.data ?? []) as VendorRow[]

  // Compute risk + readiness for every vendor
  const metrics = await getVendorListMetrics(
    vendors.map((v) => ({ id: v.id, approval_status: v.approval_status })),
  )

  // Doc expiry counts (only count Approved evidence — expiry doesn't apply otherwise)
  const docs = (docsRes.data ?? []) as { expiry_date: string | null; evidence_status: string }[]
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
  const issues = (issuesRes.data ?? []) as { status: string; due_date: string | null; vendor_id: string }[]
  const openStatuses = new Set(['open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred'])
  let openRemediations = 0
  let overdueRemediations = 0
  for (const i of issues) {
    if (!openStatuses.has(i.status)) continue
    openRemediations++
    if (i.due_date && i.due_date < todayStr && i.status !== 'deferred') overdueRemediations++
  }
  const remediationsByVendor = new Map<string, number>()
  for (const i of issues) {
    if (!openStatuses.has(i.status)) continue
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

  // Top 8 highest-risk vendors (Critical band first, then High)
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

  type RemRow = {
    id: string; title: string; severity: string; status: string; due_date: string | null
    vendor_id: string; vendors: { name: string } | null
  }
  const recentRemediations: RecentRemediation[] = ((recentIssuesRes.data ?? []) as unknown as RemRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    status: r.status,
    due_date: r.due_date,
    vendor_id: r.vendor_id,
    vendor_name: r.vendors?.name ?? 'Unknown',
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
    recentActivity: (activityRes.data ?? []) as ActivityLogEntry[],
  }
}
