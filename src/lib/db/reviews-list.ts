import { createServerClient } from '@/lib/supabase/server'
import type { VendorReviewPackStatus, ReviewItemDecision } from '@/types/review-pack'

export interface ReviewListRow {
  vendor_review_pack_id: string
  vendor_id: string
  vendor_name: string
  vendor_code: string | null
  vendor_criticality_tier: number | null
  vendor_service_type: string
  pack_id: string
  pack_name: string
  pack_code: string | null
  status: VendorReviewPackStatus
  due_at: string | null
  reviewer_user_id: string | null
  reviewer_name: string | null
  approver_user_id: string | null
  approver_name: string | null
  // Computed metrics
  applicable: number
  completed: number
  readiness_pct: number
  missing_evidence: number
  open_remediations: number
}

/**
 * Fetch all vendor review packs across the org with computed metrics
 * (readiness %, missing evidence, open remediations) for the Reviews page.
 */
export async function getOrgReviewsList(orgId: string): Promise<ReviewListRow[]> {
  const supabase = await createServerClient()

  // 1. Pull all vendor_review_packs joined with vendor + pack + reviewer + approver
  const { data, error } = await supabase
    .from('vendor_review_packs')
    .select(`
      id, vendor_id, review_pack_id, status, due_at,
      reviewer_user_id, approver_user_id,
      vendors!inner ( id, name, vendor_code, criticality_tier, service_type ),
      review_packs!inner ( id, name, code ),
      reviewer:users!vendor_review_packs_reviewer_user_id_fkey ( id, name, email ),
      approver:users!vendor_review_packs_approver_user_id_fkey ( id, name, email )
    `)
    .eq('org_id', orgId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  type RawRow = {
    id: string
    vendor_id: string
    review_pack_id: string
    status: VendorReviewPackStatus
    due_at: string | null
    reviewer_user_id: string | null
    approver_user_id: string | null
    vendors: { id: string; name: string; vendor_code: string | null; criticality_tier: number | null; service_type: string } | { id: string; name: string; vendor_code: string | null; criticality_tier: number | null; service_type: string }[] | null
    review_packs: { id: string; name: string; code: string | null } | { id: string; name: string; code: string | null }[] | null
    reviewer: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null
    approver: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null
  }
  const raws = (data ?? []) as unknown as RawRow[]
  if (raws.length === 0) return []

  // 2. Pull all review item decisions for these packs in one query
  const vrpIds = raws.map((r) => r.id)
  const { data: itemsData } = await supabase
    .from('vendor_review_items')
    .select(`
      vendor_review_pack_id, decision,
      review_requirements!inner ( required )
    `)
    .in('vendor_review_pack_id', vrpIds)

  type ItemRow = {
    vendor_review_pack_id: string
    decision: ReviewItemDecision
    review_requirements: { required: boolean } | { required: boolean }[] | null
  }
  const itemsByVrp = new Map<string, { decision: ReviewItemDecision; required: boolean }[]>()
  for (const it of (itemsData ?? []) as unknown as ItemRow[]) {
    const reqRaw = it.review_requirements
    const req = Array.isArray(reqRaw) ? reqRaw[0] : reqRaw
    const arr = itemsByVrp.get(it.vendor_review_pack_id) ?? []
    arr.push({ decision: it.decision, required: req?.required ?? false })
    itemsByVrp.set(it.vendor_review_pack_id, arr)
  }

  // 3. Pull missing evidence + open remediation counts per vendor
  const vendorIds = Array.from(new Set(raws.map((r) => r.vendor_id)))

  const [evidenceRes, remediationRes] = await Promise.all([
    supabase
      .from('vendor_documents')
      .select(`
        vendor_id, evidence_status,
        evidence_requirements ( review_pack_id )
      `)
      .in('vendor_id', vendorIds)
      .not('evidence_requirement_id', 'is', null)
      .is('deleted_at', null),
    supabase
      .from('issues')
      .select('vendor_id, status')
      .in('vendor_id', vendorIds)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred']),
  ])

  // Missing evidence per (vendor, pack)
  type EvRow = { vendor_id: string; evidence_status: string; evidence_requirements: { review_pack_id: string } | { review_pack_id: string }[] | null }
  const missingByVendorPack = new Map<string, number>()
  for (const e of (evidenceRes.data ?? []) as unknown as EvRow[]) {
    const reqRaw = e.evidence_requirements
    const req = Array.isArray(reqRaw) ? reqRaw[0] : reqRaw
    if (!req) continue
    const isMissing = e.evidence_status === 'missing' || e.evidence_status === 'rejected' || e.evidence_status === 'expired'
    if (!isMissing) continue
    const key = `${e.vendor_id}::${req.review_pack_id}`
    missingByVendorPack.set(key, (missingByVendorPack.get(key) ?? 0) + 1)
  }

  // Open remediations per vendor (any pack)
  const remByVendor = new Map<string, number>()
  for (const i of (remediationRes.data ?? []) as { vendor_id: string }[]) {
    remByVendor.set(i.vendor_id, (remByVendor.get(i.vendor_id) ?? 0) + 1)
  }

  // 4. Compose
  return raws.map((r) => {
    const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors
    const p = Array.isArray(r.review_packs) ? r.review_packs[0] : r.review_packs
    const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer
    const approver = Array.isArray(r.approver) ? r.approver[0] : r.approver

    const items = itemsByVrp.get(r.id) ?? []
    const applicable = items.filter((i) => i.decision !== 'na').length
    const completed = items.filter((i) => i.decision === 'pass' || i.decision === 'exception_approved').length
    const readiness_pct = applicable > 0 ? Math.round((completed / applicable) * 100) : 0

    const missing = missingByVendorPack.get(`${r.vendor_id}::${p?.id ?? ''}`) ?? 0

    return {
      vendor_review_pack_id: r.id,
      vendor_id: r.vendor_id,
      vendor_name: v?.name ?? 'Unknown',
      vendor_code: v?.vendor_code ?? null,
      vendor_criticality_tier: v?.criticality_tier ?? null,
      vendor_service_type: v?.service_type ?? 'other',
      pack_id: p?.id ?? '',
      pack_name: p?.name ?? 'Unknown Pack',
      pack_code: p?.code ?? null,
      status: r.status,
      due_at: r.due_at,
      reviewer_user_id: r.reviewer_user_id,
      reviewer_name: reviewer?.name ?? reviewer?.email ?? null,
      approver_user_id: r.approver_user_id,
      approver_name: approver?.name ?? approver?.email ?? null,
      applicable,
      completed,
      readiness_pct,
      missing_evidence: missing,
      open_remediations: remByVendor.get(r.vendor_id) ?? 0,
    }
  })
}
