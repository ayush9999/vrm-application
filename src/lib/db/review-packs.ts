import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { computeRiskScore, type RiskScoreOutput } from '@/lib/risk-score'
import { generateReviewCode } from '@/lib/db/vendor-reviews'
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
  const rows = await sql<ReviewPack[]>`
    SELECT *
    FROM review_packs
    WHERE (org_id IS NULL OR org_id = ${orgId})
      AND is_active = true
      AND deleted_at IS NULL
    ORDER BY name
  `
  return rows as unknown as ReviewPack[]
}

/** Fetch all review packs visible to the org including archived (custom only — standard packs can't be archived). */
export async function getReviewPacksWithArchived(orgId: string): Promise<ReviewPack[]> {
  const rows = await sql<ReviewPack[]>`
    SELECT *
    FROM review_packs
    WHERE (org_id IS NULL OR org_id = ${orgId})
      AND deleted_at IS NULL
    ORDER BY is_active DESC, name
  `
  return rows as unknown as ReviewPack[]
}

/** Fetch a single review pack with its evidence and review requirements. */
export async function getReviewPackWithRequirements(packId: string) {
  const [packRows, evidenceRows, reviewRows] = await Promise.all([
    sql<ReviewPack[]>`
      SELECT * FROM review_packs WHERE id = ${packId} LIMIT 1
    `,
    sql<EvidenceRequirement[]>`
      SELECT * FROM evidence_requirements
      WHERE review_pack_id = ${packId} AND deleted_at IS NULL
      ORDER BY sort_order
    `,
    sql<ReviewRequirement[]>`
      SELECT * FROM review_requirements
      WHERE review_pack_id = ${packId} AND deleted_at IS NULL
      ORDER BY sort_order
    `,
  ])

  if (packRows.length === 0) throw new Error('Review pack not found')
  return {
    pack: packRows[0] as unknown as ReviewPack,
    evidenceRequirements: evidenceRows as unknown as EvidenceRequirement[],
    reviewRequirements: reviewRows as unknown as ReviewRequirement[],
  }
}

// ─── Auto-apply logic ───────────────────────────────────────────────────────

interface VendorProfile {
  id: string
  org_id: string
  category_ids: string[]
  criticality_tier: number | null
  service_types: VendorServiceType[]
  data_access_levels: VendorDataAccessLevel[]
  processes_personal_data: boolean
}

/** True if the two arrays share at least one common element. */
function hasOverlap<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (!a || !b || a.length === 0 || b.length === 0) return false
  const set = new Set(a)
  for (const x of b) if (set.has(x)) return true
  return false
}

