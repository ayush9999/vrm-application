import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { computeRiskScore, type RiskScoreOutput } from '@/lib/risk-score'
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
  VendorApprovalStatus,
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

/** Fetch all review packs visible to the org including archived (custom only — standard packs can't be archived). */
export async function getReviewPacksWithArchived(orgId: string): Promise<ReviewPack[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('review_packs')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
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
          evidence_requirement_id: ereq.id,
          evidence_status: 'missing',
        })
        if (docErr) throw new Error(docErr.message)
      }
    }
  }
}

// ─── Vendor Review Pack queries ─────────────────────────────────────────────

/** Get all review packs assigned to a vendor with item counts + matched rule. */
export async function getVendorReviewPacks(vendorId: string): Promise<VendorReviewPack[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('vendor_review_packs')
    .select(`
      *,
      review_packs!inner ( name, code, applicability_rules ),
      vendors!inner ( criticality_tier, service_type, data_access_level, processes_personal_data )
    `)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .order('assigned_at')
  if (error) throw new Error(error.message)

  // Fetch item counts for each pack
  const packs: VendorReviewPack[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const rp = row.review_packs as {
      name: string
      code: string
      applicability_rules: ApplicabilityRules
    } | null
    const v = row.vendors as {
      criticality_tier: number | null
      service_type: VendorServiceType
      data_access_level: VendorDataAccessLevel
      processes_personal_data: boolean
    } | null

    const { data: items } = await supabase
      .from('vendor_review_items')
      .select('decision')
      .eq('vendor_review_pack_id', row.id as string)

    const decisions = (items ?? []) as { decision: ReviewItemDecision }[]
    packs.push({
      ...(row as unknown as VendorReviewPack),
      review_pack_name: rp?.name,
      review_pack_code: rp?.code,
      matched_rule: rp && v ? describeMatchedRule(rp.applicability_rules, v) : undefined,
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

// ─── Custom Pack creation ───────────────────────────────────────────────────

export interface CustomEvidenceReqInput {
  name: string
  description?: string | null
  required: boolean
  expiry_applies: boolean
}

export interface CustomReviewReqInput {
  name: string
  description?: string | null
  required: boolean
  creates_remediation_on_fail: boolean
  linked_evidence_index?: number | null  // index into evidence requirements array
  compliance_references?: { standard: string; reference: string }[]
}

export async function createCustomReviewPack(input: {
  orgId: string
  name: string
  description?: string | null
  applicabilityRules: ApplicabilityRules
  reviewCadence: 'annual' | 'biannual' | 'on_incident' | 'on_renewal'
  evidenceRequirements: CustomEvidenceReqInput[]
  reviewRequirements: CustomReviewReqInput[]
  createdByUserId: string
}): Promise<{ packId: string }> {
  const supabase = await createServerClient()

  // 1. Create the pack
  const { data: pack, error: packErr } = await supabase
    .from('review_packs')
    .insert({
      org_id: input.orgId,
      name: input.name,
      description: input.description ?? null,
      applicability_rules: input.applicabilityRules,
      review_cadence: input.reviewCadence,
      source_type: 'custom',
      is_active: true,
      created_by_user_id: input.createdByUserId,
    })
    .select('id')
    .single()
  if (packErr) throw new Error(packErr.message)
  const packId = (pack as { id: string }).id

  // 2. Insert evidence requirements (collect ids by index for linking)
  const evidenceIdByIdx = new Map<number, string>()
  if (input.evidenceRequirements.length > 0) {
    const rows = input.evidenceRequirements.map((er, idx) => ({
      org_id: input.orgId,
      review_pack_id: packId,
      name: er.name,
      description: er.description ?? null,
      required: er.required,
      expiry_applies: er.expiry_applies,
      sort_order: idx,
    }))
    const { data: evRows, error: evErr } = await supabase
      .from('evidence_requirements')
      .insert(rows)
      .select('id')
    if (evErr) throw new Error(evErr.message)
    ;(evRows ?? []).forEach((r, i) => evidenceIdByIdx.set(i, (r as { id: string }).id))
  }

  // 3. Insert review requirements
  if (input.reviewRequirements.length > 0) {
    const rows = input.reviewRequirements.map((rr, idx) => ({
      org_id: input.orgId,
      review_pack_id: packId,
      name: rr.name,
      description: rr.description ?? null,
      required: rr.required,
      creates_remediation_on_fail: rr.creates_remediation_on_fail,
      linked_evidence_requirement_id: rr.linked_evidence_index != null ? evidenceIdByIdx.get(rr.linked_evidence_index) ?? null : null,
      compliance_references: rr.compliance_references ?? [],
      sort_order: idx,
    }))
    const { error: rrErr } = await supabase
      .from('review_requirements')
      .insert(rows)
    if (rrErr) throw new Error(rrErr.message)
  }

  return { packId }
}

/** Returns a human-readable explanation of why this pack was assigned to this vendor. */
function describeMatchedRule(
  rules: ApplicabilityRules,
  vendor: {
    criticality_tier: number | null
    service_type: VendorServiceType
    data_access_level: VendorDataAccessLevel
    processes_personal_data: boolean
  },
): string {
  if (vendor.criticality_tier === 1) return 'Tier 1 critical vendor — all packs apply'
  if (rules.always) return 'Always assigned'
  if (rules.processes_personal_data && vendor.processes_personal_data) return 'Vendor processes personal data'
  if (rules.data_access_levels?.includes(vendor.data_access_level)) return `Data access level: ${vendor.data_access_level.replace(/_/g, ' ')}`
  if (rules.min_criticality_tier && vendor.criticality_tier && vendor.criticality_tier <= rules.min_criticality_tier) {
    return `Criticality tier ${vendor.criticality_tier} ≤ ${rules.min_criticality_tier}`
  }
  if (rules.service_types?.includes(vendor.service_type)) return `Service type: ${vendor.service_type.replace(/_/g, ' ')}`
  if (rules.requires_esg_setting) return 'ESG enabled in org settings'
  return 'Manually assigned'
}

/** Get review items for a specific vendor review pack — and the linked evidence row id. */
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

  // Look up vendor_id for this pack so we can find the corresponding vendor_documents rows
  const { data: vrpRow } = await supabase
    .from('vendor_review_packs')
    .select('vendor_id')
    .eq('id', vendorReviewPackId)
    .maybeSingle()
  const vendorId = (vrpRow as { vendor_id: string } | null)?.vendor_id

  // Build a map: evidence_requirement_id → vendor_documents.id (one per requirement, per vendor)
  const evidenceIdByReq = new Map<string, string>()
  if (vendorId) {
    const { data: docs } = await supabase
      .from('vendor_documents')
      .select('id, evidence_requirement_id')
      .eq('vendor_id', vendorId)
      .not('evidence_requirement_id', 'is', null)
      .is('deleted_at', null)
    for (const d of (docs ?? []) as { id: string; evidence_requirement_id: string }[]) {
      evidenceIdByReq.set(d.evidence_requirement_id, d.id)
    }
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const req = row.review_requirements as Record<string, unknown> | null
    const pack = req?.review_packs as { name: string } | null
    const linkedReqId = req?.linked_evidence_requirement_id as string | null | undefined
    const linkedVendorDocId = linkedReqId ? evidenceIdByReq.get(linkedReqId) : undefined
    return {
      ...(row as unknown as VendorReviewItem),
      linked_evidence_id: linkedVendorDocId ?? null,
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

/**
 * Get readiness + risk + counts for a batch of vendors (for the vendor list and profile header).
 * Returns a Map keyed by vendor_id.
 *
 * Requires the vendor's approval_status to compute the risk score override.
 * Pass an array of `{ vendor_id, approval_status }` objects.
 */
export async function getVendorListMetrics(
  vendors: { id: string; approval_status: VendorApprovalStatus }[],
): Promise<Map<string, {
  readinessPct: number
  applicable: number
  completed: number
  missingEvidenceCount: number
  openRemediationCount: number
  risk: RiskScoreOutput
}>> {
  const result = new Map<string, {
    readinessPct: number
    applicable: number
    completed: number
    missingEvidenceCount: number
    openRemediationCount: number
    risk: RiskScoreOutput
  }>()
  if (vendors.length === 0) return result

  const vendorIds = vendors.map((v) => v.id)
  const approvalByVendor = new Map(vendors.map((v) => [v.id, v.approval_status]))
  const supabase = await createServerClient()

  // Get all vendor_review_packs for these vendors
  const { data: vrps } = await supabase
    .from('vendor_review_packs')
    .select('id, vendor_id')
    .in('vendor_id', vendorIds)
    .is('deleted_at', null)

  const vrpByVendor = new Map<string, string[]>()
  for (const v of (vrps ?? []) as { id: string; vendor_id: string }[]) {
    if (!vrpByVendor.has(v.vendor_id)) vrpByVendor.set(v.vendor_id, [])
    vrpByVendor.get(v.vendor_id)!.push(v.id)
  }

  // Get all review items + their requirement.required for those packs
  const allVrpIds = (vrps ?? []).map((v: { id: string }) => v.id)
  const itemsByVendor = new Map<string, { decision: ReviewItemDecision; required: boolean }[]>()
  if (allVrpIds.length > 0) {
    const { data: items } = await supabase
      .from('vendor_review_items')
      .select(`
        vendor_review_pack_id, decision,
        review_requirements!inner ( required )
      `)
      .in('vendor_review_pack_id', allVrpIds)

    type ItemRow = {
      vendor_review_pack_id: string
      decision: ReviewItemDecision
      review_requirements: { required: boolean } | null
    }

    const itemsByVrp = new Map<string, { decision: ReviewItemDecision; required: boolean }[]>()
    for (const it of (items ?? []) as unknown as ItemRow[]) {
      if (!itemsByVrp.has(it.vendor_review_pack_id)) itemsByVrp.set(it.vendor_review_pack_id, [])
      itemsByVrp.get(it.vendor_review_pack_id)!.push({
        decision: it.decision,
        required: it.review_requirements?.required ?? false,
      })
    }

    for (const [vendorId, vrpIds] of vrpByVendor) {
      const all: { decision: ReviewItemDecision; required: boolean }[] = []
      for (const vrpId of vrpIds) {
        for (const d of (itemsByVrp.get(vrpId) ?? [])) all.push(d)
      }
      itemsByVendor.set(vendorId, all)
    }
  }

  // Get evidence rows + their requirement.required + status
  const { data: evidence } = await supabase
    .from('vendor_documents')
    .select(`
      vendor_id, evidence_status,
      evidence_requirements ( required )
    `)
    .in('vendor_id', vendorIds)
    .not('evidence_requirement_id', 'is', null)
    .is('deleted_at', null)

  type EvidenceRow = {
    vendor_id: string
    evidence_status: string
    evidence_requirements: { required: boolean } | null
  }

  const evidenceByVendor = new Map<string, { status: string; required: boolean }[]>()
  for (const e of (evidence ?? []) as unknown as EvidenceRow[]) {
    if (!evidenceByVendor.has(e.vendor_id)) evidenceByVendor.set(e.vendor_id, [])
    evidenceByVendor.get(e.vendor_id)!.push({
      status: e.evidence_status,
      required: e.evidence_requirements?.required ?? false,
    })
  }

  // Open remediation counts (any open status) + critical-severity counts (for risk score)
  const { data: openIssues } = await supabase
    .from('issues')
    .select('vendor_id, status, severity')
    .in('vendor_id', vendorIds)
    .is('deleted_at', null)
    .in('status', ['open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred'])

  const remediationByVendor = new Map<string, { total: number; critical: number }>()
  for (const i of (openIssues ?? []) as { vendor_id: string; severity: string }[]) {
    const cur = remediationByVendor.get(i.vendor_id) ?? { total: 0, critical: 0 }
    cur.total += 1
    if (i.severity === 'critical') cur.critical += 1
    remediationByVendor.set(i.vendor_id, cur)
  }

  // Compute final metrics per vendor
  for (const vendorId of vendorIds) {
    const decisions = itemsByVendor.get(vendorId) ?? []
    const evidenceItems = evidenceByVendor.get(vendorId) ?? []
    const remStats = remediationByVendor.get(vendorId) ?? { total: 0, critical: 0 }

    // Readiness: applicable = total - na
    const reviewApplicable = decisions.filter((d) => d.decision !== 'na').length
    const reviewCompleted = decisions.filter(
      (d) => d.decision === 'pass' || d.decision === 'exception_approved',
    ).length
    const evidenceApplicable = evidenceItems.filter((e) => e.status !== 'waived').length
    const evidenceCompleted = evidenceItems.filter((e) => e.status === 'approved').length
    const missingEvidenceCount = evidenceItems.filter(
      (e) => e.status === 'missing' || e.status === 'rejected' || e.status === 'expired',
    ).length

    const totalApplicable = reviewApplicable + evidenceApplicable
    const totalCompleted = reviewCompleted + evidenceCompleted
    const pct = totalApplicable > 0 ? Math.round((totalCompleted / totalApplicable) * 100) : 0

    // Risk score
    const requiredReviewTotal = decisions.filter((d) => d.required && d.decision !== 'na').length
    const requiredReviewCompleted = decisions.filter(
      (d) => d.required && (d.decision === 'pass' || d.decision === 'exception_approved'),
    ).length
    const optionalReviewTotal = decisions.filter((d) => !d.required && d.decision !== 'na').length
    const optionalReviewCompleted = decisions.filter(
      (d) => !d.required && (d.decision === 'pass' || d.decision === 'exception_approved'),
    ).length

    const requiredEvidenceTotal = evidenceItems.filter((e) => e.required && e.status !== 'waived').length
    const requiredEvidenceApproved = evidenceItems.filter((e) => e.required && e.status === 'approved').length
    const optionalEvidenceTotal = evidenceItems.filter((e) => !e.required && e.status !== 'waived').length
    const optionalEvidenceApproved = evidenceItems.filter((e) => !e.required && e.status === 'approved').length

    const risk = computeRiskScore({
      requiredReviewTotal,
      requiredReviewCompleted,
      optionalReviewTotal,
      optionalReviewCompleted,
      requiredEvidenceTotal,
      requiredEvidenceApproved,
      optionalEvidenceTotal,
      optionalEvidenceApproved,
      openCriticalRemediations: remStats.critical,
      approvalStatus: approvalByVendor.get(vendorId)!,
    })

    result.set(vendorId, {
      readinessPct: pct,
      applicable: totalApplicable,
      completed: totalCompleted,
      missingEvidenceCount,
      openRemediationCount: remStats.total,
      risk,
    })
  }

  return result
}

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
