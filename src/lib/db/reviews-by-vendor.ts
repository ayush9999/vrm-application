import { createServerClient } from '@/lib/supabase/server'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import type { VendorReviewPackStatus, VendorApprovalStatus } from '@/types/review-pack'
import type { RiskBand } from '@/lib/risk-score'

export interface ReviewVendorRow {
  vendor_id: string
  vendor_name: string
  vendor_code: string | null
  vendor_criticality_tier: number | null
  vendor_service_type: string
  vendor_approval_status: VendorApprovalStatus
  // Aggregated across all packs
  total_packs: number
  active_packs: number  // in_progress, awaiting_approval, sent_back
  upcoming_packs: number
  completed_packs: number
  overdue_count: number
  next_due_at: string | null
  // Vendor-level metrics
  readiness_pct: number
  risk_band: RiskBand
  risk_score: number
}

/**
 * Returns one row per vendor that has any review packs assigned.
 * Aggregates pack counts + vendor-level metrics.
 */
export async function getReviewsByVendor(orgId: string): Promise<ReviewVendorRow[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('vendor_review_packs')
    .select(`
      id, vendor_id, status, due_at,
      vendors!inner ( id, name, vendor_code, criticality_tier, service_type, approval_status )
    `)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  type Row = {
    id: string
    vendor_id: string
    status: VendorReviewPackStatus
    due_at: string | null
    vendors: {
      id: string; name: string; vendor_code: string | null
      criticality_tier: number | null; service_type: string
      approval_status: VendorApprovalStatus
    } | {
      id: string; name: string; vendor_code: string | null
      criticality_tier: number | null; service_type: string
      approval_status: VendorApprovalStatus
    }[] | null
  }

  const rows = (data ?? []) as unknown as Row[]
  const todayStr = new Date().toISOString().split('T')[0]
  const activeStatuses = new Set<string>(['in_progress', 'awaiting_approval', 'sent_back', 'not_started'])
  const completedStatuses = new Set<string>(['approved', 'approved_with_exception', 'locked'])

  // Group by vendor
  const byVendor = new Map<string, {
    vendor: { id: string; name: string; vendor_code: string | null; criticality_tier: number | null; service_type: string; approval_status: VendorApprovalStatus }
    packs: { status: VendorReviewPackStatus; due_at: string | null }[]
  }>()

  for (const r of rows) {
    const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors
    if (!v) continue
    const existing = byVendor.get(r.vendor_id) ?? { vendor: v, packs: [] }
    existing.packs.push({ status: r.status, due_at: r.due_at })
    byVendor.set(r.vendor_id, existing)
  }

  // Get metrics for all vendors
  const vendorEntries = Array.from(byVendor.entries())
  const metrics = await getVendorListMetrics(
    vendorEntries.map(([, v]) => ({ id: v.vendor.id, approval_status: v.vendor.approval_status })),
  )

  return vendorEntries.map(([vendorId, { vendor, packs }]) => {
    const m = metrics.get(vendorId)
    const activePacks = packs.filter((p) => activeStatuses.has(p.status))
    const upcomingPacks = packs.filter((p) => p.status === 'upcoming')
    const completedPacks = packs.filter((p) => completedStatuses.has(p.status))
    const overdue = packs.filter((p) => activeStatuses.has(p.status) && p.due_at && p.due_at.split('T')[0] < todayStr)

    // Next due date across all active/upcoming packs
    const dueDates = packs
      .filter((p) => (activeStatuses.has(p.status) || p.status === 'upcoming') && p.due_at)
      .map((p) => p.due_at!)
      .sort()
    const nextDue = dueDates[0] ?? null

    return {
      vendor_id: vendorId,
      vendor_name: vendor.name,
      vendor_code: vendor.vendor_code,
      vendor_criticality_tier: vendor.criticality_tier,
      vendor_service_type: vendor.service_type,
      vendor_approval_status: vendor.approval_status,
      total_packs: packs.length,
      active_packs: activePacks.length,
      upcoming_packs: upcomingPacks.length,
      completed_packs: completedPacks.length,
      overdue_count: overdue.length,
      next_due_at: nextDue,
      readiness_pct: m?.readinessPct ?? 0,
      risk_band: m?.risk.band ?? 'critical',
      risk_score: m?.risk.score ?? 0,
    }
  }).sort((a, b) => {
    // Overdue first, then by next due date
    if (a.overdue_count > 0 && b.overdue_count === 0) return -1
    if (a.overdue_count === 0 && b.overdue_count > 0) return 1
    const ad = a.next_due_at ?? '9999'
    const bd = b.next_due_at ?? '9999'
    return ad < bd ? -1 : ad > bd ? 1 : a.vendor_name.localeCompare(b.vendor_name)
  })
}
