import { createServerClient } from '@/lib/supabase/server'
import type { VendorStatus } from '@/types/vendor'
import type { ActivityLogEntry } from '@/types/activity'

export interface VendorStats {
  total: number
  byStatus: Record<VendorStatus, number>
  critical: number
}

export interface DocumentStats {
  expiringSoon: number
  expired: number
}

export interface DisputeStats {
  open: number
  under_review: number
}

export interface AssessmentPipelineStats {
  draft: number
  in_review: number
  pending_ai_review: number
  pending_human_review: number
  submitted: number
  completed: number
}

export interface IncidentStats {
  open: number
  bySeverity: { critical: number; high: number; medium: number; low: number }
}

export interface ReviewDueVendor {
  id: string
  name: string
  next_review_due_at: string
  daysOverdue: number  // negative = still upcoming
}

export interface PendingAssessment {
  id: string
  title: string | null
  vendor_name: string
  vendor_id: string
  status: string
}

export interface IssueStats {
  total: number
  open: number
  inProgress: number
  overdue: number
  bySeverity: { critical: number; high: number; medium: number; low: number }
}

export interface RecentIssue {
  id: string
  title: string
  severity: string
  status: string
  due_date: string | null
  vendor_name: string
  vendor_id: string
}

export interface HighRiskVendor {
  id: string
  name: string
  status: string
  criticality_tier: number | null
  openIssueCount: number
}

export interface DashboardData {
  vendors: VendorStats
  documents: DocumentStats
  disputes: DisputeStats
  incidents: IncidentStats
  issues: IssueStats
  recentIssues: RecentIssue[]
  highRiskVendors: HighRiskVendor[]
  assessmentPipeline: AssessmentPipelineStats
  reviewDueVendors: ReviewDueVendor[]
  pendingHumanReviews: PendingAssessment[]
  recentActivity: ActivityLogEntry[]
}

