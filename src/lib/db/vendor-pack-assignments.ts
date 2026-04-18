import sql from '@/lib/db/pool'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface VendorPackAssignment {
  id: string
  vendor_id: string
  review_pack_id: string
  pack_name: string
  pack_code: string | null
  assigned_at: string
  assigned_by_name: string | null
}

/** Get all active pack assignments for a vendor. */
export async function getVendorAssignedPacks(vendorId: string): Promise<VendorPackAssignment[]> {
  const rows = await sql`
    SELECT vpa.id, vpa.vendor_id, vpa.review_pack_id, vpa.assigned_at,
      rp.name AS pack_name, rp.code AS pack_code,
      u.name AS assigned_by_name
    FROM vendor_pack_assignments vpa
    INNER JOIN review_packs rp ON rp.id = vpa.review_pack_id
    LEFT JOIN users u ON u.id = vpa.assigned_by_user_id
    WHERE vpa.vendor_id = ${vendorId}
      AND vpa.removed_at IS NULL
    ORDER BY vpa.assigned_at
  `
  return rows as VendorPackAssignment[]
}

/** Get just the pack IDs assigned to a vendor (for auto-schedule). */
export async function getVendorAssignedPackIds(vendorId: string): Promise<string[]> {
  const rows = await sql<{ review_pack_id: string }[]>`
    SELECT review_pack_id
    FROM vendor_pack_assignments
    WHERE vendor_id = ${vendorId}
      AND removed_at IS NULL
  `
  return rows.map((r) => r.review_pack_id)
}

/** Assign a pack to a vendor (add to the permanent list). */
export async function assignPackToVendor(
  orgId: string,
  vendorId: string,
  reviewPackId: string,
  assignedByUserId: string,
): Promise<void> {
  const supabase = await createServerClient()
  // Upsert — if it was previously removed, re-activate it
  const { error } = await supabase
    .from('vendor_pack_assignments')
    .upsert(
      {
        org_id: orgId,
        vendor_id: vendorId,
        review_pack_id: reviewPackId,
        assigned_by_user_id: assignedByUserId,
        assigned_at: new Date().toISOString(),
        removed_at: null,
      },
      { onConflict: 'vendor_id,review_pack_id' },
    )
  if (error) throw new Error(error.message)
}

/** Remove a pack from a vendor's assignments (soft-remove). */
export async function removePackFromVendor(
  orgId: string,
  vendorId: string,
  reviewPackId: string,
): Promise<void> {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('vendor_pack_assignments')
    .update({ removed_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('review_pack_id', reviewPackId)
    .eq('org_id', orgId)
  if (error) throw new Error(error.message)
}

/**
 * Bulk-assign packs to a vendor (used by auto-apply on vendor creation).
 * Uses service client to bypass RLS during bootstrap.
 */
export async function bulkAssignPacksToVendor(
  orgId: string,
  vendorId: string,
  reviewPackIds: string[],
): Promise<void> {
  if (reviewPackIds.length === 0) return
  const service = createServiceClient()
  const rows = reviewPackIds.map((rpId) => ({
    org_id: orgId,
    vendor_id: vendorId,
    review_pack_id: rpId,
    assigned_at: new Date().toISOString(),
  }))
  // Use upsert to handle duplicates gracefully
  for (const row of rows) {
    await service
      .from('vendor_pack_assignments')
      .upsert(row, { onConflict: 'vendor_id,review_pack_id' })
  }
}
