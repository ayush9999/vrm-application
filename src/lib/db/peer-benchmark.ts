import { createServerClient } from '@/lib/supabase/server'
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

  const supabase = await createServerClient()

  // Find all OTHER vendors in the same category
  const { data, error } = await supabase
    .from('vendors')
    .select('id, approval_status, vendor_categories!inner ( name )')
    .eq('org_id', orgId)
    .eq('category_id', categoryId)
    .neq('id', vendorId)
    .is('deleted_at', null)
    .is('archived_at', null)
  if (error) throw new Error(error.message)

  type Row = { id: string; approval_status: VendorApprovalStatus; vendor_categories: { name: string } | { name: string }[] | null }
  const peers = (data ?? []) as unknown as Row[]

  // Need at least 3 peers for a meaningful comparison
  if (peers.length < 3) return null

  const categoryName = (() => {
    const raw = peers[0]?.vendor_categories
    const cat = Array.isArray(raw) ? raw[0] : raw
    return cat?.name ?? 'Unknown'
  })()

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