/**
 * Given a vendor profile, determine which review packs should be auto-assigned.
 * Rules:
 *   - always:true → always assigned (e.g. Legal & Contract)
 *   - processes_personal_data:true → packs requiring personal data processing
 *   - data_access_levels → if any of vendor's levels overlap with the rule list
 *   - min_criticality_tier → if vendor's tier ≤ threshold (tier 1 = most critical)
 *   - service_types → if any of vendor's service types overlap with the rule list
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
    if (hasOverlap(rules.data_access_levels, vendor.data_access_levels)) return true
    if (rules.min_criticality_tier && vendor.criticality_tier && vendor.criticality_tier <= rules.min_criticality_tier) return true
    if (hasOverlap(rules.service_types, vendor.service_types)) return true
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

  // 2. Write to vendor_pack_assignments (permanent config)
  const { bulkAssignPacksToVendor } = await import('@/lib/db/vendor-pack-assignments')
  await bulkAssignPacksToVendor(vendor.org_id, vendor.id, matched.map((p) => p.id))

  // 3. Check which packs already have active review instances
  const { data: existing } = await service
    .from('vendor_review_packs')
    .select('review_pack_id')
    .eq('vendor_id', vendor.id)
    .is('deleted_at', null)
  const existingPackIds = new Set((existing ?? []).map((r: { review_pack_id: string }) => r.review_pack_id))
  const newPacks = matched.filter((p) => !existingPackIds.has(p.id))
  if (newPacks.length === 0) return

  // 4. For each new pack, get requirements and create review instances
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

  // 5. Create a vendor_reviews row to group all newly created packs under an onboarding review
  const reviewCode = await generateReviewCode(vendor.org_id)
  const { data: vendorReview, error: vrErr } = await service
    .from('vendor_reviews')
    .insert({
      org_id: vendor.org_id,
      vendor_id: vendor.id,
      review_code: reviewCode,
      review_type: 'onboarding',
      status: 'not_started',
    })
    .select('id')
    .single()
  if (vrErr) throw new Error(vrErr.message)

  // 6. Link all newly created vendor_review_packs to this review
  const newPackIds = newPacks.map((p) => p.id)
  const { data: createdVrps } = await service
    .from('vendor_review_packs')
    .select('id')
    .eq('vendor_id', vendor.id)
    .in('review_pack_id', newPackIds)
    .is('deleted_at', null)

  if (createdVrps && createdVrps.length > 0) {
    const vrpIdsToLink = (createdVrps as { id: string }[]).map((r) => r.id)
    for (const vrpId of vrpIdsToLink) {
      const { error: linkErr } = await service
        .from('vendor_review_packs')
        .update({ vendor_review_id: (vendorReview as { id: string }).id })
        .eq('id', vrpId)
      if (linkErr) throw new Error(linkErr.message)
    }
  }
}

// ─── Vendor Review Pack queries ─────────────────────────────────────────────

/** Get all review packs assigned to a vendor with item counts + matched rule. */
export async function getVendorReviewPacks(vendorId: string): Promise<VendorReviewPack[]> {
  // Fetch vendor review packs with joined pack + vendor info
  type VrpRow = VendorReviewPack & {
    review_pack_name: string
    review_pack_code: string | null
    applicability_rules: ApplicabilityRules
    criticality_tier: number | null
    service_types: VendorServiceType[]
    data_access_levels: VendorDataAccessLevel[]
    processes_personal_data: boolean
  }

  const rows = await sql<VrpRow[]>`
    SELECT vrp.*,
      rp.name AS review_pack_name, rp.code AS review_pack_code,
      rp.applicability_rules,
      v.criticality_tier, v.service_types, v.data_access_levels, v.processes_personal_data
    FROM vendor_review_packs vrp
    INNER JOIN review_packs rp ON rp.id = vrp.review_pack_id
    INNER JOIN vendors v ON v.id = vrp.vendor_id
    WHERE vrp.vendor_id = ${vendorId}
      AND vrp.deleted_at IS NULL
    ORDER BY vrp.assigned_at
  `

  const vrpIds = rows.map((r) => r.id)

  // Batch: fetch ALL item decisions for ALL packs in ONE query
  const countsByPack = new Map<string, { total: number; passed: number; failed: number; not_started: number; na: number }>()
  if (vrpIds.length > 0) {
    const allItems = await sql<{ vendor_review_pack_id: string; decision: ReviewItemDecision }[]>`
      SELECT vendor_review_pack_id, decision
      FROM vendor_review_items
      WHERE vendor_review_pack_id = ANY(${vrpIds})
    `

    for (const item of allItems) {
      const counts = countsByPack.get(item.vendor_review_pack_id) ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 }
      counts.total++
      if (item.decision === 'pass') counts.passed++
      else if (item.decision === 'fail') counts.failed++
      else if (item.decision === 'not_started') counts.not_started++
      else if (item.decision === 'na') counts.na++
      countsByPack.set(item.vendor_review_pack_id, counts)
    }
  }

  return rows.map((row) => {
    const v = {
      criticality_tier: row.criticality_tier,
      service_types: row.service_types,
      data_access_levels: row.data_access_levels,
      processes_personal_data: row.processes_personal_data,
    }

    return {
      ...(row as unknown as VendorReviewPack),
      review_pack_name: row.review_pack_name,
      review_pack_code: row.review_pack_code,
      matched_rule: describeMatchedRule(row.applicability_rules, v),
      item_counts: countsByPack.get(row.id) ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 },
    }
  })
}

/**
 * Clone an existing pack (standard or custom) into a new custom pack for the given org.
 * Copies all evidence_requirements + review_requirements, preserving the
 * linked_evidence_requirement_id mapping by index.
 */
