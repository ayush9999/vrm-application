'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { assignPackToVendor, removePackFromVendor } from '@/lib/db/vendor-pack-assignments'
import { logActivity } from '@/lib/db/activity-log'

/**
 * Add a pack to a vendor's permanent assignment list.
 * Does NOT create a review instance — just adds to the config.
 */
export async function assignPackToVendorAction(
  vendorId: string,
  reviewPackId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    await assignPackToVendor(user.orgId, vendorId, reviewPackId, user.userId)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_pack_assignment',
      entityId: vendorId,
      action: 'pack_assigned',
      title: 'Review pack assigned to vendor',
    })

    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to assign pack' }
  }
}

/**
 * Remove a pack from a vendor's permanent assignment list.
 * Does NOT delete existing review instances — just removes from future scheduling.
 */
export async function removePackFromVendorAction(
  vendorId: string,
  reviewPackId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    await removePackFromVendor(user.orgId, vendorId, reviewPackId)

    await logActivity({
      orgId: user.orgId,
      vendorId,
      actorUserId: user.userId,
      entityType: 'vendor_pack_assignment',
      entityId: vendorId,
      action: 'pack_removed',
      title: 'Review pack removed from vendor',
    })

    revalidatePath(`/vendors/${vendorId}`)
    return { success: true }
  } catch (err) {
    return { message: err instanceof Error ? err.message : 'Failed to remove pack' }
  }
}
