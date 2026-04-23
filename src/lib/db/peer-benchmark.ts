import sql from '@/lib/db/pool'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import type { VendorApprovalStatus } from '@/types/review-pack'

export interface PeerBenchmark {
  categoryName: string
  categoryAvgReadiness: number
  vendorCount: number  // how many peers sharing any of this vendor's categories (excluding self)
}

/**
 * For a given vendor, compute the average readiness % of all OTHER
 * vendors sharing at least one category. Uses the first category's
 * name as the label for the benchmark card.
 * Returns null if < 3 peers (not meaningful).
 */
export async function getPeerBenchmark(
  orgId: string,
  vendorId: string,
  categoryIds: string[] | null,
): Promise<PeerBenchmark | null> {
  if (!categoryIds || categoryIds.length === 0) return null

  // Find all OTHER vendors whose category_ids overlap with the given list.
  // pick the first matching category's name as the display label.
  type PeerRow = { id: string; approval_status: VendorApprovalStatus; category_name: string }
  const peers = await sql<PeerRow[]>`
    SELECT v.id, v.approval_status,
      COALESCE(
        (SELECT vc.name
         FROM vendor_categories vc
         WHERE vc.id = ANY(v.category_ids)
           AND vc.id = ANY(${categoryIds})
         LIMIT 1),
        'Unknown'
      ) AS category_name
    FROM vendors v
    WHERE v.org_id = ${orgId}
      AND v.category_ids && ${categoryIds}::uuid[]
      AND v.id != ${vendorId}
      AND v.deleted_at IS NULL
      AND v.archived_at IS NULL
  `

  // Need at least 3 peers for a meaningful comparison
  if (peers.length < 3) return null

  const categoryName = peers[0]?.category_name ?? 'Unknown'

  // Compute readiness for all peers
  const metrics = await getVendorListMetrics(
    peers.map((p) => ({ id: p.id, approval_status: p.approval_status })),
  )

  let totalReadiness = 0
  let count = 0
  for (const p of peers) {
    const m = metrics.get(p.id)
    if (m) {
      totalReadiness += m.readinessPct
      count++
    }
  }

  if (count === 0) return null

  return {
    categoryName,
    categoryAvgReadiness: Math.round(totalReadiness / count),
    vendorCount: count,
  }
}