export async function duplicatePackAsCustom(
  sourcePackId: string,
  orgId: string,
  newName: string,
  createdByUserId: string,
): Promise<string> {
  const supabase = await createServerClient()

  // 1. Fetch source pack
  const { data: src, error: srcErr } = await supabase
    .from('review_packs')
    .select('*')
    .eq('id', sourcePackId)
    .maybeSingle()
  if (srcErr) throw new Error(srcErr.message)
  if (!src) throw new Error('Source pack not found')

  // 2. Fetch source evidence + review requirements (in order)
  const [evRes, rrRes] = await Promise.all([
    supabase
      .from('evidence_requirements')
      .select('*')
      .eq('review_pack_id', sourcePackId)
      .is('deleted_at', null)
      .order('sort_order'),
    supabase
      .from('review_requirements')
      .select('*')
      .eq('review_pack_id', sourcePackId)
      .is('deleted_at', null)
      .order('sort_order'),
  ])
  if (evRes.error) throw new Error(evRes.error.message)
  if (rrRes.error) throw new Error(rrRes.error.message)

  type EvSrc = { id: string; name: string; description: string | null; required: boolean; expiry_applies: boolean; sort_order: number }
  type RrSrc = { id: string; name: string; description: string | null; required: boolean; linked_evidence_requirement_id: string | null; compliance_references: { standard: string; reference: string }[] | null; creates_remediation_on_fail: boolean; sort_order: number }
  const srcEvidence = (evRes.data ?? []) as EvSrc[]
  const srcReviews = (rrRes.data ?? []) as RrSrc[]

  // 3. Build evidenceRequirements + reviewRequirements input for createCustomReviewPack
  const oldEvidenceIdToIdx = new Map<string, number>()
  srcEvidence.forEach((e, i) => oldEvidenceIdToIdx.set(e.id, i))

  const srcRow = src as { name: string; description: string | null; applicability_rules: ApplicabilityRules; review_cadence: 'annual' | 'biannual' | 'on_incident' | 'on_renewal' }

  const { packId } = await createCustomReviewPack({
    orgId,
    name: newName,
    description: srcRow.description,
    applicabilityRules: srcRow.applicability_rules ?? {},
    reviewCadence: srcRow.review_cadence ?? 'annual',
    evidenceRequirements: srcEvidence.map((e) => ({
      name: e.name,
      description: e.description,
      required: e.required,
      expiry_applies: e.expiry_applies,
    })),
    reviewRequirements: srcReviews.map((r) => ({
      name: r.name,
      description: r.description,
      required: r.required,
      creates_remediation_on_fail: r.creates_remediation_on_fail,
      linked_evidence_index: r.linked_evidence_requirement_id != null
        ? oldEvidenceIdToIdx.get(r.linked_evidence_requirement_id) ?? null
        : null,
      compliance_references: r.compliance_references ?? [],
    })),
    createdByUserId,
  })

  return packId
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
    service_types: VendorServiceType[]
    data_access_levels: VendorDataAccessLevel[]
    processes_personal_data: boolean
  },
): string {
  if (vendor.criticality_tier === 1) return 'Tier 1 critical vendor — all packs apply'
  if (rules.always) return 'Always assigned'
  if (rules.processes_personal_data && vendor.processes_personal_data) return 'Vendor processes personal data'

  const dalMatch = vendor.data_access_levels.find((l) => rules.data_access_levels?.includes(l))
  if (dalMatch) return `Data access level: ${dalMatch.replace(/_/g, ' ')}`

  if (rules.min_criticality_tier && vendor.criticality_tier && vendor.criticality_tier <= rules.min_criticality_tier) {
    return `Criticality tier ${vendor.criticality_tier} ≤ ${rules.min_criticality_tier}`
  }

  const stMatch = vendor.service_types.find((t) => rules.service_types?.includes(t))
  if (stMatch) return `Service type: ${stMatch.replace(/_/g, ' ')}`

  if (rules.requires_esg_setting) return 'ESG enabled in org settings'
  return 'Manually assigned'
}

/**
 * Pre-fill: load the most recent completed review for the same vendor + pack,
 * return a map of review_requirement_id → { decision, comment, decided_at }.
 */
