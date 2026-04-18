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
    const exp = String(d.expiry_date)
    if (exp < todayStr) docsExpired++
    else if (exp <= in30Days) docsExpiring30++
    else if (exp <= in60Days) docsExpiring60++
  }

  // Remediation counts
  const openStatuses = new Set(['open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred'])
  let openRemediations = 0
  let overdueRemediations = 0
  const remediationsByVendor = new Map<string, number>()
  for (const i of issues) {
    if (!openStatuses.has(i.status)) continue
    openRemediations++
    if (i.due_date && String(i.due_date) < todayStr && i.status !== 'deferred') overdueRemediations++
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
    if (v.next_review_due_at && String(v.next_review_due_at) <= endOfMonth) reviewsDueThisMonth++
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

// ---------------------------------------------------------------------------
// Programme Health
// ---------------------------------------------------------------------------

export interface ProgrammeHealth {
  score: number         // 0-100
  band: 'critical' | 'high' | 'medium' | 'low'
  bandColor: string     // hex color for the gauge
  evidenceCompletePct: number
  reviewsCompletePct: number
  vendorsApprovedPct: number
}

export async function getProgrammeHealth(orgId: string): Promise<ProgrammeHealth> {
  const [evidenceRows, reviewRows, vendorRows, criticalRows, suspendedRows] = await Promise.all([
    sql<{ approved: string; total: string }[]>`
      SELECT COUNT(*) FILTER (WHERE vd.evidence_status = 'approved') as approved,
             COUNT(*) as total
      FROM vendor_documents vd
      JOIN evidence_requirements er ON er.id = vd.evidence_requirement_id
      WHERE vd.org_id = ${orgId} AND vd.deleted_at IS NULL AND er.required = true
    `,
    sql<{ completed: string; total: string }[]>`
      SELECT COUNT(*) FILTER (WHERE vrp.status IN ('approved', 'approved_with_exception', 'locked')) as completed,
             COUNT(*) as total
      FROM vendor_review_packs vrp
      WHERE vrp.org_id = ${orgId} AND vrp.deleted_at IS NULL
    `,
    sql<{ approved: string; total: string }[]>`
      SELECT COUNT(*) FILTER (WHERE v.approval_status IN ('approved', 'approved_with_exception')) as approved,
             COUNT(*) as total
      FROM vendors v
      WHERE v.org_id = ${orgId} AND v.deleted_at IS NULL AND v.archived_at IS NULL
    `,
    sql<{ count: string }[]>`
      SELECT COUNT(*) as count
      FROM issues
      WHERE org_id = ${orgId} AND deleted_at IS NULL
        AND severity = 'critical'
        AND status IN ('open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred')
    `,
    sql<{ count: string }[]>`
      SELECT COUNT(*) as count
      FROM vendors
      WHERE org_id = ${orgId} AND deleted_at IS NULL AND archived_at IS NULL
        AND approval_status IN ('suspended', 'blocked')
    `,
  ])

  const evidenceApproved = Number(evidenceRows[0].approved)
  const evidenceTotal = Number(evidenceRows[0].total)
  const reviewsCompleted = Number(reviewRows[0].completed)
  const reviewsTotal = Number(reviewRows[0].total)
  const vendorsApproved = Number(vendorRows[0].approved)
  const vendorsTotal = Number(vendorRows[0].total)
  const openCriticalRemediations = Number(criticalRows[0].count)
  const hasSuspendedOrBlocked = Number(suspendedRows[0].count) > 0

  const evidenceCompletePct = evidenceTotal === 0 ? 0 : Math.round((evidenceApproved / evidenceTotal) * 100)
  const reviewsCompletePct = reviewsTotal === 0 ? 0 : Math.round((reviewsCompleted / reviewsTotal) * 100)
  const vendorsApprovedPct = vendorsTotal === 0 ? 0 : Math.round((vendorsApproved / vendorsTotal) * 100)

  const rawScore = evidenceCompletePct * 0.35 + reviewsCompletePct * 0.35 + vendorsApprovedPct * 0.30
  const deduction = Math.min(openCriticalRemediations * 5, 20)
  let score = Math.max(0, Math.round(rawScore - deduction))

  if (hasSuspendedOrBlocked) {
    score = Math.min(score, 30)
  }

  const band: ProgrammeHealth['band'] =
    score <= 30 ? 'critical' :
    score <= 60 ? 'high' :
    score <= 85 ? 'medium' :
    'low'

  const bandColorMap: Record<ProgrammeHealth['band'], string> = {
    critical: '#E24B4A',
    high: '#EF9F27',
    medium: '#EF9F27',
    low: '#639922',
  }

  return {
    score,
    band,
    bandColor: bandColorMap[band],
    evidenceCompletePct,
    reviewsCompletePct,
    vendorsApprovedPct,
  }
}

// ---------------------------------------------------------------------------
// Pack Readiness
// ---------------------------------------------------------------------------

export interface PackReadinessItem {
  packName: string
  packCode: string | null
  readinessPct: number
}

export async function getPackReadiness(orgId: string): Promise<PackReadinessItem[]> {
  const [reviewItems, evidenceItems] = await Promise.all([
    sql<{ pack_id: string; pack_name: string; pack_code: string | null; decision: string }[]>`
      SELECT rp.id as pack_id, rp.name as pack_name, rp.code as pack_code,
        vri.decision
      FROM review_packs rp
      JOIN vendor_review_packs vrp ON vrp.review_pack_id = rp.id AND vrp.deleted_at IS NULL
      JOIN vendor_review_items vri ON vri.vendor_review_pack_id = vrp.id
      WHERE (rp.org_id IS NULL OR rp.org_id = ${orgId})
        AND rp.is_active = true AND rp.deleted_at IS NULL
        AND vrp.org_id = ${orgId}
    `,
    sql<{ pack_id: string; evidence_status: string }[]>`
      SELECT rp.id as pack_id, vd.evidence_status
      FROM review_packs rp
      JOIN evidence_requirements er ON er.review_pack_id = rp.id AND er.deleted_at IS NULL
      JOIN vendor_documents vd ON vd.evidence_requirement_id = er.id AND vd.deleted_at IS NULL
      WHERE (rp.org_id IS NULL OR rp.org_id = ${orgId})
        AND rp.is_active = true AND rp.deleted_at IS NULL
        AND vd.org_id = ${orgId}
    `,
  ])

  // Group review items by pack
  const packMap = new Map<string, {
    packName: string
    packCode: string | null
    reviewApplicable: number
    reviewCompleted: number
    evidenceApplicable: number
    evidenceCompleted: number
  }>()

  for (const row of reviewItems) {
    let pack = packMap.get(row.pack_id)
    if (!pack) {
      pack = {
        packName: row.pack_name,
        packCode: row.pack_code,
        reviewApplicable: 0,
        reviewCompleted: 0,
        evidenceApplicable: 0,
        evidenceCompleted: 0,
      }
      packMap.set(row.pack_id, pack)
    }
    if (row.decision !== 'na') {
      pack.reviewApplicable++
      if (row.decision === 'pass' || row.decision === 'exception_approved') {
        pack.reviewCompleted++
      }
    }
  }

  for (const row of evidenceItems) {
    let pack = packMap.get(row.pack_id)
    if (!pack) {
      pack = {
        packName: '',
        packCode: null,
        reviewApplicable: 0,
        reviewCompleted: 0,
        evidenceApplicable: 0,
        evidenceCompleted: 0,
      }
      packMap.set(row.pack_id, pack)
    }
    if (row.evidence_status !== 'waived') {
      pack.evidenceApplicable++
      if (row.evidence_status === 'approved') {
        pack.evidenceCompleted++
      }
    }
  }

  const results: PackReadinessItem[] = []
  for (const pack of packMap.values()) {
    const totalApplicable = pack.reviewApplicable + pack.evidenceApplicable
    const totalCompleted = pack.reviewCompleted + pack.evidenceCompleted
    const readinessPct = totalApplicable === 0 ? 0 : Math.round((totalCompleted / totalApplicable) * 100)
    results.push({
      packName: pack.packName,
      packCode: pack.packCode,
      readinessPct,
    })
  }

  results.sort((a, b) => b.readinessPct - a.readinessPct)
  return results
}

// ---------------------------------------------------------------------------
// Attention Items
// ---------------------------------------------------------------------------

export interface AttentionItem {
  type: string
  title: string
  subtitle: string
  badgeLabel: string
  badgeStyle: 'red' | 'amber' | 'blue'
  lineColor: string
  href?: string
}

function formatNameList(names: string[], max = 4): string {
  if (names.length <= max) return names.join(', ')
  return names.slice(0, max).join(', ') + ` + ${names.length - max} more`
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export async function getAttentionItems(orgId: string): Promise<AttentionItem[]> {
  const [
    missingDocsRows,
    expiringDocsRows,
    reviewsDueRows,
    overdueRemRows,
    dueSoonRemRows,
    pendingApprovalRows,
  ] = await Promise.all([
    // 1. Vendors awaiting required docs
    sql<{ name: string }[]>`
      SELECT DISTINCT v.name FROM vendors v
      JOIN vendor_documents vd ON vd.vendor_id = v.id AND vd.deleted_at IS NULL
      JOIN evidence_requirements er ON er.id = vd.evidence_requirement_id AND er.required = true
      WHERE v.org_id = ${orgId} AND v.deleted_at IS NULL AND v.archived_at IS NULL
        AND vd.evidence_status = 'missing'
    `,
    // 2. Evidence expiring within 30 days
    sql<{ id: string; evidence_name: string; vendor_name: string; expiry_date: string }[]>`
      SELECT vd.id, er.name as evidence_name, v.name as vendor_name, vd.expiry_date
      FROM vendor_documents vd
      JOIN evidence_requirements er ON er.id = vd.evidence_requirement_id
      JOIN vendors v ON v.id = vd.vendor_id
      WHERE vd.org_id = ${orgId} AND vd.deleted_at IS NULL
        AND vd.evidence_status = 'approved'
        AND vd.expiry_date IS NOT NULL
        AND vd.expiry_date > CURRENT_DATE
        AND vd.expiry_date <= CURRENT_DATE + interval '30 days'
      ORDER BY vd.expiry_date
      LIMIT 3
    `,
    // 3. Reviews due this month
    sql<{ name: string }[]>`
      SELECT v.name FROM vendors v
      WHERE v.org_id = ${orgId} AND v.deleted_at IS NULL AND v.archived_at IS NULL
        AND v.next_review_due_at IS NOT NULL
        AND v.next_review_due_at >= date_trunc('month', CURRENT_DATE)
        AND v.next_review_due_at < date_trunc('month', CURRENT_DATE) + interval '1 month'
    `,
    // 4. Overdue remediations
    sql<{ title: string; vendor_name: string; owner_name: string | null }[]>`
      SELECT i.title, v.name as vendor_name, u.name as owner_name
      FROM issues i
      JOIN vendors v ON v.id = i.vendor_id
      LEFT JOIN users u ON u.id = i.owner_user_id
      WHERE i.org_id = ${orgId} AND i.deleted_at IS NULL
        AND i.due_date < CURRENT_DATE
        AND i.status IN ('open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred')
      ORDER BY i.due_date
      LIMIT 5
    `,
    // 5. Remediations due within 14 days
    sql<{ title: string; due_date: string; vendor_name: string; owner_name: string | null }[]>`
      SELECT i.title, i.due_date, v.name as vendor_name, u.name as owner_name
      FROM issues i
      JOIN vendors v ON v.id = i.vendor_id
      LEFT JOIN users u ON u.id = i.owner_user_id
      WHERE i.org_id = ${orgId} AND i.deleted_at IS NULL
        AND i.due_date >= CURRENT_DATE
        AND i.due_date <= CURRENT_DATE + interval '14 days'
        AND i.status IN ('open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred')
      ORDER BY i.due_date LIMIT 3
    `,
    // 6. Approvals pending
    sql<{ name: string }[]>`
      SELECT name FROM vendors
      WHERE org_id = ${orgId} AND deleted_at IS NULL AND archived_at IS NULL
        AND approval_status = 'in_internal_review'
    `,
  ])

  const items: AttentionItem[] = []

  // 1. Vendors awaiting required docs
  if (missingDocsRows.length > 0) {
    const names = missingDocsRows.map((r) => r.name)
    items.push({
      type: 'missing_docs',
      title: `${missingDocsRows.length} vendor(s) awaiting required documents`,
      subtitle: formatNameList(names),
      badgeLabel: 'Action needed',
      badgeStyle: 'red',
      lineColor: '#E24B4A',
      href: '/vendors',
    })
  }

  // 2. Evidence expiring within 30 days
  for (const doc of expiringDocsRows) {
    const days = daysUntil(doc.expiry_date)
    items.push({
      type: 'expiring_evidence',
      title: `${doc.evidence_name} expiring in ${days} days`,
      subtitle: `${doc.vendor_name} · expires ${formatDate(doc.expiry_date)}`,
      badgeLabel: 'Expiring soon',
      badgeStyle: 'amber',
      lineColor: '#EF9F27',
    })
  }

  // 3. Reviews due this month
  if (reviewsDueRows.length > 0) {
    const names = reviewsDueRows.map((r) => r.name)
    items.push({
      type: 'reviews_due',
      title: `${reviewsDueRows.length} review(s) due this month`,
      subtitle: formatNameList(names),
      badgeLabel: 'Due this month',
      badgeStyle: 'blue',
      lineColor: '#378ADD',
    })
  }

  // 4. Overdue remediations
  if (overdueRemRows.length > 0) {
    const subtitle = overdueRemRows
      .map((r) => `${r.title} · ${r.vendor_name}${r.owner_name ? ` · ${r.owner_name}` : ''}`)
      .join('; ')
    items.push({
      type: 'overdue_remediations',
      title: `${overdueRemRows.length} remediation(s) overdue`,
      subtitle,
      badgeLabel: 'Overdue',
      badgeStyle: 'red',
      lineColor: '#E24B4A',
      href: '/issues',
    })
  }

  // 5. Remediations due within 14 days
  for (const rem of dueSoonRemRows) {
    const days = daysUntil(rem.due_date)
    items.push({
      type: 'due_soon_remediation',
      title: `Open remediation due in ${days} days`,
      subtitle: `${rem.title} · ${rem.vendor_name} · assigned to ${rem.owner_name ?? 'unassigned'}`,
      badgeLabel: 'Due soon',
      badgeStyle: 'amber',
      lineColor: '#EF9F27',
    })
  }

  // 6. Approvals pending
  if (pendingApprovalRows.length > 0) {
    const names = pendingApprovalRows.map((r) => r.name)
    items.push({
      type: 'pending_approvals',
      title: `${pendingApprovalRows.length} vendor(s) awaiting approval decision`,
      subtitle: formatNameList(names),
      badgeLabel: 'Pending approval',
      badgeStyle: 'blue',
      lineColor: '#378ADD',
    })
  }

  // Sort by priority: red first, then amber, then blue
  const priorityOrder: Record<AttentionItem['badgeStyle'], number> = { red: 0, amber: 1, blue: 2 }
  items.sort((a, b) => priorityOrder[a.badgeStyle] - priorityOrder[b.badgeStyle])

  // If no items at all, return a placeholder
  if (items.length === 0) {
    return [{
      type: 'empty',
      title: 'No items need attention right now',
      subtitle: '',
      badgeLabel: '',
      badgeStyle: 'blue',
      lineColor: '#378ADD',
    }]
  }

  return items
}
