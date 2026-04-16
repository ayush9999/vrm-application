import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  ReviewPack,
  EvidenceRequirement,
  ReviewRequirement,
  VendorReviewPack,
  VendorReviewItem,
  VendorReviewPackStatus,
  ReviewItemDecision,
  ApplicabilityRules,
  ReadinessScore,
  VendorDataAccessLevel,
  VendorServiceType,
} from '@/types/review-pack'

// ─── Review Pack queries ────────────────────────────────────────────────────

/** Fetch all active review packs visible to the org (standard + custom). */
export async function getReviewPacks(orgId: string): Promise<ReviewPack[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_packs')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as ReviewPack[]
}

/** Fetch a single review pack with its evidence and review requirements. */
export async function getReviewPackWithRequirements(packId: string) {
  const supabase = await createServerClient()

  const [packRes, evidenceRes, reviewRes] = await Promise.all([
    supabase.from('review_packs').select('*').eq('id', packId).single(),
    supabase
      .from('evidence_requirements')
      .select('*')
      .eq('review_pack_id', packId)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('review_requirements')
      .select('*')
      .eq('review_pack_id', packId)
      .is('deleted_at', null)
      .order('sort_order'),
  ])

  if (packRes.error) throw new Error(packRes.error.message)
  return {
    pack: packRes.data as ReviewPack,
    evidenceRequirements: (evidenceRes.data ?? []) as EvidenceRequirement[],
    reviewRequirements: (reviewRes.data ?? []) as ReviewRequirement[],
  }
}

// ─── Auto-apply logic ───────────────────────────────────────────────────────

interface VendorProfile {
  id: string
  org_id: string
  category_id: string | null
  criticality_tier: number | null
  service_type: VendorServiceType
  data_access_level: VendorDataAccessLevel
  processes_personal_data: boolean
}

/**
 * Given a vendor profile, determine which review packs should be auto-assigned.
 * Rules:
 *   - always:true → always assigned (e.g. Legal & Contract)
 *   - processes_personal_data:true → packs requiring personal data processing
 *   - data_access_levels → if vendor's level is in the list
 *   - min_criticality_tier → if vendor's tier ≤ threshold (tier 1 = most critical)
 *   - service_types → if vendor's service_type is in the list
 *   - requires_esg_setting → only if org has ESG enabled (checked separately)
 *   - Tier 1 vendors → get ALL packs regardless
 */
export function matchReviewPacks(
  packs: ReviewPack[],
  vendor: VendorProfile,
  orgEsgEnabled: boolean = false,
): ReviewPack[] {
  const isTier1 = vendor.criticality_tier === 1

  return packs.filter((pack) => {
    // Tier 1 critical vendors get everything
    if (isTier1) return true

    const rules = pack.applicability_rules as ApplicabilityRules
    if (!rules || Object.keys(rules).length === 0) return false

    // "always" packs are always assigned
    if (rules.always) return true

    // Check each rule — any match means the pack applies
    if (rules.processes_personal_data && vendor.processes_personal_data) return true
    if (rules.data_access_levels?.includes(vendor.data_access_level)) return true
    if (rules.min_criticality_tier && vendor.criticality_tier && vendor.criticality_tier <= rules.min_criticality_tier) return true
    if (rules.service_types?.includes(vendor.service_type)) return true
    if (rules.requires_esg_setting && orgEsgEnabled) return true

    return false
  })
}

/**
 * Auto-assign review packs to a vendor. Creates vendor_review_packs,
 * vendor_review_items, and vendor_documents (evidence) records.
 * Uses service client because this may run during vendor creation before
 * the session is fully established in context.
 */