export async function getPreviousReviewDecisions(
  vendorId: string,
  reviewPackId: string,
  currentVrpId: string,
): Promise<Map<string, { decision: ReviewItemDecision; comment: string | null; decided_at: string | null }>> {
  // Find the most recent completed VRP for this vendor + pack (excluding current)
  const prevVrpRows = await sql<{ id: string }[]>`
    SELECT id
    FROM vendor_review_packs
    WHERE vendor_id = ${vendorId}
      AND review_pack_id = ${reviewPackId}
      AND id != ${currentVrpId}
      AND status IN ('approved', 'approved_with_exception', 'locked')
      AND deleted_at IS NULL
    ORDER BY completed_at DESC
    LIMIT 1
  `

  if (prevVrpRows.length === 0) return new Map()

  const prevVrpId = prevVrpRows[0].id
  const items = await sql<{ review_requirement_id: string; decision: ReviewItemDecision; reviewer_comment: string | null; decided_at: string | null }[]>`
    SELECT review_requirement_id, decision, reviewer_comment, decided_at
    FROM vendor_review_items
    WHERE vendor_review_pack_id = ${prevVrpId}
  `

  const map = new Map<string, { decision: ReviewItemDecision; comment: string | null; decided_at: string | null }>()
  for (const it of items) {
    if (it.decision !== 'not_started') {
      map.set(it.review_requirement_id, { decision: it.decision, comment: it.reviewer_comment, decided_at: it.decided_at })
    }
  }
  return map
}

