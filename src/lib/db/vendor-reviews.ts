import sql from '@/lib/db/pool'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  VendorReview,
  VendorReviewStatus,
  VendorReviewPack,
  ReviewType,
  ReviewItemDecision,
} from '@/types/review-pack'

// ─── Review code generation ────────────────────────────────────────────────

/**
 * Generate the next sequential review code for this org.
 * Pattern: REV-001, REV-002, ...
 */
export async function generateReviewCode(orgId: string): Promise<string> {
  const rows = await sql<{ review_code: string }[]>`
    SELECT review_code
    FROM vendor_reviews
    WHERE org_id = ${orgId}
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `

  let nextNum = 1
  if (rows.length > 0 && rows[0].review_code) {
    const match = rows[0].review_code.match(/REV-(\d+)/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }

  return `REV-${String(nextNum).padStart(3, '0')}`
}

// ─── Create vendor review ──────────────────────────────────────────────────

export async function createVendorReview(input: {
  orgId: string
  vendorId: string
  reviewType: ReviewType
  reviewerUserId?: string | null
  approverUserId?: string | null
  dueAt?: string | null
  createdByUserId?: string | null
  packIds: string[]
}): Promise<VendorReview> {
  const service = createServiceClient()

  // 1. Generate review code
  const reviewCode = await generateReviewCode(input.orgId)

  // 2. Insert the vendor_reviews row
  const { data: review, error: reviewErr } = await service
    .from('vendor_reviews')
    .insert({
      org_id: input.orgId,
      vendor_id: input.vendorId,
      review_code: reviewCode,
      review_type: input.reviewType,
      status: 'not_started' as VendorReviewStatus,
      reviewer_user_id: input.reviewerUserId ?? null,
      approver_user_id: input.approverUserId ?? null,
      due_at: input.dueAt ?? null,
      created_by_user_id: input.createdByUserId ?? null,
    })
    .select('*')
    .single()
  if (reviewErr) throw new Error(reviewErr.message)

  const vendorReview = review as unknown as VendorReview

  // 3. For each packId, create or link vendor_review_packs + items + evidence
  for (const packId of input.packIds) {
    // Check if an unlinked vendor_review_packs row already exists for this vendor+pack
    const { data: existingVrp } = await service
      .from('vendor_review_packs')
      .select('id')
      .eq('vendor_id', input.vendorId)
      .eq('review_pack_id', packId)
      .is('vendor_review_id', null)
      .is('deleted_at', null)
      .maybeSingle()

    let vrpId: string

    if (existingVrp) {
      // Link existing unlinked pack to this review
      const { error: linkErr } = await service
        .from('vendor_review_packs')
        .update({ vendor_review_id: vendorReview.id })
        .eq('id', (existingVrp as { id: string }).id)
      if (linkErr) throw new Error(linkErr.message)
      vrpId = (existingVrp as { id: string }).id
    } else {
      // Create a new vendor_review_pack linked to this review
      const { data: vrp, error: vrpErr } = await service
        .from('vendor_review_packs')
        .insert({
          org_id: input.orgId,
          vendor_id: input.vendorId,
          review_pack_id: packId,
          status: 'not_started',
          review_type: input.reviewType,
          vendor_review_id: vendorReview.id,
          reviewer_user_id: input.reviewerUserId ?? null,
          approver_user_id: input.approverUserId ?? null,
          due_at: input.dueAt ?? null,
        })
        .select('id')
        .single()
      if (vrpErr) throw new Error(vrpErr.message)
      vrpId = (vrp as { id: string }).id

      // Create vendor_review_items for each review_requirement in the pack
      const { data: reviewReqs } = await service
        .from('review_requirements')
        .select('id')
        .eq('review_pack_id', packId)
        .is('deleted_at', null)

      if (reviewReqs && reviewReqs.length > 0) {
        const items = (reviewReqs as { id: string }[]).map((req) => ({
          org_id: input.orgId,
          vendor_review_pack_id: vrpId,
          review_requirement_id: req.id,
          decision: 'not_started' as ReviewItemDecision,
        }))
        const { error: itemErr } = await service.from('vendor_review_items').insert(items)
        if (itemErr) throw new Error(itemErr.message)
      }

      // Create vendor_documents (evidence) for each evidence_requirement not yet existing
      const { data: evidenceReqs } = await service
        .from('evidence_requirements')
        .select('id')
        .eq('review_pack_id', packId)
        .is('deleted_at', null)

      if (evidenceReqs && evidenceReqs.length > 0) {
        for (const ereq of evidenceReqs as { id: string }[]) {
          const { data: existingDoc } = await service
            .from('vendor_documents')
            .select('id')
            .eq('vendor_id', input.vendorId)
            .eq('evidence_requirement_id', ereq.id)
            .maybeSingle()
          if (existingDoc) continue

          const { error: docErr } = await service.from('vendor_documents').insert({
            org_id: input.orgId,
            vendor_id: input.vendorId,
            evidence_requirement_id: ereq.id,
            evidence_status: 'missing',
          })
          if (docErr) throw new Error(docErr.message)
        }
      }
    }
  }

  return vendorReview
}

// ─── Query helpers ─────────────────────────────────────────────────────────

/**
 * Compute item counts for a set of vendor_review_pack IDs.
 * Returns a map of vrpId -> { total, passed, failed, not_started, na }.
 */
async function batchItemCounts(
  vrpIds: string[],
): Promise<Map<string, { total: number; passed: number; failed: number; not_started: number; na: number }>> {
  const countsByPack = new Map<string, { total: number; passed: number; failed: number; not_started: number; na: number }>()
  if (vrpIds.length === 0) return countsByPack

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

  return countsByPack
}

/**
 * Fetch packs for a set of review IDs, attach item counts, and return grouped by review ID.
 */
async function fetchPacksForReviews(
  reviewIds: string[],
): Promise<Map<string, VendorReviewPack[]>> {
  const result = new Map<string, VendorReviewPack[]>()
  if (reviewIds.length === 0) return result

  const packRows = await sql<(VendorReviewPack & { review_pack_name: string; review_pack_code: string | null })[]>`
    SELECT vrp.*, rp.name AS review_pack_name, rp.code AS review_pack_code
    FROM vendor_review_packs vrp
    JOIN review_packs rp ON rp.id = vrp.review_pack_id
    WHERE vrp.vendor_review_id = ANY(${reviewIds})
      AND vrp.deleted_at IS NULL
    ORDER BY vrp.assigned_at
  `

  const vrpIds = packRows.map((r) => r.id)
  const countsByPack = await batchItemCounts(vrpIds)

  for (const row of packRows) {
    const pack: VendorReviewPack = {
      ...(row as unknown as VendorReviewPack),
      review_pack_name: row.review_pack_name,
      review_pack_code: row.review_pack_code,
      item_counts: countsByPack.get(row.id) ?? { total: 0, passed: 0, failed: 0, not_started: 0, na: 0 },
    }
    const reviewId = row.vendor_review_id
    if (reviewId) {
      const list = result.get(reviewId) ?? []
      list.push(pack)
      result.set(reviewId, list)
    }
  }

  return result
}

/**
 * Compute review-level totals (total_items, completed_items, readiness_pct)
 * by summing across all non-excluded packs.
 */
function computeReviewTotals(packs: VendorReviewPack[]): { total_items: number; completed_items: number; readiness_pct: number } {
  let total = 0
  let completed = 0

  for (const pack of packs) {
    if (pack.is_excluded) continue
    const counts = pack.item_counts
    if (!counts) continue
    // applicable = total - na
    const applicable = counts.total - counts.na
    total += applicable
    completed += counts.passed
  }

  const readiness_pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return { total_items: total, completed_items: completed, readiness_pct }
}

// ─── Get vendor reviews ────────────────────────────────────────────────────

/** Fetch all reviews for a vendor with pack summaries. */
export async function getVendorReviews(vendorId: string): Promise<VendorReview[]> {
  const rows = await sql<VendorReview[]>`
    SELECT vr.*,
      ru.name AS reviewer_name,
      au.name AS approver_name
    FROM vendor_reviews vr
    LEFT JOIN users ru ON ru.id = vr.reviewer_user_id
    LEFT JOIN users au ON au.id = vr.approver_user_id
    WHERE vr.vendor_id = ${vendorId}
      AND vr.deleted_at IS NULL
    ORDER BY vr.created_at DESC
  `

  if (rows.length === 0) return []

  const reviewIds = rows.map((r) => r.id)
  const packsByReview = await fetchPacksForReviews(reviewIds)

  return rows.map((row) => {
    const packs = packsByReview.get(row.id) ?? []
    const totals = computeReviewTotals(packs)
    return {
      ...(row as unknown as VendorReview),
      packs,
      total_items: totals.total_items,
      completed_items: totals.completed_items,
      readiness_pct: totals.readiness_pct,
    }
  })
}

// ─── Get single vendor review ──────────────────────────────────────────────

/** Fetch a single review by ID with packs and item counts. */
export async function getVendorReview(reviewId: string): Promise<VendorReview | null> {
  const rows = await sql<VendorReview[]>`
    SELECT vr.*,
      ru.name AS reviewer_name,
      au.name AS approver_name
    FROM vendor_reviews vr
    LEFT JOIN users ru ON ru.id = vr.reviewer_user_id
    LEFT JOIN users au ON au.id = vr.approver_user_id
    WHERE vr.id = ${reviewId}
      AND vr.deleted_at IS NULL
    LIMIT 1
  `

  if (rows.length === 0) return null

  const review = rows[0] as unknown as VendorReview
  const packsByReview = await fetchPacksForReviews([review.id])
  const packs = packsByReview.get(review.id) ?? []
  const totals = computeReviewTotals(packs)

  return {
    ...review,
    packs,
    total_items: totals.total_items,
    completed_items: totals.completed_items,
    readiness_pct: totals.readiness_pct,
  }
}

// ─── Get org reviews ───────────────────────────────────────────────────────

/** Fetch all reviews across the org with vendor names. */
export async function getOrgReviews(orgId: string): Promise<VendorReview[]> {
  const rows = await sql<VendorReview[]>`
    SELECT vr.*,
      v.name AS vendor_name,
      ru.name AS reviewer_name
    FROM vendor_reviews vr
    JOIN vendors v ON v.id = vr.vendor_id
    LEFT JOIN users ru ON ru.id = vr.reviewer_user_id
    WHERE vr.org_id = ${orgId}
      AND vr.deleted_at IS NULL
    ORDER BY vr.created_at DESC
  `

  if (rows.length === 0) return []

  // Batch fetch pack counts per review
  const reviewIds = rows.map((r) => r.id)

  // Get pack counts and item counts in batch
  const packCountRows = await sql<{ vendor_review_id: string; pack_count: string }[]>`
    SELECT vendor_review_id, COUNT(*)::text AS pack_count
    FROM vendor_review_packs
    WHERE vendor_review_id = ANY(${reviewIds})
      AND deleted_at IS NULL
    GROUP BY vendor_review_id
  `
  const packCountMap = new Map(packCountRows.map((r) => [r.vendor_review_id, parseInt(r.pack_count, 10)]))

  // Also fetch packs for review-level totals
  const packsByReview = await fetchPacksForReviews(reviewIds)

  return rows.map((row) => {
    const packs = packsByReview.get(row.id) ?? []
    const totals = computeReviewTotals(packs)
    return {
      ...(row as unknown as VendorReview),
      packs,
      total_items: totals.total_items,
      completed_items: totals.completed_items,
      readiness_pct: totals.readiness_pct,
    }
  })
}

// ─── Update review status ──────────────────────────────────────────────────

/** Update review status and optional timestamp fields. */
export async function updateReviewStatus(
  reviewId: string,
  status: VendorReviewStatus,
  fields?: Partial<{
    started_at: string | null
    submitted_at: string | null
    completed_at: string | null
    locked_at: string | null
    locked_by_user_id: string | null
  }>,
): Promise<void> {
  const service = createServiceClient()

  const update: Record<string, unknown> = { status }
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      update[key] = value
    }
  }

  const { error } = await service
    .from('vendor_reviews')
    .update(update)
    .eq('id', reviewId)
  if (error) throw new Error(error.message)
}