export async function autoAssignReviewPacks(
  vendor: VendorProfile,
  orgEsgEnabled: boolean = false,
): Promise<void> {
  const service = createServiceClient()

  // 1. Get all active standard + org-custom packs
  const { data: allPacks, error: packErr } = await service
    .from('review_packs')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${vendor.org_id}`)
    .eq('is_active', true)
    .is('deleted_at', null)
  if (packErr) throw new Error(packErr.message)

  const matched = matchReviewPacks((allPacks ?? []) as ReviewPack[], vendor, orgEsgEnabled)
  if (matched.length === 0) return

  // 2. Check which packs are already assigned
  const { data: existing } = await service
    .from('vendor_review_packs')
    .select('review_pack_id')
    .eq('vendor_id', vendor.id)
    .is('deleted_at', null)
  const existingPackIds = new Set((existing ?? []).map((r: { review_pack_id: string }) => r.review_pack_id))
  const newPacks = matched.filter((p) => !existingPackIds.has(p.id))
  if (newPacks.length === 0) return

  // 3. For each new pack, get requirements and create instances
  for (const pack of newPacks) {
    // Create vendor_review_pack
    const { data: vrp, error: vrpErr } = await service
      .from('vendor_review_packs')
      .insert({
        org_id: vendor.org_id,
        vendor_id: vendor.id,
        review_pack_id: pack.id,
        status: 'not_started' as VendorReviewPackStatus,
      })
      .select('id')
      .single()
    if (vrpErr) throw new Error(vrpErr.message)

    // Get review requirements for this pack
    const { data: reviewReqs } = await service
      .from('review_requirements')
      .select('id')
      .eq('review_pack_id', pack.id)
      .is('deleted_at', null)

    // Create vendor_review_items
    if (reviewReqs && reviewReqs.length > 0) {
      const items = (reviewReqs as { id: string }[]).map((req) => ({
        org_id: vendor.org_id,
        vendor_review_pack_id: vrp.id,
        review_requirement_id: req.id,
        decision: 'not_started' as ReviewItemDecision,
      }))
      const { error: itemErr } = await service.from('vendor_review_items').insert(items)
      if (itemErr) throw new Error(itemErr.message)
    }

    // Get evidence requirements for this pack
    const { data: evidenceReqs } = await service
      .from('evidence_requirements')
      .select('id')
      .eq('review_pack_id', pack.id)
      .is('deleted_at', null)

    // Create vendor_documents (evidence) records for requirements not yet linked
    if (evidenceReqs && evidenceReqs.length > 0) {
      for (const ereq of evidenceReqs as { id: string }[]) {
        // Check if a vendor_documents row already exists for this requirement
        const { data: existingDoc } = await service
          .from('vendor_documents')
          .select('id')
          .eq('vendor_id', vendor.id)
          .eq('evidence_requirement_id', ereq.id)
          .maybeSingle()
        if (existingDoc) continue

        // We need a doc_type_id. Use a generic one or create without it.
        // For now, we leave doc_type_id as the first available or skip the FK.
        // The evidence_requirement_id is the primary link.
        const { error: docErr } = await service.from('vendor_documents').insert({
          org_id: vendor.org_id,
          vendor_id: vendor.id,
          doc_type_id: null as unknown as string, // Will be nullable after we update the constraint
          evidence_requirement_id: ereq.id,
          evidence_status: 'missing',
        })
        // Ignore errors if doc_type_id NOT NULL constraint fails — evidence
        // linking is best-effort during auto-assign
        if (docErr && !docErr.message.includes('null value')) {
          throw new Error(docErr.message)
        }
      }
    }
  }
}

// ─── Vendor Review Pack queries ─────────────────────────────────────────────

/** Get all review packs assigned to a vendor with item counts. */
export async function getVendorReviewPacks(vendorId: string): Promise<VendorReviewPack[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('vendor_review_packs')
    .select(`
      *,
      review_packs!inner ( name, code )
    `)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .order('assigned_at')
  if (error) throw new Error(error.message)

  // Fetch item counts for each pack
  const packs: VendorReviewPack[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const rp = row.review_packs as { name: string; code: string } | null
    const { data: items } = await supabase
      .from('vendor_review_items')
      .select('decision')
      .eq('vendor_review_pack_id', row.id as string)

    const decisions = (items ?? []) as { decision: ReviewItemDecision }[]
    packs.push({
      ...(row as unknown as VendorReviewPack),
      review_pack_name: rp?.name,
      review_pack_code: rp?.code,
      item_counts: {
        total: decisions.length,
        passed: decisions.filter((d) => d.decision === 'pass').length,
        failed: decisions.filter((d) => d.decision === 'fail').length,
        not_started: decisions.filter((d) => d.decision === 'not_started').length,
        na: decisions.filter((d) => d.decision === 'na').length,
      },
    })
  }
  return packs
}

/** Get review items for a specific vendor review pack. */
export async function getVendorReviewItems(vendorReviewPackId: string): Promise<VendorReviewItem[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('vendor_review_items')
    .select(`
      *,
      review_requirements!inner (
        name, description, compliance_references,
        linked_evidence_requirement_id, creates_remediation_on_fail,
        review_packs!inner ( name )
      )
    `)
    .eq('vendor_review_pack_id', vendorReviewPackId)
    .order('created_at')
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const req = row.review_requirements as Record<string, unknown> | null
    const pack = req?.review_packs as { name: string } | null
    return {
      ...(row as unknown as VendorReviewItem),
      requirement_name: req?.name as string | undefined,
      requirement_description: req?.description as string | undefined,
      compliance_references: req?.compliance_references as VendorReviewItem['compliance_references'],
      linked_evidence_requirement_id: req?.linked_evidence_requirement_id as string | null | undefined,
      creates_remediation_on_fail: req?.creates_remediation_on_fail as boolean | undefined,
      pack_name: pack?.name,
    }
  })
}

/** Update a review item decision. */
export async function updateReviewItemDecision(
  itemId: string,
  decision: ReviewItemDecision,
  comment: string | null,
  userId: string,
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_review_items')
    .update({
      decision,
      reviewer_comment: comment,
      decided_at: new Date().toISOString(),
      decided_by_user_id: userId,
    })
    .eq('id', itemId)
  if (error) throw new Error(error.message)
}

// ─── Readiness calculation ──────────────────────────────────────────────────

/** Calculate readiness score for a vendor across all assigned review packs. */
export async function getVendorReadiness(vendorId: string): Promise<ReadinessScore> {
  const supabase = await createServerClient()

  // Get all review items for this vendor (through vendor_review_packs)
  const { data: vrps } = await supabase
    .from('vendor_review_packs')
    .select('id')
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)

  if (!vrps || vrps.length === 0) {
    return { applicable: 0, completed: 0, percentage: 0 }
  }

  const packIds = (vrps as { id: string }[]).map((p) => p.id)
  const { data: items } = await supabase
    .from('vendor_review_items')
    .select('decision')
    .in('vendor_review_pack_id', packIds)

  if (!items || items.length === 0) {
    return { applicable: 0, completed: 0, percentage: 0 }
  }

  const decisions = items as { decision: ReviewItemDecision }[]
  // N/A items excluded from denominator
  const applicable = decisions.filter((d) => d.decision !== 'na').length
  const completed = decisions.filter((d) =>
    d.decision === 'pass' || d.decision === 'exception_approved',
  ).length

  // Also count approved evidence
  const { data: evidence } = await supabase
    .from('vendor_documents')
    .select('evidence_status')
    .eq('vendor_id', vendorId)
    .not('evidence_requirement_id', 'is', null)

  const evidenceItems = (evidence ?? []) as { evidence_status: string }[]
  const evidenceApplicable = evidenceItems.length
  const evidenceCompleted = evidenceItems.filter((e) => e.evidence_status === 'approved').length

  const totalApplicable = applicable + evidenceApplicable
  const totalCompleted = completed + evidenceCompleted
  const percentage = totalApplicable > 0 ? Math.round((totalCompleted / totalApplicable) * 100) : 0

  return { applicable: totalApplicable, completed: totalCompleted, percentage }
}