/** Get review items for a specific vendor review pack — and the linked evidence row id. */
export async function getVendorReviewItems(vendorReviewPackId: string): Promise<VendorReviewItem[]> {
  type ItemRow = VendorReviewItem & {
    requirement_name: string
    requirement_description: string | null
    compliance_references: VendorReviewItem['compliance_references']
    linked_evidence_requirement_id: string | null
    creates_remediation_on_fail: boolean
    pack_name: string
  }

  // Fetch items with joined requirement + pack, and look up vendor_id in parallel
  const [itemRows, vrpRows] = await Promise.all([
    sql<ItemRow[]>`
      SELECT vri.*,
        rr.name AS requirement_name,
        rr.description AS requirement_description,
        rr.compliance_references,
        rr.linked_evidence_requirement_id,
        rr.creates_remediation_on_fail,
        rp.name AS pack_name
      FROM vendor_review_items vri
      INNER JOIN review_requirements rr ON rr.id = vri.review_requirement_id
      INNER JOIN review_packs rp ON rp.id = rr.review_pack_id
      WHERE vri.vendor_review_pack_id = ${vendorReviewPackId}
      ORDER BY vri.created_at
    `,
    sql<{ vendor_id: string }[]>`
      SELECT vendor_id
      FROM vendor_review_packs
      WHERE id = ${vendorReviewPackId}
      LIMIT 1
    `,
  ])

  const vendorId = vrpRows[0]?.vendor_id ?? null

  // Build maps: evidence_requirement_id -> { vendor_doc_id, evidence_status, evidence_name }
  const evidenceByReq = new Map<string, { docId: string; status: string; name: string }>()
  if (vendorId) {
    const docs = await sql<{ id: string; evidence_requirement_id: string; evidence_status: string; er_name: string | null }[]>`
      SELECT vd.id, vd.evidence_requirement_id, vd.evidence_status,
        er.name AS er_name
      FROM vendor_documents vd
      LEFT JOIN evidence_requirements er ON er.id = vd.evidence_requirement_id
      WHERE vd.vendor_id = ${vendorId}
        AND vd.evidence_requirement_id IS NOT NULL
        AND vd.deleted_at IS NULL
    `
    for (const d of docs) {
      evidenceByReq.set(d.evidence_requirement_id, {
        docId: d.id,
        status: d.evidence_status,
        name: d.er_name ?? 'Evidence',
      })
    }
  }

  return itemRows.map((row) => {
    const linkedReqId = row.linked_evidence_requirement_id
    const linkedEvidence = linkedReqId ? evidenceByReq.get(linkedReqId) : undefined
    return {
      ...(row as unknown as VendorReviewItem),
      linked_evidence_id: linkedEvidence?.docId ?? null,
      linked_evidence_name: linkedEvidence?.name ?? null,
      linked_evidence_status: linkedEvidence?.status ?? null,
      requirement_name: row.requirement_name,
      requirement_description: row.requirement_description,
      compliance_references: row.compliance_references,
      linked_evidence_requirement_id: row.linked_evidence_requirement_id,
      creates_remediation_on_fail: row.creates_remediation_on_fail,
      pack_name: row.pack_name,
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
 * Uses direct Postgres — all 3 queries run in parallel on one TCP connection
 * instead of 4 separate HTTP REST calls through PostgREST.
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

  // All 3 queries run in parallel on ONE Postgres connection (~10ms total vs ~400-800ms via REST)
  const [itemRows, evidenceRows, issueRows] = await Promise.all([
    // Review items with vendor_id resolved through the join (no N+1)
    sql<{ vendor_id: string; decision: string; required: boolean }[]>`
      SELECT vrp.vendor_id, vri.decision, rr.required
      FROM vendor_review_items vri
      JOIN vendor_review_packs vrp ON vrp.id = vri.vendor_review_pack_id
      JOIN review_requirements rr ON rr.id = vri.review_requirement_id
      WHERE vrp.vendor_id = ANY(${vendorIds})
        AND vrp.deleted_at IS NULL
    `,
    // Evidence with required flag
    sql<{ vendor_id: string; evidence_status: string; required: boolean }[]>`
      SELECT vd.vendor_id, vd.evidence_status, er.required
      FROM vendor_documents vd
      JOIN evidence_requirements er ON er.id = vd.evidence_requirement_id
      WHERE vd.vendor_id = ANY(${vendorIds})
        AND vd.evidence_requirement_id IS NOT NULL
        AND vd.deleted_at IS NULL
    `,
    // Open issues with severity
    sql<{ vendor_id: string; severity: string }[]>`
      SELECT vendor_id, severity
      FROM issues
      WHERE vendor_id = ANY(${vendorIds})
        AND deleted_at IS NULL
        AND status IN ('open', 'in_progress', 'blocked', 'waiting_on_vendor', 'waiting_internal_review', 'deferred')
    `,
  ])

  // Group review items by vendor
  const itemsByVendor = new Map<string, { decision: ReviewItemDecision; required: boolean }[]>()
  for (const row of itemRows) {
    if (!itemsByVendor.has(row.vendor_id)) itemsByVendor.set(row.vendor_id, [])
    itemsByVendor.get(row.vendor_id)!.push({
      decision: row.decision as ReviewItemDecision,
      required: row.required,
    })
  }

  // Group evidence by vendor
  const evidenceByVendor = new Map<string, { status: string; required: boolean }[]>()
  for (const row of evidenceRows) {
    if (!evidenceByVendor.has(row.vendor_id)) evidenceByVendor.set(row.vendor_id, [])
    evidenceByVendor.get(row.vendor_id)!.push({
      status: row.evidence_status,
      required: row.required,
    })
  }

  // Group remediation counts by vendor
  const remediationByVendor = new Map<string, { total: number; critical: number }>()
  for (const row of issueRows) {
    const cur = remediationByVendor.get(row.vendor_id) ?? { total: 0, critical: 0 }
    cur.total += 1
    if (row.severity === 'critical') cur.critical += 1
    remediationByVendor.set(row.vendor_id, cur)
  }

  // Compute final metrics per vendor (same logic, unchanged)
  for (const vendorId of vendorIds) {
    const decisions = itemsByVendor.get(vendorId) ?? []
    const evidenceItems = evidenceByVendor.get(vendorId) ?? []
    const remStats = remediationByVendor.get(vendorId) ?? { total: 0, critical: 0 }

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
  // Run both queries in parallel
  const [decisions, evidenceItems] = await Promise.all([
    sql<{ decision: ReviewItemDecision }[]>`
      SELECT vri.decision
      FROM vendor_review_items vri
      JOIN vendor_review_packs vrp ON vrp.id = vri.vendor_review_pack_id
      WHERE vrp.vendor_id = ${vendorId}
        AND vrp.deleted_at IS NULL
    `,
    sql<{ evidence_status: string }[]>`
      SELECT evidence_status
      FROM vendor_documents
      WHERE vendor_id = ${vendorId}
        AND evidence_requirement_id IS NOT NULL
    `,
  ])

  if (decisions.length === 0 && evidenceItems.length === 0) {
    return { applicable: 0, completed: 0, percentage: 0 }
  }

  // N/A items excluded from denominator
  const applicable = decisions.filter((d) => d.decision !== 'na').length
  const completed = decisions.filter((d) =>
    d.decision === 'pass' || d.decision === 'exception_approved',
  ).length

  const evidenceApplicable = evidenceItems.length
  const evidenceCompleted = evidenceItems.filter((e) => e.evidence_status === 'approved').length

  const totalApplicable = applicable + evidenceApplicable
  const totalCompleted = completed + evidenceCompleted
  const percentage = totalApplicable > 0 ? Math.round((totalCompleted / totalApplicable) * 100) : 0

  return { applicable: totalApplicable, completed: totalCompleted, percentage }
}
