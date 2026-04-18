'use server'

import { revalidatePath } from 'next/cache'
import { requireCurrentUser } from '@/lib/current-user'
import { assignPackToVendor, removePackFromVendor } from '@/lib/db/vendor-pack-assignments'
import { logActivity } from '@/lib/db/activity-log'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Add a pack to a vendor's permanent assignment list.
 * Also creates vendor_documents (evidence) rows for all evidence
 * requirements in the pack so the Evidence tab populates immediately.
 */
export async function assignPackToVendorAction(
  vendorId: string,
  reviewPackId: string,
): Promise<{ success?: boolean; message?: string }> {
  try {
    const user = await requireCurrentUser()
    await assignPackToVendor(user.orgId, vendorId, reviewPackId, user.userId)

    // Create evidence rows for this pack's requirements
    const supabase = await createServerClient()
    const { data: evidenceReqs } = await supabase
      .from('evidence_requirements')
      .select('id')
      .eq('review_pack_id', reviewPackId)
      .is('deleted_at', null)

    if (evidenceReqs && evidenceReqs.length > 0) {
      for (const ereq of evidenceReqs as { id: string }[]) {
        // Check if evidence row already exists for this vendor + requirement
        const { data: existing } = await supabase
          .from('vendor_documents')
          .select('id')
          .eq('vendor_id', vendorId)
          .eq('evidence_requirement_id', ereq.id)
          .maybeSingle()

        if (!existing) {
          await supabase.from('vendor_documents').insert({
            org_id: user.orgId,
            vendor_id: vendorId,
            evidence_requirement_id: ereq.id,
            evidence_status: 'missing',
          })
        }
      }
    }

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
 * Does NOT delete existing evidence or review instances —
 * just removes from future scheduling.
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