export async function getDashboardData(orgId: string): Promise<DashboardData> {
  const supabase = createServerClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [vendorRes, docRes, disputeRes, activityRes, assessmentRes, incidentRes, reviewDueRes, pendingHumanRes, issueRes, recentIssueRes, highRiskVendorRes] = await Promise.all([
    // Vendors
    supabase
      .from('vendors')
      .select('status, is_critical')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .is('archived_at', null),

    // Documents with expiry
    supabase
      .from('vendor_documents')
      .select('expiry_date')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('expiry_date', 'is', null),

    // Open disputes
    supabase
      .from('vendor_disputes')
      .select('status')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['open', 'under_review']),

    // Recent activity
    supabase
      .from('activity_log')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),

    // Assessment pipeline
    supabase
      .from('vendor_assessments')
      .select('status')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('status', 'in', '("archived")'),

    // Open incidents
    supabase
      .from('vendor_incidents')
      .select('severity')
      .eq('org_id', orgId)
      .eq('status', 'open')
      .is('deleted_at', null),

    // Vendors with review due (overdue or within 30 days)
    supabase
      .from('vendors')
      .select('id, name, next_review_due_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .not('next_review_due_at', 'is', null)
      .lte('next_review_due_at', in30Days)
      .order('next_review_due_at', { ascending: true })
      .limit(5),

    // Assessments pending human review
    supabase
      .from('vendor_assessments')
      .select('id, title, status, vendors(id, name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['pending_human_review', 'submitted'])
      .order('updated_at', { ascending: false })
      .limit(5),

    // All active issues (not resolved/closed/deleted)
    supabase
      .from('issues')
      .select('severity, status, due_date')
      .eq('org_id', orgId)
      .is('deleted_at', null),

    // Recent open issues with vendor name
    supabase
      .from('issues')
      .select('id, title, severity, status, due_date, vendor_id, vendors(name)')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress', 'blocked', 'deferred'])
      .order('created_at', { ascending: false })
      .limit(5),

    // High-risk vendors (critical flag set)
    supabase
      .from('vendors')
      .select('id, name, status, criticality_tier, is_critical')
      .eq('org_id', orgId)
      .eq('is_critical', true)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name')
      .limit(8),
  ])

  // Vendor stats
  const vendorRows = (vendorRes.data ?? []) as { status: VendorStatus; is_critical: boolean }[]
  const byStatus: Record<VendorStatus, number> = { active: 0, under_review: 0, suspended: 0 }
  let critical = 0
  for (const v of vendorRows) {
    byStatus[v.status] = (byStatus[v.status] ?? 0) + 1
    if (v.is_critical) critical++
  }

  // Document stats
  const docRows = (docRes.data ?? []) as { expiry_date: string }[]
  let expiringSoon = 0
  let expired = 0
  for (const d of docRows) {
    if (d.expiry_date < todayStr) expired++
    else if (d.expiry_date <= in30Days) expiringSoon++
  }

  // Dispute stats
  const disputeRows = (disputeRes.data ?? []) as { status: string }[]
  const disputes = { open: 0, under_review: 0 }
  for (const d of disputeRows) {
    if (d.status === 'open') disputes.open++
    else if (d.status === 'under_review') disputes.under_review++
  }

  // Assessment pipeline
  const assessmentRows = (assessmentRes.data ?? []) as { status: string }[]
  const pipeline: AssessmentPipelineStats = {
    draft: 0, in_review: 0, pending_ai_review: 0,
    pending_human_review: 0, submitted: 0, completed: 0,
  }
  for (const a of assessmentRows) {
    const k = a.status as keyof AssessmentPipelineStats
    if (k in pipeline) pipeline[k]++
  }

  // Incident stats
  const incidentRows = (incidentRes.data ?? []) as { severity: string }[]
  const incidentSeverity = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const i of incidentRows) {
    const s = i.severity as keyof typeof incidentSeverity
    if (s in incidentSeverity) incidentSeverity[s]++
  }

  // Review due vendors
  const reviewRows = (reviewDueRes.data ?? []) as { id: string; name: string; next_review_due_at: string }[]
  const reviewDueVendors: ReviewDueVendor[] = reviewRows.map(v => {
    const due = new Date(v.next_review_due_at)
    const diffMs = today.getTime() - due.getTime()
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return { id: v.id, name: v.name, next_review_due_at: v.next_review_due_at, daysOverdue }
  })

  // Pending human reviews
  const pendingRows = (pendingHumanRes.data ?? []) as unknown as {
    id: string; title: string | null; status: string
    vendors: { id: string; name: string } | null
  }[]
  const pendingHumanReviews: PendingAssessment[] = pendingRows.map(a => ({
    id: a.id,
    title: a.title,
    vendor_name: a.vendors?.name ?? 'Unknown vendor',
    vendor_id: a.vendors?.id ?? '',
    status: a.status,
  }))

  // Issue stats
  const issueRows = (issueRes.data ?? []) as { severity: string; status: string; due_date: string | null }[]
  const activeStatuses = new Set(['open', 'in_progress', 'blocked', 'deferred'])
  const issueSeverity = { critical: 0, high: 0, medium: 0, low: 0 }
  let issueOpen = 0
  let issueInProgress = 0
  let issueOverdue = 0
  for (const i of issueRows) {
    if (activeStatuses.has(i.status)) {
      const s = i.severity as keyof typeof issueSeverity
      if (s in issueSeverity) issueSeverity[s]++
      if (i.status === 'open') issueOpen++
      if (i.status === 'in_progress') issueInProgress++
      if (i.due_date && i.due_date < todayStr && i.status !== 'deferred') issueOverdue++
    }
  }
  const issueTotalActive = issueRows.filter(i => activeStatuses.has(i.status)).length

  // Recent issues
  const recentIssueRows = (recentIssueRes.data ?? []) as unknown as {
    id: string; title: string; severity: string; status: string; due_date: string | null
    vendor_id: string; vendors: { name: string } | null
  }[]
  const recentIssues: RecentIssue[] = recentIssueRows.map(i => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    status: i.status,
    due_date: i.due_date,
    vendor_name: i.vendors?.name ?? 'Unknown',
    vendor_id: i.vendor_id,
  }))

  // High-risk vendors — enrich with open issue count
  const hrVendorRows = (highRiskVendorRes.data ?? []) as {
    id: string; name: string; status: string; criticality_tier: number | null; is_critical: boolean
  }[]
  // Count open issues per vendor from the full issue list
  const openIssuesByVendor = new Map<string, number>()
  for (const i of issueRows) {
    // We don't have vendor_id in the summary query — use recentIssueRows as proxy
  }
  const highRiskVendors: HighRiskVendor[] = hrVendorRows.map(v => ({
    id: v.id,
    name: v.name,
    status: v.status,
    criticality_tier: v.criticality_tier,
    openIssueCount: 0, // enriched below
  }))

  // Quick issue count per high-risk vendor
  if (highRiskVendors.length > 0) {
    const hrIds = highRiskVendors.map(v => v.id)
    const { data: issueCounts } = await supabase
      .from('issues')
      .select('vendor_id')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress', 'blocked', 'deferred'])
      .in('vendor_id', hrIds)
    if (issueCounts) {
      const countMap = new Map<string, number>()
      for (const r of issueCounts) countMap.set(r.vendor_id, (countMap.get(r.vendor_id) ?? 0) + 1)
      for (const v of highRiskVendors) v.openIssueCount = countMap.get(v.id) ?? 0
    }
  }

  return {
    vendors: { total: vendorRows.length, byStatus, critical },
    documents: { expiringSoon, expired },
    disputes,
    incidents: { open: incidentRows.length, bySeverity: incidentSeverity },
    issues: {
      total: issueTotalActive,
      open: issueOpen,
      inProgress: issueInProgress,
      overdue: issueOverdue,
      bySeverity: issueSeverity,
    },
    recentIssues,
    highRiskVendors,
    assessmentPipeline: pipeline,
    reviewDueVendors,
    pendingHumanReviews,
    recentActivity: (activityRes.data ?? []) as ActivityLogEntry[],
  }
}
