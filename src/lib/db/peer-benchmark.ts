import sql from '@/lib/db/pool'
import { getVendorListMetrics } from '@/lib/db/review-packs'
import type { VendorApprovalStatus } from '@/types/review-pack'

export interface PeerBenchmark {
  categoryName: string
  categoryAvgReadiness: number
  vendorCount: number  // how many peers in the same category (excluding this vendor)
}

/**
 * For a given vendor, compute the average readiness % of all OTHER
 * vendors in the same category within the same org.
 * Returns null if < 3 peers (not meaningful).
 */
export async function getPeerBenchmark(
  orgId: string,
  vendorId: string,
  categoryId: string | null,
): Promise<PeerBenchmark | null> {
  if (!categoryId) return null

  // Find all OTHER vendors in the same category
  type PeerRow = { id: string; approval_status: VendorApprovalStatus; category_name: string }
  const peers = await sql<PeerRow[]>`
    SELECT v.id, v.approval_status, vc.name AS category_name
    FROM vendors v
    INNER JOIN vendor_categories vc ON vc.id = v.category_id
    WHERE v.org_id = ${orgId}
      AND v.category_id = ${categoryId}
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
